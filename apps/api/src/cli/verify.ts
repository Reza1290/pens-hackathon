// Read-only verification against a reviewed, redacted expectation fixture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { and,eq,count } from 'drizzle-orm';
import { z } from 'zod';
import request from 'supertest';
import { db,pool } from '../db/client.js';
import * as s from '../db/schema/index.js';
import { createApp } from '../app.js';
import { cardSchema } from '@kasirnusa/contracts';
import { projectRoot } from '../config/env.js';
import { requiredArg } from './args.js';
const expectationSchema=z.object({dataset_version:z.string(),as_of:z.iso.date(),account_external_id:z.string(),source_external_id:z.string(),request_date:z.iso.date(),additional_outlets:z.number(),location:z.string(),target_period:z.string(),annual_increment:z.string().nullable(),elapsed_days:z.number(),owner_external_id:z.string(),contact_external_id:z.string(),reconciliation_status:z.string(),next_action_route:z.string().optional(),acknowledgements:z.number().optional()});
try{
  const datasetId=z.uuid().parse(requiredArg('dataset'));
  const expected=expectationSchema.parse(JSON.parse(await readFile(resolve(projectRoot,requiredArg('fixture')),'utf8')));
  const api=createApp(db,new Set([datasetId]));
  const response=await request(api).get(`/api/opportunities?dataset_id=${datasetId}`);assert.equal(response.status,200);
  const candidates=z.array(cardSchema).parse(response.body.items).filter(c=>c.account.external_id===expected.account_external_id);
  assert.equal(candidates.length,1);const c=candidates[0];
  assert.equal(c.dataset_version,expected.dataset_version);assert.equal(c.as_of,expected.as_of);assert.equal(c.signal.date,expected.request_date);assert.equal(c.signal.additional_outlets,expected.additional_outlets);assert.equal(c.signal.location,expected.location);assert.equal(c.signal.target_period,expected.target_period);assert.equal(c.value_scenario?.amount??null,expected.annual_increment);assert.equal(c.elapsed_days,expected.elapsed_days);assert.equal(c.people.owner.external_id,expected.owner_external_id);assert.equal(c.people.contact?.external_id,expected.contact_external_id);assert.equal(c.reconciliation.status,expected.reconciliation_status);assert.equal(c.stakeholder_context[0].authority,'unknown');
  if(expected.next_action_route)assert.equal(c.next_action.route,expected.next_action_route);
  if(expected.acknowledgements!==undefined)assert.equal(c.findings.find(f=>f.type==='follow_through')?.check?.acknowledgements,expected.acknowledgements);
  assert(c.evidence.some(e=>e.source_external_id===expected.source_external_id));
  for(const e of c.evidence){const source=await request(api).get(`/api/sources/${e.source_id}?dataset_id=${datasetId}`);assert.equal(source.status,200);assert.equal(source.body.filename,e.filename);assert.equal(source.body.locator,e.locator);}
  const graph=await request(api).get(`/api/opportunities/${c.id}/evidence?dataset_id=${datasetId}`);assert.equal(graph.status,200);assert.equal(graph.body.limits.max_hops,3);
  const [sources]=await db.select({n:count()}).from(s.sourceRecords).where(eq(s.sourceRecords.datasetId,datasetId));
  const [deals]=await db.select({n:count()}).from(s.deals).where(eq(s.deals.datasetId,datasetId));
  const [accountDeals]=await db.select({n:count()}).from(s.deals).where(and(eq(s.deals.datasetId,datasetId),eq(s.deals.accountId,c.account.id)));
  console.log(JSON.stringify({verified:true,account:expected.account_external_id,retained_sources:sources.n,deals_in_scope:deals.n,account_deals:accountDeals.n,evidence_passages:c.evidence.length,graph_nodes:graph.body.nodes.length,annual_increment:c.value_scenario?.amount,elapsed_days:c.elapsed_days},null,2));
}finally{await pool.end();}
