import { describe,it,expect } from 'vitest';
import { extractRequest,annualIncrement,elapsedDays,reconcile,responseType,collectSignals } from '../apps/api/src/modules/opportunities/rules.js';
import { parseRecords } from '../apps/api/src/modules/ingestion/service.js';
describe('deterministic evidence rules',()=>{
  it('extracts only explicit prospective expansion and preserves quarter precision',()=>{
    expect(extractRequest('Kami berencana membuka 3 outlet di Testville pada kuartal 2 2027. Mohon penawaran.')).toEqual({quantity:3,location:'Testville',targetPeriod:'2027-Q2',kind:'quotation_request',requestedActions:['quotation']});
    expect(extractRequest('Kami tidak berencana membuka 3 outlet.')).toBeNull();
    expect(extractRequest('Terima kasih atas dukungan saat pembukaan 3 outlet.')).toBeNull();
    expect(extractRequest('Rencana membuka 3 outlet dan 4 cabang awal 2027.')).toMatchObject({quantity:null,targetPeriod:'2027-early'});
    expect(extractRequest('Awal 2027 kami buka 6 cabang di Testville.')).toMatchObject({quantity:6,location:'Testville',targetPeriod:'2027-early'});
    expect(extractRequest('Rencana membuka 3 outlet tidak batal.')).toMatchObject({quantity:3});
    expect(extractRequest('Mohon penawaran renewal untuk 25 outlet saat ini.')).toBeNull();
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
    expect(responseType('Terima kasih. Penawaran IDR 100 untuk setiap outlet.')).toBe('substantive_candidate');
    expect(responseType('Akan kirim penawaran IDR 100 besok.')).toBe('acknowledgement');
    expect(responseType('Mohon penawaran renewal untuk 25 outlet saat ini.')).toBe('unclear');
  });
  it('updates linked revisions/cancellations, preserves history and retains uncertain scope',()=>{
    const origin={id:'1',externalId:'I1',eventDate:'2026-08-01',sender:'customer',body:'Rencana membuka 3 outlet di Testville pada Q2 2027.',parentId:null};
    const revision={...origin,id:'2',externalId:'I2',eventDate:'2026-08-02',parentId:'1',body:'Revisi rencana menjadi 5 outlet.'};
    const cancellation={...revision,id:'3',externalId:'I3',parentId:'2',body:'Rencana ekspansi dibatalkan.'};
    const group=collectSignals('a',[origin,revision,cancellation],()=>true);
    expect(group).toHaveLength(1);expect(group[0]).toMatchObject({origin:{id:'1'},request:{quantity:5},status:'cancelled'});expect(group[0].chain).toHaveLength(3);
    const ambiguous={...revision,body:'Revisi dari 3 outlet menjadi 5 outlet.'};
    expect(collectSignals('a',[origin,ambiguous],()=>true)[0]).toMatchObject({status:'unclear',request:{quantity:null}});
    const unknown={...origin,body:'Rencana membuka outlet.'};
    expect(collectSignals('a',[unknown,{...unknown,id:'4',externalId:'I4'}],()=>true)).toHaveLength(2);
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
