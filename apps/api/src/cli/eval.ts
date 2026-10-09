import { randomUUID } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
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
try{
  const datasetId=requiredArg('dataset');
  const [dataset]=await db.select().from(s.datasets).where(eq(s.datasets.id,datasetId));
  const [account]=await db.select().from(s.accounts).where(and(eq(s.accounts.datasetId,datasetId),eq(s.accounts.type,'customer'))).orderBy(s.accounts.externalId).limit(1);
  if(dataset?.status!=='ready'||!account)throw new Error('ready_dataset_with_customer_required');
  const runtime=new Interpreter(db,{live:process.argv.includes('--live'),maxCalls:env.MODEL_MAX_CALLS,timeoutMs:env.MODEL_TIMEOUT_MS});
  const provider=jevProvider(env.JEV_API_KEY,env.JEV_MODEL);
  const rows:{id:string;operation:string;expected:string;rules:string|null;jev:string|null;status:string;cached:boolean}[]=[];let extractionTotal=0,quantityCorrect=0,periodCorrect=0;
  for(const fixture of evaluationCases){
    const person=stableId('synthetic-eval-person');const source=stableId('synthetic-eval-source',fixture.id);
    const context:Context={datasetId,accountId:account.id,sources:[{id:source,field:'synthetic_text',text:fixture.text,eventDate:'2026-08-01',speakerId:person}],candidates:[{id:person,role:'unknown',start:'2025-01-01',end:null}],subjectId:person,claim:fixture.claim??''};
    if(fixture.followup)context.sources.push({id:stableId(source,'followup'),field:'synthetic_text',text:fixture.followup,eventDate:'2026-08-02',speakerId:null});
    const request=extractRequest(fixture.text),response=responseType(fixture.text);
    const baseline=fixture.operation==='intent'?(isCancellation(fixture.text)?'cancellation':/\b(?:revisi|revised|revise)\b/i.test(fixture.text)?'revision':request?.kind??(response==='unclear'?'none':response)):null;
    if(fixture.quantity!==undefined){extractionTotal++;quantityCorrect+=Number(request?.quantity===fixture.quantity);periodCorrect+=Number(request?.targetPeriod===fixture.period);}
    const result=await runtime.run(context,fixture.operation,provider);
    const modelChoice=result.status==='succeeded'?(result.value as {choice:string}).choice:null;
    rows.push({id:fixture.id,operation:fixture.operation,expected:fixture.expected,rules:baseline,jev:modelChoice,status:result.status,cached:result.cached});
  }
  const metric=(operation:string,mode:'rules'|'jev')=>{
    const selected=rows.filter(r=>r.operation===operation),answered=selected.filter(r=>r[mode]!==null);
    const labels=[...new Set(selected.map(r=>r.expected))];
    return {status:answered.length===0?'not_measured':answered.length===selected.length?'measured':'partial',samples:selected.length,answered:answered.length,correct:answered.filter(r=>r[mode]===r.expected).length,by_label:Object.fromEntries(labels.map(label=>{const tp=answered.filter(r=>r.expected===label&&r[mode]===label).length,fp=answered.filter(r=>r.expected!==label&&r[mode]===label).length,fn=answered.filter(r=>r.expected===label&&r[mode]!==label).length,unanswered=selected.filter(r=>r.expected===label&&r[mode]===null).length;return [label,{tp,fp,fn,unanswered,precision:tp+fp?tp/(tp+fp):null,recall_on_answered:tp+fn?tp/(tp+fn):null}];}))};
  };
  const [usage]=await db.select({input_tokens:sql<string>`coalesce(sum(${s.modelRuns.inputTokens}),0)`,output_tokens:sql<string>`coalesce(sum(${s.modelRuns.outputTokens}),0)`,estimated_cost_usd:sql<string>`coalesce(sum(${s.modelRuns.costUsd}),0)`,unknown_cost_runs:sql<string>`count(*) filter (where ${s.modelRuns.costUsd} is null)`}).from(s.modelRuns).where(and(eq(s.modelRuns.datasetId,datasetId),eq(s.modelRuns.promptVersion,PROMPT_VERSION)));
  const report={dataset_id:datasetId,dataset_version:dataset.version,as_of:dataset.asOf,rule_version:RULE_VERSION,prompt_version:PROMPT_VERSION,fixture_kind:'assistant_curated_synthetic',human_review:'pending',automatic_acceptance:false,quality_gate:'not_agreed',live_requested:process.argv.includes('--live'),provider_configured:provider.configured,samples:rows.length,rules_only:Object.fromEntries(['intent','role','relevance','concern_addressed'].map(op=>[op,metric(op,'rules')])),rules_plus_jev:Object.fromEntries(['intent','role','relevance','concern_addressed'].map(op=>[op,metric(op,'jev')])),extraction:{samples:extractionTotal,quantity_correct:quantityCorrect,period_correct:periodCorrect},calls_this_run:runtime.calls,cache_hits_this_run:runtime.cacheHits,cumulative_dataset_usage:usage,results:rows,limitations:['Synthetic regression cases are not a human-reviewed dataset benchmark.','Role/relevance/concern deterministic baselines are not implemented in this phase.','Provider judgments are evaluation candidates only; they do not change opportunities.','Unanswered provider cases are reported separately; recall is conditional on answered cases, not a rollout gate.']};
  const output=resolve(projectRoot,'artifacts/evaluations',randomUUID());await mkdir(output,{recursive:true});await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({report:resolve(output,'report.json'),samples:report.samples,rules_intent:report.rules_only.intent,extraction:report.extraction,jev_answered:report.rules_plus_jev.intent.answered,calls:runtime.calls,automatic_acceptance:false},null,2));
}finally{await pool.end();}
