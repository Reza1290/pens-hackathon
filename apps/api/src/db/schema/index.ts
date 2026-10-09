import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, integer, numeric, boolean, date, timestamp, jsonb, unique, foreignKey, check, index, type AnyPgColumn } from 'drizzle-orm/pg-core';

export const datasets = pgTable('datasets', {
  id: uuid().primaryKey(), version: text().notNull(), manifestHash: text('manifest_hash').notNull().unique(),
  mappingVersion: text('mapping_version').notNull(), asOf: date('as_of').notNull(),
  status: text().notNull(), coverage: jsonb().notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [check('dataset_status', sql`${t.status} in ('staging','incomplete','ready')`)]);
export const sourceFiles = pgTable('source_files', {
  id: uuid().primaryKey(), datasetId: uuid('dataset_id').notNull().references(() => datasets.id),
  filename: text().notNull(), sha256: text().notNull(), relativePath: text('relative_path').notNull(),
  recordCount: integer('record_count').notNull(),
}, t => [unique().on(t.datasetId, t.id), unique().on(t.datasetId, t.filename)]);
export const sourceRecords = pgTable('source_records', {
  id: uuid().primaryKey(), datasetId: uuid('dataset_id').notNull(), fileId: uuid('file_id').notNull(),
  locator: integer().notNull(), externalId: text('external_id'), accountExternalId: text('account_external_id'),
  payload: jsonb().notNull().$type<Record<string, string>>(), rawText: text('raw_text').notNull(),
  contentHash: text('content_hash').notNull(), searchText: text('search_text').notNull(),
}, t => [unique().on(t.datasetId, t.id), unique().on(t.fileId, t.locator),
foreignKey({ columns: [t.datasetId, t.fileId], foreignColumns: [sourceFiles.datasetId, sourceFiles.id] }),
index('source_account_idx').on(t.datasetId, t.accountExternalId)]);
export const ingestionErrors = pgTable('ingestion_errors', {
  id: uuid().primaryKey(), datasetId: uuid('dataset_id').notNull().references(() => datasets.id),
  fileId: uuid('file_id'), locator: integer(), code: text().notNull(), field: text(), disposition: text().notNull(),
}, t => [foreignKey({ columns: [t.datasetId, t.fileId], foreignColumns: [sourceFiles.datasetId, sourceFiles.id] })]);
export const entities = pgTable('entities', {
  id: uuid().primaryKey(), datasetId: uuid('dataset_id').notNull().references(() => datasets.id),
  kind: text().notNull(), externalId: text('external_id').notNull(),
}, t => [unique().on(t.datasetId, t.id), unique().on(t.datasetId, t.id, t.kind), unique().on(t.datasetId, t.kind, t.externalId)]);
const identity = (kind: string) => ({
  id: uuid().primaryKey(), datasetId: uuid('dataset_id').notNull(),
  externalId: text('external_id').notNull(), entityKind: text('entity_kind').notNull().default(kind)
});
type Identity = { id: AnyPgColumn; datasetId: AnyPgColumn; externalId: AnyPgColumn; entityKind: AnyPgColumn };
const identityConstraints = (t: Identity, kind: string) => [unique().on(t.datasetId, t.id), unique().on(t.datasetId, t.externalId),
  check(`${kind}_kind`, sql`${t.entityKind} = ${sql.raw("'" + kind + "'")}`),
foreignKey({ columns: [t.datasetId, t.id, t.entityKind], foreignColumns: [entities.datasetId, entities.id, entities.kind] })];
export const entitySources = pgTable('entity_sources', {
  datasetId: uuid('dataset_id').notNull(), entityId: uuid('entity_id').notNull(), sourceId: uuid('source_id').notNull(),
}, t => [unique().on(t.entityId, t.sourceId),
foreignKey({ columns: [t.datasetId, t.entityId], foreignColumns: [entities.datasetId, entities.id] }),
foreignKey({ columns: [t.datasetId, t.sourceId], foreignColumns: [sourceRecords.datasetId, sourceRecords.id] })]);
export const employees = pgTable('employees', { ...identity('employee'), name: text().notNull(), title: text().notNull(), email: text().notNull() }, t => identityConstraints(t, 'employee'));
export const accounts = pgTable('accounts', {
  ...identity('account'), name: text().notNull(), type: text().notNull(),
  ownerId: uuid('owner_id').notNull(), championExternalId: text('champion_external_id'), package: text(), outletCount: integer('outlet_count')
},
  t => [...identityConstraints(t, 'account'), foreignKey({ columns: [t.datasetId, t.ownerId], foreignColumns: [employees.datasetId, employees.id] }), check('account_type', sql`${t.type} in ('customer','prospect')`)]);
export const contacts = pgTable('contacts', {
  ...identity('contact'), name: text().notNull(), email: text().notNull(),
  accountId: uuid('account_id').notNull(), title: text().notNull()
}, t => [...identityConstraints(t, 'contact'),
foreignKey({ columns: [t.datasetId, t.accountId], foreignColumns: [accounts.datasetId, accounts.id] })]);
export const organizations = pgTable('organizations', { ...identity('organization'), name: text().notNull(), accountId: uuid('account_id') }, t => [...identityConstraints(t, 'organization'),
foreignKey({ columns: [t.datasetId, t.accountId], foreignColumns: [accounts.datasetId, accounts.id] })]);
export const employments = pgTable('contact_employments', {
  ...identity('employment'), contactId: uuid('contact_id').notNull(), organizationId: uuid('organization_id').notNull(),
  accountId: uuid('account_id'), role: text().notNull(), start: date('start_date').notNull(), end: date('end_date')
}, t => [...identityConstraints(t, 'employment'),
foreignKey({ columns: [t.datasetId, t.contactId], foreignColumns: [contacts.datasetId, contacts.id] }),
foreignKey({ columns: [t.datasetId, t.organizationId], foreignColumns: [organizations.datasetId, organizations.id] }),
foreignKey({ columns: [t.datasetId, t.accountId], foreignColumns: [accounts.datasetId, accounts.id] }), check('employment_interval', sql`${t.end} is null or ${t.end} >= ${t.start}`)]);
export const contracts = pgTable('contracts', {
  ...identity('contract'), accountId: uuid('account_id').notNull(), package: text().notNull(),
  outlets: integer().notNull(), outletLimit: integer('outlet_limit'), unlimited: boolean().notNull(), start: date('start_date').notNull(), renewal: date('renewal_date').notNull(),
  monthlyRate: numeric('monthly_rate', { precision: 20, scale: 2 }).notNull(), discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).notNull(),
  annualValue: numeric('annual_value', { precision: 20, scale: 2 }).notNull(), currency: text().notNull().default('IDR'), decisionExternalId: text('decision_external_id')
}, t => [...identityConstraints(t, 'contract'),
foreignKey({ columns: [t.datasetId, t.accountId], foreignColumns: [accounts.datasetId, accounts.id] }),
check('contract_numbers', sql`${t.outlets} >= 0 and ${t.monthlyRate} >= 0 and ${t.discountPercent} between 0 and 100`),
check('contract_limit', sql`(${t.unlimited} and ${t.outletLimit} is null) or (not ${t.unlimited} and ${t.outletLimit} >= 0)`)]);
export const deals = pgTable('deals', {
  ...identity('deal'), accountId: uuid('account_id').notNull(), ownerId: uuid('owner_id').notNull(),
  type: text().notNull(), stage: text().notNull(), stageSince: date('stage_since').notNull(), created: date('created_date').notNull(),
  outlets: integer(), annualValue: numeric('annual_value', { precision: 20, scale: 2 }), status: text().notNull()
}, t => [...identityConstraints(t, 'deal'),
foreignKey({ columns: [t.datasetId, t.accountId], foreignColumns: [accounts.datasetId, accounts.id] }),
foreignKey({ columns: [t.datasetId, t.ownerId], foreignColumns: [employees.datasetId, employees.id] }), index('deal_account_idx').on(t.datasetId, t.accountId)]);
export const interactions = pgTable('interactions', {
  ...identity('interaction'), accountId: uuid('account_id'), eventDate: date('event_date').notNull(), type: text().notNull(),
  sender: text().notNull(), recipients: text().notNull(), subject: text().notNull(), body: text().notNull(), parentId: uuid('parent_id')
}, t => [...identityConstraints(t, 'interaction'),
foreignKey({ columns: [t.datasetId, t.accountId], foreignColumns: [accounts.datasetId, accounts.id] }),
foreignKey({ columns: [t.datasetId, t.parentId], foreignColumns: [t.datasetId, t.id] }), index('interaction_account_date_idx').on(t.datasetId, t.accountId, t.eventDate)]);
export const participants = pgTable('interaction_participants', { datasetId: uuid('dataset_id').notNull(), interactionId: uuid('interaction_id').notNull(), personId: uuid('person_id').notNull(), role: text().notNull() }, t => [unique().on(t.interactionId, t.personId, t.role),
foreignKey({ columns: [t.datasetId, t.interactionId], foreignColumns: [interactions.datasetId, interactions.id] }),
foreignKey({ columns: [t.datasetId, t.personId], foreignColumns: [entities.datasetId, entities.id] })]);
export const analysisRuns = pgTable('analysis_runs', {
  id: uuid().primaryKey(), datasetId: uuid('dataset_id').notNull().references(() => datasets.id), asOf: date('as_of').notNull(),
  ruleVersion: text('rule_version').notNull(), status: text().notNull(), startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull()
}, t => [unique().on(t.datasetId, t.id)]);
export const signals = pgTable('expansion_signals', {
  ...identity('signal'), accountId: uuid('account_id').notNull(), requestDate: date('request_date').notNull(),
  quantity: integer(), location: text(), targetPeriod: text('target_period'), kind: text().notNull(), status: text().notNull(), dedupKey: text('dedup_key').notNull(),
  runId: uuid('run_id').notNull(), sourceId: uuid('source_id').notNull()
}, t => [...identityConstraints(t, 'signal'), unique().on(t.datasetId, t.dedupKey),
foreignKey({ columns: [t.datasetId, t.accountId], foreignColumns: [accounts.datasetId, accounts.id] }),
foreignKey({ columns: [t.datasetId, t.runId], foreignColumns: [analysisRuns.datasetId, analysisRuns.id] }),
foreignKey({ columns: [t.datasetId, t.sourceId], foreignColumns: [sourceRecords.datasetId, sourceRecords.id] })]);
export const signalMatches = pgTable('signal_deal_matches', {
  id: uuid().primaryKey(), datasetId: uuid('dataset_id').notNull(), signalId: uuid('signal_id').notNull(),
  dealId: uuid('deal_id').notNull(), runId: uuid('run_id').notNull(), status: text().notNull(), reason: text().notNull()
}, t => [
  foreignKey({ columns: [t.datasetId, t.signalId], foreignColumns: [signals.datasetId, signals.id] }),
  foreignKey({ columns: [t.datasetId, t.dealId], foreignColumns: [deals.datasetId, deals.id] }),
  foreignKey({ columns: [t.datasetId, t.runId], foreignColumns: [analysisRuns.datasetId, analysisRuns.id] })]);
