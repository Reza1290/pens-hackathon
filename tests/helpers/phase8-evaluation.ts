import { stableId } from '../../apps/api/src/modules/ingestion/service.js';
import { assessRequirement,requirementNextAction } from '../../apps/api/src/modules/stakeholders/requirements.js';
import { selectAction } from '../../apps/api/src/modules/stakeholders/rules.js';
import { deterministicPlan } from '../../apps/api/src/modules/qa/planner.js';
import { qaRequestSchema,type StakeholderStatement } from '@kasirnusa/contracts';
import type { EvidenceBundle } from '../../apps/api/src/modules/qa/retrieval.js';
export function evaluateCase(c:any){
  const id=(s:string)=>stableId(c.id,s);
  const applicable=c.expectations.response_coverage.applicable;
  const sourceIds=c.sources.map((s:any)=>s.id);
  for(const dimension of Object.values(c.expectations) as any[])for(const evidence of dimension.evidence_ids)if(![...sourceIds,c.dataset_metadata.id].includes(evidence))throw new Error('Unbound fixture evidence');
  for(const source of c.sources){if(!c.people.some((p:any)=>p.id===source.speaker_id&&p.start<=source.event_date&&(!p.end||p.end>=source.event_date)))throw new Error('Invalid fixture speaker/employment');if(source.account_id!==c.account_id||source.event_date>c.as_of)throw new Error('Fixture account/date boundary');}
  const req=c.sources[0];
  const statement:StakeholderStatement|undefined=applicable?{id:id('statement'),person_id:id('X'),predicate:'REQUESTS_EVIDENCE',text:req.text,event_date:req.event_date,speaker_id:id(req.speaker_id),attribution:'direct',scope_id:id(req.id),scope_type:'interaction',method:'synthetic-fixture',verification:'unreviewed_rules_candidate',current:true,polarity:'affirmed',evidence_ids:[id(req.id)],decision_scope_id:id(c.decision_id)}:undefined;
  const bundle:EvidenceBundle={scope:{dataset_id:id('dataset'),account_id:id('A'),as_of:c.as_of,deal_id:null,signal_id:null},method:'synthetic-linked-fixture',assertions:[],relationships:[],sources:c.sources.map((s:any)=>({id:id(s.id),interaction_id:id(s.id),parent_id:s.parent_id?id(s.parent_id):null,external_id:s.id,filename:'synthetic',locator:1,hash:JSON.stringify(s),text:s.text,date:s.event_date,sender:s.speaker_id,recipients:'AM',path:[],reason:'explicit fixture link',attachment_unavailable:s.attachment_unavailable})),coverage:{truncated:false,unresolved_links:[],limits:{hops:2,records:24,characters:24000,milliseconds:2000},elapsed_ms:0}};
  const assessment=statement?assessRequirement(statement,bundle,c.expectations.response_coverage.reply_id?id(c.expectations.response_coverage.reply_id):undefined):null;
  const action=selectAction({ownerId:id('AM'),statements:statement?[statement]:[],currentIds:[id('X')],prerequisites:[],baseEvidenceIds:[id(c.dataset_metadata.id)],preferred:'joint'});
  const plan=deterministicPlan(qaRequestSchema.parse({question:c.question}));
  const next=assessment?requirementNextAction(assessment,id('AM'),true):{task:plan.operation==='account_diagnosis'&&'metric' in plan.args&&plan.args.metric?'clarify_metric_periods':'clarify_scope_or_authority',responsible_ids:[id('AM')],allowed_participant_ids:[],approver_ids:[],evidence_ids:[id(c.dataset_metadata.id)]};
  const checks={response_coverage:assessment?assessment.status===c.expectations.response_coverage.status:null,fulfillment:assessment?assessment.fulfillment.status===c.expectations.fulfillment.status&&assessment.fulfillment.customer_acceptance===c.expectations.fulfillment.customer_acceptance:null,next_action:next.task===c.expectations.next_action.task&&action.route===c.expectations.next_action.route&&JSON.stringify(next.responsible_ids)===JSON.stringify(c.expectations.next_action.responsible_ids.map(id))&&JSON.stringify(next.allowed_participant_ids)===JSON.stringify(c.expectations.next_action.allowed_participant_ids.map(id))&&next.approver_ids.length===c.expectations.next_action.approver_ids.length};
  if(assessment&&!assessment.source_ids.every(s=>sourceIds.map(id).includes(s)))throw new Error('Unbound assessment evidence');
  return {id:c.id,family:c.family,checks,observed:{response_coverage:assessment?.status??'not_applicable',fulfillment:assessment?.fulfillment??{status:'not_applicable'},next_action:next,route:action.route,operation:plan.operation},expected:c.expectations};
}
