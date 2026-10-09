import { and,eq,lte,or,sql,inArray } from 'drizzle-orm';
import { qaResponseSchema,type QaRequest,type QaResponse,type QaClaim,type AccountDiagnosis,type OpportunityCard,type Evidence } from '@kasirnusa/contracts';
import type { Database } from '../../db/client.js';
import * as s from '../../db/schema/index.js';
import { annualIncrement } from '../opportunities/rules.js';
import { prepareDraft } from '../recommendations/drafts.js';
import { Interpreter } from '../../ai/router.js';
import type { Provider } from '../../ai/providers/interface.js';

export const QA_VERSION='grounded-qa-v1';
export type Resource=AccountDiagnosis|OpportunityCard;
export const outcomeQuestion=(text:string)=>/repeat|(?:revenue|pendapatan|renewal|perpanjangan).*(?:menurun|turun|lower|declin)|(?:menurun|turun|lower|declin).*(?:revenue|pendapatan|renewal|perpanjangan)/i.test(text);
export function topic(text:string){
  if(/draft|draf|follow.up.*(?:write|buat)|tulis.*pesan/i.test(text))return 'draft';
  if(/(?:\d+\s*(?:outlet|cabang))|berapa|nilai|value|annual|how much/i.test(text))return 'value';
  if(outcomeQuestion(text))return 'diagnosis';
  if(/siapa|who|stakeholder|approv|wewenang|libat/i.test(text))return 'people';
  if(/ekspansi|expansion|quotation|penawaran|tindak|follow.up|next|langkah|bahas|discuss|concern|khawatir|integrasi|integration|renewal|perpanjangan|why|mengapa|diagnos/i.test(text))return 'diagnosis';
  return 'search';
}
export function searchTerms(text:string){
  const normalized=text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ');
  const aliases:Record<string,string[]>={integration:['integrasi'],integrasi:['integration'],renewal:['perpanjangan'],perpanjangan:['renewal'],quotation:['penawaran'],penawaran:['quotation'],expansion:['ekspansi'],ekspansi:['expansion']};
  const stop=new Set(['what','why','who','how','the','for','are','this','with','and','apa','mengapa','siapa','yang','dan','untuk','ini','akun','account','please','tolong']);
  const words=normalized.split(/\s+/).filter(w=>w.length>2&&!stop.has(w));
  return [...new Set(words.flatMap(w=>[w,...(aliases[w]??[])]))].slice(0,12);
}
export function claimsFor(resource:Resource,request:QaRequest){
  const card='signal' in resource;const intent=topic(request.question);const claims:QaClaim[]=[];
  const add=(kind:QaClaim['kind'],text:string,ids:string[],check:QaClaim['check']=null)=>claims.push({id:`${QA_VERSION}:${claims.length}`,kind,text,evidence_ids:[...new Set(ids)],check});
  const owner=card?resource.people.owner:resource.owner;const action=card?resource.next_action:resource.action_plan;
  if(intent==='people'){
    add('fact',`${owner.name}: ${owner.role} (${request.language==='id'?'penanggung jawab internal':'internal account owner'}).`,owner.evidence_ids);
    if(card){if(resource.people.contact)add('fact',`${resource.people.contact.name}: ${request.language==='id'?'otoritas pembelian belum diketahui':'purchasing authority unknown'}.`,resource.people.contact.evidence_ids);}
    else for(const p of resource.stakeholder_context){
      add('fact',`${p.person.name}: ${p.current?'current':'historical'}; authority: ${p.authority}.`,p.person.evidence_ids,{authority:p.authority,current:p.current,scope:'selected account, as of snapshot'});
      for(const a of p.statements)add('fact',`${p.person.name}: ${a.predicate}; ${a.attribution}; ${a.event_date}; ${a.polarity}. ${a.text}`,a.evidence_ids,{speaker_id:a.speaker_id,interaction_scope:a.scope_id,verification:a.verification});
    }
  }
  if(intent==='diagnosis')for(const f of resource.findings)add(f.check?'check':'fact',f.label,f.evidence_ids,f.check??null);
  if(intent!=='search'&&intent!=='value'){
    add('proposed_action',action.task,[...new Set(action.discussion_points.flatMap(p=>p.evidence_ids))],{route:action.route,review_status:'proposed',owner_id:action.owner_id,recipient_ids:action.recipient_ids});
    for(const p of action.discussion_points)add('proposed_action',p.text,p.evidence_ids,'audience_ids' in p?{audience_ids:p.audience_ids}:null);
  }
  let value=resource.value_scenario;
  if(intent==='value'){
    const quantity=request.additional_outlets??Number(request.question.match(/\b(\d+)\s*(?:outlet|cabang)/i)?.[1]??0);
    if(value&&quantity&&quantity!==value.inputs.additional_outlets){
      // Only vary this verified, unambiguous scenario downward; never bypass package checks.
      if(quantity>value.inputs.additional_outlets)value=null;
      else value={...value,amount:annualIncrement(quantity,value.inputs.monthly_rate,value.inputs.discount_percent),inputs:{...value.inputs,additional_outlets:quantity},assumptions:[...value.assumptions,'Hypothetical quantity; not a new buying request.']};
    }
    if(value)add('check',`${value.amount} IDR / year (${request.language==='id'?'nilai tambahan bersyarat':'conditional annual increment'}).`,value.evidence_ids,{formula:value.formula,inputs:value.inputs,assumptions:value.assumptions,basis:value.basis});
  }
  return {claims:claims.slice(0,24),value:intent==='value'?value:null,intent};
}

