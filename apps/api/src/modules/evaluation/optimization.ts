import { z } from 'zod';
import Decimal from 'decimal.js';
export const optimizationPolicySchema=z.object({
  version:z.literal('optimization-policy-v1'),routing:z.literal('rules_with_explicit_model_opt_in'),retrieval:z.literal('graph_and_simple_text'),
  classifier_enabled:z.literal(false),semantic_retrieval_enabled:z.literal(false),
  review:z.object({status:z.literal('pending'),reviewer:z.null(),dataset_hash:z.null()}),
  gates:z.object({minimum_signal_recall:z.null(),minimum_signal_precision:z.null(),maximum_unsupported_claims:z.null(),maximum_authority_errors:z.null()}),
}).strict();
export type BenchmarkRow={id:string;operation:string;expected:string;rules:string|null;jev:string|null;status:string;cached:boolean;calls?:number;rules_ms?:number;provider_ms?:number;cost_usd?:string|null;input_tokens?:number|null;output_tokens?:number|null};
export function quality(rows:BenchmarkRow[],mode:'rules'|'jev'|'combined'){
  const prediction=(r:BenchmarkRow)=>mode==='combined'?r.jev??r.rules:r[mode];
  const labels=[...new Set(rows.map(r=>r.expected))].sort();
  const answered=rows.filter(r=>prediction(r)!==null);
  return {status:answered.length===0?'not_measured':answered.length===rows.length?'measured':'partial',samples:rows.length,answered:answered.length,unanswered:rows.length-answered.length,correct:answered.filter(r=>prediction(r)===r.expected).length,
    missed_request_ids:rows.filter(r=>['quotation_request','explicit_plan'].includes(r.expected)&&prediction(r)!==r.expected).map(r=>r.id),
    by_label:Object.fromEntries(labels.map(label=>{
      const positives=rows.filter(r=>r.expected===label),tp=positives.filter(r=>prediction(r)===label).length;
      const fp=rows.filter(r=>r.expected!==label&&prediction(r)===label).length;
      const unanswered=positives.filter(r=>prediction(r)===null).length;
      return [label,{support:positives.length,tp,fp,fn:positives.length-tp,unanswered,precision:tp+fp?tp/(tp+fp):null,recall:positives.length?tp/positives.length:null}];
    }))};
}
export function assessOptimization(rows:BenchmarkRow[],policy:unknown,review:string){
  const config=optimizationPolicySchema.parse(policy);
  if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('duplicate_benchmark_case');
  const successful=rows.filter(r=>r.jev!==null);
  const operations=[...new Set(rows.map(r=>r.operation))];
  return {policy_version:config.version,decision:'defer' as const,baseline_retained:true,
    reasons:[...(review!=='approved'?['Evaluation labels have not received independent human review.']:[]),'Numerical recall/support/authority gates have not been agreed.','No reviewed, complete live cost/quality comparison establishes an optimization benefit.','Classifier label volume/splits and semantic retrieval misses have not been validated.'],
    comparison_status:successful.length===rows.length&&rows.length>0?'complete_provider_answers_unreviewed':'provider_comparison_incomplete',
    provider_answered:successful.length,provider_unanswered:rows.length-successful.length,
    by_operation:Object.fromEntries(operations.map(op=>{const scope=rows.filter(r=>r.operation===op);return [op,{rules_only:quality(scope,'rules'),jev_only:quality(scope,'jev'),rules_plus_jev:quality(scope,'combined')}];})),
    measurements:{physical_calls:rows.reduce((n,r)=>n+(r.calls??0),0),cache_hits:rows.filter(r=>r.cached).length,
      rules_ms_total:rows.reduce((n,r)=>n+(r.rules_ms??0),0),provider_and_cache_ms_total:rows.reduce((n,r)=>n+(r.provider_ms??0),0),
      known_cost_responses:rows.filter(r=>r.cost_usd!=null).length,unknown_cost_responses:rows.filter(r=>r.cost_usd==null).length,
      known_estimated_cost_usd:rows.reduce((total,r)=>total.plus(r.cost_usd??0),new Decimal(0)).toFixed(10),
      known_input_tokens:rows.reduce((n,r)=>n+(r.input_tokens??0),0),known_output_tokens:rows.reduce((n,r)=>n+(r.output_tokens??0),0),unknown_usage_responses:rows.filter(r=>r.input_tokens==null||r.output_tokens==null).length},
    savings_percent:null,unsupported_claims:null,authority_errors:null,
    rollback:{action:'Keep committed baseline configuration; QA_LIVE_ENABLED=false disables new Q&A model calls. No classifier or semantic index requires removal.',data_changes:'No source, opportunity, diagnosis or model artifact promotion.'},
    limitations:['Combined predictions use valid Jev answers and otherwise retain the rules result; unavailable cases never disappear from recall denominators.','Offline provider timing includes database/cache accounting and is not an inference latency benchmark.','Synthetic regression labels are not a reviewed production benchmark.']};
}
