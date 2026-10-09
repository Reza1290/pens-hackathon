import { describe,it,expect } from 'vitest';
import policy from '../config/optimization.json';
import { quality,assessOptimization,type BenchmarkRow } from '../apps/api/src/modules/evaluation/optimization.js';
const rows:BenchmarkRow[]=[
  {id:'quote',operation:'intent',expected:'quotation_request',rules:'quotation_request',jev:null,status:'unavailable',cached:false,calls:0},
  {id:'plan',operation:'intent',expected:'explicit_plan',rules:null,jev:null,status:'timeout',cached:false,calls:1},
  {id:'negative',operation:'intent',expected:'none',rules:'quotation_request',jev:'none',status:'succeeded',cached:true,calls:0},
];
describe('optimization evidence gates',()=>{
  it('counts unanswered positives as misses rather than reporting perfect recall',()=>{
    const result=quality(rows,'jev');expect(result.answered).toBe(1);expect(result.by_label.quotation_request.recall).toBe(0);expect(result.by_label.explicit_plan.fn).toBe(1);expect(result.missed_request_ids).toEqual(['quote','plan']);
  });
  it('compares rules and a provider with fallback on the same complete case set',()=>{
    const result=quality(rows,'combined');expect(result.samples).toBe(3);expect(result.correct).toBe(2);expect(result.unanswered).toBe(1);expect(result.by_label.quotation_request.precision).toBe(1);expect(quality(rows,'rules').by_label.quotation_request.precision).toBe(.5);
  });
  it('defers without promoting unreviewed predictions or inventing savings',()=>{
    const result=assessOptimization(rows,policy,'pending');expect(result.decision).toBe('defer');expect(result.savings_percent).toBeNull();expect(result.authority_errors).toBeNull();expect(result.measurements.physical_calls).toBe(1);expect(result.provider_unanswered).toBe(2);
    expect(()=>assessOptimization([...rows,rows[0]],policy,'pending')).toThrow('duplicate_benchmark_case');
    expect(()=>assessOptimization(rows,{...policy,classifier_enabled:true},'pending')).toThrow();
  });
});
