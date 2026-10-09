import { describe,it,expect } from 'vitest';
import { extractRequest,annualIncrement,elapsedDays,reconcile,responseType } from '../apps/api/src/modules/opportunities/rules.js';
import { parseRecords } from '../apps/api/src/modules/ingestion/service.js';
describe('deterministic evidence rules',()=>{
  it('extracts only explicit prospective expansion and preserves quarter precision',()=>{
    expect(extractRequest('Kami berencana membuka 3 outlet di Testville pada kuartal 2 2027. Mohon penawaran.')).toEqual({quantity:3,location:'Testville',targetPeriod:'2027-Q2',kind:'quotation_request',requestedActions:['quotation']});
    expect(extractRequest('Kami tidak berencana membuka 3 outlet.')).toBeNull();
    expect(extractRequest('Terima kasih atas dukungan saat pembukaan 3 outlet.')).toBeNull();
    expect(extractRequest('Rencana membuka 3 outlet dan 4 cabang awal 2027.')).toMatchObject({quantity:null,targetPeriod:'2027-early'});
  });
  it('uses exact decimal arithmetic and snapshot dates',()=>{
    expect(annualIncrement(3,'100','12.5')).toBe('3150.00');
    expect(annualIncrement(1,'0.1','0')).toBe('1.20');
    expect(elapsedDays('2026-08-01','2026-09-01')).toBe(31);
    expect(()=>annualIncrement(2,'100','101')).toThrow();
    expect(()=>elapsedDays('2026-09-01','2026-08-01')).toThrow();
  });
  it('does not turn acknowledgement into delivered terms or cancelled intent',()=>{
    expect(responseType('Nanti saya cek dan kabari.')).toBe('acknowledgement');
    expect(responseType('Rencana batal.')).toBe('cancellation');
    expect(responseType('Penawaran IDR 100 untuk setiap outlet.')).toBe('substantive_candidate');
  });
  it('requires complete scope and an explicit confirmed deal link',()=>{
    const deal={id:'d1',accountId:'a1',type:'expansion',outlets:3,status:'Terbuka'};
    expect(reconcile('a1','s1',[],false).status).toBe('insufficient_coverage');
    expect(reconcile('a1','s1',[deal],true).status).toBe('ambiguous');
    expect(reconcile('a1','s1',[{...deal,confirmedSignalKey:'s1'}],true).status).toBe('matched');
    expect(reconcile('a1','s1',[{...deal,accountId:'a2'}],true).status).toBe('unmatched');
  });
  it('retains malformed JSON and CSV record text for quarantine',()=>{
    expect(parseRecords('interactions.jsonl','{bad}\n')[0]).toMatchObject({raw:'{bad}',error:'malformed_json_record'});
    expect(parseRecords('interactions.jsonl','{}  \n\n')).toHaveLength(2);
    expect(parseRecords('interactions.jsonl','{}  \n')[0].raw).toBe('{}  ');
    expect(parseRecords('sample.csv','id,name\nx\n')[0].error).toBe('invalid_column_count');
    expect(parseRecords('sample.csv','id,name\nx,"two\nlines"\n')[0]).toMatchObject({locator:1,row:{id:'x',name:'two\nlines'}});
  });
});
