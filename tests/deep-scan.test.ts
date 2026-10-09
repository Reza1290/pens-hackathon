import { randomUUID } from 'node:crypto';
import { resolve, basename } from 'node:path';
import { rm, realpath } from 'node:fs/promises';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { env, projectRoot } from '../apps/api/src/config/env.js';
import * as s from '../apps/api/src/db/schema/index.js';
import { importDataset, stableId } from '../apps/api/src/modules/ingestion/service.js';
import { analyzeDataset } from '../apps/api/src/modules/opportunities/service.js';
import { inside } from '../apps/api/src/modules/ingestion/manifest.js';
import { createApp } from '../apps/api/src/app.js';
import { fixture } from './fixtures/snapshot.js';
import { Interpreter } from '../apps/api/src/ai/router.js';
import { choices } from '../apps/api/src/ai/schemas/interpretation.js';
import type { Provider } from '../apps/api/src/ai/providers/interface.js';
import { aiScanResponseSchema } from '@kasirnusa/contracts';

const adminUrl = new URL(env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(adminUrl.hostname)) throw new Error('DB tests require local PostgreSQL');
const name = `kasirnusa_test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: adminUrl.href });
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${name}`;
const pool = new pg.Pool({ connectionString: testUrl.href });
const db = drizzle(pool, { schema: s });
let created = false;
const paths: string[] = [];
const make = async (options: Parameters<typeof fixture>[0] = {}) => {
  const f = await fixture(options);
  paths.push(f.path);
  return f;
};

beforeAll(async () => {
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await migrate(db, { migrationsFolder: resolve(projectRoot, 'apps/api/src/db/migrations') });
});

afterAll(async () => {
  await pool.end();
  if (created && /^kasirnusa_test_[a-f0-9]{32}$/.test(name)) await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
  const root = await realpath(resolve(projectRoot, env.DATA_ROOT));
  for (const path of paths) {
    const target = inside(root, await realpath(path));
    if (!basename(target).startsWith('phase1-test-')) throw new Error('Unsafe fixture cleanup');
    await rm(target, { recursive: true });
  }
});

describe('on-demand AI deep scan for expansion opportunities', () => {
  it('discovers opportunities missed by regex and enforces unit guardrails on financial values', async () => {
    const f = await make({
      messages: [
        // Missed by regex because unit is "kasir" (terminal), not "outlet"
        {
          id: 'I10',
          body: 'Bulan depan kami mau deploy 5 kasir baru di Malang.',
          sender: 'buyer@example.test',
          date: '2026-08-01',
        },
        // Missed by regex because unit is "toko" and phrasing is informal
        {
          id: 'I11',
          body: 'Kami berencana buka 4 toko di Semarang pada Q3 2027.',
          sender: 'buyer@example.test',
          date: '2026-08-02',
        },
        // Regular payment confirmation - not an expansion
        {
          id: 'I12',
          body: 'Pembayaran invoice bulan ini sudah ditransfer.',
          sender: 'buyer@example.test',
          date: '2026-08-03',
        },
      ],
    });

    const imported = await importDataset(db, f.manifest);
    await analyzeDataset(db, imported.dataset_id, '2026-09-01');

    const makeProbs = (favored: string, score = 0.93) => {
      const rem = (1 - score) / (choices.intent.length - 1);
      return Object.fromEntries(choices.intent.map(c => [c, c === favored ? score : rem]));
    };

    const simulatedJev: Provider = {
      name: 'typesafe',
      model: 'jev-1.13.0',
      configured: true,
      async invoke(_op, context) {
        const text = context.sources[0].text;
        if (/kasir baru/i.test(text)) {
          return {
            model: this.model,
            value: {
              type: 'choice',
              choice: 'explicit_plan',
              confidence: 0.92,
              probabilities: makeProbs('explicit_plan', 0.92),
            },
            inputTokens: 15,
            outputTokens: 2,
          };
        }
        if (/4 toko/i.test(text)) {
          return {
            model: this.model,
            value: {
              type: 'choice',
              choice: 'explicit_plan',
              confidence: 0.95,
              probabilities: makeProbs('explicit_plan', 0.95),
            },
            inputTokens: 15,
            outputTokens: 2,
          };
        }
        return {
          model: this.model,
          value: {
            type: 'choice',
            choice: 'none',
            confidence: 0.99,
            probabilities: makeProbs('none', 0.99),
          },
          inputTokens: 10,
          outputTokens: 2,
        };
      },
    };

    const runtime = new Interpreter(db, { live: true, maxCalls: 10, timeoutMs: 500 });
    const app = createApp(db, new Set([imported.dataset_id]), {
      runtime,
      provider: simulatedJev,
      analysis: { runtime, jev: simulatedJev },
    });

    // Call POST /api/opportunities/scan
    const response = await request(app)
      .post('/api/opportunities/scan')
      .send({ dataset_id: imported.dataset_id });

    expect(response.status).toBe(200);
    const parsed = aiScanResponseSchema.parse(response.body);

    expect(parsed.candidates_found).toBe(2);
    expect(parsed.candidates).toHaveLength(2);

    // 1. Verify terminal unit guardrail
    const terminalCandidate = parsed.candidates.find(c => c.signal.unit === 'terminal');
    expect(terminalCandidate).toBeDefined();
    expect(terminalCandidate!.signal.quantity).toBe(5);
    expect(terminalCandidate!.value_scenario).toBeNull(); // Must NOT calculate outlet revenue for terminals!
    expect(terminalCandidate!.limitations.some(l => l.includes('not a new outlet'))).toBe(true);
    expect(terminalCandidate!.review_status).toBe('candidate_requiring_human_review');

    // 2. Verify outlet unit
    const outletCandidate = parsed.candidates.find(c => c.signal.unit === 'outlet');
    expect(outletCandidate).toBeDefined();
    expect(outletCandidate!.signal.quantity).toBe(4);
    expect(outletCandidate!.signal.location).toBe('Semarang');
    expect(outletCandidate!.signal.target_period).toBe('2027-Q3');

    // 3. Verify repeated scan utilizes cache
    const initialCalls = runtime.calls;
    const repeatResponse = await request(app)
      .post('/api/opportunities/scan')
      .send({ dataset_id: imported.dataset_id });

    expect(repeatResponse.status).toBe(200);
    expect(runtime.calls).toBe(initialCalls); // 0 additional model calls due to cache!
    expect(repeatResponse.body.cache_hits).toBeGreaterThan(0);
  });
});
