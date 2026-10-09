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

export const stakeholderStatementSchema=z.object({
  id:uuidSchema,person_id:uuidSchema,predicate:z.enum(['APPROVER_FOR','EVALUATES_TECHNICAL_FOR','INTERMEDIARY_FOR','REQUESTS_EVIDENCE','RAISES_CONCERN']),
  text:z.string(),event_date:dateSchema,speaker_id:uuidSchema.nullable(),attribution:z.enum(['direct','reported']),
  scope_id:uuidSchema,scope_type:z.literal('interaction'),method:z.string(),verification:z.literal('unreviewed_rules_candidate'),
  current:z.boolean(),polarity:z.enum(['affirmed','denied']),evidence_ids:z.array(uuidSchema).min(1),
});
export type StakeholderStatement=z.infer<typeof stakeholderStatementSchema>;
export const stakeholderSchema=z.object({
  person:personSchema,current:z.boolean(),employments:z.array(z.object({role:z.string(),start:dateSchema,end:dateSchema.nullable(),evidence_ids:z.array(uuidSchema)})),
  authority:z.enum(['supported_scoped','reported_scoped','unknown','conflicting_or_outdated']),
  statements:z.array(stakeholderStatementSchema),unknowns:z.array(z.string()),
});
export const premiseSchema=z.object({
  metric:z.enum(['ambiguous_repeat_orders','repeat_expansion','renewal','revenue','closed_expansion_deal_proxy']),
  status:z.enum(['supported','not_supported','insufficient_data']),
  periods:z.object({previous_start:dateSchema,previous_end:dateSchema,current_start:dateSchema,current_end:dateSchema}).nullable(),
  coverage:z.string(),qualifying_events:z.string(),calculation:z.object({previous:z.number(),current:z.number(),change:z.number()}).nullable(),
  evidence_ids:z.array(uuidSchema),limitations:z.array(z.string()),clarification:z.string().nullable(),
});
export const actionPlanSchema=z.object({
  route:z.enum(['joint_decision_maker_discussion','prepare_through_intermediary','resolve_prerequisite_first','clarify_authority_or_requirement']),
  owner_id:uuidSchema,recipient_ids:z.array(uuidSchema),supporting_owner_ids:z.array(uuidSchema),review_status:z.literal('proposed'),
  task:z.string(),rationale:z.string(),discussion_points:z.array(z.object({audience_ids:z.array(uuidSchema),text:z.string(),evidence_ids:z.array(uuidSchema).min(1)})),unknowns:z.array(z.string()),
});
export const diagnosisSchema=z.object({
  id:uuidSchema,dataset_id:uuidSchema,dataset_version:z.string(),as_of:dateSchema,account_id:uuidSchema,
  account:accountSchema,signal_id:uuidSchema.nullable(),deal_id:uuidSchema.nullable(),
  commercial_context:z.enum(['expansion','renewal','new_sale','unknown']),
  owner:personSchema,findings:z.array(findingSchema),stakeholder_context:z.array(stakeholderSchema),
  action_plan:actionPlanSchema,premise_check:premiseSchema.nullable(),value_scenario:cardSchema.shape.value_scenario,
  internal_decisions:z.array(z.object({id:uuidSchema,external_id:z.string(),date:dateSchema,requester_id:uuidSchema,approver_id:uuidSchema,outcome:z.string(),rationale:z.string(),commitment_status:z.string().nullable(),evidence_ids:z.array(uuidSchema)})),
  evidence:z.array(evidenceSchema),unknowns:z.array(z.string()),limitations:z.array(z.string()),method:z.string(),
  dependencies:z.object({opportunity_hash:z.string()}),
});
export type AccountDiagnosis=z.infer<typeof diagnosisSchema>;
