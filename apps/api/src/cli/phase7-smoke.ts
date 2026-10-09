// Four bounded synthetic operations; never transmit imported customer passages.
import { eq,and } from 'drizzle-orm';
import { db,pool } from '../db/client.js';
import * as s from '../db/schema/index.js';
import { env } from '../config/env.js';
import { requiredArg } from './args.js';
import { Interpreter } from '../ai/router.js';
import { jevProvider } from '../ai/providers/jev.js';
import { selectedGenerativeProvider } from '../ai/providers/selected.js';
import { stableId } from '../modules/ingestion/service.js';
import type { Context,Operation } from '../ai/schemas/interpretation.js';
try{
  const datasetId=requiredArg('dataset');const [dataset]=await db.select().from(s.datasets).where(and(eq(s.datasets.id,datasetId),eq(s.datasets.status,'ready')));
  const [account]=await db.select().from(s.accounts).where(eq(s.accounts.datasetId,datasetId)).orderBy(s.accounts.externalId).limit(1);
  if(!dataset||!account)throw new Error('ready_dataset_required');
  const person=stableId('phase7-synthetic-person'),source=stableId('phase7-synthetic-source');
  const base:Context={datasetId,accountId:account.id,subjectId:person,candidates:[{id:person,role:'unknown',start:'2025-01-01',end:null}],claim:'phase7-synthetic-smoke-v1',sources:[{id:source,field:'synthetic_text',eventDate:dataset.asOf,speakerId:person,text:'I require ROI and payback evidence before deciding on expansion S1.'}]};
  const checks:{operation:Operation;context:Context;expected:string;match:(value:unknown)=>boolean}[]=[
    {operation:'query_plan',context:{...base,grounding:{language:'en',question:'What should we do next for the selected account?',facts:[{id:'scope',text:'Use the selected account; no signal or deal has been selected.',evidence_ids:[source]}]}},expected:'account_diagnosis',match:v=>(v as {operation:string}).operation==='account_diagnosis'},
    {operation:'concern_addressed',context:{...base,sources:[...base.sources,{id:stableId('phase7-synthetic-response'),field:'synthetic_text',eventDate:dataset.asOf,speakerId:null,text:'Here is ROI 20%. The payback calculation is not included.'}]},expected:'partially_addressed',match:v=>(v as {choice:string}).choice==='partially_addressed'},
    {operation:'extract_details',context:base,expected:'REQUESTS_EVIDENCE source-span candidate',match:v=>(v as {assertions:{predicate:string}[]}).assertions.some(a=>a.predicate==='REQUESTS_EVIDENCE')},
    {operation:'answer_plan',context:{...base,grounding:{language:'en',question:'What action is supported?',facts:[{id:'prepare-evidence',text:'Prepare ROI and payback evidence requested by the decision-maker.',evidence_ids:[source]}]}},expected:'prepare-evidence fact binding',match:v=>(v as {fact_ids:string[]}).fact_ids.includes('prepare-evidence')},
  ];
  const summary=[];
  for(const check of checks){
    const provider=check.operation==='concern_addressed'?jevProvider(env.JEV_API_KEY,env.JEV_MODEL):selectedGenerativeProvider();
    const runtime=new Interpreter(db,{live:process.argv.includes('--live'),maxCalls:1,timeoutMs:env.MODEL_TIMEOUT_MS,inputRate:env.LLM_INPUT_USD_PER_MILLION,outputRate:env.LLM_OUTPUT_USD_PER_MILLION});
    const result=await runtime.run(check.context,check.operation,provider);const [run]=await db.select().from(s.modelRuns).where(eq(s.modelRuns.id,result.runId));
    summary.push({operation:check.operation,provider:provider.name,model:provider.model,status:result.status,observed:check.operation==='query_plan'&&result.value?(result.value as {operation:string}).operation:undefined,expected:check.expected,expected_matched:result.status==='succeeded'&&check.match(result.value),calls:result.calls,cached:result.cached,input_tokens:result.cached?0:run.inputTokens,output_tokens:result.cached?0:run.outputTokens,cost_usd:result.cached?'0':run.costUsd,latency_ms:run.latencyMs,run_id:result.runId});
  }
  console.log(JSON.stringify({synthetic_only:true,maximum_physical_calls:4,human_review:'pending',results:summary},null,2));
  if(process.argv.includes('--live')&&summary.some(r=>!r.expected_matched))process.exitCode=1;
}finally{await pool.end();}
