import { randomUUID } from 'node:crypto';
import { resolve,basename } from 'node:path';
import { rm,realpath } from 'node:fs/promises';
import { describe,it,expect,beforeAll,afterAll } from 'vitest';
import pg from 'pg';
import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq,count,and } from 'drizzle-orm';
import { env,projectRoot } from '../apps/api/src/config/env.js';
import * as s from '../apps/api/src/db/schema/index.js';
import { importDataset,stableId } from '../apps/api/src/modules/ingestion/service.js';
import { analyzeDataset } from '../apps/api/src/modules/opportunities/service.js';
import { inside } from '../apps/api/src/modules/ingestion/manifest.js';
import { createApp } from '../apps/api/src/app.js';
import { fixture } from './fixtures/snapshot.js';
import { cardSchema } from '@kasirnusa/contracts';
import { Interpreter } from '../apps/api/src/ai/router.js';
import { choices,type Context } from '../apps/api/src/ai/schemas/interpretation.js';
import { ProviderError,type Provider } from '../apps/api/src/ai/providers/interface.js';
import { interpretationContext } from '../apps/api/src/ai/context.js';
import { analyzeStakeholders } from '../apps/api/src/modules/stakeholders/service.js';
import { diagnosisSchema } from '@kasirnusa/contracts';

