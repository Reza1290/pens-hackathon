import { requirementAssessmentSchema,type StakeholderStatement } from '@kasirnusa/contracts';
import { stableId } from '../ingestion/service.js';
import type { EvidenceBundle } from '../qa/retrieval.js';
export const REQUIREMENT_VERSION='requirement-assessment-v2-separated';
// status is response coverage for ONE reply, never thread-wide fulfillment.
export function assessRequirement(statement:StakeholderStatement,bundle:EvidenceBundle,replySourceId?:string){
  const requirement=bundle.sources.find(s=>s.interaction_id===statement.scope_id);
  const root=(id:string)=>{const seen=new Set<string>();let current=bundle.sources.find(s=>s.interaction_id===id);while(current?.parent_id&&!seen.has(current.interaction_id)){seen.add(current.interaction_id);const parent=bundle.sources.find(s=>s.interaction_id===current!.parent_id);if(!parent)break;current=parent;}return current?.interaction_id;};
  const related=bundle.sources.filter(s=>s.date>=statement.event_date&&s.date<=bundle.scope.as_of&&s.interaction_id!==statement.scope_id&&root(s.interaction_id)===root(statement.scope_id)&&s.sender!==requirement?.sender);
  const reply=replySourceId?related.find(s=>s.id===replySourceId):related.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id))[0];
  const text=reply?.text??'';
  const categories=[['roi','roi|return on investment'],['payback','payback|balik modal'],['reference','referensi|reference'],['pricing','harga|pricing|price|discount|diskon'],['rollout','rollout|implementasi|implementation|schedule|jadwal'],['integration','integrasi|integration']].filter(([,pattern])=>new RegExp(pattern,'i').test(statement.text));
  const supplied=(pattern:string)=>text.split(/[\n.!?]/).some(clause=>new RegExp(pattern,'i').test(clause)&&!/not (?:included|provided|available)|belum (?:ada|tersedia|diberikan)|will (?:send|prepare)|akan (?:kirim|siapkan)/i.test(clause));
  const missing=categories.filter(([,pattern])=>!supplied(pattern)).map(([name])=>name);
  const tokens=(s:string):string[]=>s.match(/\b(?:S\d+|DL-[\w-]+|DEAL-[\w-]+)\b/g)??[];
  const requiredScopes=tokens(requirement?.text??statement.text),replyScopes=tokens(text);
  const differentScope=requiredScopes.length>0&&replyScopes.length>0&&replyScopes.every(s=>!requiredScopes.includes(s));
  let status:'addressed'|'partially_addressed'|'not_addressed'|'insufficient_evidence'='insufficient_evidence';
  const limitations=['Coverage concerns only the identified reply; other replies may address the requirement.'];
  if(reply&&differentScope)status='not_addressed';
  else if(!statement.decision_scope_id||!requirement||!reply||bundle.coverage.truncated||bundle.coverage.unresolved_links.length)limitations.push('Unresolved scope, missing linked reply or incomplete retrieval prevents assessment.');
  else if(categories.length){
    const responsive=categories.some(([,pattern])=>new RegExp(pattern,'i').test(text));
    const broadReference=categories.length===1&&categories[0][0]==='reference'&&!/named|contact|retail|accepted|suitable|nama|kontak|ritel|diterima|sesuai/i.test(statement.text);
    if(!responsive)status='not_addressed';
    else if(broadReference&&/here (?:is|are)|berikut/i.test(text))status='addressed';
    else if(categories.some(([c])=>c==='reference')&&!broadReference)limitations.push('A qualified reference requirement needs visible supporting contents; keyword overlap is insufficient.');
    else if(reply.attachment_unavailable)limitations.push('Requested detail may be in unavailable contents; visible text alone does not establish full coverage.');
    else status=missing.length||!/\d|attached below|berikut|here (?:is|are)|evidence|bukti|status/i.test(text)?'partially_addressed':'addressed';
  }
  // Deliberately narrow fulfillment: an explicit request for numeric ROI/payback
  // values can be evidenced inline. Documents, suitability and acceptance need
  // separate evidence; a provider's coverage choice cannot set this result.
  const numericRequest=/^(?:(?:For|Untuk) S\d+ )?(?:I require (?:a )?numeric (?:ROI value|payback period)|saya memerlukan angka (?:ROI|payback))\.?$/i.test(statement.text)&&categories.length>0&&categories.every(([c])=>c==='roi'||c==='payback');
  const numericValues=categories.every(([c])=>new RegExp(c==='roi'?'roi\\s*[:=]?\\s*\\d+(?:[.,]\\d+)?\\s*%':'(?:payback|balik modal)\\s*[:=]?\\s*\\d+\\s*(?:months?|bulan)','i').test(text));
  const established=numericRequest&&numericValues&&status==='addressed'&&!reply?.attachment_unavailable;
  const fulfillment={status:established?'established' as const:'insufficient_evidence' as const,source_ids:established?[requirement!.id,reply!.id]:[...statement.evidence_ids,...(reply?[reply.id]:[])],reason:established?'Requested numeric values are visible in this scoped reply; their correctness and customer acceptance are not established.':'Available evidence does not establish requirement fulfillment. An acknowledgment, pointer or unrelated reply is not proof of delivery, suitability or acceptance.',customer_acceptance:'not_established' as const};
  return requirementAssessmentSchema.parse({id:stableId(statement.id,REQUIREMENT_VERSION,reply?.hash??'no-reply'),requirement_id:statement.id,holder_id:statement.person_id,speaker_id:statement.speaker_id,attribution:statement.attribution,event_date:statement.event_date,decision_scope_id:statement.decision_scope_id??statement.scope_id,status,reply_source_id:reply?.id??null,response_scope:'specific_reply',fulfillment,requirement:statement.text,missing_details:missing,source_ids:[...new Set([...statement.evidence_ids,...(reply?[reply.id]:[])])],method:REQUIREMENT_VERSION,limitations,prompt_version:REQUIREMENT_VERSION,schema_version:'separated-assessment-v2'});
}

export function requirementNextAction(assessment:ReturnType<typeof assessRequirement>,ownerId:string,currentHolder:boolean){
  const task=assessment.fulfillment.status==='established'?'verify_requirement_evidence':'prepare_requirement_evidence';
  return {task,responsible_ids:[ownerId],allowed_participant_ids:currentHolder?[assessment.holder_id]:[],approver_ids:[],evidence_ids:assessment.source_ids,
    text:task==='verify_requirement_evidence'?`Verify the provided values and confirm any remaining requirements: ${assessment.requirement}`:`Prepare or obtain the documented requirement evidence while confirming decision authority: ${assessment.requirement}`};
}
