import { z } from 'zod';
import { question } from '../prompts/interpretation.js';
import type { Context,Operation } from '../schemas/interpretation.js';
import { jsonPost,ProviderError,type Provider } from './interface.js';
export function jevProvider(key:string,model='jev-1.13.0',fetcher:typeof fetch=fetch):Provider{
  return {name:'typesafe',model,configured:!!key&&/^jev-\d+\.\d+\.\d+$/.test(model),async invoke(operation:Operation,context:Context,signal:AbortSignal){
    if(operation==='extract_details')throw new ProviderError('invalid');
    const payload=await jsonPost('https://api.typesafe.ai/v1/systemone',key,{model,state:context,questions:{judgment:question(operation)}},signal,fetcher);
    const result=z.object({model:z.string(),answers:z.object({judgment:z.unknown()}),usage:z.object({input_tokens:z.number().int().nonnegative(),output_tokens:z.number().int().nonnegative()})}).parse(payload);
    return {model:result.model,value:result.answers.judgment,inputTokens:result.usage.input_tokens,outputTokens:result.usage.output_tokens};
  }};
}
