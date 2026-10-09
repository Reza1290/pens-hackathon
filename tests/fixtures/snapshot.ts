// Synthetic records only. Nothing copied from supplied customer rows.
import { randomUUID } from 'node:crypto';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env,projectRoot } from '../../apps/api/src/config/env.js';
import { sha256, type Manifest } from '../../apps/api/src/modules/ingestion/manifest.js';
const csv=(columns:string[],rows:Record<string,string>[])=>columns.join(',')+'\n'+rows.map(row=>columns.map(key=>'"'+(row[key]??'').replaceAll('"','""')+'"').join(',')).join('\n')+(rows.length?'\n':'');
export async function fixture(options:{ownerIntermediary?:boolean;tag?:string;stakeholderSlice?:boolean;ticketSlice?:boolean;invalidDecisionApprover?:boolean;messages?:{id:string;body:string;parent?:string;sender?:string;date?:string;participants?:string;recipient?:string}[];inconsistentTerms?:boolean;deal?:boolean;invalidOwner?:boolean;malformed?:boolean;missingDeals?:boolean;invalidDealHeader?:boolean;duplicate?:boolean;conflictingContracts?:boolean;finiteLimit?:boolean}={}){
  const version=`phase1-test-${randomUUID()}`;const path=resolve(projectRoot,env.DATA_ROOT,version);await mkdir(path,{recursive:true});
  const inputs:Record<string,{columns:string[];rows:Record<string,string>[]}>={
    'employees.csv':{columns:['employee_id','nama','jabatan','email'],rows:[{employee_id:'E1',nama:'Sample Manager',jabatan:'Account Manager',email:'manager@example.test'}]},
    'crm_accounts.csv':{columns:['account_id','nama','tipe','account_owner_id','champion_contact_id','paket','jumlah_outlet'],rows:[{account_id:'A1',nama:'Sample Customer',tipe:'pelanggan',account_owner_id:options.invalidOwner?'E-missing':'E1',champion_contact_id:'K1',paket:'Enterprise',jumlah_outlet:'2'}]},
    'crm_contacts.csv':{columns:['contact_id','nama','email','account_id_saat_ini','jabatan_saat_ini'],rows:[{contact_id:'K1',nama:'Sample Contact',email:'buyer@example.test',account_id_saat_ini:'A1',jabatan_saat_ini:'Operations Lead'}]},
    'contact_employment_history.csv':{columns:['contact_id','account_id','organisasi','jabatan','mulai','selesai'],rows:[{contact_id:'K1',account_id:'A1',organisasi:'Sample Customer',jabatan:'Operations Lead',mulai:'2025-01-01',selesai:''}]},
    'contracts_billing.csv':{columns:['contract_id','account_id','paket','outlet_kontrak','batas_outlet_paket','mulai','tanggal_renewal','harga_per_outlet_bulan','diskon_pct','nilai_tahunan','decision_id'],rows:[{contract_id:'CT1',account_id:'A1',paket:'Enterprise',outlet_kontrak:'2',batas_outlet_paket:options.finiteLimit?'2':'tanpa batas',mulai:'2025-01-01',tanggal_renewal:'2027-01-01',harga_per_outlet_bulan:'100',diskon_pct:'12.5',nilai_tahunan:'2100',decision_id:''}]},
    'crm_deals.csv':{columns:options.invalidDealHeader?['deal_id']:['deal_id','account_id','tipe','stage','stage_sejak','dibuat','owner_id','outlet','nilai_tahunan','status','request_interaction_id'],rows:options.deal?[{deal_id:'DL1',account_id:'A1',tipe:'ekspansi',stage:'Proposal',stage_sejak:'2026-08-01',dibuat:'2026-08-01',owner_id:'E1',outlet:'3',nilai_tahunan:'3150',status:'Terbuka',request_interaction_id:'I1'}]:[]},
  };
  if(options.tag)inputs['crm_accounts.csv'].rows[0].nama+=` ${options.tag}`;
  if(options.ownerIntermediary){
    inputs['crm_contacts.csv'].rows[0].nama='Owner X';inputs['crm_contacts.csv'].rows[0].jabatan_saat_ini='Owner';inputs['contact_employment_history.csv'].rows[0].jabatan='Owner';
    inputs['crm_contacts.csv'].rows.push({contact_id:'K2',nama:'Operator Y',email:'operator@example.test',account_id_saat_ini:'A1',jabatan_saat_ini:'Operations Lead'});
    inputs['contact_employment_history.csv'].rows.push({contact_id:'K2',account_id:'A1',organisasi:'Sample Customer',jabatan:'Operations Lead',mulai:'2025-01-01',selesai:''});
  }
  if(options.inconsistentTerms)inputs['contracts_billing.csv'].rows[0].nilai_tahunan='1';
  if(options.conflictingContracts)inputs['contracts_billing.csv'].rows.push({...inputs['contracts_billing.csv'].rows[0],contract_id:'CT2',harga_per_outlet_bulan:'200'});
  for(const filename of ['outlets.csv','product_usage_daily.csv','feature_usage_monthly.csv','support_tickets.csv','features.csv','bugs.csv','releases.csv','decision_log.csv'])inputs[filename]={columns:['id'],rows:[]};
  if(options.stakeholderSlice){
    inputs['decision_log.csv']={columns:['decision_id','tanggal','account_id','deal_id','diminta_oleh','diputuskan_oleh','keputusan','nilai','alasan','fitur_dijanjikan','status_janji'],rows:[{decision_id:'D1',tanggal:'2026-01-01',account_id:'A1',deal_id:'',diminta_oleh:'E1',diputuskan_oleh:'E1',keputusan:'Disetujui',nilai:'10%',alasan:'Komitmen integrasi akuntansi Q3 2026',fitur_dijanjikan:'F1',status_janji:'Belum ditepati'}]};
    inputs['features.csv']={columns:['feature_id','nama','status','target_awal','target_terkini','catatan'],rows:[{feature_id:'F1',nama:'Integrasi akuntansi',status:'Dalam pengembangan',target_awal:'2026-Q3',target_terkini:'Belum ditetapkan',catatan:''}]};
  }
  if(options.invalidDecisionApprover&&options.stakeholderSlice)inputs['decision_log.csv'].rows[0].diputuskan_oleh='K1';
  if(options.ticketSlice)inputs['support_tickets.csv']={columns:['ticket_id','account_id','dibuat','status','diselesaikan','deskripsi'],rows:[{ticket_id:'T1',account_id:'A1',dibuat:'2026-08-01',status:'Baru',diselesaikan:'',deskripsi:'Sample product requirement'}]};
  const message={interaction_id:'I1',tanggal:'2026-08-01',tipe:'email',account_id:'A1',dari:'buyer@example.test',ke:'manager@example.test',peserta:'',subjek:'Proposed rollout',isi:'Kami berencana membuka 3 outlet di Testville pada kuartal 2 2027. Mohon penawaran dan jadwal implementasinya.',membalas_id:''};
  const added=(options.messages??[]).map(m=>({...message,interaction_id:m.id,isi:m.body,membalas_id:m.parent??'',dari:m.sender??message.dari,tanggal:m.date??'2026-08-02',peserta:m.participants??'',ke:m.recipient??message.ke}));
  const jsonl=options.malformed?'{broken JSON\n':JSON.stringify(message)+'\n'+(options.duplicate?JSON.stringify({...message,interaction_id:'I2'})+'\n':'')+added.map(m=>JSON.stringify(m)+'\n').join('');
  const files:Manifest['files']=[];
  for(const filename of Object.keys(inputs).sort()){
    if(options.missingDeals&&filename==='crm_deals.csv')continue;
    const {columns,rows}=inputs[filename];const content=csv(columns,rows);await writeFile(resolve(path,filename),content);
    files.push({filename,relative_path:`data/raw/${version}/${filename}`,sha256:sha256(content),bytes:Buffer.byteLength(content),kind:'records',records:rows.length,columns});
  }
  await writeFile(resolve(path,'interactions.jsonl'),jsonl);files.push({filename:'interactions.jsonl',relative_path:`data/raw/${version}/interactions.jsonl`,sha256:sha256(jsonl),bytes:Buffer.byteLength(jsonl),kind:'records',records:(options.duplicate?2:1)+added.length,columns:Object.keys(message)});
  files.sort((a,b)=>a.filename<b.filename?-1:1);
  const manifest:Manifest={schema_version:'source-manifest-v1',dataset_version:version,mapping_version:'phase0-v1',as_of:'2026-09-01',files,content_manifest_sha256:sha256(JSON.stringify(files.map(f=>[f.filename,f.sha256])))};
  return {manifest,path};
}
