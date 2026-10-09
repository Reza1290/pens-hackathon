import { and,eq } from 'drizzle-orm';
import { db,pool } from '../db/client.js';
import * as s from '../db/schema/index.js';
import { env } from '../config/env.js';
import { requiredArg } from './args.js';
import { Interpreter } from '../ai/router.js';
import { jevProvider } from '../ai/providers/jev.js';
import { geminiProvider } from '../ai/providers/gemini.js';
import { generativeProvider } from '../ai/providers/generative.js';
import { stableId } from '../modules/ingestion/service.js';
import type { Context } from '../ai/schemas/interpretation.js';
try{
  const datasetId=requiredArg('dataset');
  const [dataset]=await db.select().from(s.datasets).where(and(eq(s.datasets.id,datasetId),eq(s.datasets.status,'ready')));
  const [account]=await db.select().from(s.accounts).where(eq(s.accounts.datasetId,datasetId)).orderBy(s.accounts.externalId).limit(1);
  if(!dataset||!account)throw new Error('ready_dataset_required');
  const person=stableId('provider-smoke-person'),source=stableId('provider-smoke-source');
  const base:Context={datasetId,accountId:account.id,subjectId:person,candidates:[{id:person,role:'unknown',start:'2025-01-01',end:null}],claim:'synthetic-provider-check-v1',sources:[{id:source,field:'synthetic_text',eventDate:dataset.asOf,speakerId:person,text:'We plan to add 3 outlets. Please send a quotation.'}]};
  const summary=[];
  for(const kind of ['jev','generative'] as const){
    let httpStatus:number|null=null;
    const transport:typeof fetch=async(url,options)=>{const response=await fetch(url,options);httpStatus=response.status;return response;};
    const provider=kind==='jev'?jevProvider(env.JEV_API_KEY,env.JEV_MODEL,transport):env.LLM_PROVIDER==='gemini'?geminiProvider(env.LLM_API_KEY,env.LLM_MODEL,transport):generativeProvider(env.LLM_API_KEY,env.LLM_MODEL,transport);
    const context=kind==='jev'?base:{...base,grounding:{language:'en' as const,question:'What action is supported?',facts:[{id:'synthetic-fact-1',text:'Prepare a quotation for the recorded request.',evidence_ids:[source]}]}};
    // One physical attempt per provider; no hidden retry or customer content.
    const runtime=new Interpreter(db,{live:process.argv.includes('--live'),maxCalls:1,timeoutMs:env.MODEL_TIMEOUT_MS,inputRate:env.LLM_INPUT_USD_PER_MILLION,outputRate:env.LLM_OUTPUT_USD_PER_MILLION});
    const result=await runtime.run(context,kind==='jev'?'intent':'answer_plan',provider);
    const [run]=await db.select({input:s.modelRuns.inputTokens,output:s.modelRuns.outputTokens,cost:s.modelRuns.costUsd}).from(s.modelRuns).where(eq(s.modelRuns.id,result.runId));
    summary.push({provider:provider.name,model:provider.model,configured:provider.configured,status:result.status,http_status:httpStatus,cached:result.cached,calls:result.calls,input_tokens:result.cached?0:run.input,output_tokens:result.cached?0:run.output,estimated_cost_usd:result.cached?'0':run.cost,run_id:result.runId,synthetic_only:true});
  }
  console.log(JSON.stringify({results:summary,automatic_acceptance:false,human_review:'pending'},null,2));
  if(process.argv.includes('--live')&&summary.some(r=>r.status!=='succeeded'))process.exitCode=1;
}finally{await pool.end();}
