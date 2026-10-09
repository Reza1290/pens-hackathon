// Explicit synthetic normal-path compatibility check, not independent acceptance.
import { randomUUID } from 'node:crypto';
import { resolve,basename } from 'node:path';
import { rm,realpath,mkdir,writeFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { env,projectRoot } from '../apps/api/src/config/env.js';
import * as schema from '../apps/api/src/db/schema/index.js';
import { fixture } from './fixtures/snapshot.js';
import { importDataset,stableId } from '../apps/api/src/modules/ingestion/service.js';
import { inside } from '../apps/api/src/modules/ingestion/manifest.js';
import { analyzeDataset } from '../apps/api/src/modules/opportunities/service.js';
import { createApp } from '../apps/api/src/app.js';
import { Interpreter } from '../apps/api/src/ai/router.js';
import { selectedGenerativeProvider } from '../apps/api/src/ai/providers/selected.js';
import { recordReview,reviewedStatements } from '../apps/api/src/modules/stakeholders/review.js';
import { jevProvider } from '../apps/api/src/ai/providers/jev.js';
const live=process.argv.includes('--live');const name=`kasirnusa_phase8_${randomUUID().replaceAll('-','')}`;
const url=new URL(env.DATABASE_URL);if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Local database required');
const admin=new pg.Pool({connectionString:url.href});url.pathname='/'+name;const pool=new pg.Pool({connectionString:url.href});const db=drizzle(pool,{schema});let created=false,path:string|undefined;
try{
  await admin.query(`CREATE DATABASE "${name}"`);created=true;await migrate(db,{migrationsFolder:resolve(projectRoot,'apps/api/src/db/migrations')});
  const raw=await fixture({ownerIntermediary:true,messages:[{id:'I2',body:'I approve this purchase for expansion S1. I require ROI and payback evidence.',parent:'I1'},{id:'I3',body:'I handle operational inputs and prepare the proposal for X.',parent:'I2',sender:'operator@example.test'},{id:'I4',body:'Our features include stock controls.',parent:'I3',sender:'manager@example.test',date:'2026-08-03'},{id:'I5',body:'I need custom procurement documentation for expansion S1.',parent:'I2'}]});path=raw.path;
  const imported=await importDataset(db,raw.manifest);const datasetId=imported.dataset_id,accountId=stableId(datasetId,'account','A1');await analyzeDataset(db,datasetId,'2026-09-01');
  const generation=new Interpreter(db,{live,maxCalls:2,timeoutMs:env.MODEL_TIMEOUT_MS,inputRate:env.LLM_INPUT_USD_PER_MILLION,outputRate:env.LLM_OUTPUT_USD_PER_MILLION});
  const analysis=new Interpreter(db,{live,maxCalls:2,timeoutMs:env.MODEL_TIMEOUT_MS,inputRate:env.LLM_INPUT_USD_PER_MILLION,outputRate:env.LLM_OUTPUT_USD_PER_MILLION});
  const wire:Array<{request:unknown,response:unknown,latency_ms:number}>=[];
  const transport:typeof fetch=async(url,init)=>{const started=performance.now();const response=await fetch(url,init);wire.push({request:JSON.parse(String(init?.body)),response:await response.clone().json(),latency_ms:Math.round(performance.now()-started)});return response;};
  const provider=selectedGenerativeProvider(transport);const app=createApp(db,new Set([datasetId]),{runtime:generation,provider,planner:true,analysis:{runtime:analysis,jev:jevProvider(env.JEV_API_KEY,env.JEV_MODEL,transport),extractor:provider}});
  const body={dataset_id:datasetId,account_id:accountId,question:'What should we do next for this account?'};
  const first=await request(app).post('/api/qa').send(body);const callsAfterFirst=generation.calls+analysis.calls;const second=await request(app).post('/api/qa').send(body);
  const runs=await db.select().from(schema.modelRuns).where(eq(schema.modelRuns.datasetId,datasetId));
  const extracted=runs.find(r=>r.operation==='extract_details');
  const extraction=extracted?.output as {status?:string,assertions?:unknown[]}|null;
  let pendingReview=false;
  if(extracted?.status==='succeeded'&&extraction?.status==='candidate'&&extraction.assertions?.length){await recordReview(db,{model_run_id:extracted.id,candidate_index:0,state:'pending_review',reviewer:'synthetic-live-compatibility',rationale:'Awaiting independent semantic review; no candidate approved by this test.'});pendingReview=true;}
  const promoted=(await reviewedStatements(db,datasetId,accountId)).statements.length;
  const offline=createApp(db,new Set([datasetId]),{runtime:new Interpreter(db,{live:false,maxCalls:0,timeoutMs:200}),provider,planner:false,analysis:{runtime:new Interpreter(db,{live:false,maxCalls:0,timeoutMs:200})}});
  const fallback=await request(offline).post('/api/qa').send(body);
  const report={wire,extraction:{status:extracted?.status,candidate_count:extraction?.assertions?.length??0,pending_review:pendingReview,promoted},fallback:{status:fallback.status,generation:fallback.body.generation,ordered_action:JSON.stringify(fallback.body.claims).includes('Gather operational inputs')},kind:'synthetic_live_compatibility_not_acceptance',live,review_status:'pending_review',budgets:{generation:2,analysis:2},status:first.status,second_status:second.status,plan:first.body.plan,assessment:first.body.requirement_assessments?.map((a:any)=>({status:a.status,source_ids:a.source_ids,method:a.method})),claims:first.body.claims,capabilities:first.body.capabilities,repeat_new_calls:generation.calls+analysis.calls-callsAfterFirst,physical_calls:generation.calls+analysis.calls,expected:{assessment:'not_addressed',ordered_preparation_and_joint_action:true,unreviewed_extraction_promoted:false},observed:{ordered_action:JSON.stringify(first.body.claims).includes('Gather operational inputs')&&JSON.stringify(first.body.claims).includes('joint commercial discussion')},runs:runs.map(r=>({operation:r.operation,status:r.status,model:r.model,prompt:r.promptVersion,schema:r.schemaVersion,input_hash:r.inputHash,output:r.output,context:r.context,diagnostics:r.diagnostics,input_tokens:r.inputTokens,output_tokens:r.outputTokens,cost_usd:r.costUsd,latency_ms:r.latencyMs}))};
  const folder=resolve(projectRoot,'artifacts/evaluations');await mkdir(folder,{recursive:true});const file=resolve(folder,`phase8-${randomUUID()}.json`);await writeFile(file,JSON.stringify(report,null,2));
  console.log(JSON.stringify({report:file,status:report.status,second_status:report.second_status,physical_calls:report.physical_calls,repeat_new_calls:report.repeat_new_calls,observed:report.observed,extraction:report.extraction,fallback:report.fallback,runs:report.runs.map(({context,output,diagnostics,...summary})=>summary),review_status:report.review_status},null,2));
  if(first.status!==200||second.status!==200||report.repeat_new_calls!==0||!pendingReview||promoted!==0||!report.observed.ordered_action||fallback.status!==200||!report.fallback.ordered_action||report.assessment?.[0]?.status!=='not_addressed')process.exitCode=1;
}finally{
  await pool.end();if(created&&/^kasirnusa_phase8_[a-f0-9]{32}$/.test(name))await admin.query(`DROP DATABASE "${name}"`);await admin.end();
  if(path){const target=inside(await realpath(resolve(projectRoot,env.DATA_ROOT)),await realpath(path));if(!basename(target).startsWith('phase1-test-'))throw new Error('Unsafe fixture cleanup');await rm(target,{recursive:true});}
}
