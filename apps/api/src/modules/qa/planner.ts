import { operationPlanSchema,type OperationPlan,type QaRequest } from '@kasirnusa/contracts';
import type { Interpreter } from '../../ai/router.js';
import type { Provider } from '../../ai/providers/interface.js';
import type { Context } from '../../ai/schemas/interpretation.js';
export function deterministicPlan(input:QaRequest):OperationPlan{
  const q=input.question;
  const scope={deal_id:input.deal_id??null,signal_id:input.signal_id??input.opportunity_id??null};
  if(/draft|draf|tulis.*pesan/i.test(q))return {operation:'draft',args:scope};
  const quantity=input.additional_outlets??Number(q.match(/\b(\d+)\s*(?:outlet|cabang)/i)?.[1]??0);
  if(quantity&&/nilai|harga|berapa|value|annual|how much/i.test(q))return {operation:'value_scenario',args:{additional_outlets:quantity}};
  if(/precedent|preseden|historical.*(?:discount|exception)|diskon.*(?:sebelum|historis)/i.test(q))return {operation:'commercial_precedent',args:{kind:'discount',package:null,quantity:null}};
  if(/repeat|(?:revenue|pendapatan|renewal).*(?:lower|declin|turun)/i.test(q))return {operation:'account_diagnosis',args:{...scope,metric:input.metric??'ambiguous_repeat_orders',periods:input.periods??null}};
  if(/(?:who|siapa).*(?:approv|decid|procurement|involv|join)|stakeholder|wewenang|libat/i.test(q))return {operation:'stakeholder_guidance',args:scope};
  if(/(?:list|show|which|daftar|mana).*(?:expansion|ekspansi|opportunit|peluang)/i.test(q))return {operation:'expansion_listing',args:{}};
  if(/expansion|ekspansi|integration|integrasi|follow.up|tindaklanjut|next.*(?:step|account)|(?:what|apa).*(?:discuss|bahas|do next|langkah)|renewal.*concern/i.test(q))return {operation:'account_diagnosis',args:{...scope,metric:null,periods:null}};
  if(/^(?:why|mengapa|berapa)[?\s]*$/i.test(q))return {operation:'clarify',args:{question:'Which purchasing decision, requirement or metric should be investigated?'}};
  return {operation:'source_search',args:{query:q}};
}
export async function planQuestion(input:QaRequest,context:Context,runtime:Interpreter,provider:Provider,enabled:boolean){
  const fallback=operationPlanSchema.parse(deterministicPlan(input));
  if(!enabled)return {plan:fallback,status:'deterministic_fallback',calls:0,run_id:null};
  const outcome=await runtime.run({...context,claim:'operation-planner-v1',grounding:{question:JSON.stringify(input),language:input.language,facts:[{id:'scope',text:`Selected account ${context.accountId}; dataset ${context.datasetId}. Do not change this scope.`,evidence_ids:context.sources.map(s=>s.id)}]}},'query_plan',provider);
  return {plan:outcome.status==='succeeded'?operationPlanSchema.parse(outcome.value):fallback,status:outcome.status,calls:outcome.calls,run_id:outcome.runId};
}