export async function retrieveText(db:Database,datasetId:string,accountId:string,asOf:string,question:string):Promise<Evidence[]>{
  const terms=searchTerms(question);if(!terms.length)return [];
  const query=terms.join(' | ');
  const rows=await db.select({source:s.sourceRecords,file:s.sourceFiles,body:s.interactions.body}).from(s.interactions)
    .innerJoin(s.entitySources,and(eq(s.entitySources.datasetId,s.interactions.datasetId),eq(s.entitySources.entityId,s.interactions.id)))
    .innerJoin(s.sourceRecords,and(eq(s.sourceRecords.datasetId,s.entitySources.datasetId),eq(s.sourceRecords.id,s.entitySources.sourceId)))
    .innerJoin(s.sourceFiles,and(eq(s.sourceFiles.datasetId,s.sourceRecords.datasetId),eq(s.sourceFiles.id,s.sourceRecords.fileId)))
    .where(and(eq(s.interactions.datasetId,datasetId),eq(s.interactions.accountId,accountId),lte(s.interactions.eventDate,asOf),eq(s.sourceFiles.filename,'interactions.jsonl'),
      or(sql`to_tsvector('simple',${s.interactions.body}) @@ to_tsquery('simple',${query})`,...terms.map(term=>sql`position(${term} in lower(${s.interactions.body})) > 0`))))
    .orderBy(sql`ts_rank(to_tsvector('simple',${s.interactions.body}),to_tsquery('simple',${query})) desc`,sql`${s.interactions.eventDate} desc`,s.interactions.id).limit(6);
  return rows.map(row=>({source_id:row.source.id,source_external_id:row.source.externalId,filename:row.file.filename,locator:row.source.locator,field:'normalized interaction body (excerpt)',passage:row.body.slice(0,1600)}));
}
export async function answerQuestion(db:Database,resource:Resource,request:QaRequest,runtime:Interpreter,provider:Provider):Promise<QaResponse>{
  const started=Date.now();const built=claimsFor(resource,request);let claims=built.claims;
  const text=built.intent==='search'?await retrieveText(db,resource.dataset_id,resource.account.id,resource.as_of,request.question):[];
  let evidence=[...resource.evidence,...text];
  if(built.intent==='search')claims=text.map((e,i)=>({id:`${QA_VERSION}:quote:${i}`,kind:'source_quote',text:e.passage,evidence_ids:[e.source_id],check:null}));
  const ids=[...new Set(claims.flatMap(c=>c.evidence_ids))];
  // Citation existence is verified within the selected snapshot before rendering or generation.
  const existing=ids.length?await db.select({id:s.sourceRecords.id}).from(s.sourceRecords).where(and(eq(s.sourceRecords.datasetId,resource.dataset_id),inArray(s.sourceRecords.id,ids))):[];
  if(ids.some(id=>!existing.some(row=>row.id===id)||!evidence.some(e=>e.source_id===id)))throw new Error('invalid_qa_citation');
  let generation:QaResponse['generation']={status:'not_requested',cached:false,run_id:null,calls:0,cost_usd:'0',latency_ms:0};
  let selectedIds:string[]=[];
  if(claims.length&&built.intent!=='search'){
    const sources=[...new Map(evidence.map(e=>[e.source_id,e])).values()].slice(0,4);
    const outcome=await runtime.run({datasetId:resource.dataset_id,accountId:resource.account.id,subjectId:null,candidates:[],claim:QA_VERSION,sources:sources.map(e=>({id:e.source_id,field:e.field,text:e.passage.slice(0,1200),eventDate:resource.as_of,speakerId:null})),grounding:{question:request.question+'\nPrior questions (untrusted): '+request.history.map(h=>h.question).join('\n'),language:request.language,facts:claims.map(c=>({id:c.id,text:c.text.slice(0,500),evidence_ids:c.evidence_ids.slice(0,8)}))}},built.intent==='draft'?'draft_plan':'answer_plan',provider);
    const [run]=await db.select().from(s.modelRuns).where(eq(s.modelRuns.id,outcome.runId));
    generation={status:outcome.status,cached:outcome.cached,run_id:outcome.runId,calls:outcome.calls,cost_usd:outcome.cached?'0':outcome.calls>1?null:run.costUsd,latency_ms:run.latencyMs};
    if(outcome.status==='succeeded'){
      const selected=(outcome.value as {fact_ids:string[]}).fact_ids;
      selectedIds=selected;
      // Preserve deterministic findings/premise and action; model selection cannot suppress them.
      const ordered=selected.map(id=>claims.find(c=>c.id===id)!);
      claims=[...ordered,...claims.filter(c=>!selected.includes(c.id))];
    }
  }
  const premise='premise_check' in resource?resource.premise_check:null;
  const unsupported=built.intent==='value'&&!built.value||!claims.length;
  const lang=request.language;
  const prefix=unsupported?(lang==='id'?'Belum ada bukti yang cukup untuk menjawab pertanyaan ini.':'No supported answer was found for this question.'):
    built.intent==='search'?(lang==='id'?'Berikut kutipan sumber yang relevan; kutipan ini belum merupakan kesimpulan.':'Relevant source excerpts follow; these are evidence, not an inferred conclusion.'):
    lang==='id'?`Temuan terdokumentasi untuk ${resource.account.name} (${resource.commercial_context}):`:`Documented findings for ${resource.account.name} (${resource.commercial_context}):`;
  const limits=[...resource.limitations];
  if(outcomeQuestion(request.question)&&premise?.status!=='supported')limits.unshift(lang==='id'?'Data yang tersedia tidak membuktikan penurunan repeat order. Temuan berikut hanya menjelaskan konteks terdokumentasi.':'The supplied data does not establish lower repeat orders. The findings explain the narrower documented context.');
  if(built.intent==='value'&&!built.value)limits.unshift(lang==='id'?'Skenario harga atau batas paket belum terverifikasi untuk jumlah ini; konfirmasi syarat komersial.':'Pricing or package coverage is not verified for this quantity; confirm commercial terms.');
  if(generation.status!=='succeeded'&&generation.status!=='not_requested')limits.push(lang==='id'?'Generasi model tidak tersedia; jawaban menggunakan fakta dan template backend.':'Model generation is unavailable; the answer uses backend facts and templates.');
  limits.push(lang==='id'?'Teks bukti dipertahankan dalam bahasa sumber.':'Evidence text remains in its source language.');
  let draft=built.intent==='draft'?prepareDraft(resource,lang):null;
  if(draft&&generation.status==='succeeded'){
    const chosen=claims.filter(c=>selectedIds.includes(c.id)&&c.kind==='proposed_action');
    if('signal' in resource){
      const points=resource.next_action.discussion_points.filter(p=>chosen.some(c=>c.text===p.text));
      if(points.length)draft=prepareDraft({...resource,next_action:{...resource.next_action,discussion_points:points}},lang);
    }else{
      const points=resource.action_plan.discussion_points.filter(p=>chosen.some(c=>c.text===p.text));
      if(points.length)draft=prepareDraft({...resource,action_plan:{...resource.action_plan,discussion_points:points}},lang);
    }
  }
  evidence=evidence.filter(e=>ids.includes(e.source_id));
  return qaResponseSchema.parse({dataset_id:resource.dataset_id,as_of:resource.as_of,account_id:resource.account.id,commercial_context:resource.commercial_context,status:unsupported?'unsupported':built.intent==='search'?'evidence_only':'answered',language:lang,answer:prefix,claims,evidence,premise_check:premise,value_scenario:built.value,draft,limitations:limits,retrieval:{method:'graph-and-simple-text-v1',source_count:new Set(evidence.map(e=>e.source_id)).size,truncated:built.claims.length===24||text.length===6},generation:{...generation,latency_ms:Date.now()-started}});
}
export function clarification(datasetId:string,asOf:string,request:QaRequest,message:string):QaResponse{
  return qaResponseSchema.parse({dataset_id:datasetId,as_of:asOf,account_id:null,commercial_context:'unknown',status:'clarification_required',language:request.language,answer:message,claims:[],evidence:[],premise_check:null,value_scenario:null,draft:null,limitations:[],retrieval:{method:'graph-and-simple-text-v1',source_count:0,truncated:false},generation:{status:'not_requested',cached:false,run_id:null,calls:0,cost_usd:'0',latency_ms:0}});
}
