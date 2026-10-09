import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { createHash,randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { evaluateCase } from '../tests/helpers/phase8-evaluation.js';
const heldout=process.argv.includes('--heldout');
const file=heldout?'tests/fixtures/phase8-heldout-v1.json':'tests/fixtures/phase8-review-v2.json';
const text=await readFile(file,'utf8'),hash=createHash('sha256').update(text).digest('hex');
const frozen=JSON.parse(await readFile('tests/fixtures/phase8-heldout-freeze.json','utf8'));
if(heldout&&hash!==frozen.sha256)throw new Error('Held-out labels changed after freeze');
const packet=JSON.parse(text);const splits=new Map<string,string>();
for(const c of packet.cases){if(splits.has(c.family)&&splits.get(c.family)!==c.split)throw new Error('Bilingual family split');splits.set(c.family,c.split);}
const results=packet.cases.map(evaluateCase);
const dimensions=Object.fromEntries(['response_coverage','fulfillment','next_action'].map(d=>{const values=results.map((r:any)=>r.checks[d]);return [d,{passed:values.filter((v:any)=>v===true).length,failed:values.filter((v:any)=>v===false).length,not_applicable:values.filter((v:any)=>v===null).length}];}));
const report={kind:'provisional_deterministic_checklist_not_model_accuracy',heldout,packet:file,packet_hash:hash,frozen_at:heldout?frozen.frozen_at:null,run_at:new Date().toISOString(),code_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),working_diff_sha256:createHash('sha256').update(execFileSync('git',['diff','HEAD'],{encoding:'utf8'})).digest('hex'),independently_reviewed:false,acceptance_eligible:false,physical_provider_calls:0,dimensions,results};
await mkdir('artifacts/evaluations',{recursive:true});const output=`artifacts/evaluations/phase8-${heldout?'heldout':'review-v2'}-${randomUUID()}.json`;await writeFile(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({report:output,packet_hash:hash,dimensions,acceptance_eligible:false},null,2));
if(Object.values(dimensions).some((v:any)=>v.failed))process.exitCode=1;
