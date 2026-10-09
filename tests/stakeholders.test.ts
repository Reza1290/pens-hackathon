import { randomUUID } from 'node:crypto';
import { describe,it,expect } from 'vitest';
import { extractStatements,authority,selectAction,checkPremise,type Candidate } from '../apps/api/src/modules/stakeholders/rules.js';
const ownerId=randomUUID(),employee=randomUUID(),operatorId=randomUUID();
const person=(id:string,role:string):Candidate=>({id,name:role==='CFO'?'Sample CFO':'Sample Owner',email:'sample@example.test',role,start:'2025-01-01',end:null,current:true,evidenceIds:[randomUUID()]});
const people=[person(ownerId,'CFO'),person(operatorId,'Operations Lead')];
const message=(speakerId:string,text:string)=>({id:randomUUID(),date:'2026-08-01',text,sourceId:randomUUID(),speakerId,attendeeIds:[]});
describe('dated stakeholder guidance and premise checks',()=>{
  it('changes route and discussion content from actual requirements and retains intermediary',()=>{
    const owner=extractStatements(message(ownerId,'Saya menyetujui pembelian untuk rollout ini. Saya memerlukan bukti ROI.'),people);
    const operator=extractStatements(message(operatorId,'Saya menyiapkan business case untuk CFO.'),people);
    for(const statement of [...owner,...operator])statement.decision_scope_id=owner[0].scope_id;
    const input={ownerId:employee,statements:[...owner,...operator],currentIds:[ownerId,operatorId],prerequisites:[],baseEvidenceIds:[randomUUID()],preferred:'joint' as const};
    const joint=selectAction(input),prepare=selectAction({...input,preferred:'intermediary'});
    expect(joint.route).toBe('joint_decision_maker_discussion');expect(prepare.route).toBe('prepare_through_intermediary');expect(prepare.recipient_ids).toContain(operatorId);
    const roi=prepare.discussion_points.find(p=>p.text.includes('ROI'));expect(roi?.audience_ids).toEqual([ownerId]);
    const reference=extractStatements(message(ownerId,'Saya menyetujui pembelian untuk rollout ini. Saya membutuhkan referensi.'),people);
    for(const statement of reference)statement.decision_scope_id=owner[0].scope_id;
    expect(selectAction({...input,statements:[...reference,...operator]}).discussion_points.some(p=>p.text.includes('referensi'))).toBe(true);
    const denied=extractStatements(message(ownerId,'Saya tidak lagi memerlukan bukti ROI.'),people);
    const changed=selectAction({...input,statements:[...owner,...operator,...denied]});
    expect(changed.discussion_points.some(p=>p.text.startsWith('Address the documented')&&p.text.includes('ROI'))).toBe(false);expect(changed.discussion_points.some(p=>p.text.includes('denied or changed'))).toBe(true);
    const prerequisite=selectAction({...input,prerequisites:[{text:'Resolve promised integration first.',evidenceIds:[randomUUID()]}]});expect(prerequisite.route).toBe('resolve_prerequisite_first');
  });
  it('keeps reported requirements on the decision-maker rather than the speaker',()=>{
    const source=message(operatorId,'CFO membutuhkan bukti ROI. Saya menyiapkan business case untuk CFO.');
    const assertions=extractStatements(source,people);const requirement=assertions.find(s=>s.predicate==='REQUESTS_EVIDENCE');
    expect(requirement).toMatchObject({person_id:ownerId,speaker_id:operatorId,attribution:'reported'});
    expect(assertions.filter(s=>s.person_id===operatorId&&s.predicate==='REQUESTS_EVIDENCE')).toHaveLength(0);
  });
  it('does not derive authority from a title and surfaces negative/outdated evidence',()=>{
    expect(extractStatements(message(ownerId,'Saya pemilik perusahaan.'),people)).toHaveLength(0);
    const positive=extractStatements(message(ownerId,'Saya menyetujui pembelian ini.'),people);
    const negative=extractStatements(message(ownerId,'Saya tidak lagi menyetujui pembelian ini.'),people);
    expect(authority([...positive,...negative])).toBe('conflicting_or_outdated');
    expect(authority(positive.map(s=>({...s,current:false})))).toBe('conflicting_or_outdated');
    expect(selectAction({ownerId:employee,statements:[...positive,...negative],currentIds:[ownerId],prerequisites:[],baseEvidenceIds:[randomUUID()],preferred:'joint'}).route).toBe('clarify_authority_or_requirement');
    expect(extractStatements(message(ownerId,'Saya menyetujui pembelian ini.'),[{...people[0],end:'2026-07-01',current:false}])).toHaveLength(0);
  });
  it('requires a metric and coverage, and exposes closing-stage proxies explicitly',()=>{
    const periods={previous_start:'2026-07-01',previous_end:'2026-07-14',current_start:'2026-08-01',current_end:'2026-08-14'},events=[{date:'2026-07-10',evidenceId:randomUUID()}];
    expect(checkPremise('ambiguous_repeat_orders',null,events,'2026-09-01',true)).toMatchObject({status:'insufficient_data',calculation:null});
    expect(checkPremise('repeat_expansion',periods,events,'2026-09-01',true).status).toBe('insufficient_data');
    expect(checkPremise('revenue',periods,events,'2026-09-01',true).status).toBe('insufficient_data');
    expect(checkPremise('closed_expansion_deal_proxy',periods,events,'2026-09-01',true)).toMatchObject({status:'supported',calculation:{previous:1,current:0,change:-1}});
    expect(checkPremise('closed_expansion_deal_proxy',periods,[],'2026-09-01',true).status).toBe('not_supported');
    expect(checkPremise('closed_expansion_deal_proxy',periods,events,'2026-09-01',false).status).toBe('insufficient_data');
    expect(()=>checkPremise('renewal',{...periods,current_end:'2026-08-15'},events,'2026-09-01',true)).toThrow();
  });
});
