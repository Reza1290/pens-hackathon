import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { and,eq,sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { modelRuns,accounts,extractionReviews } from '../db/schema/index.js';
import { sha256 } from '../modules/ingestion/manifest.js';
import { PROMPT_VERSION } from './prompts/interpretation.js';
import { contextSchema,validateValue,SCHEMA_VERSION,choices,type Context,type Operation } from './schemas/interpretation.js';
import { ProviderError,type Provider } from './providers/interface.js';
export const PARAMETERS_VERSION='interpretation-limits-v1';
export type Outcome={status:'succeeded'|'unavailable'|'invalid'|'timeout'|'provider_error'|'budget_exceeded';runId:string;cached:boolean;calls:number;value?:unknown};
export function cacheKey(context:Context,operation:Operation,provider:Provider,versions={prompt:PROMPT_VERSION,schema:SCHEMA_VERSION,parameters:PARAMETERS_VERSION}){
  return sha256(JSON.stringify({context,operation,choices:operation in choices?choices[operation as keyof typeof choices]:null,provider:provider.name,model:provider.model,versions}));
}
export class Interpreter{
  calls=0;cacheHits=0;
  private active=0;
  private waiters:(()=>void)[]=[];
  constructor(private db:Database,private options:{live:boolean;maxCalls:number;timeoutMs:number;concurrency?:number;inputRate?:string;outputRate?:string}){}
  async run(raw:Context,operation:Operation,provider:Provider):Promise<Outcome>{
    const context=contextSchema.parse(raw);
    const [account]=await this.db.select({id:accounts.id}).from(accounts).where(and(eq(accounts.datasetId,context.datasetId),eq(accounts.id,context.accountId)));
    if(!account)throw new Error('account_outside_dataset');
    if(context.subjectId&&!context.candidates.some(c=>c.id===context.subjectId))throw new Error('subject_outside_candidates');
    if(JSON.stringify(context).length>32000)throw new Error('context_budget_exceeded');
    if(this.active>=(this.options.concurrency??2))await new Promise<void>(resolve=>this.waiters.push(resolve));
    else this.active++;
    try{return await this.execute(context,operation,provider);}finally{const next=this.waiters.shift();if(next)next();else this.active--;}
  }
  private async execute(context:Context,operation:Operation,provider:Provider):Promise<Outcome>{
    const versions=operation==='query_plan'?{prompt:'operation-planner-v1',schema:'operation-plan-v1',parameters:'single-operation-v1'}:operation==='answer_plan'||operation==='draft_plan'?{prompt:'grounded-generation-v2',schema:'fact-plan-v1',parameters:'qa-limits-v2'}:{prompt:PROMPT_VERSION,schema:SCHEMA_VERSION,parameters:PARAMETERS_VERSION};
    const key=cacheKey(context,operation,provider,versions),inputHash=sha256(JSON.stringify(context));
    // Same key is serialized across CLI processes; locks end with this transaction.
    return this.db.transaction(async tx=>{
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key},0))`);
      const successes=this.options.live&&provider.configured?await tx.select().from(modelRuns).where(and(eq(modelRuns.datasetId,context.datasetId),eq(modelRuns.accountId,context.accountId),eq(modelRuns.cacheKey,key),eq(modelRuns.status,'succeeded'))):[];
      for(const previous of successes){try{
        if(operation==='extract_details'){
          const reviews=await tx.select().from(extractionReviews).where(eq(extractionReviews.modelRunId,previous.id));const superseded=new Set(reviews.map(r=>r.supersedes));
          if(reviews.some(r=>!superseded.has(r.id)&&r.state==='rejected'))continue;
        }
        const value=validateValue(operation,previous.output,context);this.cacheHits++;return {status:'succeeded',runId:previous.id,cached:true,calls:0,value};
      }catch{/* Invalid persisted outputs are never reused. */}}
      let last:Outcome|undefined;
      let attempts=0;
      for(let attempt=0;attempt<2;attempt++){
        const started=Date.now();let status:Outcome['status']='unavailable',value:unknown=null,inputTokens:number|null=null,outputTokens:number|null=null,costUsd:string|null=null;let retryable=false;
        let receivedOutput:unknown=null,validationCode:string|null=null;
        if(this.options.live&&provider.configured){
          if(this.calls>=this.options.maxCalls)status='budget_exceeded';
          else{
            this.calls++;attempts++;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),this.options.timeoutMs);
            try{
              const result=await Promise.race([provider.invoke(operation,context,controller.signal),new Promise<never>((_resolve,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('provider_timeout')),{once:true}))]);
              inputTokens=result.inputTokens;outputTokens=result.outputTokens;
              const rates=provider.name==='typesafe'&&provider.model==='jev-1.13.0'?['0.042','0']:[this.options.inputRate,this.options.outputRate];
              if(rates[0]!==undefined&&rates[1]!==undefined)costUsd=new Decimal(inputTokens).times(rates[0]).plus(new Decimal(outputTokens).times(rates[1])).div(1000000).toFixed(10);
              if(result.model!==provider.model)throw new ProviderError('invalid');
              receivedOutput=result.value;value=validateValue(operation,result.value,context);status='succeeded';
            }catch(error){status=controller.signal.aborted?'timeout':error instanceof ProviderError?error.code:error instanceof TypeError?'provider_error':'invalid';validationCode=error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'provider_or_schema_validation';retryable=error instanceof ProviderError&&error.retryable;}finally{clearTimeout(timer);}
          }
        }
        const noCall=status==='unavailable'||status==='budget_exceeded';if(noCall)costUsd='0.0000000000';
        const runId=randomUUID();await tx.insert(modelRuns).values({id:runId,datasetId:context.datasetId,accountId:context.accountId,cacheKey:key,inputHash,operation,provider:provider.name,model:provider.model,promptVersion:versions.prompt,schemaVersion:versions.schema,parametersVersion:versions.parameters,status,context,diagnostics:{received_output:receivedOutput,validation_code:validationCode,normalized:status==='succeeded'&&JSON.stringify(receivedOutput)!==JSON.stringify(value)},output:status==='succeeded'?value:null,latencyMs:Date.now()-started,inputTokens,outputTokens,costUsd,costBasis:noCall?'no_call':costUsd===null?'unknown':'estimated_from_reported_usage'});
        last={status,runId,cached:false,calls:attempts,...(status==='succeeded'?{value}: {})};
        if(!retryable||attempt===1||this.calls>=this.options.maxCalls)break;
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      return last!;
    });
  }
}
