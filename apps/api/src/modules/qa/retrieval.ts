import { and,eq,lte,inArray,or,sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import * as s from '../../db/schema/index.js';
export const RETRIEVAL_VERSION='connected-evidence-v1';
export type BundleSource={id:string;external_id:string|null;filename:string;locator:number;hash:string;text:string;date:string;interaction_id:string;parent_id:string|null;sender:string;recipients:string;reason:string;path:string[];attachment_unavailable:boolean};
export type EvidenceBundle={scope:{dataset_id:string;account_id:string;as_of:string;deal_id:string|null;signal_id:string|null},sources:BundleSource[],linked_records?:{id:string;external_id:string|null;filename:string;hash:string;payload:Record<string,string>;reason:string;path:string[]}[],assertions:unknown[],relationships:{from:string;to:string;relation:string}[],coverage:{truncated:boolean;unresolved_links:string[];limits:{hops:number;records:number;characters:number;milliseconds:number};elapsed_ms:number},method:string};
export async function retrieveConnected(db:Database,input:{datasetId:string;accountId:string;asOf:string;seedSourceIds:string[];query?:string;dealId?:string;signalId?:string},limits={hops:2,records:24,characters:24000,milliseconds:2000}):Promise<EvidenceBundle>{
  const start=Date.now();let truncated=false,characters=0;
  const scope=and(eq(s.interactions.datasetId,input.datasetId),eq(s.interactions.accountId,input.accountId),lte(s.interactions.eventDate,input.asOf));
  const [deal]=input.dealId?await db.select().from(s.deals).where(and(eq(s.deals.datasetId,input.datasetId),eq(s.deals.accountId,input.accountId),eq(s.deals.id,input.dealId))):[];
  if(input.dealId&&!deal)throw new Error('retrieval_deal_outside_scope');
  const query=(input.query??'').normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu,' ').trim();
  const sourceQuery=()=>db.select({m:s.interactions,r:s.sourceRecords,f:s.sourceFiles}).from(s.interactions).innerJoin(s.entitySources,and(eq(s.entitySources.datasetId,s.interactions.datasetId),eq(s.entitySources.entityId,s.interactions.id))).innerJoin(s.sourceRecords,and(eq(s.sourceRecords.datasetId,s.entitySources.datasetId),eq(s.sourceRecords.id,s.entitySources.sourceId))).innerJoin(s.sourceFiles,and(eq(s.sourceFiles.datasetId,s.sourceRecords.datasetId),eq(s.sourceFiles.id,s.sourceRecords.fileId)));
  const matches=or(input.seedSourceIds.length?inArray(s.sourceRecords.id,input.seedSourceIds):undefined,query?sql`to_tsvector('simple',${s.interactions.body}) @@ plainto_tsquery('simple',${query})`:undefined);
  const seeds=matches?await sourceQuery().where(and(scope,eq(s.sourceFiles.filename,'interactions.jsonl'),matches,deal?sql`position(${deal.externalId} in ${s.interactions.body}) > 0`:undefined)).orderBy(s.interactions.eventDate,s.interactions.id).limit(limits.records+1):[];
  const decisionTokens=(body:string)=>body.match(/\b(?:DL\d+|DL-[\w-]+|DEAL-[\w-]+|S\d+|S-[\w-]+)\b/g)??[];
  const selectedTokens=new Set(deal?[deal.externalId]:seeds.flatMap(row=>decisionTokens(row.m.body)));
  type Row=typeof seeds[number];const found=new Map<string,BundleSource>();const frontier:string[]=[];const paths=new Map<string,string[]>();const relationships:EvidenceBundle['relationships']=[];
  const add=(row:Row,reason:string,path:string[])=>{
    if(found.has(row.m.id))return;
    if(found.size>=limits.records||characters+row.m.body.length>limits.characters||Date.now()-start>limits.milliseconds){truncated=true;return;}
    // A reply naming a different deal cannot satisfy this scoped decision.
    const tokens=decisionTokens(row.m.body);
    if(selectedTokens.size&&tokens.length&&tokens.some(token=>!selectedTokens.has(token)))return;
    characters+=row.m.body.length;found.set(row.m.id,{id:row.r.id,external_id:row.m.externalId,filename:row.f.filename,locator:row.r.locator,hash:row.r.contentHash,text:row.m.body,date:row.m.eventDate,interaction_id:row.m.id,parent_id:row.m.parentId,sender:row.m.sender,recipients:row.m.recipients,reason,path,attachment_unavailable:/lampir|attach/i.test(row.m.body)});frontier.push(row.m.id);paths.set(row.m.id,path);
  };
  for(const row of seeds)add(row,input.seedSourceIds.includes(row.r.id)?'explicit source/graph seed':'account/date-scoped text match',[row.m.id]);
  for(let hop=0;hop<limits.hops&&frontier.length;hop++){
    const layer=frontier.splice(0);const parents=layer.map(id=>found.get(id)?.parent_id).filter((id):id is string=>!!id);
    const rows=await sourceQuery().where(and(scope,eq(s.sourceFiles.filename,'interactions.jsonl'),or(inArray(s.interactions.parentId,layer),parents.length?inArray(s.interactions.id,parents):undefined))).orderBy(s.interactions.eventDate,s.interactions.id).limit(limits.records+1);
    for(const row of rows){const via=row.m.parentId&&layer.includes(row.m.parentId)?row.m.parentId:layer.find(id=>found.get(id)?.parent_id===row.m.id);if(!via)continue;add(row,'explicit reply link',[...(paths.get(via)??[]),row.m.id]);if(found.has(row.m.id))relationships.push({from:row.m.id,to:row.m.parentId??via,relation:'REPLIES_TO'});}
    if(rows.length>limits.records)truncated=true;
  }
  if(frontier.length){const next=await db.select({id:s.interactions.id,body:s.interactions.body}).from(s.interactions).where(and(scope,inArray(s.interactions.parentId,frontier))).limit(limits.records+1);if(next.some(row=>!found.has(row.id)&&(!selectedTokens.size||decisionTokens(row.body).every(token=>selectedTokens.has(token)))))truncated=true;}
  const sources=[...found.values()];const unresolved=sources.filter(m=>m.parent_id&&!found.has(m.parent_id)).map(m=>m.parent_id!);
  const ids=sources.map(m=>m.id);
  const [prepared]=await db.select({runId:s.diagnoses.runId}).from(s.diagnoses).where(and(eq(s.diagnoses.datasetId,input.datasetId),eq(s.diagnoses.accountId,input.accountId),eq(s.diagnoses.scopeKey,JSON.stringify([input.accountId,input.signalId??null,input.dealId??null]))));
  const assertions=ids.length?await db.select({id:s.assertions.id,claim:s.assertions.literal,predicate:s.assertions.predicate,object_id:s.assertions.objectId,speaker_id:s.assertions.speakerId,attribution:s.assertions.attribution,date:s.assertions.eventDate,method:s.assertions.method,verification:s.assertions.verification,run_id:s.assertions.runId,source_id:s.assertionEvidence.sourceId}).from(s.assertions).innerJoin(s.assertionEvidence,and(eq(s.assertionEvidence.datasetId,s.assertions.datasetId),eq(s.assertionEvidence.assertionId,s.assertions.id))).where(and(eq(s.assertions.datasetId,input.datasetId),eq(s.assertions.accountId,input.accountId),lte(s.assertions.eventDate,input.asOf),inArray(s.assertionEvidence.sourceId,ids),prepared?eq(s.assertions.runId,prepared.runId):undefined)).limit(49):[];
  if(assertions.length>48)truncated=true;
  const objects=[...new Set(assertions.slice(0,48).flatMap(a=>a.object_id?[a.object_id]:[]))];
  const linked=objects.length?await db.select({entity:s.entitySources.entityId,record:s.sourceRecords,file:s.sourceFiles}).from(s.entitySources).innerJoin(s.sourceRecords,and(eq(s.entitySources.datasetId,s.sourceRecords.datasetId),eq(s.entitySources.sourceId,s.sourceRecords.id))).innerJoin(s.sourceFiles,and(eq(s.sourceFiles.datasetId,s.sourceRecords.datasetId),eq(s.sourceFiles.id,s.sourceRecords.fileId))).where(and(eq(s.entitySources.datasetId,input.datasetId),inArray(s.entitySources.entityId,objects))).limit(limits.records+1):[];
  const linked_records:NonNullable<EvidenceBundle['linked_records']>=[];
  for(const row of linked){
    const date=row.record.payload.tanggal??row.record.payload.dibuat??row.record.payload.mulai;
    if(date&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>input.asOf)continue;
    if(linked_records.some(r=>r.id===row.record.id))continue;
    const size=JSON.stringify(row.record.payload).length;
    if(found.size+linked_records.length>=limits.records||characters+size>limits.characters||Date.now()-start>limits.milliseconds){truncated=true;break;}
    const assertion=assertions.find(a=>a.object_id===row.entity)!;characters+=size;
    linked_records.push({id:row.record.id,external_id:row.record.externalId,filename:row.file.filename,hash:row.record.contentHash,payload:row.record.payload,reason:'Explicit evidence-backed assertion target; no same-account relevance assumption',path:[assertion.source_id,assertion.id,row.entity,row.record.id]});
    relationships.push({from:assertion.id,to:row.entity,relation:assertion.predicate});
  }
  return {scope:{dataset_id:input.datasetId,account_id:input.accountId,as_of:input.asOf,deal_id:input.dealId??null,signal_id:input.signalId??null},sources,linked_records,assertions:assertions.slice(0,48),relationships,coverage:{truncated,unresolved_links:[...new Set(unresolved)],limits,elapsed_ms:Date.now()-start},method:RETRIEVAL_VERSION};
}
