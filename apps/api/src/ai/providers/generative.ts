import { z } from 'zod';
import { extractionSchema,type Context,type Operation } from '../schemas/interpretation.js';
import { EXTRACTION_INSTRUCTIONS } from '../prompts/interpretation.js';
import { jsonPost,ProviderError,type Provider } from './interface.js';
// Explicitly configured model; no guessed default or alias-based successful cache.
export function generativeProvider(key:string,model:string,fetcher:typeof fetch=fetch):Provider{
  return {name:'openai',model,configured:!!key&&!!model,async invoke(operation:Operation,context:Context,signal:AbortSignal){
    if(operation!=='extract_details')throw new ProviderError('invalid');
    const schema=z.toJSONSchema(extractionSchema);delete schema.$schema;
    const payload=await jsonPost('https://api.openai.com/v1/responses',key,{model,store:false,max_output_tokens:2048,instructions:EXTRACTION_INSTRUCTIONS,input:JSON.stringify(context),text:{format:{type:'json_schema',name:'evidence_candidates',strict:true,schema}}},signal,fetcher);
    const result=z.object({model:z.string(),status:z.literal('completed'),output:z.array(z.object({type:z.string(),content:z.array(z.object({type:z.string(),text:z.string().optional()})).optional()})),usage:z.object({input_tokens:z.number().int().nonnegative(),output_tokens:z.number().int().nonnegative()})}).parse(payload);
    const content=result.output.flatMap(item=>item.content??[]);
    if(content.some(item=>item.type==='refusal'))throw new ProviderError('invalid');
    const text=content.filter(item=>item.type==='output_text').map(item=>item.text??'').join('');
    let value:unknown;try{value=JSON.parse(text);}catch{throw new ProviderError('invalid');}
    return {model:result.model,value,inputTokens:result.usage.input_tokens,outputTokens:result.usage.output_tokens};
  }};
}