export const assertions = pgTable('assertions', {
  id: uuid().primaryKey(), datasetId: uuid('dataset_id').notNull(), subjectId: uuid('subject_id').notNull(),
  predicate: text().notNull(), objectId: uuid('object_id'), literal: jsonb(), accountId: uuid('account_id').notNull(),
  eventDate: date('event_date').notNull(), speakerId: uuid('speaker_id'), attribution: text().notNull(), method: text().notNull(), verification: text().notNull(), runId: uuid('run_id').notNull()
}, t => [unique().on(t.datasetId, t.id),
check('assertion_one_target', sql`(${t.objectId} is null) <> (${t.literal} is null)`),
foreignKey({ columns: [t.datasetId, t.subjectId], foreignColumns: [entities.datasetId, entities.id] }),
foreignKey({ columns: [t.datasetId, t.objectId], foreignColumns: [entities.datasetId, entities.id] }),
foreignKey({ columns: [t.datasetId, t.speakerId], foreignColumns: [entities.datasetId, entities.id] }),
foreignKey({ columns: [t.datasetId, t.accountId], foreignColumns: [accounts.datasetId, accounts.id] }),
foreignKey({ columns: [t.datasetId, t.runId], foreignColumns: [analysisRuns.datasetId, analysisRuns.id] }), index('assertion_traversal_idx').on(t.datasetId, t.subjectId, t.predicate)]);
export const assertionEvidence = pgTable('assertion_evidence', { datasetId: uuid('dataset_id').notNull(), assertionId: uuid('assertion_id').notNull(), sourceId: uuid('source_id').notNull(), field: text().notNull(), passage: text().notNull(), relation: text().notNull() }, t => [unique().on(t.assertionId, t.sourceId, t.field),
foreignKey({ columns: [t.datasetId, t.assertionId], foreignColumns: [assertions.datasetId, assertions.id] }),
foreignKey({ columns: [t.datasetId, t.sourceId], foreignColumns: [sourceRecords.datasetId, sourceRecords.id] })]);
export const findings = pgTable('findings', {
  id: uuid().primaryKey(), datasetId: uuid('dataset_id').notNull(), accountId: uuid('account_id').notNull(), signalId: uuid('signal_id'),
  runId: uuid('run_id').notNull(), commercialContext: text('commercial_context').notNull(), type: text().notNull(), details: jsonb().notNull()
}, t => [unique().on(t.datasetId, t.id),
foreignKey({ columns: [t.datasetId, t.accountId], foreignColumns: [accounts.datasetId, accounts.id] }),
foreignKey({ columns: [t.datasetId, t.signalId], foreignColumns: [signals.datasetId, signals.id] }),
foreignKey({ columns: [t.datasetId, t.runId], foreignColumns: [analysisRuns.datasetId, analysisRuns.id] })]);
export const findingEvidence = pgTable('finding_evidence', { datasetId: uuid('dataset_id').notNull(), findingId: uuid('finding_id').notNull(), sourceId: uuid('source_id'), checkResult: jsonb('check_result') }, t => [
  foreignKey({ columns: [t.datasetId, t.findingId], foreignColumns: [findings.datasetId, findings.id] }),
  foreignKey({ columns: [t.datasetId, t.sourceId], foreignColumns: [sourceRecords.datasetId, sourceRecords.id] }), check('finding_evidence_target', sql`${t.sourceId} is not null or ${t.checkResult} is not null`)]);
