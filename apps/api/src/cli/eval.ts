import { randomUUID } from 'node:crypto';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { eq,and,sql } from 'drizzle-orm';
import { db,pool } from '../db/client.js';
import * as s from '../db/schema/index.js';
import { env,projectRoot } from '../config/env.js';
import { requiredArg } from './args.js';
import { evaluationCases } from '../../../../tests/fixtures/interpretation.js';
import { extractRequest,isCancellation,responseType,RULE_VERSION } from '../modules/opportunities/rules.js';
import { Interpreter } from '../ai/router.js';
import { jevProvider } from '../ai/providers/jev.js';
import type { Context } from '../ai/schemas/interpretation.js';
import { stableId } from '../modules/ingestion/service.js';
import { PROMPT_VERSION } from '../ai/prompts/interpretation.js';
import { sha256 } from '../modules/ingestion/manifest.js';
import { assessOptimization,quality,type BenchmarkRow } from '../modules/evaluation/optimization.js';
try{
  const datasetId=requiredArg('dataset');
  const [dataset]=await db.select().from(s.datasets).where(eq(s.datasets.id,datasetId));
  const [account]=await db.select().from(s.accounts).where(and(eq(s.accounts.datasetId,datasetId),eq(s.accounts.type,'customer'))).orderBy(s.accounts.externalId).limit(1);
  if(dataset?.status!=='ready'||!account)throw new Error('ready_dataset_with_customer_required');
  const runtime=new Interpreter(db,{live:process.argv.includes('--live'),maxCalls:env.MODEL_MAX_CALLS,timeoutMs:env.MODEL_TIMEOUT_MS});
  const provider=jevProvider(env.JEV_API_KEY,env.JEV_MODEL);
  const rows:BenchmarkRow[]=[];let extractionTotal=0,quantityCorrect=0,periodCorrect=0;
  for(const fixture of evaluationCases){
    const person=stableId('synthetic-eval-person');const source=stableId('synthetic-eval-source',fixture.id);
    const context:Context={datasetId,accountId:account.id,sources:[{id:source,field:'synthetic_text',text:fixture.text,eventDate:'2026-08-01',speakerId:person}],candidates:[{id:person,role:'unknown',start:'2025-01-01',end:null}],subjectId:person,claim:fixture.claim??''};
    if(fixture.followup)context.sources.push({id:stableId(source,'followup'),field:'synthetic_text',text:fixture.followup,eventDate:'2026-08-02',speakerId:null});
    const rulesStarted=performance.now();const request=extractRequest(fixture.text),response=responseType(fixture.text);
    const baseline=fixture.operation==='intent'?(isCancellation(fixture.text)?'cancellation':/\b(?:revisi|revised|revise)\b/i.test(fixture.text)?'revision':request?.kind??(response==='unclear'?'none':response)):null;
    if(fixture.quantity!==undefined){extractionTotal++;quantityCorrect+=Number(request?.quantity===fixture.quantity);periodCorrect+=Number(request?.targetPeriod===fixture.period);}
    const rulesMs=performance.now()-rulesStarted,providerStarted=performance.now();
    const result=await runtime.run(context,fixture.operation,provider);
    const providerMs=performance.now()-providerStarted;
    const [run]=await db.select({cost:s.modelRuns.costUsd,input:s.modelRuns.inputTokens,output:s.modelRuns.outputTokens}).from(s.modelRuns).where(eq(s.modelRuns.id,result.runId));
    const modelChoice=result.status==='succeeded'?(result.value as {choice:string}).choice:null;
    rows.push({id:fixture.id,operation:fixture.operation,expected:fixture.expected,rules:baseline,jev:modelChoice,status:result.status,cached:result.cached,calls:result.calls,rules_ms:rulesMs,provider_ms:providerMs,cost_usd:result.cached?'0':result.calls>1?null:run.cost,input_tokens:result.calls===0?0:result.calls>1?null:run.input,output_tokens:result.calls===0?0:result.calls>1?null:run.output});
  }
  const [usage]=await db.select({input_tokens:sql<string>`coalesce(sum(${s.modelRuns.inputTokens}),0)`,output_tokens:sql<string>`coalesce(sum(${s.modelRuns.outputTokens}),0)`,estimated_cost_usd:sql<string>`coalesce(sum(${s.modelRuns.costUsd}),0)`,unknown_cost_runs:sql<string>`count(*) filter (where ${s.modelRuns.costUsd} is null)`}).from(s.modelRuns).where(and(eq(s.modelRuns.datasetId,datasetId),eq(s.modelRuns.promptVersion,PROMPT_VERSION)));
  const report={dataset_id:datasetId,dataset_version:dataset.version,as_of:dataset.asOf,rule_version:RULE_VERSION,prompt_version:PROMPT_VERSION,fixture_kind:'assistant_curated_synthetic',human_review:'pending',automatic_acceptance:false,quality_gate:'not_agreed',live_requested:process.argv.includes('--live'),provider_configured:provider.configured,samples:rows.length,rules_only:Object.fromEntries(['intent','role','relevance','concern_addressed'].map(op=>[op,quality(rows.filter(r=>r.operation===op),'rules')])),jev_only:Object.fromEntries(['intent','role','relevance','concern_addressed'].map(op=>[op,quality(rows.filter(r=>r.operation===op),'jev')])),rules_plus_jev:Object.fromEntries(['intent','role','relevance','concern_addressed'].map(op=>[op,quality(rows.filter(r=>r.operation===op),'combined')])),extraction:{samples:extractionTotal,quantity_correct:quantityCorrect,period_correct:periodCorrect},calls_this_run:runtime.calls,cache_hits_this_run:runtime.cacheHits,cumulative_dataset_usage:usage,results:rows,limitations:['Synthetic regression cases are not a human-reviewed dataset benchmark.','Role/relevance/concern deterministic baselines are not implemented in this phase.','Provider judgments are evaluation candidates only; they do not change opportunities.','Unanswered positives remain in recall denominators; absent provider answers are not a measured model-quality result.']};
  const policy=JSON.parse(await readFile(resolve(projectRoot,'config/optimization.json'),'utf8'));
  const assessment={...assessOptimization(rows,policy,report.human_review),dataset_id:datasetId,dataset_version:dataset.version,as_of:dataset.asOf,
    scope_hash:sha256(JSON.stringify(evaluationCases)),rule_version:RULE_VERSION,prompt_version:PROMPT_VERSION,provider_model:provider.model,
    evaluation_scope:{kind:'assistant_curated_synthetic',samples:rows.length,case_ids:rows.map(r=>r.id),human_review:'pending',split:'evaluation_only_no_training',thread_holdouts:'not_available_in_synthetic_cases',near_duplicate_groups:'not_reviewed_no_training_permitted'},
    extraction:report.extraction};
  const output=resolve(projectRoot,'artifacts/evaluations',randomUUID());await mkdir(output,{recursive:true});await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  await writeFile(resolve(output,'optimization.json'),JSON.stringify(assessment,null,2)+'\n');
  await writeFile(resolve(output,'label-review.json'),JSON.stringify({scope_hash:assessment.scope_hash,review_status:'pending',reviewer:null,reviewed_at:null,cases:evaluationCases.map(f=>({...f,proposed_label:f.expected,reviewed_label:null,source_support_review:null,thread_group:null,near_duplicate_group:null}))},null,2)+'\n');
  console.log(JSON.stringify({report:resolve(output,'report.json'),optimization:resolve(output,'optimization.json'),label_review:resolve(output,'label-review.json'),decision:assessment.decision,samples:report.samples,rules_intent:report.rules_only.intent,extraction:report.extraction,jev_answered:assessment.provider_answered,calls:runtime.calls,automatic_acceptance:false},null,2));
}finally{await pool.end();}
