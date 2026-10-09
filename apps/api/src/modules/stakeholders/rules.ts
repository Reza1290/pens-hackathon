import { actionPlanSchema,premiseSchema,type StakeholderStatement } from '@kasirnusa/contracts';
import { stableId } from '../ingestion/service.js';
export const STAKEHOLDER_VERSION='stakeholder-rules-v1.2';
export type Candidate={id:string;name:string;email:string;role:string;start:string;end:string|null;current:boolean;evidenceIds:string[]};
export type StatementInput={id:string;date:string;text:string;sourceId:string;speakerId:string|null;attendeeIds:string[]};
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function extractStatements(message:StatementInput,people:Candidate[]):StakeholderStatement[]{
  const eligible=people.filter(p=>p.start<=message.date&&(!p.end||p.end>=message.date));
  const direct=eligible.find(p=>p.id===message.speakerId);
  const mentions=eligible.filter(p=>message.attendeeIds.includes(p.id)&&new RegExp(`\\b(?:Pak|Bu|Mr|Ms)\\s+${escape(p.name.split(' ')[0])}\\b`,'i').test(message.text));
  const subject=direct??(mentions.length===1?mentions[0]:undefined);
  const out:StakeholderStatement[]=[];
  const add=(person:Candidate,predicate:StakeholderStatement['predicate'],text:string,polarity:StakeholderStatement['polarity']='affirmed')=>out.push({id:stableId(message.id,person.id,predicate,text,STAKEHOLDER_VERSION),person_id:person.id,predicate,text,event_date:message.date,speaker_id:message.speakerId,attribution:person.id===message.speakerId?'direct':'reported',scope_id:message.id,scope_type:'interaction',method:STAKEHOLDER_VERSION,verification:'unreviewed_rules_candidate',current:person.current,polarity,evidence_ids:[message.sourceId,...person.evidenceIds]});
  if(direct){
    for(const sentence of message.text.split(/(?<=[.!?])\s+/)){
      if(/\bsaya\b.*(?:menyetujui|memutuskan).*(?:pembelian|pengadaan)|\bI approve this purchase\b/i.test(sentence))add(direct,'APPROVER_FOR',sentence,/tidak|bukan|no longer/i.test(sentence)?'denied':'affirmed');
      if(/\bsaya\b.*(?:menilai sisi teknis|evaluasi teknis|mengevaluasi aspek teknis)|\bI evaluate technical\b/i.test(sentence))add(direct,'EVALUATES_TECHNICAL_FOR',sentence);
      if(/(?:proposal.*saya teruskan|saya.*(?:menyiapkan|siapkan).*business case|I prepare.*business case)/i.test(sentence))add(direct,'INTERMEDIARY_FOR',sentence);
      if(/\b(?:saya|I)\b.*(?:memerlukan|membutuhkan|minta|need|require).*(?:ROI|referensi|reference|integrasi|integration|payback)/i.test(sentence))add(direct,'REQUESTS_EVIDENCE',sentence,/tidak lagi|no longer/i.test(sentence)?'denied':'affirmed');
    }
    // Resolve a reported role against unique employment in this account and at this date.
    const role=message.text.match(/(?:teruskan ke|forwarded to)\s+(GM Operations|CFO|pemilik)/i)?.[1]
      ??message.text.match(/\b(CFO|GM Operations|pemilik)\s+(?:memerlukan|membutuhkan|requires)/i)?.[1];
    const targets=role?eligible.filter(p=>p.role.toLowerCase()===role.toLowerCase()&&p.id!==direct.id):[];
    if(targets.length===1){
      if(/keputusan pengadaan.*(?:beliau|GM)|decides procurement/i.test(message.text))add(targets[0],'APPROVER_FOR',message.text,/tidak.*keputusan pengadaan/i.test(message.text)?'denied':'affirmed');
      const requirement=message.text.match(/[^.!?]*(?:CFO|GM Operations|pemilik)\s+(?:memerlukan|membutuhkan|requires)[^.!?]*(?:ROI|referensi|reference|integrasi|integration)[^.!?]*/i)?.[0];
      if(requirement)add(targets[0],'REQUESTS_EVIDENCE',requirement.trim());
    }
  }
  if(subject){
    const concern=message.text.match(/[^.!?]*(?:bertanya|khawatir|concern|menanyakan)[^.!?]*integrasi[^.!?]*/i)?.[0];
    if(concern)add(subject,'RAISES_CONCERN',concern.trim());
  }
  return out;
}
export function authority(statements:StakeholderStatement[]){
  const roles=statements.filter(s=>s.predicate==='APPROVER_FOR');
  if(roles.some(s=>s.polarity==='denied')||roles.length>0&&!roles.some(s=>s.current))return 'conflicting_or_outdated' as const;
  const valid=roles.filter(s=>s.current&&s.polarity==='affirmed');
  return valid.some(s=>s.attribution==='direct')?'supported_scoped' as const:valid.length?'reported_scoped' as const:'unknown' as const;
}
export function selectAction(input:{ownerId:string;statements:StakeholderStatement[];currentIds:string[];prerequisites:{text:string;evidenceIds:string[]}[];baseEvidenceIds:string[];productOwnerIds?:string[];preferred:'joint'|'intermediary'}){
  const valid=input.statements.filter(s=>s.current&&input.currentIds.includes(s.person_id)&&s.polarity==='affirmed');
  const approvers=valid.filter(s=>s.predicate==='APPROVER_FOR'&&authority(input.statements.filter(a=>a.person_id===s.person_id))!=='conflicting_or_outdated');
  const intermediaries=valid.filter(s=>s.predicate==='INTERMEDIARY_FOR'||s.predicate==='EVALUATES_TECHNICAL_FOR');
  const requirements=valid.filter(s=>(s.predicate==='REQUESTS_EVIDENCE'||s.predicate==='RAISES_CONCERN')&&!input.statements.some(other=>other.person_id===s.person_id&&other.current&&other.predicate===s.predicate&&other.polarity==='denied'));
  const targetIds=[...new Set([...requirements,...approvers,...intermediaries].map(s=>s.person_id))];
  let route:'joint_decision_maker_discussion'|'prepare_through_intermediary'|'resolve_prerequisite_first'|'clarify_authority_or_requirement'='clarify_authority_or_requirement';
  if(input.prerequisites.length)route='resolve_prerequisite_first';
  else if(approvers.length)route=input.preferred==='intermediary'&&intermediaries.length?'prepare_through_intermediary':'joint_decision_maker_discussion';
  const points=requirements.map(s=>({audience_ids:[s.person_id],text:`Address the documented requirement/concern of this stakeholder: ${s.text}`,evidence_ids:s.evidence_ids}));
  for(const prerequisite of input.prerequisites)points.push({audience_ids:targetIds,text:prerequisite.text,evidence_ids:prerequisite.evidenceIds});
  if(approvers.length&&intermediaries.length)points.push({audience_ids:[...new Set(intermediaries.map(s=>s.person_id))],text:'Arrange a joint discussion or prepare the decision-maker business case; retain the technical/operational contributor and confirm current procurement requirements.',evidence_ids:[...new Set([...approvers,...intermediaries].flatMap(s=>s.evidence_ids))]});
  if(route==='clarify_authority_or_requirement')points.push({audience_ids:targetIds,text:'Confirm who approves this specific purchase and what evidence they require; titles alone do not establish authority.',evidence_ids:input.baseEvidenceIds});
  for(const statement of input.statements.filter(s=>s.current&&s.predicate==='REQUESTS_EVIDENCE'&&s.polarity==='denied'))points.push({audience_ids:[statement.person_id],text:'Clarify which requirements still apply; retained evidence includes a denied or changed requirement.',evidence_ids:input.statements.filter(s=>s.person_id===statement.person_id&&s.predicate==='REQUESTS_EVIDENCE').flatMap(s=>s.evidence_ids)});
  return actionPlanSchema.parse({route,owner_id:input.ownerId,recipient_ids:targetIds,supporting_owner_ids:input.productOwnerIds??[],review_status:'proposed',
    task:route==='resolve_prerequisite_first'?'Obtain a verified prerequisite/remediation plan before requesting a purchasing or renewal decision.':route==='prepare_through_intermediary'?'Equip the intermediary with the documented decision-maker evidence and business case.':route==='joint_decision_maker_discussion'?'Ask the existing contact to arrange a joint discussion with the scoped decision-maker.':'Clarify current authority and decision requirements.',
    rationale:'Route follows dated, scoped statements and documented prerequisites; all action is proposed for human review.',discussion_points:points,unknowns:['Confirm current authority for this scoped decision.','Confirm current requirements and any undocumented follow-up.']});
}
export type Periods={previous_start:string;previous_end:string;current_start:string;current_end:string};
export function checkPremise(metric:'ambiguous_repeat_orders'|'repeat_expansion'|'renewal'|'revenue'|'closed_expansion_deal_proxy',periods:Periods|null,events:{date:string;evidenceId:string}[],asOf:string,coverageComplete:boolean){
  if(periods){const day=(s:string)=>Date.parse(s+'T00:00:00Z')/86400000;const a=day(periods.previous_end)-day(periods.previous_start),b=day(periods.current_end)-day(periods.current_start);if(!Number.isFinite(a)||a<0||a!==b||periods.previous_end>=periods.current_start||periods.current_end>asOf)throw new Error('Invalid or incomparable periods');}
  const base={metric,periods,coverage:'Supplied snapshot only; no complete purchase/renewal/payment ledger.',qualifying_events:'Actual dated incremental orders, renewals or revenue require a ledger; usage and installed outlets do not qualify.',calculation:null,evidence_ids:events.map(e=>e.evidenceId),limitations:['Renewal friction and unrealized expansion do not establish a decline in repeat orders.'],clarification:metric==='ambiguous_repeat_orders'?'Do you mean additional expansion orders, renewals, or revenue, and which comparable periods?':null};
  if(metric!=='closed_expansion_deal_proxy'||!periods||!coverageComplete)return premiseSchema.parse({...base,status:'insufficient_data'});
  const count=(start:string,end:string)=>events.filter(e=>e.date>=start&&e.date<=end).length;
  const previous=count(periods.previous_start,periods.previous_end),current=count(periods.current_start,periods.current_end);
  return premiseSchema.parse({...base,status:current<previous?'supported':'not_supported',coverage:'Complete query of recorded currently won expansion deals in this supplied snapshot; not all real orders.',qualifying_events:'Won expansion CRM deals grouped by current stage-entry date (explicit closing-date proxy).',calculation:{previous,current,change:current-previous},limitations:[...base.limitations,'Current stage-entry date is a proxy, not a purchase date or complete transition history.']});
}
