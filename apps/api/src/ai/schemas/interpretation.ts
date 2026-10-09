import { z } from 'zod';

export const SCHEMA_VERSION='interpretation-v1';
export const operationSchema=z.enum(['intent','role','relevance','concern_addressed','extract_details','answer_plan','draft_plan']);
export type Operation=z.infer<typeof operationSchema>;
export const contextSchema=z.object({
  datasetId:z.uuid(),accountId:z.uuid(),
  sources:z.array(z.object({id:z.uuid(),field:z.string().min(1),text:z.string().max(12000),eventDate:z.iso.date(),speakerId:z.uuid().nullable()})).min(1).max(4),
  candidates:z.array(z.object({id:z.uuid(),role:z.string(),start:z.iso.date(),end:z.iso.date().nullable()})).max(12),
  subjectId:z.uuid().nullable(),claim:z.string().max(2000).default(''),
  grounding:z.object({question:z.string().max(2000),language:z.enum(['en','id']),facts:z.array(z.object({id:z.string(),text:z.string().max(3000),evidence_ids:z.array(z.uuid())})).min(1).max(24)}).optional(),
});
export type Context=z.infer<typeof contextSchema>;
export const choices={
  intent:['quotation_request','explicit_plan','acknowledgement','substantive_candidate','cancellation','revision','none','insufficient_evidence'],
  role:['approver','technical_evaluator','intermediary','insufficient_evidence'],
  relevance:['relevant','irrelevant','insufficient_evidence'],
  concern_addressed:['addressed','not_addressed','insufficient_evidence'],
} as const;
export const extractionSchema=z.object({
  status:z.enum(['candidate','insufficient_evidence']),
  assertions:z.array(z.object({
    subjectId:z.uuid(),predicate:z.enum(['EXPANSION_DETAILS','REQUESTS_EVIDENCE','RAISES_CONCERN','APPROVER_FOR','EVALUATES_TECHNICAL_FOR']),
    value:z.string().min(1).max(500),sourceId:z.uuid(),field:z.string(),quote:z.string().min(1),
    start:z.number().int().nonnegative(),end:z.number().int().positive(),eventDate:z.iso.date(),
    attribution:z.enum(['direct','reported']),speakerId:z.uuid().nullable(),
  })).max(12),
}).strict();
export function validateValue(operation:Operation,value:unknown,context:Context){
  if(operation==='answer_plan'||operation==='draft_plan'){
    const output=answerPlanSchema.parse(value);
    if(!context.grounding||output.fact_ids.some(id=>!context.grounding!.facts.some(f=>f.id===id))||new Set(output.fact_ids).size!==output.fact_ids.length)throw new Error('unsupported_answer_fact');
    return output;
  }
  if(operation!=='extract_details'){
    const answer=z.object({type:z.literal('choice'),choice:z.string(),probabilities:z.record(z.string(),z.number().min(0).max(1)),confidence:z.number().min(0).max(1)}).parse(value);
    const expected:readonly string[]=choices[operation];
    if(!expected.includes(answer.choice)||Object.keys(answer.probabilities).length!==expected.length||expected.some(k=>answer.probabilities[k]===undefined)||Math.abs(Object.values(answer.probabilities).reduce((a,b)=>a+b,0)-1)>0.001||answer.probabilities[answer.choice]<Math.max(...Object.values(answer.probabilities)))throw new Error('invalid_choice_distribution');
    if((operation==='role'&&context.subjectId===null||operation==='relevance'&&!context.claim||operation==='concern_addressed'&&context.sources.length!==2)&&answer.choice!=='insufficient_evidence')throw new Error('missing_judgment_context');
    return answer;
  }
  const output=extractionSchema.parse(value);
  if(output.status==='insufficient_evidence'&&output.assertions.length)throw new Error('insufficient_with_assertions');
  if(output.status==='candidate'&&!output.assertions.length)throw new Error('empty_candidate');
  for(const a of output.assertions){
    const source=context.sources.find(s=>s.id===a.sourceId&&s.field===a.field);
    const candidate=context.candidates.find(c=>c.id===a.subjectId&&c.start<=a.eventDate&&(!c.end||c.end>=a.eventDate));
    if(!source||!candidate||source.eventDate!==a.eventDate||source.speakerId!==a.speakerId||a.end>source.text.length||source.text.slice(a.start,a.end)!==a.quote)throw new Error('invalid_evidence_scope_or_span');
    if(a.attribution==='direct'&&a.subjectId!==source.speakerId)throw new Error('invalid_direct_attribution');
  }
  return output;
}
// The model may select/order validated facts; it cannot write new factual claims.
export const answerPlanSchema=z.object({fact_ids:z.array(z.string()).min(1).max(12)}).strict();
