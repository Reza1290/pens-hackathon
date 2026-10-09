import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { qaResponseSchema } from '@kasirnusa/contracts';
import { env,projectRoot } from '../config/env.js';
import { requiredArg } from './args.js';
const dataset=requiredArg('dataset');
const base=`http://127.0.0.1:${env.API_PORT}/api`;
const accountsResponse=await fetch(`${base}/accounts?dataset_id=${encodeURIComponent(dataset)}&page_size=100`);
if(!accountsResponse.ok)throw new Error('authorized_prepared_dataset_and_local_API_required');
const accounts=(await accountsResponse.json()).items as {id:string;externalId:string}[];
const cases:[string,'en'|'id',string,string,string?][]=[
  ['C06','en','What expansion request is pending?','answered','I0300'],
  ['C06','id','Apa peluang ekspansi akun ini?','answered','I0300'],
  ['C06','en','What follow-up is missing?','answered','I0300'],
  ['C06','id','Apa yang belum ditindaklanjuti?','answered','I0300'],
  ['C06','en','Who should be involved?','answered','K116'],
  ['C06','id','Siapa yang perlu dilibatkan?','answered','K116'],
  ['C06','en','How much for 10 outlets?','answered'],
  ['C06','id','Kalau tambah 10 outlet berapa nilai tahunannya?','answered'],
  ['C06','en','Write a follow-up draft','answered'],
  ['C06','id','Buatkan draft follow-up','answered'],
  ['C01','en','Why are repeat orders lower?','answered','I0331'],
  ['C01','id','Mengapa repeat order turun?','answered','I0331'],
  ['C01','en','What should we discuss about integration?','answered','I0331'],
  ['C01','id','Apa yang perlu dibahas tentang integrasi?','answered','I0331'],
  ['C01','en','Who should be involved?','answered','I0331'],
  ['C01','id','Siapa yang perlu dilibatkan?','answered','I0331'],
  ['P01','en','Who decides procurement?','answered','I0343'],
  ['P01','id','Siapa yang punya wewenang pengadaan?','answered','I0343'],
  ['C02','en','What expansion constraints need follow-up?','answered','I0253'],
  ['C02','id','Apa kendala ekspansi yang perlu ditindaklanjuti?','answered','I0253'],
  ['C02','en','How much for 6 outlets?','unsupported'],
  ['C02','id','Berapa nilai untuk 6 outlet?','unsupported'],
  ['C01','en','Weather forecast?','unsupported'],
  ['C01','id','Prakiraan cuaca?','unsupported'],
  ['C06','en','Who approves for P01?','clarification_required'],
  ['C06','id','Siapa yang berwenang di P01?','clarification_required'],
];
const rows:{case_id:number;account:string;language:string;expected:string;actual:string;passed:boolean;missing_reference:boolean;invalid_citations:number;claims:number;calls:number;cached:boolean;generation_status:string;cost_usd:string|null;latency_ms:number}[]=[];
for(const [index,[code,language,question,expected,source]] of cases.entries()){
  const account=accounts.find(a=>a.externalId===code);if(!account)throw new Error('evaluation_account_missing');
  const started=Date.now();const response=await fetch(base+'/qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataset_id:dataset,account_id:account.id,language,question})});
  if(!response.ok)throw new Error(`qa_evaluation_http_${response.status}`);
  const answer=qaResponseSchema.parse(await response.json());
  const cited=[...new Set(answer.claims.flatMap(c=>c.evidence_ids))];let invalid=0;
  for(const id of cited){
    if(!answer.evidence.some(e=>e.source_id===id)){invalid++;continue;}
    const original=await fetch(base+'/sources/'+id+'?dataset_id='+encodeURIComponent(dataset));if(!original.ok)invalid++;
  }
  const missing=Boolean(source&&!answer.evidence.some(e=>e.source_external_id===source));
  const valueCorrect=!/10\s*outlet/.test(question)||answer.value_scenario?.amount==='37800000.00';
  const premiseCorrect=!/repeat/.test(question)||answer.premise_check?.status==='insufficient_data';
  rows.push({case_id:index+1,account:code,language,expected,actual:answer.status,passed:answer.status===expected&&!missing&&!invalid&&valueCorrect&&premiseCorrect,missing_reference:missing,invalid_citations:invalid,claims:answer.claims.length,calls:answer.generation.calls,cached:answer.generation.cached,generation_status:answer.generation.status,cost_usd:answer.generation.cost_usd,latency_ms:Date.now()-started});
}
const latencies=rows.map(r=>r.latency_ms).sort((a,b)=>a-b);
const report={dataset_id:dataset,method:'grounded-qa-v1',fixture_kind:'source_case_regression',human_review:'pending',live_provider_quality:'not_measured',semantic_claim_support:'not_independently_reviewed',samples:rows.length,passed:rows.filter(r=>r.passed).length,missing_expected_evidence:rows.filter(r=>r.missing_reference).length,invalid_citation_references:rows.reduce((n,r)=>n+r.invalid_citations,0),calls:rows.reduce((n,r)=>n+r.calls,0),cache_hits:rows.filter(r=>r.cached).length,known_estimated_cost_usd:rows.reduce((total,r)=>total.plus(r.cost_usd??0),new Decimal(0)).toFixed(10),unknown_cost_responses:rows.filter(r=>r.cost_usd===null).length,latency_ms:{median:latencies[Math.floor(latencies.length/2)],p95:latencies[Math.ceil(latencies.length*.95)-1]},results:rows,limitations:['Source-reference regression checks do not prove semantic support or generalization.','The server owns provider opt-in; this evaluator does not enable live inference.','No customer passages or API secrets are written in this report.']};
const output=resolve(projectRoot,'artifacts/evaluations','qa-'+randomUUID());await mkdir(output,{recursive:true});await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:resolve(output,'report.json'),samples:report.samples,passed:report.passed,missing_expected_evidence:report.missing_expected_evidence,invalid_citations:report.invalid_citation_references,calls:report.calls,latency_ms:report.latency_ms},null,2));
if(report.passed!==report.samples)process.exitCode=1;
