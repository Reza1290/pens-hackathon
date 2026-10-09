import { and,eq,inArray } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import * as s from '../db/schema/index.js';
import { contextSchema,type Context } from './schemas/interpretation.js';
export async function interpretationContext(db:Database,datasetId:string,accountExternalId:string,sourceExternalIds:string[],subjectExternalId?:string,claim=''):Promise<Context>{
  const [dataset]=await db.select().from(s.datasets).where(eq(s.datasets.id,datasetId));
  const [account]=await db.select().from(s.accounts).where(and(eq(s.accounts.datasetId,datasetId),eq(s.accounts.externalId,accountExternalId)));
  if(dataset?.status!=='ready'||!account)throw new Error('ready_dataset_and_scoped_account_required');
  if(sourceExternalIds.length<1||sourceExternalIds.length>4||new Set(sourceExternalIds).size!==sourceExternalIds.length)throw new Error('bounded_unique_sources_required');
  const messages=await db.select().from(s.interactions).where(and(eq(s.interactions.datasetId,datasetId),eq(s.interactions.accountId,account.id),inArray(s.interactions.externalId,sourceExternalIds)));
  if(messages.length!==sourceExternalIds.length||messages.some(m=>m.eventDate>dataset.asOf))throw new Error('source_outside_account_or_snapshot');
  const records=await db.select({record:s.sourceRecords}).from(s.sourceRecords).innerJoin(s.sourceFiles,and(eq(s.sourceFiles.id,s.sourceRecords.fileId),eq(s.sourceFiles.datasetId,s.sourceRecords.datasetId))).where(and(eq(s.sourceRecords.datasetId,datasetId),eq(s.sourceFiles.filename,'interactions.jsonl'),inArray(s.sourceRecords.externalId,sourceExternalIds)));
  const people=await db.select({contact:s.contacts,job:s.employments}).from(s.contacts).innerJoin(s.employments,and(eq(s.contacts.id,s.employments.contactId),eq(s.contacts.datasetId,s.employments.datasetId))).where(and(eq(s.contacts.datasetId,datasetId),eq(s.employments.accountId,account.id)));
  const scoped=people.filter(p=>messages.some(m=>p.job.start<=m.eventDate&&(!p.job.end||p.job.end>=m.eventDate)));
  if(scoped.length>12)throw new Error('candidate_budget_requires_narrower_scope');
  const sources=sourceExternalIds.map(externalId=>{
    const message=messages.find(m=>m.externalId===externalId)!;const record=records.find(r=>r.record.externalId===externalId)?.record;
    if(!record)throw new Error('source_record_missing');
    const speakers=scoped.filter(p=>p.contact.email.toLowerCase()===message.sender.toLowerCase()&&p.job.start<=message.eventDate&&(!p.job.end||p.job.end>=message.eventDate));
    return {id:record.id,field:'isi',text:message.body,eventDate:message.eventDate,speakerId:speakers.length===1?speakers[0].contact.id:null};
  });
  const subject=scoped.find(p=>p.contact.externalId===subjectExternalId);
  if(subjectExternalId&&!subject)throw new Error('subject_outside_candidates');
  return contextSchema.parse({datasetId,accountId:account.id,sources,candidates:scoped.map(p=>({id:p.contact.id,role:p.job.role,start:p.job.start,end:p.job.end})),subjectId:subject?.contact.id??null,claim});
}
