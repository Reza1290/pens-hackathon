import { readFileSync } from 'node:fs';
import { describe,it,expect } from 'vitest';
import { requireApproval,boundedSyntheticTransport,liveBudget,liveCaseIds,syntheticContext } from './helpers/phase8-acceptance.js';
import { jevProvider } from '../apps/api/src/ai/providers/jev.js';
import { validateValue,choices } from '../apps/api/src/ai/schemas/interpretation.js';
const packet=JSON.parse(readFileSync(new URL('./fixtures/phase8-review-v2.json',import.meta.url),'utf8'));
describe('Phase 8 acceptance preparation guards (simulated, not approval)',()=>{
  it('requires user approval for the exact packet, final commit and live cap',()=>{
    const plan={packet_sha256:'packet',code_commit:'commit'};
    const approved={decision:'approved',actor:'user',approval_quote:'Synthetic test actor only; not real approval.',recorded_at:'test',plan_sha256:'plan',packet_sha256:'packet',code_commit:'commit',labels_and_criteria:true,synthetic_live_budget:true,physical_call_cap:10};
    expect(()=>requireApproval(plan,approved,'plan','commit')).not.toThrow();
    for(const change of [{decision:'pending'},{actor:'agent'},{approval_quote:''},{packet_sha256:'changed'},{plan_sha256:'changed'},{code_commit:'other'},{physical_call_cap:11},{synthetic_live_budget:false},{labels_and_criteria:false}])expect(()=>requireApproval(plan,{...approved,...change},'plan','commit')).toThrow();
    expect(()=>requireApproval(plan,approved,'plan','new-commit')).toThrow();
  });
  it('exercises all planned synthetic adapter requests without transmitting labels, and caps physical calls',async()=>{
    let calls=0,reserved=0;const wires:any[]=[];
    const transport:typeof fetch=async(_url,init)=>{const request=JSON.parse(String(init!.body));expect(JSON.stringify(request.state)).not.toMatch(/expectations|approval_quote|proposed_expectation/);const caseId=liveCaseIds[calls++];const c=packet.cases.find((c:any)=>c.id===caseId);expect(request.state.sources.map((s:any)=>s.text)).toEqual(c.sources.map((s:any)=>s.text));const selected=c.expectations.response_coverage.status;return new Response(JSON.stringify({model:'jev-1.13.0',answers:{judgment:{type:'choice',choice:selected,confidence:1,probabilities:Object.fromEntries(choices.concern_addressed.map(k=>[k,k===selected?1:0]))}},usage:{input_tokens:10,output_tokens:2}}),{status:200});};
    const bounded=boundedSyntheticTransport(transport,async()=>{reserved++;},async r=>{wires.push(r);});const provider=jevProvider('synthetic-test-key','jev-1.13.0',bounded);
    for(const id of liveCaseIds){const c=packet.cases.find((c:any)=>c.id===id),context=syntheticContext(c);const result=await provider.invoke('concern_addressed',context,AbortSignal.timeout(1000));expect((validateValue('concern_addressed',result.value,context) as any).choice).toBe(c.expectations.response_coverage.status);}
    expect(calls).toBe(10);expect(reserved).toBe(10);expect(wires).toHaveLength(10);
    await expect(provider.invoke('concern_addressed',syntheticContext(packet.cases.find((c:any)=>c.id==='reference-en')),AbortSignal.timeout(1000))).rejects.toThrow('cap');expect(calls).toBe(liveBudget.physical_call_cap);
    expect(JSON.stringify(wires)).not.toContain('synthetic-test-key');
  });
  it('reserves failures once without retrying and rejects another endpoint',async()=>{
    let calls=0,reserved=0;
    const transport=boundedSyntheticTransport(async()=>{calls++;throw new TypeError('injected offline failure');},async()=>{reserved++;},async()=>{});
    const init={method:'POST',body:JSON.stringify({model:'jev-1.13.0',questions:{judgment:{}}})};
    await expect(transport('https://api.typesafe.ai/v1/systemone',init)).rejects.toThrow();expect(calls).toBe(1);expect(reserved).toBe(1);
    await expect(transport('https://other.example.test',init)).rejects.toThrow('endpoint');expect(reserved).toBe(1);
  });
});
