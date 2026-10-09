import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  aiScanResponseSchema,
  type AiScanResponse,
  type AiCandidateOpportunity,
  type Evidence,
} from '@kasirnusa/contracts';
import type { Database } from '../../db/client.js';
import * as s from '../../db/schema/index.js';
import { stableId } from '../ingestion/service.js';
import { annualIncrement, contractTermsConsistent } from './rules.js';
import type { Interpreter } from '../../ai/router.js';
import type { Provider } from '../../ai/providers/interface.js';
import type { Context } from '../../ai/schemas/interpretation.js';

export async function deepScanOpportunities(
  db: Database,
  datasetId: string,
  options: {
    accountId?: string;
    runtime: Interpreter;
    jevProvider: Provider;
    extractorProvider?: Provider;
    maxScan?: number;
  }
): Promise<AiScanResponse> {
  z.uuid().parse(datasetId);
  if (options.accountId) z.uuid().parse(options.accountId);

  const [dataset] = await db.select().from(s.datasets).where(eq(s.datasets.id, datasetId));
  if (!dataset || dataset.status !== 'ready') throw new Error('Ready imported dataset required');

  const [accounts, contacts, employments, interactions, contracts, sources, existingSignals] = await Promise.all([
    db.select().from(s.accounts).where(eq(s.accounts.datasetId, datasetId)),
    db.select().from(s.contacts).where(eq(s.contacts.datasetId, datasetId)),
    db.select().from(s.employments).where(eq(s.employments.datasetId, datasetId)),
    db.select().from(s.interactions).where(eq(s.interactions.datasetId, datasetId)),
    db.select().from(s.contracts).where(eq(s.contracts.datasetId, datasetId)),
    db.select({ record: s.sourceRecords, file: s.sourceFiles })
      .from(s.sourceRecords)
      .innerJoin(s.sourceFiles, and(eq(s.sourceRecords.fileId, s.sourceFiles.id), eq(s.sourceRecords.datasetId, s.sourceFiles.datasetId)))
      .where(and(eq(s.sourceRecords.datasetId, datasetId), eq(s.sourceFiles.filename, 'interactions.jsonl'))),
    db.select({ accountId: s.signals.accountId, sourceId: s.signals.sourceId })
      .from(s.signals)
      .where(eq(s.signals.datasetId, datasetId)),
  ]);

  const capturedSourceIds = new Set(existingSignals.map(sig => sig.sourceId));
  const candidateAccounts = accounts.filter(a => a.type === 'customer' && (!options.accountId || a.id === options.accountId));

  type ScanCandidate = {
    account: typeof accounts[number];
    contact: typeof contacts[number];
    message: typeof interactions[number];
    sourceRow: typeof sources[number];
  };

  const eligibleCandidates: ScanCandidate[] = [];

  for (const account of candidateAccounts) {
    const accountMessages = interactions
      .filter(m => m.accountId === account.id && m.eventDate <= dataset.asOf)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

    for (const message of accountMessages) {
      const sourceRow = sources.find(r => r.record.externalId === message.externalId);
      if (!sourceRow || capturedSourceIds.has(sourceRow.record.id)) continue;

      // Contact and employment validation (same criteria as deterministic engine)
      const candidateContacts = contacts.filter(
        c => c.accountId === account.id && c.email.toLowerCase() === message.sender.toLowerCase()
      );
      if (candidateContacts.length !== 1) continue;
      const contact = candidateContacts[0];

      const activeJobs = employments.filter(
        e => e.contactId === contact.id && e.accountId === account.id && e.start <= message.eventDate && (!e.end || e.end >= message.eventDate)
      );
      if (activeJobs.length !== 1 || (activeJobs[0].end && activeJobs[0].end < dataset.asOf)) continue;

      // Only candidate messages mentioning operational, commercial or scale terms
      if (/(?:buka|tambah|deploy|kasir|outlet|cabang|pos|lisensi|titik|ekspansi|kuotasi|penawaran|quotation|hardware|gerai|store)/i.test(message.body)) {
        eligibleCandidates.push({ account, contact, message, sourceRow });
      }
    }
  }

  const bounded = eligibleCandidates.slice(0, options.maxScan ?? 10);
  const candidates: AiCandidateOpportunity[] = [];

  for (const item of bounded) {
    const { account, contact, message, sourceRow } = item;

    const context: Context = {
      datasetId,
      accountId: account.id,
      asOf: dataset.asOf,
      sources: [{
        id: sourceRow.record.id,
        field: 'isi',
        text: message.body.slice(0, 12000),
        eventDate: message.eventDate,
        speakerId: contact.id,
        hash: sourceRow.record.contentHash,
      }],
      candidates: [{ id: contact.id, role: 'contact', start: message.eventDate, end: null }],
      subjectId: null,
      claim: 'expansion-intent-check',
    };

    // Step A: Jev Intent Classification
    const intentOutcome = await options.runtime.run(context, 'intent', options.jevProvider);
    if (intentOutcome.status !== 'succeeded' || !intentOutcome.value) continue;

    const intentVal = intentOutcome.value as { choice: string; confidence: number };
    if (!['quotation_request', 'explicit_plan'].includes(intentVal.choice)) continue;

    // Step B: Unit & Entity Extraction
    // Determine unit
    let unit: 'outlet' | 'terminal' | 'license' | 'other' = 'other';
    let quantity: number | null = null;

    const outletMatch = message.body.match(/\b(\d+)\s*(?:outlet|cabang|gerai|stores?|branches?|toko|titik)\b/i);
    const terminalMatch = message.body.match(/\b(\d+)\s*(?:kasir|terminal|pos|mesin|tablet|device)\b/i);
    const licenseMatch = message.body.match(/\b(\d+)\s*(?:lisensi|license|akun|user)\b/i);
    const genericNumberMatch = message.body.match(/\b(\d+)\b/);

    if (outletMatch) {
      unit = 'outlet';
      quantity = Number(outletMatch[1]);
    } else if (terminalMatch) {
      unit = 'terminal';
      quantity = Number(terminalMatch[1]);
    } else if (licenseMatch) {
      unit = 'license';
      quantity = Number(licenseMatch[1]);
    } else if (genericNumberMatch) {
      quantity = Number(genericNumberMatch[1]);
    }

    // Determine location and period
    const locationMatch = message.body.match(/\bdi\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)/);
    const location = locationMatch ? locationMatch[1] : null;

    const quarterMatch = message.body.match(/(?:kuartal\s*([1-4])|Q([1-4]))\s*(20\d{2})/i);
    const earlyMatch = message.body.match(/\b(awal|early)\s*(20\d{2})/i);
    const targetPeriod = quarterMatch ? `${quarterMatch[3]}-Q${quarterMatch[1] || quarterMatch[2]}` : earlyMatch ? `${earlyMatch[2]}-early` : null;

    // Step C: Strict Commercial Guardrail (Only outlet units qualify for revenue calculation)
    let valueScenario = null;
    const limitations: string[] = [
      'AI-discovered candidate; requires human review before CRM admission.',
      'Fallible model interpretation; zero arithmetic hallucination enforced.',
    ];

    if (unit === 'outlet' && quantity && quantity > 0) {
      const scopedContracts = contracts.filter(
        c => c.accountId === account.id && c.start <= message.eventDate && c.start <= dataset.asOf && c.renewal > dataset.asOf
      );
      if (scopedContracts.length === 1) {
        const contract = scopedContracts[0];
        const consistent = contractTermsConsistent(contract.outlets, contract.monthlyRate, contract.discountPercent, contract.annualValue);
        const exceeds = !contract.unlimited && contract.outlets + quantity > (contract.outletLimit ?? 0);

        if (consistent && !exceeds) {
          valueScenario = {
            amount: annualIncrement(quantity, contract.monthlyRate, contract.discountPercent),
            currency: 'IDR' as const,
            basis: 'annual_increment' as const,
            formula: 'additional_outlets × monthly_rate × 12 × (1 − discount_percent / 100)',
            inputs: {
              additional_outlets: quantity,
              monthly_rate: contract.monthlyRate,
              discount_percent: contract.discountPercent,
            },
            assumptions: [
              'Current rate and discount are assumed to apply; confirm terms before quoting.',
              'Conditional annualized increment from AI-detected candidate.',
            ],
            evidence_ids: [sourceRow.record.id],
          };
        }
      }
    } else if (unit !== 'outlet') {
      limitations.push(`Detected unit '${unit}' is not a new outlet; financial value is not calculated.`);
    }

    const evidenceItem: Evidence = {
      source_id: sourceRow.record.id,
      source_external_id: message.externalId,
      filename: sourceRow.file.filename,
      locator: sourceRow.record.locator,
      field: 'isi',
      passage: message.body,
    };

    candidates.push({
      id: stableId(datasetId, 'ai_candidate', message.externalId),
      account_id: account.id,
      account_external_id: account.externalId,
      account_name: account.name,
      signal: {
        kind: intentVal.choice as 'quotation_request' | 'explicit_plan',
        quantity,
        unit,
        location,
        target_period: targetPeriod,
        raw_quote: message.body.slice(0, 300),
      },
      intent_assessment: {
        choice: intentVal.choice,
        confidence: intentVal.confidence,
        model: options.jevProvider.model,
      },
      source: evidenceItem,
      value_scenario: valueScenario,
      review_status: 'candidate_requiring_human_review',
      limitations,
    });
  }

  return aiScanResponseSchema.parse({
    dataset_id: datasetId,
    as_of: dataset.asOf,
    account_id: options.accountId ?? null,
    messages_scanned: bounded.length,
    candidates_found: candidates.length,
    candidates,
    model_calls: options.runtime.calls,
    cache_hits: options.runtime.cacheHits,
  });
}
