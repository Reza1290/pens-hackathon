import { createHash } from 'node:crypto';
import { stableId } from '../../apps/api/src/modules/ingestion/service.js';
import { contextSchema,type Context } from '../../apps/api/src/ai/schemas/interpretation.js';
export const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
export const liveCaseIds=['reference-en','reference-id','roi-en','roi-id','pricing-en','pricing-id','wrong_decision-en','wrong_decision-id','integration-en','integration-id'];
export const liveBudget={physical_call_cap:10,retries:0,timeout_ms:30000,max_request_bytes:12000,estimated_input_tokens_per_call:2000,input_usd_per_million:0.042,output_usd_per_million:0,estimated_total_usd:0.00084};
export function requireApproval(plan:any,approval:any,planHash:string,currentCommit:string){
  if(approval?.decision!=='approved'||approval?.actor!=='user'||typeof approval?.approval_quote!=='string'||!approval.approval_quote.trim()||!approval?.recorded_at)throw new Error('Explicit user approval required');
  if(approval.plan_sha256!==planHash||approval.packet_sha256!==plan.packet_sha256||approval.code_commit!==plan.code_commit||currentCommit!==plan.code_commit)throw new Error('Approval does not match pinned packet/plan/commit');
  if(approval.labels_and_criteria!==true||approval.synthetic_live_budget!==true||approval.physical_call_cap!==liveBudget.physical_call_cap)throw new Error('Both labels/criteria and the exact live budget require approval');
}
export function syntheticContext(c:any):Context{
  if(!liveCaseIds.includes(c.id)||c.account_id!=='A'||c.sources.length!==2||c.people.some((p:any)=>!['X','Y','AM'].includes(p.id)))throw new Error('Not an approved synthetic live case');
  const id=(value:string)=>stableId('phase8-approved-synthetic',c.id,value);
  return contextSchema.parse({datasetId:id('dataset'),accountId:id('A'),asOf:c.as_of,decisionScopeId:id(c.decision_id),subjectId:id('X'),candidates:c.people.map((p:any)=>({id:id(p.id),role:p.role,start:p.start,end:p.end})),sources:c.sources.map((s:any)=>({id:id(s.id),field:'synthetic_text',text:s.text,eventDate:s.event_date,speakerId:id(s.speaker_id),hash:digest(JSON.stringify(s))})),claim:JSON.stringify({requirement_decision:c.sources[0].decision_id,reply_decision:c.sources[1].decision_id,reply_attachment_unavailable:c.sources[1].attachment_unavailable,scope:'Assess only this specific reply. Other replies and attachment contents are not supplied.'})});
}
export function boundedSyntheticTransport(fetcher:typeof fetch,beforeCall:()=>Promise<void>,afterResponse:(record:any)=>Promise<void>):typeof fetch{
  let calls=0;
  return async(url,init)=>{
    if(String(url)!=='https://api.typesafe.ai/v1/systemone'||init?.method!=='POST')throw new Error('Unapproved endpoint');
    const body=String(init.body);if(Buffer.byteLength(body)>liveBudget.max_request_bytes)throw new Error('Synthetic request size exceeded');
    const request=JSON.parse(body);if(request.model!=='jev-1.13.0'||Object.keys(request.questions??{}).join()!=='judgment')throw new Error('Unapproved model or question');
    if(calls>=liveBudget.physical_call_cap)throw new Error('Physical call cap exhausted');
    await beforeCall();calls++;const started=performance.now();
    try{const response=await fetcher(url,init);const raw=await response.clone().text();if(Buffer.byteLength(raw)>262144)throw new Error('Response capture limit');await afterResponse({request,status:response.status,raw_response:raw,latency_ms:Math.round(performance.now()-started)});return response;}
    catch{await afterResponse({request,error:'transport_or_capture_failure',latency_ms:Math.round(performance.now()-started)});throw new Error('transport_or_capture_failure');}
  };
}
