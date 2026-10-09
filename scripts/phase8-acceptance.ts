// Prepare is offline. Execution requires explicit user approval matching the frozen plan.
import { readFile,mkdir,writeFile,open } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { env } from '../apps/api/src/config/env.js';
import { PROMPT_VERSION,question } from '../apps/api/src/ai/prompts/interpretation.js';
import { SCHEMA_VERSION,validateValue } from '../apps/api/src/ai/schemas/interpretation.js';
import { jevProvider } from '../apps/api/src/ai/providers/jev.js';
import { evaluateCase } from '../tests/helpers/phase8-evaluation.js';
import { digest,liveCaseIds,liveBudget,requireApproval,syntheticContext,boundedSyntheticTransport } from '../tests/helpers/phase8-acceptance.js';
const packetFile='docs/PHASE-8-APPROVAL.md';
const fixtureFiles=['tests/fixtures/phase8-review-v2.json','tests/fixtures/phase8-heldout-v1.json','tests/fixtures/phase8-heldout-freeze.json'];
const args=process.argv.slice(2),arg=(name:string)=>args[args.indexOf(name)+1];
const git=(...a:string[])=>execFileSync('git',a,{encoding:'utf8'}).trim();
const commit=git('rev-parse','HEAD');
if(git('status','--porcelain'))throw new Error('Acceptance preparation/execution requires a clean committed tree');
const fixtures=await Promise.all(fixtureFiles.map(async path=>({path,sha256:digest(await readFile(path,'utf8'))})));
const packetText=await readFile(packetFile,'utf8');
const packets=await Promise.all(fixtureFiles.slice(0,2).map(async path=>JSON.parse(await readFile(path,'utf8'))));
const freeze=JSON.parse(await readFile(fixtureFiles[2],'utf8'));if(fixtures[1].sha256!==freeze.sha256)throw new Error('Held-out freeze mismatch');
const liveCases=liveCaseIds.map(id=>{const c=packets[0].cases.find((c:any)=>c.id===id);if(!c)throw new Error('Missing live case');syntheticContext(c);return c;});
const prompts={coverage:{version:PROMPT_VERSION,schema:SCHEMA_VERSION,question_sha256:digest(JSON.stringify(question('concern_addressed')))},planner:{version:'operation-planner-v1',schema:'operation-plan-v1'},answer:{version:'grounded-generation-v2',schema:'fact-plan-v1'}};
await mkdir('artifacts/evaluations',{recursive:true});
if(args.includes('--prepare')){
  const plan={version:'phase8-approval-plan-v1',created_at:new Date().toISOString(),code_commit:commit,packet:packetFile,packet_sha256:digest(packetText),fixtures,prompts,models:{jev:'jev-1.13.0',configured_jev:env.JEV_MODEL,generative_provider:env.LLM_PROVIDER,generative_model:env.LLM_MODEL},live_budget:liveBudget,live_case_ids:liveCaseIds,live_context_sha256:liveCases.map((c:any)=>({id:c.id,sha256:digest(JSON.stringify(syntheticContext(c)))})),status:'awaiting_user_approval',human_approved:false,expected_deterministic:{coverage_applicable:20,fulfillment_applicable:20,next_actions:36},criteria:'All approved applicable expectations and all existing safety/workflow regressions pass; no N/A as success; live labels reported separately.',flags_modified:false};
  const file=`artifacts/evaluations/phase8-acceptance-plan-${commit.slice(0,7)}.json`;
  await writeFile(file,JSON.stringify(plan,null,2),{flag:'wx'});
  const planHash=digest(await readFile(file,'utf8'));
  const pending=`artifacts/evaluations/phase8-approval-pending-${commit.slice(0,7)}.json`;
  await writeFile(pending,JSON.stringify({decision:'pending',actor:'user',approval_quote:'',recorded_at:null,plan_sha256:planHash,packet_sha256:plan.packet_sha256,code_commit:commit,labels_and_criteria:false,synthetic_live_budget:false,physical_call_cap:10},null,2),{flag:'wx'});
  console.log(JSON.stringify({plan:file,pending_receipt:pending,plan_sha256:planHash,code_commit:commit,fixtures,prompts,live_budget:liveBudget,status:plan.status},null,2));
}else if(args.includes('--run')&&args.includes('--plan')&&args.includes('--approval')){
  const planText=await readFile(arg('--plan'),'utf8'),plan=JSON.parse(planText),approval=JSON.parse(await readFile(arg('--approval'),'utf8'));
  const planHash=digest(planText);requireApproval(plan,approval,planHash,commit);
  if(plan.packet_sha256!==digest(packetText)||JSON.stringify(plan.fixtures)!==JSON.stringify(fixtures)||JSON.stringify(plan.prompts)!==JSON.stringify(prompts)||JSON.stringify(plan.live_budget)!==JSON.stringify(liveBudget)||JSON.stringify(plan.live_case_ids)!==JSON.stringify(liveCaseIds)||plan.models.configured_jev!==env.JEV_MODEL||env.JEV_MODEL!=='jev-1.13.0')throw new Error('Pinned run configuration changed');
  // Exclusive claim before any network call: a repeated command cannot spend another budget.
  const lock=await open(`artifacts/evaluations/phase8-approval-${planHash}.claimed`,'wx');await lock.writeFile(JSON.stringify({claimed_at:new Date().toISOString(),code_commit:commit}));await lock.close();
  const file=`artifacts/evaluations/phase8-acceptance-${randomUUID()}.json`;
  const report:any={kind:'user_reviewed_phase8_acceptance',code_commit:commit,plan_sha256:planHash,approval,fixtures,prompts,started_at:new Date().toISOString(),deterministic:[],workflow_regressions:null,live:[],physical_calls:0,wire:[],complete:false};
  const save=()=>writeFile(file,JSON.stringify(report,null,2));await save();
  try{
    report.deterministic=packets.flatMap(p=>p.cases.map((c:any)=>({...evaluateCase(c),packet_version:p.version,split:c.split,language:c.language})));await save();
    // The normal API, review/cache/fallback and safety regressions use simulators.
    const testEnv={...process.env,QA_PLANNER_ENABLED:'false',QA_LIVE_ENABLED:'false',QA_JEV_ENABLED:'false',ANALYSIS_EXTRACTION_ENABLED:'false'};
    try{const output=execFileSync(process.platform==='win32'?'npm.cmd':'npm',['test'],{env:testEnv,encoding:'utf8',shell:process.platform==='win32',timeout:180000});report.workflow_regressions={status:'passed',output};}
    catch(error:any){report.workflow_regressions={status:'failed',output:String(error.stdout??''),error:String(error.stderr??'')};}await save();
    const transport=boundedSyntheticTransport(fetch,async()=>{if(report.physical_calls>=liveBudget.physical_call_cap)throw new Error('Persisted call cap exhausted');report.physical_calls++;await save();},async record=>{report.wire.push(record);await save();});
    const provider=jevProvider(env.JEV_API_KEY,'jev-1.13.0',transport);
    for(const c of liveCases){
      const context=syntheticContext(c),started=performance.now();let result:any,raw:any;
      try{if(!provider.configured)throw new Error('Provider unavailable');raw=await provider.invoke('concern_addressed',context,AbortSignal.timeout(liveBudget.timeout_ms));if(raw.model!=='jev-1.13.0')throw new Error('Model mismatch');const value=validateValue('concern_addressed',raw.value,context) as {choice:string};result={status:'succeeded',value,raw_output:raw.value,input_tokens:raw.inputTokens,output_tokens:raw.outputTokens,cost_usd:raw.inputTokens*liveBudget.input_usd_per_million/1000000,matched:value.choice===c.expectations.response_coverage.status};}
      catch(error){result={status:'failed',matched:false,raw_output:raw?.value??null,actual_model:raw?.model??null,input_tokens:raw?.inputTokens??null,output_tokens:raw?.outputTokens??null,cost_usd:raw?raw.inputTokens*liveBudget.input_usd_per_million/1000000:null,error:error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'provider_or_validation_failure; inspect saved synthetic wire'};}
      report.live.push({case_id:c.id,language:c.language,expected:c.expectations.response_coverage.status,context,...result,latency_ms:Math.round(performance.now()-started)});await save();
    }
    report.complete=true;report.passed=report.deterministic.every((r:any)=>!Object.values(r.checks).includes(false))&&report.workflow_regressions.status==='passed'&&report.live.every((r:any)=>r.matched);
    report.total_known_live_cost_usd=report.live.reduce((sum:number,r:any)=>sum+(r.cost_usd??0),0);report.total_live_cost_usd=report.live.some((r:any)=>r.cost_usd===null)?null:report.total_known_live_cost_usd;
    report.live_by_label=Object.fromEntries([...new Set(report.live.map((r:any)=>r.expected))].map(label=>[label,{samples:report.live.filter((r:any)=>r.expected===label).length,matched:report.live.filter((r:any)=>r.expected===label&&r.matched).length}]));
    report.live_by_language=Object.fromEntries(['en','id'].map(language=>[language,{samples:report.live.filter((r:any)=>r.language===language).length,matched:report.live.filter((r:any)=>r.language===language&&r.matched).length}]));
    report.finished_at=new Date().toISOString();await save();console.log(JSON.stringify({report:file,passed:report.passed,physical_calls:report.physical_calls,total_live_cost_usd:report.total_live_cost_usd},null,2));if(!report.passed)process.exitCode=1;
  }catch{report.execution_error='Acceptance interrupted; reserved calls remain consumed. Inspect partial report before any new budget.';await save();throw new Error(report.execution_error);}
}else throw new Error('Use --prepare, or --run --plan <file> --approval <file> after explicit user approval');