export const recommendations = pgTable('recommendations', {
  id: uuid().primaryKey(), datasetId: uuid('dataset_id').notNull(), signalId: uuid('signal_id'), accountId:uuid('account_id'),runId: uuid('run_id').notNull(),
  ownerId: uuid('owner_id').notNull(), contactId: uuid('contact_id'), route: text().notNull(), reviewStatus: text('review_status').notNull().default('proposed'), card: jsonb().notNull()
}, t => [unique().on(t.datasetId, t.id), unique().on(t.runId, t.signalId),
check('recommendation_scope',sql`${t.signalId} is not null or ${t.accountId} is not null`),
foreignKey({columns:[t.datasetId,t.accountId],foreignColumns:[accounts.datasetId,accounts.id]}),
foreignKey({ columns: [t.datasetId, t.signalId], foreignColumns: [signals.datasetId, signals.id] }),
foreignKey({ columns: [t.datasetId, t.ownerId], foreignColumns: [employees.datasetId, employees.id] }),
foreignKey({ columns: [t.datasetId, t.contactId], foreignColumns: [contacts.datasetId, contacts.id] }),
foreignKey({ columns: [t.datasetId, t.runId], foreignColumns: [analysisRuns.datasetId, analysisRuns.id] })]);

export const decisions=pgTable('decisions',{
  ...identity('decision'),accountId:uuid('account_id').notNull(),eventDate:date('event_date').notNull(),dealId:uuid('deal_id'),
  requesterId:uuid('requester_id').notNull(),approverId:uuid('approver_id').notNull(),outcome:text().notNull(),value:text().notNull(),
  rationale:text().notNull(),featureExternalId:text('feature_external_id'),commitmentStatus:text('commitment_status'),sourceId:uuid('source_id').notNull(),
},t=>[...identityConstraints(t,'decision'),
  foreignKey({columns:[t.datasetId,t.accountId],foreignColumns:[accounts.datasetId,accounts.id]}),
  foreignKey({columns:[t.datasetId,t.dealId],foreignColumns:[deals.datasetId,deals.id]}),
  foreignKey({columns:[t.datasetId,t.requesterId],foreignColumns:[employees.datasetId,employees.id]}),
  foreignKey({columns:[t.datasetId,t.approverId],foreignColumns:[employees.datasetId,employees.id]}),
  foreignKey({columns:[t.datasetId,t.sourceId],foreignColumns:[sourceRecords.datasetId,sourceRecords.id]})]);
