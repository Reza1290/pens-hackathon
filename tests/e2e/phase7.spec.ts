import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { resolve,basename } from 'node:path';
import { rm,realpath } from 'node:fs/promises';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { env,projectRoot } from '../../apps/api/src/config/env.js';
import * as schema from '../../apps/api/src/db/schema/index.js';
import { fixture } from '../fixtures/snapshot.js';
import { importDataset,stableId } from '../../apps/api/src/modules/ingestion/service.js';
import { inside } from '../../apps/api/src/modules/ingestion/manifest.js';
import { analyzeDataset } from '../../apps/api/src/modules/opportunities/service.js';
import { analyzeStakeholders } from '../../apps/api/src/modules/stakeholders/service.js';
import { createApp } from '../../apps/api/src/app.js';
import type { Server } from 'node:http';

const name=`kasirnusa_browser_${randomUUID().replaceAll('-','')}`;
const local=new URL(env.DATABASE_URL);
if(!['127.0.0.1','localhost'].includes(local.hostname))throw new Error('Synthetic browser fixture requires local PostgreSQL');
const admin=new pg.Pool({connectionString:local.href});local.pathname='/'+name;
const pool=new pg.Pool({connectionString:local.href});const db=drizzle(pool,{schema});
let server:Server,port:number,dataset:string,account:string,path:string,created=false;
test.beforeAll(async()=>{
  await admin.query(`CREATE DATABASE "${name}"`);created=true;
  await migrate(db,{migrationsFolder:resolve(projectRoot,'apps/api/src/db/migrations')});
  const raw=await fixture({ownerIntermediary:true,messages:[
    {id:'I2',body:'I approve this purchase for expansion S1. I require ROI and payback evidence.',parent:'I1'},
    {id:'I3',body:'I handle operational inputs and prepare the proposal for X.',parent:'I2',sender:'operator@example.test'},
    {id:'I4',body:'Features include stock controls.',parent:'I3',sender:'manager@example.test',date:'2026-08-03'},
    {id:'I5',body:'Unrelated decision S2: ROI 80% and payback 1 month.',sender:'manager@example.test'},
  ]});path=raw.path;dataset=(await importDataset(db,raw.manifest)).dataset_id;account=stableId(dataset,'account','A1');
  await analyzeDataset(db,dataset,'2026-09-01');await analyzeStakeholders(db,dataset,account);
  server=createApp(db,new Set([dataset])).listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  port=(server.address() as {port:number}).port;
});
test.afterAll(async()=>{
  if(server)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  await pool.end();if(created&&/^kasirnusa_browser_[a-f0-9]{32}$/.test(name))await admin.query(`DROP DATABASE "${name}"`);await admin.end();
  if(path){const target=inside(await realpath(resolve(projectRoot,env.DATA_ROOT)),await realpath(path));if(!basename(target).startsWith('phase1-test-'))throw new Error('Unsafe fixture cleanup');await rm(target,{recursive:true});}
});
test('raw owner/intermediary fixture reaches evidence, ordered action, Q&A, comparison and editable draft',async({page})=>{
  await page.route('**/api/**',async route=>{const original=new URL(route.request().url());const response=await route.fetch({url:`http://127.0.0.1:${port}${original.pathname}${original.search}`});await route.fulfill({response});});
  await page.goto(`/accounts/${account}?dataset_id=${dataset}`);
  await expect(page.getByRole('heading',{name:'not addressed',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Action plan',exact:true}).click();
  await expect(page.getByRole('main')).toContainText('Gather operational inputs');
  await expect(page.getByRole('main')).toContainText('joint commercial discussion');
  await page.getByRole('button',{name:'Prepare draft',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Editable follow-up draft'})).toHaveValue(/ROI.*joint commercial discussion/s);
  await page.getByRole('textbox',{name:'Account question',exact:true}).fill('What should we do next for this account?');
  await page.getByRole('button',{name:'Ask account question',exact:true}).click();
  const qa=page.getByRole('region',{name:'Account questions'});
  await expect(qa).toContainText('Requirement: not addressed');await expect(qa).toContainText('Gather operational inputs');
  await qa.getByText('Outcome metric and comparison periods', {exact:true}).click();
  await qa.getByRole('combobox',{name:'Comparison metric'}).selectOption('closed_expansion_deal_proxy');
  for(const [label,value] of [['previous start','2026-07-01'],['previous end','2026-07-31'],['current start','2026-08-01'],['current end','2026-08-31']])await qa.getByLabel(label,{exact:true}).fill(value);
  await qa.getByRole('textbox',{name:'Account question',exact:true}).fill('Why are repeat orders lower?');await qa.getByRole('button',{name:'Ask account question',exact:true}).click();
  await expect(qa).toContainText('2026-07-01');await expect(qa).toContainText('closed_expansion_deal_proxy');
});
