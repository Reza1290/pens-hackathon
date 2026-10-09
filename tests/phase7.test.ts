import { randomUUID } from 'node:crypto';
import { describe,it,expect } from 'vitest';
import { operationPlanSchema,qaRequestSchema } from '@kasirnusa/contracts';
import { deterministicPlan,preserveRequest } from '../apps/api/src/modules/qa/planner.js';
import { assessRequirement } from '../apps/api/src/modules/stakeholders/requirements.js';
import { extractStatements,selectAction,type Candidate } from '../apps/api/src/modules/stakeholders/rules.js';
import type { EvidenceBundle } from '../apps/api/src/modules/qa/retrieval.js';
const person=randomUUID(),requestId=randomUUID(),sourceId=randomUUID();
const candidate:Candidate={id:person,name:'Owner X',role:'Owner',email:'x@example.test',start:'2025-01-01',end:null,current:true,evidenceIds:[sourceId]};
const statement=extractStatements({id:requestId,date:'2026-08-01',text:'I require ROI and payback evidence.',speakerId:person,sourceId,attendeeIds:[]},[candidate])[0];
statement.decision_scope_id=requestId;
const bundle=(text:string,truncated=false,attach=false):EvidenceBundle=>({scope:{dataset_id:randomUUID(),account_id:randomUUID(),as_of:'2026-09-01',deal_id:null,signal_id:null},method:'test',assertions:[],relationships:[],sources:[{id:sourceId,interaction_id:requestId,parent_id:null,external_id:'requirement',filename:'interactions.jsonl',locator:1,hash:'a',text:statement.text,date:'2026-08-01',sender:'x@example.test',recipients:'sales@example.test',path:[requestId],reason:'seed',attachment_unavailable:false},{id:randomUUID(),interaction_id:randomUUID(),parent_id:requestId,external_id:'reply',filename:'interactions.jsonl',locator:2,hash:'b',text,date:'2026-08-02',sender:'sales@example.test',recipients:'x@example.test',path:[requestId],reason:'reply',attachment_unavailable:attach}],coverage:{truncated,unresolved_links:[],limits:{hops:2,records:24,characters:24000,milliseconds:2000},elapsed_ms:1}});
describe('phase 7 contracts',()=>{
  it('preserves bilingual outcome checks and rejects invented scope or comparison baselines',()=>{
    for(const question of ['Why are repeat orders lower?','Mengapa repeat order turun?','Mengapa pesanan ulang menurun?']){
      const input=qaRequestSchema.parse({question,metric:'closed_expansion_deal_proxy',periods:{previous_start:'2026-07-01',previous_end:'2026-07-31',current_start:'2026-08-01',current_end:'2026-08-31'}});
      const checked=preserveRequest(input,{operation:'stakeholder_guidance',args:{signal_id:null,deal_id:null}});expect(checked.operation).toBe('account_diagnosis');expect(checked.args).toMatchObject({metric:input.metric,periods:input.periods});
    }
    const input=qaRequestSchema.parse({question:'What should we do next for this account?'});
    expect(preserveRequest(input,{operation:'stakeholder_guidance',args:{signal_id:null,deal_id:randomUUID()}}).operation).toBe('account_diagnosis');
    expect(preserveRequest(input,{operation:'stakeholder_guidance',args:{signal_id:null,deal_id:null}}).operation).toBe('stakeholder_guidance');
    expect(preserveRequest(input,{operation:'account_diagnosis',args:{signal_id:null,deal_id:null,metric:'revenue',periods:{previous_start:'2026-07-01',previous_end:'2026-07-31',current_start:'2026-08-01',current_end:'2026-08-31'}}}).args).toMatchObject({metric:null,periods:null});
  });
  it('rejects executable/arbitrary planner arguments and ambiguous keyword routing',()=>{
    expect(()=>operationPlanSchema.parse({operation:'sql',args:{query:'select *'}})).toThrow();
    expect(()=>operationPlanSchema.parse({operation:'source_search',args:{query:'ROI',url:'https://example.test'}})).toThrow();
    expect(deterministicPlan(qaRequestSchema.parse({question:'why?'})).operation).toBe('clarify');
    expect(deterministicPlan(qaRequestSchema.parse({question:'berapa?'})).operation).toBe('clarify');
  });
  it('separates the specific reply, fulfillment and supported preparation without authority',()=>{
    const broad={...statement,text:'For S1 I require a reference.'};
    const reference=bundle('For S1 here is the requested reference.',false,true);reference.sources[0].text=broad.text;
    const checked=assessRequirement(broad,reference);expect(checked.status).toBe('addressed');expect(checked.fulfillment.status).toBe('insufficient_evidence');expect(checked.fulfillment.customer_acceptance).toBe('not_established');
    expect(assessRequirement({...broad,text:'For S1 I require a named retail reference with contact details.'},reference).status).toBe('insufficient_evidence');
    const scoped={...statement,text:'For S1 I require ROI and payback evidence.'};const other=bundle('For S2 here is ROI 20% and payback 12 months.');other.sources[0].text=scoped.text;
    const wrong=assessRequirement(scoped,other);expect(wrong.status).toBe('not_addressed');expect(wrong.fulfillment.status).toBe('insufficient_evidence');
    const history=bundle('Here is ROI 20%.');const firstId=history.sources[1].id;history.sources.push({...history.sources[1],id:randomUUID(),interaction_id:randomUUID(),date:'2026-08-03',text:'Here is ROI 20% and payback 12 months.',hash:'later'});
    expect(assessRequirement(statement,history,firstId).status).toBe('partially_addressed');expect(assessRequirement(statement,history).status).toBe('addressed');
    const action=selectAction({ownerId:randomUUID(),statements:[statement],currentIds:[person],prerequisites:[],baseEvidenceIds:[sourceId],preferred:'joint'});expect(action.route).toBe('clarify_authority_or_requirement');expect(action.tasks[0].text).toContain('Prepare or obtain');expect(action.tasks[0].owner_ids).toEqual([action.owner_id]);expect(action.discussion_points.some(p=>p.text.includes('titles alone'))).toBe(true);
  });
  it('does not turn purchase rejection into withdrawal of purchasing authority',()=>{
    for(const text of ['I reject the purchase for S1.','Saya tidak menyetujui pembelian untuk S1.'])expect(extractStatements({id:requestId,date:'2026-08-01',text,speakerId:person,sourceId,attendeeIds:[]},[candidate]).some(s=>s.predicate==='APPROVER_FOR')).toBe(false);
    for(const text of ['I am no longer authorized to approve purchases for S1.','Saya tidak lagi berwenang menyetujui pembelian untuk S1.','Saya tidak lagi memutuskan pengadaan untuk S1.'])expect(extractStatements({id:requestId,date:'2026-08-01',text,speakerId:person,sourceId,attendeeIds:[]},[candidate]).find(s=>s.predicate==='APPROVER_FOR')?.polarity).toBe('denied');
  });
  it('distinguishes complete, partial, unrelated and unavailable follow-ups',()=>{
    expect(assessRequirement(statement,bundle('Here is ROI 20% and payback 12 months.')).status).toBe('addressed');
    const partial=assessRequirement(statement,bundle('Here is ROI 20%.'));expect(partial.status).toBe('partially_addressed');expect(partial.missing_details).toContain('payback');
    expect(assessRequirement(statement,bundle('Features include analytics and stock controls.')).status).toBe('not_addressed');
    expect(assessRequirement(statement,bundle('ROI and payback are attached.',false,true)).status).toBe('insufficient_evidence');
    expect(assessRequirement(statement,bundle('ROI 20%, payback 12 months.',true)).status).toBe('insufficient_evidence');
    const unrelated=bundle('ROI 20%, payback 12 months.');unrelated.sources[1].parent_id=null;expect(assessRequirement(statement,unrelated).status).toBe('insufficient_evidence');
  });
});
