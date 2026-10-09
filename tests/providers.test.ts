import { randomUUID } from 'node:crypto';
import { describe,it,expect } from 'vitest';
import { validateValue,type Context,choices } from '../apps/api/src/ai/schemas/interpretation.js';
import { cacheKey } from '../apps/api/src/ai/router.js';
import { jevProvider } from '../apps/api/src/ai/providers/jev.js';
import { generativeProvider } from '../apps/api/src/ai/providers/generative.js';
const person=randomUUID(),source=randomUUID();
const context:Context={datasetId:randomUUID(),accountId:randomUUID(),sources:[{id:source,field:'isi',text:'Need ROI evidence.',eventDate:'2026-08-01',speakerId:person}],candidates:[{id:person,role:'unknown',start:'2025-01-01',end:null}],subjectId:person,claim:''};
describe('synthetic provider contract checks (no live inference)',()=>{
  it('allows only supplied facts and rejects new prose/citations in grounded plans',async()=>{
    const grounded={...context,grounding:{question:'Who approves?',language:'en' as const,facts:[{id:'fact-1',text:'Authority unknown',evidence_ids:[source]}]}};
    expect(validateValue('answer_plan',{fact_ids:['fact-1']},grounded)).toEqual({fact_ids:['fact-1']});
    for(const output of [{fact_ids:['invented']},{fact_ids:['fact-1','fact-1']},{fact_ids:['fact-1'],text:'Guaranteed approval'},{fact_ids:[]}])expect(()=>validateValue('answer_plan',output,grounded)).toThrow();
    const transport:typeof fetch=async(_url,options)=>{const body=JSON.parse(String(options?.body));expect(body.instructions).toContain('untrusted data');expect(body.text.format.schema.properties.fact_ids).toBeDefined();return Response.json({model:'qa-test',status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"fact_ids":["fact-1"]}'}]}],usage:{input_tokens:12,output_tokens:3}});};
    expect((await generativeProvider('test','qa-test',transport).invoke('draft_plan',grounded,new AbortController().signal)).value).toEqual({fact_ids:['fact-1']});
  });
  it('rejects invalid spans, invented identities and changed attribution',()=>{
    const assertion={subjectId:person,predicate:'REQUESTS_EVIDENCE',value:'ROI',sourceId:source,field:'isi',quote:'ROI',start:5,end:8,eventDate:'2026-08-01',attribution:'direct',speakerId:person};
    expect(validateValue('extract_details',{status:'candidate',assertions:[assertion]},context)).toBeDefined();
    for(const change of [{quote:'profit'},{subjectId:randomUUID()},{eventDate:'2026-08-02'},{speakerId:randomUUID()}])expect(()=>validateValue('extract_details',{status:'candidate',assertions:[{...assertion,...change}]},context)).toThrow();
    const other=randomUUID(),reported={...context,candidates:[...context.candidates,{id:other,role:'unknown',start:'2025-01-01',end:null}]};
    expect(()=>validateValue('extract_details',{status:'candidate',assertions:[{...assertion,subjectId:other}]},reported)).toThrow();
    expect(validateValue('extract_details',{status:'candidate',assertions:[{...assertion,subjectId:other,attribution:'reported'}]},reported)).toBeDefined();
  });
  it('invalidates keys for source/scope/model/prompt/schema/parameter changes',()=>{
    const provider=jevProvider('test-only');const key=cacheKey(context,'intent',provider);
    for(const changed of [{...context,claim:'changed'},{...context,accountId:randomUUID()},{...context,sources:[{...context.sources[0],text:'changed'}]}])expect(cacheKey(changed,'intent',provider)).not.toBe(key);
    expect(cacheKey(context,'role',provider)).not.toBe(key);
    expect(cacheKey(context,'intent',{...provider,model:'jev-2.0.0'})).not.toBe(key);
    for(const versions of [{prompt:'new',schema:'interpretation-v1',parameters:'interpretation-limits-v1'},{prompt:'bounded-interpretation-v1',schema:'new',parameters:'interpretation-limits-v1'},{prompt:'bounded-interpretation-v1',schema:'interpretation-v1',parameters:'new'}])expect(cacheKey(context,'intent',provider,versions)).not.toBe(key);
  });
  it('rejects incomplete or inconsistent choice distributions',()=>{
    const probabilities=Object.fromEntries(choices.intent.map(k=>[k,k==='none'?1:0]));
    const value={type:'choice',choice:'none',probabilities,confidence:0.8};expect(validateValue('intent',value,context)).toBeDefined();
    expect(()=>validateValue('intent',{...value,probabilities:{none:1}},context)).toThrow();
    expect(()=>validateValue('intent',{...value,choice:'quotation_request'},context)).toThrow();
  });
  it('uses the documented Jev HTTP shape and pinned models',async()=>{
    const transport:typeof fetch=async(url,options)=>{
      expect(url).toBe('https://api.typesafe.ai/v1/systemone');const body=JSON.parse(String(options?.body));expect(body.questions.judgment.type).toBe('choice');expect(body.model).toBe('jev-1.13.0');
      return Response.json({model:'jev-1.13.0',answers:{judgment:{type:'choice',choice:'none'}},usage:{input_tokens:100,output_tokens:10}});
    };
    expect((await jevProvider('synthetic-key','jev-1.13.0',transport).invoke('intent',context,new AbortController().signal)).inputTokens).toBe(100);
    expect(jevProvider('test','jev-latest').configured).toBe(false);
  });
  it('handles structured extraction and rejects refusal/incomplete responses',async()=>{
    const transport:typeof fetch=async(url,options)=>{
      expect(url).toBe('https://api.openai.com/v1/responses');const body=JSON.parse(String(options?.body));expect(body.store).toBe(false);expect(body.text.format.type).toBe('json_schema');
      return Response.json({model:'test-model',status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"status":"insufficient_evidence","assertions":[]}'}]}],usage:{input_tokens:100,output_tokens:10}});
    };
    expect((await generativeProvider('synthetic-key','test-model',transport).invoke('extract_details',context,new AbortController().signal)).value).toMatchObject({status:'insufficient_evidence'});
    const refused:typeof fetch=async()=>Response.json({model:'test-model',status:'completed',output:[{type:'message',content:[{type:'refusal'}]}],usage:{input_tokens:100,output_tokens:10}});
    await expect(generativeProvider('synthetic-key','test-model',refused).invoke('extract_details',context,new AbortController().signal)).rejects.toThrow();
  });
});
