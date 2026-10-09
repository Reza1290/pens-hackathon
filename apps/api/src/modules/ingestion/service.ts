import { parse } from 'csv-parse/sync';
import { v5 as uuidv5 } from 'uuid';
import { eq, count as dbCount } from 'drizzle-orm';
import { z } from 'zod';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import type { Database } from '../../db/client.js';
import * as s from '../../db/schema/index.js';
import { verifiedFiles, sha256, type Manifest } from './manifest.js';

export const stableId = (...parts: string[]) => uuidv5(JSON.stringify(parts), uuidv5.DNS);
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Raw = { locator: number; row: Record<string, string>; raw: string; error?: string };
const rowSchema = z.record(z.string(), z.string());
const required = ['employees.csv','crm_accounts.csv','crm_contacts.csv','contact_employment_history.csv','contracts_billing.csv','crm_deals.csv','interactions.jsonl'];
const recordFiles = [...required, 'outlets.csv','product_usage_daily.csv','feature_usage_monthly.csv','support_tickets.csv','features.csv','bugs.csv','releases.csv','decision_log.csv'];
const idField: Record<string, string> = { 'employees.csv':'employee_id','crm_accounts.csv':'account_id','crm_contacts.csv':'contact_id','contracts_billing.csv':'contract_id','crm_deals.csv':'deal_id','interactions.jsonl':'interaction_id','outlets.csv':'outlet_id','support_tickets.csv':'ticket_id','features.csv':'feature_id','bugs.csv':'bug_id','decision_log.csv':'decision_id','releases.csv':'versi' };
const str = z.string().min(1); const day = z.iso.date(); const count = z.string().regex(/^\d+$/); const optionalDay = z.union([day, z.literal('')]);
const validators: Record<string, z.ZodType> = {
  'employees.csv': z.object({ employee_id:str, nama:str, jabatan:str, email:z.email() }),
  'crm_accounts.csv': z.object({ account_id:str, nama:str, tipe:z.enum(['pelanggan','prospek']), account_owner_id:str, jumlah_outlet:count }),
  'crm_contacts.csv': z.object({ contact_id:str, nama:str, email:z.email(), account_id_saat_ini:str, jabatan_saat_ini:str }),
  'contact_employment_history.csv': z.object({ contact_id:str, account_id:z.string(), organisasi:str, jabatan:str, mulai:day, selesai:optionalDay }),
  'contracts_billing.csv': z.object({ contract_id:str, account_id:str, paket:str, outlet_kontrak:count, batas_outlet_paket:z.union([count,z.literal('tanpa batas')]), mulai:day, tanggal_renewal:day, harga_per_outlet_bulan:count, diskon_pct:z.string().regex(/^\d+(\.\d+)?$/).refine(v=>Number(v)<=100), nilai_tahunan:count }),
  'crm_deals.csv': z.object({ deal_id:str, account_id:str, owner_id:str, tipe:z.enum(['baru','renewal','ekspansi']), stage:str, stage_sejak:day, dibuat:day, outlet:count, nilai_tahunan:count, status:str }),
  'interactions.jsonl': z.object({ interaction_id:str, tanggal:day, tipe:z.enum(['email','email_internal','catatan_meeting']), account_id:z.string(), dari:z.string(), ke:z.string(), peserta:z.string(), subjek:z.string(), isi:str, membalas_id:z.string() }),
};
export function parseRecords(filename: string, content: string): Raw[] {
  if (filename.endsWith('.jsonl')) {
    if(!content.length)return [];
    const lines=content.split(/\r?\n/);if(lines.at(-1)==='')lines.pop();
    return lines.map((raw, index) => {
    try { return { locator:index+1, row:rowSchema.parse(JSON.parse(raw)), raw }; }
    catch { return { locator:index+1, row:{}, raw, error:'malformed_json_record' }; }
    });
  }
  try {
    const rows = parse(content, { columns:true, bom:true, raw:true, info:true, relax_column_count:true, skip_empty_lines:false }) as { record:Record<string,string>; raw:string; info:{error?:unknown} }[];
    return rows.map((entry, index) => ({ locator:index+1, row:entry.record, raw:entry.raw, error:entry.info.error ? 'invalid_column_count' : undefined }));
  } catch { return [{ locator:1, row:{}, raw:content, error:'malformed_csv_file' }]; }
}

