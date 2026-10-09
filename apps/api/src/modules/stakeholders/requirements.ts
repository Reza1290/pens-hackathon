import { requirementAssessmentSchema,type StakeholderStatement } from '@kasirnusa/contracts';
import { stableId } from '../ingestion/service.js';
import type { EvidenceBundle } from '../qa/retrieval.js';
export const REQUIREMENT_VERSION='requirement-assessment-v1-four-choice';
export function assessRequirement(statement:StakeholderStatement,bundle:EvidenceBundle){
  const requirement=bundle.sources.find(s=>s.interaction_id===statement.scope_id);
  const root=(id:string)=>{const seen=new Set<string>();let current=bundle.sources.find(s=>s.interaction_id===id);while(current?.parent_id&&!seen.has(current.interaction_id)){seen.add(current.interaction_id);const parent=bundle.sources.find(s=>s.interaction_id===current!.parent_id);if(!parent)break;current=parent;}return current?.interaction_id;};
  const related=bundle.sources.filter(s=>s.date>=statement.event_date&&s.interaction_id!==statement.scope_id&&root(s.interaction_id)===root(statement.scope_id)&&s.sender!==requirement?.sender);
  const text=related.map(s=>s.text).join('\n');
  const categories=[['roi','roi|return on investment'],['payback','payback|balik modal'],['reference','referensi|reference'],['pricing','harga|pricing|price|discount|diskon'],['rollout','rollout|implementasi|implementation|schedule|jadwal'],['integration','integrasi|integration']].filter(([,pattern])=>new RegExp(pattern,'i').test(statement.text));
  const supplied=(pattern:string)=>text.split(/[\n.!?]/).some(clause=>new RegExp(pattern,'i').test(clause)&&!/not (?:included|provided|available)|belum (?:ada|tersedia|diberikan)|will (?:send|prepare)|akan (?:kirim|siapkan)/i.test(clause));
  const missing=categories.filter(([,pattern])=>!supplied(pattern)).map(([name])=>name);
  let status:'addressed'|'partially_addressed'|'not_addressed'|'insufficient_evidence'='insufficient_evidence';
  const limitations:string[]=[];
  if(!statement.decision_scope_id||bundle.coverage.truncated||bundle.coverage.unresolved_links.length||related.some(s=>s.attachment_unavailable))limitations.push('Unresolved decision scope, retrieval coverage or missing attachment contents may change the assessment.');
  else if(related.length&&categories.length){
    const responsive=categories.some(([,pattern])=>new RegExp(pattern,'i').test(text));
    const concrete=/\d|attached below|berikut|here (?:is|are)|evidence|bukti|status/i.test(text);
    status=!responsive?'not_addressed':missing.length||!concrete?'partially_addressed':'addressed';
  }else limitations.push('No adequate explicitly linked follow-up or supported requirement category was retrieved.');
  return requirementAssessmentSchema.parse({id:stableId(statement.id,REQUIREMENT_VERSION,...related.map(s=>s.hash)),requirement_id:statement.id,holder_id:statement.person_id,speaker_id:statement.speaker_id,attribution:statement.attribution,event_date:statement.event_date,decision_scope_id:statement.decision_scope_id??statement.scope_id,status,requirement:statement.text,missing_details:missing,source_ids:[...new Set([...statement.evidence_ids,...related.map(s=>s.id)])],method:REQUIREMENT_VERSION,limitations:[...limitations,'Literal assessment candidate; addressing text does not prove fulfillment or customer acceptance.']});
}
