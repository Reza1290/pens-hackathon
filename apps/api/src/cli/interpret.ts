import { db,pool } from '../db/client.js';
import { env } from '../config/env.js';
import { requiredArg } from './args.js';
import { interpretationContext } from '../ai/context.js';
import { operationSchema } from '../ai/schemas/interpretation.js';
import { Interpreter } from '../ai/router.js';
import { jevProvider } from '../ai/providers/jev.js';
import { generativeProvider } from '../ai/providers/generative.js';
const optional=(name:string)=>process.argv.includes(`--${name}`)?requiredArg(name):undefined;
try{
  const operation=operationSchema.parse(requiredArg('operation'));
  const context=await interpretationContext(db,requiredArg('dataset'),requiredArg('account'),requiredArg('sources').split(','),optional('subject'),optional('claim'));
  if(operation==='concern_addressed'&&context.sources.length!==2)throw new Error('concern_and_followup_sources_required');
  const runtime=new Interpreter(db,{live:process.argv.includes('--live'),maxCalls:env.MODEL_MAX_CALLS,timeoutMs:env.MODEL_TIMEOUT_MS,inputRate:env.LLM_INPUT_USD_PER_MILLION,outputRate:env.LLM_OUTPUT_USD_PER_MILLION});
  const provider=operation==='extract_details'?generativeProvider(env.LLM_API_KEY,env.LLM_MODEL):jevProvider(env.JEV_API_KEY,env.JEV_MODEL);
  const result=await runtime.run(context,operation,provider);
  // Values may contain customer passages: persist in SQL, print only references/status.
  console.log(JSON.stringify({status:result.status,run_id:result.runId,cached:result.cached,calls:runtime.calls,provider_configured:provider.configured,review_status:'unverified_candidate',automatic_acceptance:false},null,2));
}finally{await pool.end();}
