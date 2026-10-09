import type { Context,Operation } from '../schemas/interpretation.js';
export type ProviderResult={model:string;value:unknown;inputTokens:number;outputTokens:number};
export interface Provider{
  name:string;model:string;configured:boolean;
  invoke(operation:Operation,context:Context,signal:AbortSignal):Promise<ProviderResult>;
}
export class ProviderError extends Error{
  constructor(public readonly code:'invalid'|'provider_error',public readonly retryable=false){super(code);}
}
export async function jsonPost(url:string,key:string,payload:unknown,signal:AbortSignal,fetcher:typeof fetch=fetch,auth:'bearer'|'google'='bearer'):Promise<unknown>{
  const response=await fetcher(url,{method:'POST',headers:{...(auth==='google'?{'x-goog-api-key':key}:{Authorization:`Bearer ${key}`}), 'Content-Type':'application/json'},body:JSON.stringify(payload),signal,redirect:'error'});
  if(!response.ok){await response.body?.cancel();throw new ProviderError('provider_error',[429,500,502,503,504,529].includes(response.status));}
  // Bound output before JSON parsing. Provider error text is deliberately never logged.
  const reader=response.body?.getReader();if(!reader)throw new ProviderError('invalid');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>262144){await reader.cancel();throw new ProviderError('invalid');}chunks.push(item.value);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ProviderError('invalid');}
}
