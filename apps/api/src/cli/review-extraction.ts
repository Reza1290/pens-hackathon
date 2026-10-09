import { readFile } from 'node:fs/promises';
import { and,eq } from 'drizzle-orm';
import { db,pool } from '../db/client.js';
import * as s from '../db/schema/index.js';
import { requiredArg } from './args.js';
import { inspectCandidate,recordReview } from '../modules/stakeholders/review.js';
import { analyzeStakeholders } from '../modules/stakeholders/service.js';
try{
  if(process.argv.includes('--review-file')){
    const input=JSON.parse(await readFile(requiredArg('review-file'),'utf8'));
    const item=await inspectCandidate(db,input.model_run_id,input.candidate_index);
    const scopes=await db.select({signalId:s.diagnoses.signalId,dealId:s.diagnoses.dealId}).from(s.diagnoses).where(and(eq(s.diagnoses.datasetId,item.run.datasetId),eq(s.diagnoses.accountId,item.run.accountId)));
    const result=await recordReview(db,input);
    await analyzeStakeholders(db,item.run.datasetId,item.run.accountId);
    for(const scope of scopes.filter(s=>s.signalId||s.dealId))await analyzeStakeholders(db,item.run.datasetId,item.run.accountId,{signalId:scope.signalId??undefined,dealId:scope.dealId??undefined});
    console.log(JSON.stringify({review_id:result.review.id,state:result.review.state,reused:result.reused,recomputed:true}));
  }else{
    const item=await inspectCandidate(db,requiredArg('run'),Number(requiredArg('index')));
    console.log(JSON.stringify({candidate:item.original,original_record:item.source?.payload,source_revision:item.source?.contentHash,model:item.run.model,prompt:item.run.promptVersion,schema:item.run.schemaVersion,scope:item.scope,employment:item.employment,related_assertions:item.relatedAssertions,history:item.history,review_status:item.history.length?'see_history':'pending_review'},null,2));
  }
}catch(error){console.error(error instanceof Error?error.message:'Review unavailable');process.exitCode=1;}finally{await pool.end();}
