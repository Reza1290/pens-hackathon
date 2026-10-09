import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { and,eq,count } from 'drizzle-orm';
import { z } from 'zod';
import request from 'supertest';
import { diagnosisSchema } from '@kasirnusa/contracts';
import { db,pool } from '../db/client.js';
import * as s from '../db/schema/index.js';
import { createApp } from '../app.js';
import { projectRoot } from '../config/env.js';
import { requiredArg } from './args.js';
const fixtureSchema=z.object({dataset_version:z.string(),as_of:z.iso.date(),cases:z.array(z.object({account_id:z.string(),commercial_context:z.string(),route:z.string(),sources:z.array(z.string()),finding_types:z.array(z.string()),historical_contacts:z.array(z.string()),statements:z.array(z.object({contact_id:z.string(),predicate:z.string(),attribution:z.string()}))}))});
try{
  const datasetId=z.uuid().parse(requiredArg('dataset'));
  const fixture=fixtureSchema.parse(JSON.parse(await readFile(resolve(projectRoot,requiredArg('fixture')),'utf8')));
  const api=createApp(db,new Set([datasetId])),results=[];
  for(const expected of fixture.cases){
    const [account]=await db.select().from(s.accounts).where(and(eq(s.accounts.datasetId,datasetId),eq(s.accounts.externalId,expected.account_id)));assert(account);
    const url=`/api/accounts/${account.id}/diagnosis?dataset_id=${datasetId}`;
    const response=await request(api).get(url);assert.equal(response.status,200);const diagnosis=diagnosisSchema.parse(response.body);
    assert.equal(diagnosis.dataset_version,fixture.dataset_version);assert.equal(diagnosis.as_of,fixture.as_of);assert.equal(diagnosis.commercial_context,expected.commercial_context);assert.equal(diagnosis.action_plan.route,expected.route);assert.equal(diagnosis.signal_id,null);assert.equal(diagnosis.value_scenario,null);
    for(const id of expected.sources)assert(diagnosis.evidence.some(e=>e.source_external_id===id));
    for(const type of expected.finding_types)assert(diagnosis.findings.some(f=>f.type===type));
    if(expected.finding_types.includes('ticket_context')){assert(!diagnosis.findings.some(f=>f.type==='documented_ticket_prerequisite'));assert.equal(diagnosis.findings.find(f=>f.type==='ticket_context')?.check?.blocker_claim,false);}
    for(const id of expected.historical_contacts){const person=diagnosis.stakeholder_context.find(p=>p.person.external_id===id);assert(person);assert.equal(person.current,false);assert(!diagnosis.action_plan.recipient_ids.includes(person.person.id));}
    for(const statement of expected.statements){const person=diagnosis.stakeholder_context.find(p=>p.person.external_id===statement.contact_id);assert(person?.statements.some(a=>a.predicate===statement.predicate&&a.attribution===statement.attribution));assert(diagnosis.action_plan.recipient_ids.includes(person!.person.id));}
    const employeeIds=(await db.select({id:s.employees.id}).from(s.employees).where(eq(s.employees.datasetId,datasetId))).map(e=>e.id);
    for(const decision of diagnosis.internal_decisions){assert(employeeIds.includes(decision.requester_id));assert(employeeIds.includes(decision.approver_id));assert(!diagnosis.stakeholder_context.some(p=>p.person.id===decision.approver_id));}
    for(const e of diagnosis.evidence){const source=await request(api).get(`/api/sources/${e.source_id}?dataset_id=${datasetId}`);assert.equal(source.status,200);assert.equal(source.body.filename,e.filename);assert.equal(source.body.locator,e.locator);if(source.body.payload[e.field])assert(source.body.payload[e.field].includes(e.passage));}
    const question=await request(api).get(url+'&question=Why%20are%20repeat%20orders%20lower?');assert.equal(question.body.premise_check.status,'insufficient_data');assert.equal(question.body.premise_check.calculation,null);
    const graph=await request(api).get(`/api/accounts/${account.id}/diagnosis/evidence?dataset_id=${datasetId}`);assert.equal(graph.status,200);assert.equal(graph.body.limits.max_hops,3);
    if(diagnosis.action_plan.route==='joint_decision_maker_discussion'){const preparation=await request(api).get(url+'&route=intermediary');assert.equal(preparation.body.action_plan.route,'prepare_through_intermediary');assert(diagnosis.stakeholder_context.every(p=>p.statements.every(a=>a.predicate!=='REQUESTS_EVIDENCE')));}
    results.push({account:expected.account_id,verified:true,context:diagnosis.commercial_context,route:diagnosis.action_plan.route,statements:diagnosis.stakeholder_context.flatMap(p=>p.statements).length,evidence_passages:diagnosis.evidence.length,graph_nodes:graph.body.nodes.length});
  }
  const [decisions]=await db.select({n:count()}).from(s.decisions).where(eq(s.decisions.datasetId,datasetId));console.log(JSON.stringify({verified:true,normalized_internal_decisions:decisions.n,results},null,2));
}finally{await pool.end();}