export const diagnoses=pgTable('account_diagnoses',{
  id:uuid().primaryKey(),datasetId:uuid('dataset_id').notNull(),accountId:uuid('account_id').notNull(),runId:uuid('run_id').notNull(),
  signalId:uuid('signal_id'),dealId:uuid('deal_id'),scopeKey:text('scope_key').notNull(),diagnosis:jsonb().notNull(),
},t=>[unique().on(t.datasetId,t.scopeKey),
  foreignKey({columns:[t.datasetId,t.accountId],foreignColumns:[accounts.datasetId,accounts.id]}),
  foreignKey({columns:[t.datasetId,t.signalId],foreignColumns:[signals.datasetId,signals.id]}),
  foreignKey({columns:[t.datasetId,t.dealId],foreignColumns:[deals.datasetId,deals.id]}),
  foreignKey({columns:[t.datasetId,t.runId],foreignColumns:[analysisRuns.datasetId,analysisRuns.id]})]);

// Successful validated candidates are cached; failure attempts remain auditable.
// Candidates require review and never establish commercial authority by themselves.
export const modelRuns = pgTable('model_runs', {
  id:uuid().primaryKey(),datasetId:uuid('dataset_id').notNull(),accountId:uuid('account_id').notNull(),
  cacheKey:text('cache_key').notNull(),inputHash:text('input_hash').notNull(),operation:text().notNull(),
  provider:text().notNull(),model:text().notNull(),promptVersion:text('prompt_version').notNull(),
  schemaVersion:text('schema_version').notNull(),parametersVersion:text('parameters_version').notNull(),
  status:text().notNull(),output:jsonb(),latencyMs:integer('latency_ms').notNull(),
  inputTokens:integer('input_tokens'),outputTokens:integer('output_tokens'),
  costUsd:numeric('cost_usd',{precision:20,scale:10}),costBasis:text('cost_basis').notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
},t=>[foreignKey({columns:[t.datasetId,t.accountId],foreignColumns:[accounts.datasetId,accounts.id]}),
  index('model_cache_idx').on(t.datasetId,t.accountId,t.cacheKey,t.status),
  check('model_run_status',sql`${t.status} in ('succeeded','unavailable','invalid','timeout','provider_error','budget_exceeded')`),
  check('model_run_usage',sql`${t.latencyMs} >= 0 and (${t.inputTokens} is null or ${t.inputTokens} >= 0) and (${t.outputTokens} is null or ${t.outputTokens} >= 0) and (${t.costUsd} is null or ${t.costUsd} >= 0)`) ]);
