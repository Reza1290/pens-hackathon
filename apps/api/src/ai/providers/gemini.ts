import { generationContract } from '../prompts/generation.js';
import { z } from 'zod';
import { extractionSchema,answerPlanSchema,type Context,type Operation } from '../schemas/interpretation.js';
import { EXTRACTION_INSTRUCTIONS } from '../prompts/interpretation.js';
import { jsonPost,ProviderError,type Provider } from './interface.js';
export function geminiProvider(key:string,model:string,fetcher:typeof fetch=fetch):Provider{
  const pinned=/^gemini-[a-z0-9.-]+$/.test(model)&&!model.endsWith('-latest');
  return {name:'google-gemini',model,configured:!!key&&pinned,async invoke(operation:Operation,context:Context,signal:AbortSignal){
    if(!pinned||!['extract_details','answer_plan','draft_plan','query_plan'].includes(operation))throw new ProviderError('invalid');
    const {schema,instructions,output}=generationContract(operation);
    const payload=await jsonPost(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,key,{
      systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts:[{text:JSON.stringify(context)}]}],
      generationConfig:{maxOutputTokens:2048,responseFormat:{text:{mimeType:'APPLICATION_JSON',schema}}},
    },signal,fetcher,'google');
    const result=z.object({modelVersion:z.string(),candidates:z.array(z.object({finishReason:z.string(),content:z.object({parts:z.array(z.object({text:z.string().optional(),thought:z.boolean().optional()}))})})).length(1),usageMetadata:z.object({promptTokenCount:z.number().int().nonnegative(),candidatesTokenCount:z.number().int().nonnegative().default(0),thoughtsTokenCount:z.number().int().nonnegative().default(0)})}).parse(payload);
    if(result.candidates[0].finishReason!=='STOP'||result.modelVersion!==model)throw new ProviderError('invalid');
    const text=result.candidates[0].content.parts.filter(p=>!p.thought).map(p=>p.text??'').join('');
    let value:unknown;try{value=JSON.parse(text);}catch{throw new ProviderError('invalid');}
    return {model:result.modelVersion,value,inputTokens:result.usageMetadata.promptTokenCount,outputTokens:result.usageMetadata.candidatesTokenCount+result.usageMetadata.thoughtsTokenCount};
  }};
}
