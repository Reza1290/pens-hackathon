import { randomUUID } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { selectedGenerativeProvider } from '../apps/api/src/ai/providers/selected.js';
import { validateValue,type Context } from '../apps/api/src/ai/schemas/interpretation.js';
if(!process.argv.includes('--live'))throw new Error('Explicit --live required; one synthetic provider call.');
const fixture=JSON.parse(await readFile('tests/fixtures/extraction-span-failure.json','utf8'));
const context=fixture.context as Context;
const report=`artifacts/evaluations/phase8-extraction-diagnostic-${randomUUID()}.json`;
let calls=0,wire:unknown,requestBody:unknown;
const transport:typeof fetch=async(url,init)=>{if(++calls>1)throw new Error('Diagnostic call budget exhausted');requestBody=JSON.parse(String(init?.body));const response=await fetch(url,init);wire=await response.clone().json();return response;};
let validation='not_run',output:unknown=null;
try{const result=await selectedGenerativeProvider(transport).invoke('extract_details',context,AbortSignal.timeout(30000));output=result.value;validateValue('extract_details',output,context);validation='succeeded';}catch(error){validation=error instanceof Error?error.message:'unknown';}
await mkdir('artifacts/evaluations',{recursive:true});
await writeFile(report,JSON.stringify({synthetic_only:true,calls,context,requestBody,wire,output,validation},null,2));
console.log(JSON.stringify({calls,validation,output,report},null,2));