export async function importDataset(db: Database, manifest: Manifest) {
  // Verify every immutable byte before opening a staging transaction.
  const inputs = await verifiedFiles(manifest);
  const datasetId = stableId('dataset', manifest.content_manifest_sha256);
  const existing = await db.select().from(s.datasets).where(eq(s.datasets.id, datasetId));
  if (existing.length) {
    if(existing[0].asOf!==manifest.as_of||existing[0].mappingVersion!==manifest.mapping_version)throw new Error('Manifest metadata conflicts with the retained snapshot');
    return { dataset_id:datasetId, status:existing[0].status, reused:true, coverage:existing[0].coverage };
  }
  const parsed = new Map(inputs.filter(x => x.file.kind === 'records').map(x => [x.file.filename, parseRecords(x.file.filename,x.content)]));
  const diagnostics: { filename?:string; locator?:number; code:string; field?:string; disposition:string }[] = [];
  const rowsByFile = new Map<string, Raw[]>();
  const coverage: { filename:string; expected:number; retained:number; valid:number; duplicate:number; quarantined:number }[] = [];
  for (const { file } of inputs.filter(x=>x.file.kind === 'records')) {
    const validator=validators[file.filename];
    if(file.filename.endsWith('.csv') && validator instanceof z.ZodObject){
      const content=inputs.find(x=>x.file.filename===file.filename)!.content;
      try{const [header]=parse(content,{bom:true,to:1}) as string[][];
        if(!header||Object.keys(validator.shape).some(key=>!header.includes(key)))diagnostics.push({filename:file.filename,code:'missing_required_header',disposition:'blocking'});
      }catch{diagnostics.push({filename:file.filename,code:'invalid_header',disposition:'blocking'});}
    }
    const rows = parsed.get(file.filename)!;
    const keys = new Map<string,string>(); const valid:Raw[] = [];
    let duplicates = 0, quarantine = 0;
    for (const entry of rows) {
      if (entry.error || (validators[file.filename] && !validators[file.filename].safeParse(entry.row).success) || (file.columns && (Object.keys(entry.row).length !== file.columns.length || file.columns.some(k=>!(k in entry.row))))) {
        quarantine++; diagnostics.push({ filename:file.filename, locator:entry.locator, code:entry.error ?? 'invalid_row_schema', disposition:'quarantined' }); continue;
      }
      const key = idField[file.filename] ? entry.row[idField[file.filename]] : file.filename === 'contact_employment_history.csv' ? JSON.stringify([entry.row.contact_id,entry.row.organisasi,entry.row.jabatan,entry.row.mulai]) : file.filename === 'product_usage_daily.csv' ? JSON.stringify([entry.row.tanggal,entry.row.outlet_id]) : JSON.stringify([entry.row.bulan,entry.row.account_id,entry.row.feature_id]);
      const contentHash = sha256(JSON.stringify(entry.row));
      if (keys.has(key)) {
        if (keys.get(key) === contentHash) { duplicates++; diagnostics.push({ filename:file.filename, locator:entry.locator, code:'duplicate_record', disposition:'retained_duplicate' }); }
        else { quarantine++; diagnostics.push({ filename:file.filename, locator:entry.locator, code:'conflicting_key', disposition:'quarantined' }); }
        continue;
      }
      keys.set(key,contentHash); valid.push(entry);
    }
    if (rows.length !== file.records) diagnostics.push({ filename:file.filename, code:'record_count_mismatch', disposition:'blocking' });
    coverage.push({ filename:file.filename, expected:file.records ?? 0, retained:rows.length, valid:valid.length, duplicate:duplicates, quarantined:quarantine });
    rowsByFile.set(file.filename,valid);
  }
  for (const filename of recordFiles) if (!parsed.has(filename)) diagnostics.push({ filename, code:'missing_required_source', disposition:'blocking' });
  const eid = (kind:string,id:string) => stableId(datasetId,kind,id);
  const sid = (filename:string,locator:number) => stableId(datasetId,'source',filename,String(locator));
  const fid = (filename:string) => stableId(datasetId,'file',filename);
  const setFor = (filename:string) => new Set((rowsByFile.get(filename) ?? []).map(r=>r.row[idField[filename]]));
  const targets = { account:setFor('crm_accounts.csv'), employee:setFor('employees.csv'), contact:setFor('crm_contacts.csv'), interaction:setFor('interactions.jsonl') };
  const references: Record<string, keyof typeof targets> = { account_id:'account', account_id_saat_ini:'account', account_owner_id:'employee', owner_id:'employee', contact_id:'contact', champion_contact_id:'contact', membalas_id:'interaction' };
  for (const filename of required) for (const {row,locator} of rowsByFile.get(filename) ?? []) {
    for (const [field, kind] of Object.entries(references)) {
      if (idField[filename] === field || !row[field]) continue;
      if (!targets[kind].has(row[field])) diagnostics.push({ filename, locator, field, code:'unresolved_reference', disposition:'blocking' });
    }
    if (row.selesai && row.mulai && row.selesai < row.mulai) diagnostics.push({ filename, locator, field:'selesai', code:'invalid_interval', disposition:'blocking' });
    for (const person of row.peserta?.split(';').filter(Boolean) ?? []) if (!targets.contact.has(person) && !targets.employee.has(person)) diagnostics.push({ filename,locator,field:'peserta',code:'unresolved_participant',disposition:'blocking' });
  }
  const blocked = diagnostics.some(d=>d.disposition === 'blocking' || d.disposition === 'quarantined');
  const report = { readiness_scope:'phase1_identity_commercial',normalized_sources:required,retained_only_sources:recordFiles.filter(f=>!required.includes(f)),files:coverage, deals_complete:!blocked && parsed.has('crm_deals.csv'), normalization_complete:false, diagnostics_count:diagnostics.length };
  // Commit retention separately: even a failed normalization keeps raw data and report.
  await db.transaction(async tx => {
    await tx.insert(s.datasets).values({ id:datasetId, version:manifest.dataset_version, manifestHash:manifest.content_manifest_sha256, mappingVersion:manifest.mapping_version, asOf:manifest.as_of, status:'staging', coverage:report });
    for (const {file} of inputs) {
      await tx.insert(s.sourceFiles).values({ id:fid(file.filename), datasetId, filename:file.filename, sha256:file.sha256, relativePath:`${manifest.dataset_version}/${file.filename}`, recordCount:file.records ?? 0 });
      const rows = parsed.get(file.filename) ?? [];
      for (let offset=0;offset<rows.length;offset+=2000) await tx.insert(s.sourceRecords).values(rows.slice(offset,offset+2000).map(entry=>({ id:sid(file.filename,entry.locator), datasetId, fileId:fid(file.filename), locator:entry.locator, externalId:entry.row[idField[file.filename]] || null, accountExternalId:entry.row.account_id || entry.row.account_id_saat_ini || null, payload:entry.row, rawText:entry.raw, contentHash:sha256(entry.raw), searchText:Object.values(entry.row).join(' ') })));
    }
    if (diagnostics.length) await tx.insert(s.ingestionErrors).values(diagnostics.map((d,i)=>({ id:stableId(datasetId,'error',String(i)),datasetId,fileId:d.filename && inputs.some(x=>x.file.filename===d.filename) ? fid(d.filename) : null, locator:d.locator ?? null, code:d.code,field:d.field ?? null,disposition:d.disposition })));
  });
  if (!blocked) {
    try {
      await db.transaction(async tx => {
        const normalized = async (kind:string,externalId:string,table:AnyPgTable,values:Record<string,unknown>,filename:string,locator:number) => {
          const id=eid(kind,externalId);
          await tx.insert(s.entities).values({ id,datasetId,kind,externalId }).onConflictDoNothing();
          await tx.insert(table).values({ id,datasetId,externalId,...values }).onConflictDoNothing();
          await tx.insert(s.entitySources).values({ datasetId,entityId:id,sourceId:sid(filename,locator) }).onConflictDoNothing();
          return id;
        };
        for (const {row:r,locator} of rowsByFile.get('employees.csv')!) await normalized('employee',r.employee_id,s.employees,{ name:r.nama,title:r.jabatan,email:r.email.toLowerCase() },'employees.csv',locator);
        for (const {row:r,locator} of rowsByFile.get('crm_accounts.csv')!) await normalized('account',r.account_id,s.accounts,{ name:r.nama,type:r.tipe==='pelanggan'?'customer':'prospect',ownerId:eid('employee',r.account_owner_id),championExternalId:r.champion_contact_id || null,package:r.paket || null,outletCount:Number(r.jumlah_outlet) },'crm_accounts.csv',locator);
        for (const {row:r,locator} of rowsByFile.get('crm_contacts.csv')!) await normalized('contact',r.contact_id,s.contacts,{ name:r.nama,email:r.email.toLowerCase(),accountId:eid('account',r.account_id_saat_ini),title:r.jabatan_saat_ini },'crm_contacts.csv',locator);
        for (const {row:r,locator} of rowsByFile.get('contact_employment_history.csv')!) {
          const organizationKey=r.account_id || r.organisasi;
          const organizationId=await normalized('organization',organizationKey,s.organizations,{ name:r.organisasi,accountId:r.account_id?eid('account',r.account_id):null },'contact_employment_history.csv',locator);
          await normalized('employment',JSON.stringify([r.contact_id,r.organisasi,r.jabatan,r.mulai]),s.employments,{ contactId:eid('contact',r.contact_id),organizationId,accountId:r.account_id?eid('account',r.account_id):null,role:r.jabatan,start:r.mulai,end:r.selesai || null },'contact_employment_history.csv',locator);
        }
        for (const {row:r,locator} of rowsByFile.get('contracts_billing.csv')!) await normalized('contract',r.contract_id,s.contracts,{ accountId:eid('account',r.account_id),package:r.paket,outlets:Number(r.outlet_kontrak),outletLimit:r.batas_outlet_paket==='tanpa batas'?null:Number(r.batas_outlet_paket),unlimited:r.batas_outlet_paket==='tanpa batas',start:r.mulai,renewal:r.tanggal_renewal,monthlyRate:r.harga_per_outlet_bulan,discountPercent:r.diskon_pct,annualValue:r.nilai_tahunan,decisionExternalId:r.decision_id || null },'contracts_billing.csv',locator);
        for (const {row:r,locator} of rowsByFile.get('crm_deals.csv')!) await normalized('deal',r.deal_id,s.deals,{ accountId:eid('account',r.account_id),ownerId:eid('employee',r.owner_id),type:({baru:'new_sale',renewal:'renewal',ekspansi:'expansion'} as Record<string,string>)[r.tipe],stage:r.stage,stageSince:r.stage_sejak,created:r.dibuat,outlets:Number(r.outlet),annualValue:r.nilai_tahunan,status:r.status },'crm_deals.csv',locator);
        for (const {row:r,locator} of rowsByFile.get('interactions.jsonl')!) await normalized('interaction',r.interaction_id,s.interactions,{ accountId:r.account_id?eid('account',r.account_id):null,eventDate:r.tanggal,type:r.tipe,sender:r.dari,recipients:r.ke,subject:r.subjek,body:r.isi,parentId:null },'interactions.jsonl',locator);
        // Second pass: threads and people resolve only after all base rows exist.
        const people = [...(rowsByFile.get('employees.csv') ?? []).map(x=>({id:eid('employee',x.row.employee_id),email:x.row.email})),...(rowsByFile.get('crm_contacts.csv') ?? []).map(x=>({id:eid('contact',x.row.contact_id),email:x.row.email}))];
        for (const {row:r,locator} of rowsByFile.get('interactions.jsonl')!) {
          const interactionId=eid('interaction',r.interaction_id);
          if (r.membalas_id) await tx.update(s.interactions).set({ parentId:eid('interaction',r.membalas_id) }).where(eq(s.interactions.id,interactionId));
          for (const [role,addresses] of [['sender',r.dari],['recipient',r.ke]]) for (const address of addresses.split(/[;,]/).filter(Boolean)) {
            const matched=people.filter(p=>p.email.toLowerCase()===address.trim().toLowerCase());
            if (matched.length===1) await tx.insert(s.participants).values({ datasetId,interactionId,personId:matched[0].id,role }).onConflictDoNothing();
            else await tx.insert(s.ingestionErrors).values({ id:stableId(datasetId,'email',String(locator),role,address),datasetId,fileId:fid('interactions.jsonl'),locator,code:matched.length?'ambiguous_email':'unresolved_email',field:role,disposition:'unresolved_not_merged' });
          }
          for (const participant of r.peserta.split(';').filter(Boolean)) await tx.insert(s.participants).values({ datasetId,interactionId,personId:eid(targets.employee.has(participant)?'employee':'contact',participant),role:'attendee' }).onConflictDoNothing();
        }
        for (const {row:r,locator} of rowsByFile.get('crm_accounts.csv')!) {
          const champion=(rowsByFile.get('crm_contacts.csv') ?? []).find(c=>c.row.contact_id===r.champion_contact_id);
          if (champion && champion.row.account_id_saat_ini!==r.account_id) await tx.insert(s.ingestionErrors).values({ id:stableId(datasetId,'champion',r.account_id),datasetId,fileId:fid('crm_accounts.csv'),locator,code:'stale_champion',field:'champion_contact_id',disposition:'retained_conflict' });
        }
        report.normalization_complete=true;
        const [diagnosticCount]=await tx.select({n:dbCount()}).from(s.ingestionErrors).where(eq(s.ingestionErrors.datasetId,datasetId));
        report.diagnostics_count=diagnosticCount.n;
        await tx.update(s.datasets).set({ status:'ready',coverage:report }).where(eq(s.datasets.id,datasetId));
      });
    } catch {
      report.normalization_complete=false; report.deals_complete=false;
      await db.insert(s.ingestionErrors).values({ id:stableId(datasetId,'normalization_failure'),datasetId,code:'normalization_transaction_failed',disposition:'rolled_back' });
      await db.update(s.datasets).set({ status:'incomplete',coverage:report }).where(eq(s.datasets.id,datasetId));
      throw new Error(`Normalization rolled back; retained snapshot ${datasetId} is incomplete. Inspect ingestion_errors.`);
    }
  } else await db.update(s.datasets).set({ status:'incomplete',coverage:report }).where(eq(s.datasets.id,datasetId));
  return { dataset_id:datasetId,status:blocked?'incomplete':'ready',reused:false,coverage:report };
}
