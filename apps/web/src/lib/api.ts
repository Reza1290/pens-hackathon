import { z } from 'zod';
import { cardSchema,datasetSchema,healthSchema } from '@kasirnusa/contracts';
async function get<T>(path:string,schema:z.ZodType<T>,signal?:AbortSignal):Promise<T>{
  const response=await fetch(`/api${path}`,{signal});if(!response.ok)throw new Error(`Request failed (${response.status}). Check local API and import readiness.`);return schema.parse(await response.json());
}
export const api={
  health:(signal?:AbortSignal)=>get('/health',healthSchema,signal),
  datasets:(signal?:AbortSignal)=>get('/datasets',z.object({items:z.array(datasetSchema)}),signal),
  opportunities:(datasetId:string,signal?:AbortSignal)=>get(`/opportunities?dataset_id=${encodeURIComponent(datasetId)}`,z.object({dataset_id:z.uuid(),as_of:z.iso.date(),total:z.number(),items:z.array(cardSchema)}),signal),
};
