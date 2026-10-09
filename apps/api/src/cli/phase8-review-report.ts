import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectRoot } from '../config/env.js';
import { sha256 } from '../modules/ingestion/manifest.js';
const text=await readFile(resolve(projectRoot,'tests/fixtures/phase8-review.json'),'utf8');
const packet=JSON.parse(text);const families=new Map<string,string>();const counts:Record<string,number>={};
let reviewed=0;
for(const c of packet.cases){
  if(families.has(c.family)&&families.get(c.family)!==c.split)throw new Error('Related family crosses splits');families.set(c.family,c.split);
  if(sha256(c.allowed_context[0].passage)!==c.source_revision)throw new Error('Source revision mismatch');
  for(const key of [c.language,c.split,`${c.language}:${c.proposed_expectation}`])counts[key]=(counts[key]??0)+1;
  if(c.review_status==='reviewed'&&c.reviewer&&c.reviewer!==c.author&&!/agent|codex|model/i.test(c.reviewer))reviewed++;
}
const eligible=reviewed===packet.cases.length&&packet.gates.status==='approved'&&!!packet.gates.reviewer;
console.log(JSON.stringify({packet_hash:sha256(text),cases:packet.cases.length,counts,independently_reviewed_cases:reviewed,acceptance_eligible:eligible,quality_results:null,capability_decisions:Object.fromEntries(['QA_PLANNER_ENABLED','QA_JEV_ENABLED','ANALYSIS_EXTRACTION_ENABLED','QA_LIVE_ENABLED'].map(flag=>[flag,eligible?'requires_normal_workflow_results':'defer']))},null,2));
