import { z } from 'zod';
export const uuidSchema = z.uuid();
export const dateSchema = z.iso.date();
export const decimalSchema = z.string().regex(/^\d+(\.\d+)?$/);
export const evidenceSchema = z.object({ source_id: uuidSchema, source_external_id: z.string().nullable(), filename: z.string(), locator: z.number().int(), field: z.string(), passage: z.string() });
export const findingSchema = z.object({ type: z.string(), label: z.string(), check: z.record(z.string(), z.unknown()).optional(), evidence_ids: z.array(uuidSchema) });
export const personSchema = z.object({ id: uuidSchema, external_id: z.string(), name: z.string(), role: z.string(), evidence_ids: z.array(uuidSchema) });
export const cardSchema = z.object({
  id: uuidSchema, dataset_id: uuidSchema, dataset_version: z.string(), as_of: dateSchema, commercial_context: z.literal('expansion'),
  account: z.object({ id: uuidSchema, external_id: z.string(), name: z.string() }),
  signal: z.object({ kind: z.enum(['quotation_request','explicit_plan']), status: z.enum(['active','cancelled','unclear']), date: dateSchema, additional_outlets: z.number().int().positive().nullable(), location: z.string().nullable(), target_period: z.string().nullable(), requested_actions:z.array(z.enum(['quotation','implementation_schedule'])), interpretation: z.literal('rules_candidate') }),
  reconciliation: z.object({ status: z.enum(['matched','unmatched','ambiguous','insufficient_coverage']), candidate_ids: z.array(uuidSchema), check: z.record(z.string(), z.unknown()) }),
  findings: z.array(findingSchema), people: z.object({ owner: personSchema, contact: personSchema.nullable() }),
  stakeholder_context: z.array(z.object({ person_id: uuidSchema, role: z.string(), valid_at_request: z.boolean(), authority: z.literal('unknown'), knowledge: z.string(), expressed_requirements: z.array(z.string()), source_date: dateSchema, attribution: z.literal('direct'), evidence_ids: z.array(uuidSchema) })),
  next_action: z.object({ route: z.enum(['clarify_authority_or_requirement','resolve_prerequisite_first','follow_up_recorded_deal']), owner_id: uuidSchema, recipient_ids: z.array(uuidSchema), task: z.string(), review_status: z.literal('proposed'), discussion_points: z.array(z.object({ text: z.string(), evidence_ids: z.array(uuidSchema) })) }),
  value_scenario: z.object({ amount: decimalSchema, currency: z.literal('IDR'), basis: z.literal('annual_increment'), formula: z.string(), inputs: z.object({ additional_outlets: z.number().int(), monthly_rate: decimalSchema, discount_percent: decimalSchema }), assumptions: z.array(z.string()), evidence_ids: z.array(uuidSchema) }).nullable(),
  elapsed_days: z.number().int().nonnegative(), evidence: z.array(evidenceSchema), unknowns: z.array(z.string()), limitations: z.array(z.string()),
});
export type OpportunityCard = z.infer<typeof cardSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export const paginationSchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), page_size: z.coerce.number().int().min(1).max(100).default(20) });
export const datasetSchema = z.object({ id: uuidSchema, version: z.string(), asOf: dateSchema, status: z.string(), coverage: z.unknown() });
export const accountSchema = z.object({ id: uuidSchema, externalId: z.string(), name: z.string(), type: z.string() });
export const healthSchema = z.object({ process: z.literal('ready'), database: z.enum(['ready','unavailable']), schema: z.enum(['ready','unavailable']) });
export const graphSchema = z.object({ nodes:z.array(z.object({id:uuidSchema,kind:z.string(),label:z.string()})), edges:z.array(z.object({id:uuidSchema,from:uuidSchema,to:uuidSchema,relation:z.string(),evidence_ids:z.array(uuidSchema)})), evidence:z.array(evidenceSchema), limits:z.object({max_hops:z.number(),max_nodes:z.number(),truncated:z.boolean()}) });
export const sourceSchema = z.object({ id:uuidSchema,dataset_id:uuidSchema,as_of:dateSchema,filename:z.string(),locator:z.number().int(),external_id:z.string().nullable(),payload:z.record(z.string(),z.string()),raw_text:z.string(),content_hash:z.string() });
