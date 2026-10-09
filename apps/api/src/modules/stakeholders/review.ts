import { and,eq,sql } from 'drizzle-orm';
import { z } from 'zod';
import { stakeholderStatementSchema,type StakeholderStatement } from '@kasirnusa/contracts';
import type { Database } from '../../db/client.js';
import * as s from '../../db/schema/index.js';
import { contextSchema,extractionSchema,validateValue } from '../../ai/schemas/interpretation.js';
import { stableId } from '../ingestion/service.js';
import { sha256 } from '../ingestion/manifest.js';
import { decisionScope } from './scope.js';
export const reviewRequestSchema=z.object({model_run_id:z.uuid(),candidate_index:z.number().int().nonnegative(),state:z.enum(['pending_review','accepted','rejected']),reviewer:z.string().trim().min(2).max(200),rationale:z.string().trim().min(10).max(2000),supersedes:z.uuid().nullable().default(null),correction:extractionSchema.shape.assertions.element.optional()}).strict();
export async function inspectCandidate(db:Database,runId:string,index:number){
  const [run]=await db.select().from(s.modelRuns).where(eq(s.modelRuns.id,runId));
  if(!run||run.operation!=='extract_details'||run.status!=='succeeded')throw new Error('Successful extraction run required');
  const original=extractionSchema.parse(run.output).assertions[index];if(!original)throw new Error('Unknown candidate');
  const [source]=await db.select().from(s.sourceRecords).where(and(eq(s.sourceRecords.datasetId,run.datasetId),eq(s.sourceRecords.id,original.sourceId)));
  const history=await db.select().from(s.extractionReviews).where(and(eq(s.extractionReviews.modelRunId,runId),eq(s.extractionReviews.candidateIndex,index))).orderBy(s.extractionReviews.createdAt,s.extractionReviews.id);
  const [dataset]=await db.select().from(s.datasets).where(eq(s.datasets.id,run.datasetId));
  const messages=await db.select().from(s.interactions).where(and(eq(s.interactions.datasetId,run.datasetId),eq(s.interactions.accountId,run.accountId)));
  const message=messages.find(m=>m.externalId===source?.externalId);
  const employment=await db.select().from(s.employments).where(and(eq(s.employments.datasetId,run.datasetId),eq(s.employments.contactId,original.subjectId)));
  const relatedAssertions=await db.select({claim:s.assertions.literal,method:s.assertions.method,verification:s.assertions.verification}).from(s.assertions).where(and(eq(s.assertions.datasetId,run.datasetId),eq(s.assertions.accountId,run.accountId),eq(s.assertions.subjectId,original.subjectId)));
  return {run,original,source,history,employment,relatedAssertions,scope:{account_id:run.accountId,dataset_id:run.datasetId,as_of:dataset.asOf,decision_scope_id:message?decisionScope(messages,message.id,run.accountId,dataset.asOf):null}};
}
async function validateClaim(db:Database,run:typeof s.modelRuns.$inferSelect,claim:z.infer<typeof extractionSchema>['assertions'][number]){
  if(!run.context)throw new Error('Legacy extraction has no captured context; generate a new candidate before acceptance');
  const context=contextSchema.parse(run.context);validateValue('extract_details',{status:'candidate',assertions:[claim]},context);
  if(context.datasetId!==run.datasetId||context.accountId!==run.accountId)throw new Error('Model context outside review scope');
  const supplied=context.sources.find(src=>src.id===claim.sourceId)!;
  const [source]=await db.select().from(s.sourceRecords).where(and(eq(s.sourceRecords.datasetId,run.datasetId),eq(s.sourceRecords.id,claim.sourceId)));
  const [account]=await db.select().from(s.accounts).where(and(eq(s.accounts.datasetId,run.datasetId),eq(s.accounts.id,run.accountId)));
  const [dataset]=await db.select().from(s.datasets).where(eq(s.datasets.id,run.datasetId));
  if(!source||!supplied.hash||source.contentHash!==supplied.hash||source.accountExternalId!==account.externalId||source.payload[claim.field]?.slice(claim.start,claim.end)!==claim.quote)throw new Error('Source revision or account mismatch');
  if(claim.eventDate>dataset.asOf)throw new Error('Claim after snapshot');
  const [contact]=await db.select().from(s.contacts).where(and(eq(s.contacts.datasetId,run.datasetId),eq(s.contacts.id,claim.subjectId),eq(s.contacts.accountId,run.accountId)));
  const jobs=await db.select().from(s.employments).where(and(eq(s.employments.datasetId,run.datasetId),eq(s.employments.contactId,claim.subjectId),eq(s.employments.accountId,run.accountId)));
  if(!contact||!jobs.some(j=>j.start<=claim.eventDate&&j.start<=dataset.asOf&&(!j.end||j.end>=dataset.asOf)))throw new Error('Current dated customer identity required');
  const messages=await db.select().from(s.interactions).where(and(eq(s.interactions.datasetId,run.datasetId),eq(s.interactions.accountId,run.accountId)));
  const message=messages.find(m=>m.externalId===source.externalId&&m.eventDate===claim.eventDate);if(!message)throw new Error('Interaction/date mismatch');
  const identities=[...await db.select().from(s.contacts).where(eq(s.contacts.datasetId,run.datasetId)),...await db.select().from(s.employees).where(eq(s.employees.datasetId,run.datasetId))].filter(p=>p.email.toLowerCase()===message.sender.toLowerCase());
  if(identities.length!==1||identities[0].id!==claim.speakerId)throw new Error('Speaker identity or attribution unresolved');
  const scope=decisionScope(messages,message.id,run.accountId,dataset.asOf);if(!scope)throw new Error('Unresolved decision scope');
  const contradictions=await db.select({literal:s.assertions.literal}).from(s.assertions).where(and(eq(s.assertions.datasetId,run.datasetId),eq(s.assertions.accountId,run.accountId),eq(s.assertions.subjectId,claim.subjectId),eq(s.assertions.predicate,claim.predicate)));
  if(contradictions.some(row=>{const parsed=stakeholderStatementSchema.safeParse(row.literal);return parsed.success&&parsed.data.current&&parsed.data.decision_scope_id===scope&&parsed.data.polarity==='denied';}))throw new Error('Unresolved contradictory assertion');
  if(claim.predicate==='EXPANSION_DETAILS')throw new Error('Expansion quantity promotion requires separate deterministic commercial validation');
  return {source,scope,message};
}
export async function recordReview(db:Database,raw:unknown){
  const input=reviewRequestSchema.parse(raw);const {run,original,source}=await inspectCandidate(db,input.model_run_id,input.candidate_index);
  if(!source)throw new Error('Missing source');const claim=input.correction??original;
  if(claim.sourceId!==original.sourceId)throw new Error('Corrections retain original source; use a new extraction for a new source');
  const checked=input.state==='accepted'?await validateClaim(db,run,claim):null;
  const id=stableId('extraction-review-v1',JSON.stringify(input),source.contentHash);
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${run.id+':'+input.candidate_index},0))`);
    const [existing]=await tx.select().from(s.extractionReviews).where(eq(s.extractionReviews.id,id));if(existing)return {review:existing,reused:true};
    const history=await tx.select().from(s.extractionReviews).where(and(eq(s.extractionReviews.modelRunId,run.id),eq(s.extractionReviews.candidateIndex,input.candidate_index)));
    const superseded=new Set(history.map(r=>r.supersedes));const current=history.find(r=>!superseded.has(r.id));
    if((current?.id??null)!==input.supersedes)throw new Error('Review revision conflict; supply current supersedes ID');
    const [review]=await tx.insert(s.extractionReviews).values({id,datasetId:run.datasetId,accountId:run.accountId,modelRunId:run.id,candidateIndex:input.candidate_index,sourceId:source.id,sourceHash:source.contentHash,claim,decisionScopeId:checked?.scope??null,state:input.state,reviewer:input.reviewer,rationale:input.rationale,supersedes:input.supersedes,versions:{model:run.model,prompt:run.promptVersion,schema:run.schemaVersion,input_hash:run.inputHash}}).returning();
    // Remove stale current read models atomically; historical recommendations remain.
    await tx.delete(s.diagnoses).where(and(eq(s.diagnoses.datasetId,run.datasetId),eq(s.diagnoses.accountId,run.accountId)));
    return {review,reused:false};
  });
}
export async function reviewedStatements(db:Database,datasetId:string,accountId:string){
  const history=await db.select().from(s.extractionReviews).where(and(eq(s.extractionReviews.datasetId,datasetId),eq(s.extractionReviews.accountId,accountId))).orderBy(s.extractionReviews.id);
  const superseded=new Set(history.map(r=>r.supersedes));const statements:StakeholderStatement[]=[];const revisions:unknown[]=[];
  for(const review of history.filter(r=>!superseded.has(r.id))){
    const [run]=await db.select().from(s.modelRuns).where(eq(s.modelRuns.id,review.modelRunId));let valid=false;
    if(review.state==='accepted')try{
      const claim=extractionSchema.shape.assertions.element.parse(review.claim);const checked=await validateClaim(db,run,claim);
      if(checked.source.contentHash!==review.sourceHash||checked.scope!==review.decisionScopeId)throw new Error('Acceptance stale');valid=true;
      statements.push(stakeholderStatementSchema.parse({id:review.id,person_id:claim.subjectId,predicate:claim.predicate,scope_id:checked.message.id,scope_type:'interaction',decision_scope_id:checked.scope,text:claim.value,event_date:claim.eventDate,speaker_id:claim.speakerId,attribution:claim.attribution,polarity:'affirmed',current:true,method:'reviewed-extraction-v1',verification:'manually_verified',evidence_ids:[claim.sourceId]}));
    }catch{/* Stale/contradictory acceptances remain historical, never active. */}
    revisions.push([review.id,review.state,valid]);
  }
  return {statements,hash:sha256(JSON.stringify(revisions))};
}