// Never migrate/truncate/drop the imported developer database. Only a freshly
// created random database owned by this test run is eligible for teardown.
const adminUrl=new URL(env.DATABASE_URL);
if(!['127.0.0.1','localhost'].includes(adminUrl.hostname))throw new Error('DB tests require a local PostgreSQL server');
const name=`kasirnusa_test_${randomUUID().replaceAll('-','')}`;
const admin=new pg.Pool({connectionString:adminUrl.href});
const testUrl=new URL(adminUrl);testUrl.pathname=`/${name}`;
const pool=new pg.Pool({connectionString:testUrl.href});
const db=drizzle(pool,{schema:s});let created=false;
const paths:string[]=[];
const make=async(options:Parameters<typeof fixture>[0]={})=>{const f=await fixture(options);paths.push(f.path);return f;};
const card=async(datasetId:string)=>{const rows=await db.select({card:s.recommendations.card}).from(s.recommendations).innerJoin(s.signals,and(eq(s.recommendations.signalId,s.signals.id),eq(s.recommendations.runId,s.signals.runId))).where(eq(s.recommendations.datasetId,datasetId));return cardSchema.parse(rows[0].card);};
beforeAll(async()=>{await admin.query(`CREATE DATABASE "${name}"`);created=true;await migrate(db,{migrationsFolder:resolve(projectRoot,'apps/api/src/db/migrations')});});
afterAll(async()=>{
  await pool.end();
  if(created&&/^kasirnusa_test_[a-f0-9]{32}$/.test(name))await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
  const root=await realpath(resolve(projectRoot,env.DATA_ROOT));
  for(const path of paths){const target=inside(root,await realpath(path));if(!basename(target).startsWith('phase1-test-'))throw new Error('Unsafe fixture cleanup');await rm(target,{recursive:true});}
});
describe('disposable migrated PostgreSQL slice',()=>{
  it('persists account diagnosis, employee decisions and graph assertions without a new signal',async()=>{
    const f=await make({stakeholderSlice:true,messages:[{id:'I2',body:'Hadir: Pak Sample. Ia bertanya mengapa integrasi yang dijanjikan belum ada. Belum ada komitmen renewal.',sender:'manager@example.test',participants:'K1;E1'},{id:'I3',body:'Saya lampirkan ringkasan penggunaan. Kapan bahas renewal?',sender:'manager@example.test',recipient:'buyer@example.test',date:'2026-08-03'}]});
    const imported=await importDataset(db,f.manifest);const accountId=stableId(imported.dataset_id,'account','A1');
    const result=await analyzeStakeholders(db,imported.dataset_id,accountId);expect(result.decisions).toBe(1);expect((await analyzeStakeholders(db,imported.dataset_id,accountId)).reused).toBe(true);
    const [row]=await db.select().from(s.diagnoses).where(eq(s.diagnoses.datasetId,imported.dataset_id));const d=diagnosisSchema.parse(row.diagnosis);
    expect(d.commercial_context).toBe('renewal');expect(d.signal_id).toBeNull();expect(d.value_scenario).toBeNull();expect(d.action_plan.route).toBe('resolve_prerequisite_first');expect(d.findings.some(f=>f.type==='engagement_mismatch')).toBe(true);
    expect(d.stakeholder_context[0].statements[0].attribution).toBe('reported');expect(d.stakeholder_context[0].authority).toBe('unknown');
    const [signals]=await db.select({n:count()}).from(s.signals).where(eq(s.signals.datasetId,imported.dataset_id));expect(signals.n).toBe(0);
    const [link]=await db.select().from(s.assertions).where(and(eq(s.assertions.datasetId,imported.dataset_id),eq(s.assertions.predicate,'CONCERN_ABOUT_COMMITMENT')));expect(link.objectId).toBe(d.internal_decisions[0].id);
    const api=createApp(db,new Set([imported.dataset_id]));const url=`/api/accounts/${accountId}/diagnosis?dataset_id=${imported.dataset_id}`;
    const beforeDraft=await db.select({n:count()}).from(s.recommendations);
    const draft=await request(api).post(`/api/accounts/${accountId}/draft?dataset_id=${imported.dataset_id}`).send({language:'en'});
    expect(draft.status).toBe(200);expect(draft.body.commercial_context).toBe('renewal');expect(draft.body.review_status).toBe('human_review_required');
    expect(draft.body.body).toContain(d.action_plan.task);expect(draft.body.recipient_ids).toEqual(d.action_plan.recipient_ids);
    expect(draft.body.evidence_ids.every((id:string)=>d.evidence.some(e=>e.source_id===id))).toBe(true);
    expect(await db.select({n:count()}).from(s.recommendations)).toEqual(beforeDraft);
    expect((await request(api).post(`/api/accounts/${accountId}/draft?dataset_id=${imported.dataset_id}`).send({recipient_ids:[randomUUID()]})).status).toBe(400);
    expect((await request(api).post(`/api/accounts/${accountId}/draft?dataset_id=${randomUUID()}`).send({})).status).toBe(404);
    const question=await request(api).get(url+'&question=Why%20are%20repeat%20orders%20lower?');expect(question.status).toBe(200);expect(question.body.premise_check.status).toBe('insufficient_data');
    expect((await request(api).get(`/api/accounts/${accountId}/stakeholders?dataset_id=${imported.dataset_id}`)).status).toBe(200);
    expect((await request(api).get(`/api/accounts/${accountId}/diagnosis/evidence?dataset_id=${imported.dataset_id}`)).body.limits.max_hops).toBe(3);
    expect((await request(api).get(url+'&signal_id='+randomUUID())).status).toBe(404);
    expect((await request(api).get(url+'&metric=renewal&previous_start=2026-01-01')).status).toBe(400);
    for(const evidence of d.evidence)expect((await request(api).get(`/api/sources/${evidence.source_id}?dataset_id=${imported.dataset_id}`)).status).toBe(200);
    await analyzeDataset(db,imported.dataset_id,'2026-09-01');expect((await request(api).get(url)).status).toBe(409);
    const c=await card(imported.dataset_id);await analyzeStakeholders(db,imported.dataset_id,accountId,{signalId:c.id});expect((await request(api).get(url+'&signal_id='+c.id)).status).toBe(200);
    await analyzeStakeholders(db,imported.dataset_id,accountId);expect((await request(api).get(url)).status).toBe(200);
  });
  it('retains unresolved internal approvals without assigning a customer as approver',async()=>{
    const f=await make({stakeholderSlice:true,invalidDecisionApprover:true});const imported=await importDataset(db,f.manifest);
    const result=await analyzeStakeholders(db,imported.dataset_id,stableId(imported.dataset_id,'account','A1'));expect(result.unresolved_decisions).toBe(1);expect(result.decisions).toBe(0);
    const [row]=await db.select().from(s.diagnoses).where(eq(s.diagnoses.datasetId,imported.dataset_id));const d=diagnosisSchema.parse(row.diagnosis);expect(d.internal_decisions).toHaveLength(0);expect(d.stakeholder_context[0].authority).toBe('unknown');
    expect(d.findings.some(f=>f.type==='unresolved_internal_decisions')).toBe(true);
  });
  it('requires a documented ticket prerequisite instead of treating ticket volume as a blocker',async()=>{
    for(const [body,expected] of [['Kami mengirim banyak tiket termasuk T1 sebelum ekspansi.',false],['T1 harus selesai sebelum rollout.',true]] as const){
      const f=await make({ticketSlice:true,messages:[{id:'I2',body}]});const imported=await importDataset(db,f.manifest);await analyzeStakeholders(db,imported.dataset_id,stableId(imported.dataset_id,'account','A1'));
      const [row]=await db.select().from(s.diagnoses).where(eq(s.diagnoses.datasetId,imported.dataset_id));const d=diagnosisSchema.parse(row.diagnosis);
      expect(d.findings.some(f=>f.type==='documented_ticket_prerequisite')).toBe(expected);expect(d.action_plan.route).toBe(expected?'resolve_prerequisite_first':'clarify_authority_or_requirement');
    }
  });
  it('retains one signal through revision and cancellation with both source records',async()=>{
    const f=await make({messages:[{id:'I2',body:'Revisi rencana menjadi 5 outlet.',parent:'I1'}]});const result=await importDataset(db,f.manifest);
    await analyzeDataset(db,result.dataset_id,'2026-09-01');const revised=await card(result.dataset_id);
    expect(revised.signal.additional_outlets).toBe(5);expect(revised.value_scenario?.amount).toBe('5250.00');expect(revised.signal.date).toBe('2026-08-01');
    expect(revised.evidence.filter(e=>e.filename==='interactions.jsonl').map(e=>e.source_external_id).sort()).toEqual(['I1','I2']);
    const [signals]=await db.select({n:count()}).from(s.signals).where(eq(s.signals.datasetId,result.dataset_id));expect(signals.n).toBe(1);
    const cancelledFixture=await make({messages:[{id:'I2',body:'Rencana ekspansi dibatalkan.',parent:'I1'}]});const cancelled=await importDataset(db,cancelledFixture.manifest);await analyzeDataset(db,cancelled.dataset_id,'2026-09-01');
    expect(await card(cancelled.dataset_id)).toMatchObject({signal:{status:'cancelled'},value_scenario:null});
    const api=createApp(db,new Set([result.dataset_id,cancelled.dataset_id]));
    const draft=await request(api).post(`/api/opportunities/${revised.id}/draft?dataset_id=${result.dataset_id}`).send({language:'id'});
    expect(draft.status).toBe(200);expect(draft.body.body).toContain(revised.next_action.task);expect(draft.body.body).toContain('Usulan pembahasan');expect(draft.body.method).toBe('template-v1');
    const cancelledCard=await card(cancelled.dataset_id);
    expect((await request(api).post(`/api/opportunities/${cancelledCard.id}/draft?dataset_id=${cancelled.dataset_id}`).send({})).status).toBe(409);
  });
  it('records unavailable/failure outcomes, reuses successes and rejects stale or invalid caches',async()=>{
    const f=await make({tag:'model-ledger'});const imported=await importDataset(db,f.manifest);
    const context=await interpretationContext(db,imported.dataset_id,'A1',['I1'],'K1');
    let invoked=0;
    const value={type:'choice',choice:'quotation_request',probabilities:Object.fromEntries(choices.intent.map(k=>[k,k==='quotation_request'?1:0])),confidence:0.75};
    const provider:Provider={name:'typesafe',model:'jev-1.13.0',configured:true,async invoke(){invoked++;return {model:'jev-1.13.0',value,inputTokens:100,outputTokens:10};}};
    const offline=new Interpreter(db,{live:false,maxCalls:2,timeoutMs:100});expect((await offline.run(context,'intent',provider)).status).toBe('unavailable');expect(invoked).toBe(0);
    const live=new Interpreter(db,{live:true,maxCalls:2,timeoutMs:100});
    const results=await Promise.all([live.run(context,'intent',provider),live.run(context,'intent',provider)]);expect(results.every(r=>r.status==='succeeded')).toBe(true);expect(invoked).toBe(1);expect(results.filter(r=>r.cached)).toHaveLength(1);
    const [saved]=await db.select().from(s.modelRuns).where(eq(s.modelRuns.id,results[0].runId));expect(saved.costUsd).toBe('0.0000042000');expect(saved.inputTokens).toBe(100);
    await txInvalidCache(saved.id);
    expect((await live.run(context,'intent',provider)).cached).toBe(false);expect(invoked).toBe(2);
    expect((await live.run({...context,claim:'changed operation input'},'intent',provider)).status).toBe('budget_exceeded');
    const invalid=new Interpreter(db,{live:true,maxCalls:2,timeoutMs:100});
    const bad={...provider,model:'invalid-test-model',async invoke(){return {model:'invalid-test-model',value:{...value,probabilities:{quotation_request:1}},inputTokens:1,outputTokens:1};}};
    expect((await invalid.run(context,'intent',bad)).status).toBe('invalid');expect((await invalid.run(context,'intent',bad)).cached).toBe(false);
    const timeoutProvider={...provider,model:'timeout-test-model',invoke:async(_op:unknown,_context:unknown,signal:AbortSignal)=>new Promise<never>((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))};
    expect((await new Interpreter(db,{live:true,maxCalls:1,timeoutMs:10}).run(context,'intent',timeoutProvider)).status).toBe('timeout');
    let attempts=0;const retryProvider={...provider,model:'retry-test-model',async invoke(){attempts++;if(attempts===1)throw new ProviderError('provider_error',true);return {model:'retry-test-model',value,inputTokens:1,outputTokens:1};}};
    const retries=new Interpreter(db,{live:true,maxCalls:2,timeoutMs:100});expect((await retries.run(context,'intent',retryProvider)).status).toBe('succeeded');expect(retries.calls).toBe(2);
    await expect(interpretationContext(db,imported.dataset_id,'A1',['missing'])).rejects.toThrow();
    await expect(live.run({...context,accountId:randomUUID()},'intent',provider)).rejects.toThrow('account_outside_dataset');
    async function txInvalidCache(id:string){await db.update(s.modelRuns).set({output:{bad:true}}).where(eq(s.modelRuns.id,id));}
  });
  it('imports idempotently, retains all records and produces one deduplicated card',async()=>{
    const f=await make({duplicate:true});const result=await importDataset(db,f.manifest);expect(result.status).toBe('ready');
    expect((await importDataset(db,f.manifest)).reused).toBe(true);
    const [records]=await db.select({n:count()}).from(s.sourceRecords).where(eq(s.sourceRecords.datasetId,result.dataset_id));expect(records.n).toBe(7);
    await analyzeDataset(db,result.dataset_id,'2026-09-01');expect((await analyzeDataset(db,result.dataset_id,'2026-09-01')).reused).toBe(true);
    const c=await card(result.dataset_id);expect(c.value_scenario?.amount).toBe('3150.00');expect(c.reconciliation.status).toBe('unmatched');expect(c.people.contact?.external_id).toBe('K1');expect(c.stakeholder_context[0].authority).toBe('unknown');
    const [signals]=await db.select({n:count()}).from(s.signals).where(eq(s.signals.datasetId,result.dataset_id));expect(signals.n).toBe(1);
    const api=createApp(db,new Set([result.dataset_id]));const response=await request(api).get(`/api/opportunities/${c.id}?dataset_id=${result.dataset_id}`);expect(response.status).toBe(200);
    for(const e of c.evidence){const source=await request(api).get(`/api/sources/${e.source_id}?dataset_id=${result.dataset_id}`);expect(source.status).toBe(200);expect(source.body.locator).toBe(e.locator);}
    const graph=await request(api).get(`/api/opportunities/${c.id}/evidence?dataset_id=${result.dataset_id}`);expect(graph.status).toBe(200);expect(graph.body.limits.max_hops).toBe(3);expect(graph.body.nodes.length).toBeLessThanOrEqual(50);
    expect((await request(api).get('/api/accounts?page_size=101')).status).toBe(400);
    expect((await request(api).get('/api/datasets').set('Origin','https://untrusted.example')).status).toBe(403);
    expect((await request(api).get('/api/datasets').set('Host','untrusted.example')).status).toBe(403);
  });
  it('suppresses missing-deal finding when scoped evidence confirms the same request',async()=>{
    const f=await make({deal:true});const result=await importDataset(db,f.manifest);await analyzeDataset(db,result.dataset_id,'2026-09-01');
    const c=await card(result.dataset_id);expect(c.reconciliation.status).toBe('ambiguous');
    const [deal]=await db.select().from(s.deals).where(eq(s.deals.datasetId,result.dataset_id));const [run]=await db.select().from(s.analysisRuns).where(eq(s.analysisRuns.datasetId,result.dataset_id));
    const assertionId=randomUUID();await db.insert(s.assertions).values({id:assertionId,datasetId:result.dataset_id,subjectId:c.id,predicate:'MATCHES_DEAL',objectId:deal.id,literal:null,accountId:c.account.id,eventDate:'2026-08-01',speakerId:null,attribution:'reviewed',method:'synthetic-reviewed-fixture',verification:'manually_verified',runId:run.id});
    const [source]=await db.select().from(s.sourceRecords).where(and(eq(s.sourceRecords.datasetId,result.dataset_id),eq(s.sourceRecords.externalId,'DL1')));
    await db.insert(s.assertionEvidence).values({datasetId:result.dataset_id,assertionId,sourceId:source.id,field:'request_interaction_id',passage:'I1',relation:'support'});
    await analyzeDataset(db,result.dataset_id,'2026-09-01');const confirmed=await card(result.dataset_id);
    expect(confirmed.reconciliation.status).toBe('matched');expect(confirmed.findings.some(f=>f.type==='missing_deal')).toBe(false);
    expect(confirmed.signal.additional_outlets).toBe(3);
  });
  it('quarantines malformed input and blocks missing or unusable full deal scope',async()=>{
    for(const options of [{malformed:true},{missingDeals:true},{invalidDealHeader:true},{invalidOwner:true}]){
      const f=await make(options);const result=await importDataset(db,f.manifest);expect(result.status).toBe('incomplete');
      expect((result.coverage as {deals_complete:boolean}).deals_complete).toBe(false);
      await expect(analyzeDataset(db,result.dataset_id,'2026-09-01')).rejects.toThrow('ready');
      const [accounts]=await db.select({n:count()}).from(s.accounts).where(eq(s.accounts.datasetId,result.dataset_id));expect(accounts.n).toBe(0);
      const [errors]=await db.select({n:count()}).from(s.ingestionErrors).where(eq(s.ingestionErrors.datasetId,result.dataset_id));expect(errors.n).toBeGreaterThan(0);
      if('malformed' in options&&options.malformed){const [raw]=await db.select().from(s.sourceRecords).where(and(eq(s.sourceRecords.datasetId,result.dataset_id),eq(s.sourceRecords.locator,1),eq(s.sourceRecords.fileId,stableId(result.dataset_id,'file','interactions.jsonl'))));expect(raw.rawText).toContain('{broken');}
    }
  });
  it('returns unknown pricing for conflicting terms and prerequisite route for package changes',async()=>{
    for(const options of [{conflictingContracts:true},{finiteLimit:true},{inconsistentTerms:true}]){const f=await make(options);const result=await importDataset(db,f.manifest);await analyzeDataset(db,result.dataset_id,'2026-09-01');const c=await card(result.dataset_id);expect(c.value_scenario).toBeNull();if('finiteLimit' in options&&options.finiteLimit)expect(c.next_action.route).toBe('resolve_prerequisite_first');if('inconsistentTerms' in options&&options.inconsistentTerms)expect(c.findings.some(f=>f.type==='commercial_terms_conflict')).toBe(true);}
  });
  it('rejects cross-snapshot FKs, wrong entity kinds and unauthorized evidence',async()=>{
    const a=await importDataset(db,(await make()).manifest);const b=await importDataset(db,(await make({tag:'different snapshot'})).manifest);expect(a.dataset_id).not.toBe(b.dataset_id);await analyzeDataset(db,a.dataset_id,'2026-09-01');const c=await card(a.dataset_id);
    const foreignAccount=stableId(b.dataset_id,'account','A1');const id=randomUUID();await db.insert(s.entities).values({id,datasetId:a.dataset_id,kind:'contact',externalId:'cross'});
    await expect(db.insert(s.contacts).values({id,datasetId:a.dataset_id,externalId:'cross',name:'Synthetic',email:'x@example.test',title:'Unknown',accountId:foreignAccount})).rejects.toThrow();
    const employeeId=stableId(a.dataset_id,'employee','E1');await expect(db.insert(s.accounts).values({id:employeeId,datasetId:a.dataset_id,externalId:'wrong-kind',name:'Synthetic',type:'customer',ownerId:employeeId})).rejects.toThrow();
    const api=createApp(db,new Set([b.dataset_id]));expect((await request(api).get(`/api/opportunities/${c.id}?dataset_id=${b.dataset_id}`)).status).toBe(404);expect((await request(api).get(`/api/sources/${c.evidence[0].source_id}?dataset_id=${b.dataset_id}`)).status).toBe(404);expect((await request(api).get(`/api/accounts?dataset_id=${a.dataset_id}`)).status).toBe(404);
  });
  it('rolls back failed writes in the disposable database',async()=>{
    const id=randomUUID();await expect(db.transaction(async tx=>{await tx.insert(s.datasets).values({id,version:'rollback',manifestHash:randomUUID(),mappingVersion:'test',asOf:'2026-09-01',status:'staging',coverage:{}});throw new Error('Synthetic failure');})).rejects.toThrow('Synthetic failure');
    expect(await db.select().from(s.datasets).where(eq(s.datasets.id,id))).toHaveLength(0);
  });
});
