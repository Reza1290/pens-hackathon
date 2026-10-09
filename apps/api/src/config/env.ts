import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

let root = resolve(process.cwd());
while (!existsSync(resolve(root, 'package.json')) || !JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).workspaces) {
  const parent = dirname(root);
  if (parent === root) throw new Error('Run from within the KasirNusa repository');
  root = parent;
}
export const projectRoot = root;
dotenv.config({ path: resolve(root, '.env'), quiet: true });
export const env = z.object({
  DATABASE_URL: z.string().url().default('postgresql://kasirnusa:local_dev_only@127.0.0.1:54329/kasirnusa'),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  DATA_ROOT: z.string().default('data/raw'),
  ALLOWED_DATASET_IDS: z.string().default(''),
  JEV_API_KEY: z.string().default(''),
  JEV_MODEL: z.string().default('jev-1.13.0'),
  LLM_API_KEY: z.string().default(''),
  LLM_PROVIDER:z.enum(['openai','gemini']).default('openai'),
  LLM_MODEL: z.string().default(''),
  MODEL_MAX_CALLS: z.coerce.number().int().min(0).max(1000).default(20),
  MODEL_TIMEOUT_MS: z.coerce.number().int().min(10).max(60000).default(15000),
  QA_LIVE_ENABLED:z.enum(['true','false']).default('false'),
  LLM_INPUT_USD_PER_MILLION: z.preprocess(v=>v===''?undefined:v,z.string().regex(/^\d+(\.\d+)?$/).optional()),
  LLM_OUTPUT_USD_PER_MILLION: z.preprocess(v=>v===''?undefined:v,z.string().regex(/^\d+(\.\d+)?$/).optional()),
}).parse(process.env);
export const allowedDatasets = new Set(env.ALLOWED_DATASET_IDS.split(',').filter(Boolean));
