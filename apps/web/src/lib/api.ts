import { z } from 'zod';
import { cardSchema,datasetSchema,accountSchema,graphSchema,sourceSchema,diagnosisSchema,draftSchema } from '@kasirnusa/contracts';
async function request<T>(path:string,schema:z.ZodType<T>,signal?:AbortSignal,body?:unknown):Promise<T>{
  const response=await fetch('/api'+path,{signal,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  if(!response.ok){const detail=await response.json().catch(()=>({}));throw new Error((detail.error??'Request failed')+' ('+response.status+')');}
  return schema.parse(await response.json());
}
const query=(dataset:string,options:Record<string,string>={})=>'?'+new URLSearchParams({dataset_id:dataset,...options});
export const api={
  datasets:(signal?:AbortSignal)=>request('/datasets',z.object({items:z.array(datasetSchema)}),signal),
  accounts:(dataset:string,signal?:AbortSignal)=>request('/accounts'+query(dataset,{page_size:'100'}),z.object({items:z.array(accountSchema)}),signal),
  opportunities:(dataset:string,options:Record<string,string>,signal?:AbortSignal)=>request('/opportunities'+query(dataset,options),z.object({total:z.number(),items:z.array(cardSchema)}),signal),
  card:(dataset:string,id:string,signal?:AbortSignal)=>request('/opportunities/'+id+query(dataset),cardSchema,signal),
  diagnosis:(dataset:string,id:string,options:Record<string,string>,signal?:AbortSignal)=>request('/accounts/'+id+'/diagnosis'+query(dataset,options),diagnosisSchema,signal),
  graph:(dataset:string,kind:'accounts'|'opportunities',id:string,signal?:AbortSignal)=>request('/'+kind+'/'+id+'/'+(kind==='accounts'?'diagnosis/':'')+'evidence'+query(dataset),graphSchema,signal),
  source:(dataset:string,id:string,signal?:AbortSignal)=>request('/sources/'+id+query(dataset),sourceSchema,signal),
  draft:(dataset:string,kind:'accounts'|'opportunities',id:string,language:'en'|'id',options:Record<string,string>,signal?:AbortSignal)=>request('/'+kind+'/'+id+'/draft'+query(dataset,options),draftSchema,signal,{language}),
};
