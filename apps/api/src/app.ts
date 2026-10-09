import express from 'express';
import { and, eq, desc, ilike, or, count, sql } from 'drizzle-orm';
import { z } from 'zod';
import { cardSchema,datasetSchema,accountSchema,healthSchema,sourceSchema,paginationSchema } from '@kasirnusa/contracts';
import type { Database } from './db/client.js';
import * as s from './db/schema/index.js';
import { allowedDatasets,env } from './config/env.js';
import { projectEvidence } from './modules/graph/projection.js';

class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export function createApp(db:Database,allowlist=allowedDatasets) {
  const app=express(); app.disable('x-powered-by');
  app.use((req,res,next)=>{
    const host=req.hostname;
    if(!['localhost','127.0.0.1','[::1]','::1'].includes(host))return res.status(403).json({error:'Local access only'});
    const origin=req.get('origin');
    if(origin){try{const url=new URL(origin);if(url.protocol!=='http:'||!['localhost','127.0.0.1'].includes(url.hostname)||![String(env.API_PORT),'5173','4173'].includes(url.port))return res.status(403).json({error:'Origin not allowed'});}catch{return res.status(403).json({error:'Invalid origin'});}}
    res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');next();
  });
  const resolveDataset=async (query:unknown)=>{
    const selection=z.object({dataset_id:z.uuid().optional()}).parse(query);
    const rows=await db.select().from(s.datasets).where(eq(s.datasets.status,'ready')).orderBy(desc(s.datasets.asOf));
    const authorized=rows.filter(d=>!allowlist.size||allowlist.has(d.id));
    const found=selection.dataset_id?authorized.find(d=>d.id===selection.dataset_id):authorized[0];
    if(!found)throw new HttpError(404,'No authorized ready dataset found');
    return found;
  };
  const cardFor=async(datasetId:string,id:string)=>{
    z.uuid().parse(id);
    const rows=await db.select({card:s.recommendations.card}).from(s.recommendations).innerJoin(s.signals,and(eq(s.recommendations.signalId,s.signals.id),eq(s.recommendations.runId,s.signals.runId),eq(s.recommendations.datasetId,s.signals.datasetId))).where(and(eq(s.recommendations.datasetId,datasetId),eq(s.recommendations.signalId,id)));
    if(!rows.length)throw new HttpError(404,'Opportunity not found in selected dataset');
    return cardSchema.parse(rows[0].card);
  };
  app.get('/api/health',async(_req,res)=>{
    try {const result=await db.execute(sql`select to_regclass('public.datasets') is not null as schema_ready`);const ready=Boolean(result.rows[0]?.schema_ready);res.status(ready?200:503).json(healthSchema.parse({process:'ready',database:'ready',schema:ready?'ready':'unavailable'}));}
    catch{res.status(503).json(healthSchema.parse({process:'ready',database:'unavailable',schema:'unavailable'}));}
  });
  app.get('/api/datasets',async(_req,res)=>{
    const rows=await db.select().from(s.datasets).where(eq(s.datasets.status,'ready')).orderBy(desc(s.datasets.asOf));
    res.json({items:z.array(datasetSchema).parse(rows.filter(d=>!allowlist.size||allowlist.has(d.id)))});
  });
  app.get('/api/accounts',async(req,res)=>{
    const dataset=await resolveDataset(req.query); const paging=paginationSchema.parse(req.query);
    const search=z.object({q:z.string().max(100).default('')}).parse(req.query);
    const filter=and(eq(s.accounts.datasetId,dataset.id),search.q?or(ilike(s.accounts.name,`%${search.q.replace(/[\\%_]/g,'\\$&')}%`),ilike(s.accounts.externalId,`%${search.q.replace(/[\\%_]/g,'\\$&')}%`)):undefined);
    const [items,total]=await Promise.all([db.select().from(s.accounts).where(filter).orderBy(s.accounts.externalId).limit(paging.page_size).offset((paging.page-1)*paging.page_size),db.select({n:count()}).from(s.accounts).where(filter)]);
    res.json({dataset_id:dataset.id,as_of:dataset.asOf,...paging,total:total[0].n,items:z.array(accountSchema).parse(items)});
  });
  app.get('/api/accounts/:id',async(req,res)=>{
    const dataset=await resolveDataset(req.query);const id=z.uuid().parse(req.params.id);
    const [account]=await db.select().from(s.accounts).where(and(eq(s.accounts.datasetId,dataset.id),eq(s.accounts.id,id)));
    if(!account)throw new HttpError(404,'Account not found in selected dataset');
    const [owner]=await db.select().from(s.employees).where(and(eq(s.employees.datasetId,dataset.id),eq(s.employees.id,account.ownerId)));
    const [contacts,contracts,evidence]=await Promise.all([
      db.select({id:s.contacts.id,external_id:s.contacts.externalId,name:s.contacts.name,title:s.contacts.title}).from(s.contacts).innerJoin(s.employments,and(eq(s.contacts.id,s.employments.contactId),eq(s.contacts.datasetId,s.employments.datasetId))).where(and(eq(s.contacts.datasetId,dataset.id),eq(s.contacts.accountId,id),eq(s.employments.accountId,id),sql`${s.employments.start} <= ${dataset.asOf} and (${s.employments.end} is null or ${s.employments.end} >= ${dataset.asOf})`)),
      db.select({id:s.contracts.id,external_id:s.contracts.externalId,package:s.contracts.package,monthly_rate:s.contracts.monthlyRate,discount_percent:s.contracts.discountPercent,renewal_date:s.contracts.renewal}).from(s.contracts).where(and(eq(s.contracts.datasetId,dataset.id),eq(s.contracts.accountId,id))),
      db.select({source_id:s.entitySources.sourceId}).from(s.entitySources).where(and(eq(s.entitySources.datasetId,dataset.id),eq(s.entitySources.entityId,id))),
    ]);
    res.json(z.object({dataset_id:z.uuid(),as_of:z.iso.date(),account:accountSchema,owner:z.object({id:z.uuid(),externalId:z.string(),name:z.string(),title:z.string()}),contacts:z.array(z.object({id:z.uuid(),external_id:z.string(),name:z.string(),title:z.string()})),contracts:z.array(z.object({id:z.uuid(),external_id:z.string(),package:z.string(),monthly_rate:z.string(),discount_percent:z.string(),renewal_date:z.iso.date()})),reported_champion_external_id:z.string().nullable(),source_ids:z.array(z.uuid())}).parse({dataset_id:dataset.id,as_of:dataset.asOf,account,owner,contacts,contracts,reported_champion_external_id:account.championExternalId,source_ids:evidence.map(e=>e.source_id)}));
  });
  app.get('/api/opportunities',async(req,res)=>{
    const dataset=await resolveDataset(req.query);const paging=paginationSchema.parse(req.query);
    const filters=z.object({account_id:z.uuid().optional(),kind:z.enum(['quotation_request','explicit_plan']).optional(),status:z.enum(['active','cancelled','unclear']).optional()}).parse(req.query);
    const filter=and(eq(s.signals.datasetId,dataset.id),filters.account_id?eq(s.signals.accountId,filters.account_id):undefined,filters.kind?eq(s.signals.kind,filters.kind):undefined,filters.status?eq(s.signals.status,filters.status):undefined);
    const rows=await db.select({card:s.recommendations.card}).from(s.signals).innerJoin(s.recommendations,and(eq(s.signals.id,s.recommendations.signalId),eq(s.signals.datasetId,s.recommendations.datasetId),eq(s.signals.runId,s.recommendations.runId))).where(filter).orderBy(desc(s.signals.requestDate)).limit(paging.page_size).offset((paging.page-1)*paging.page_size);
    const [total]=await db.select({n:count()}).from(s.signals).where(filter);
    res.json({dataset_id:dataset.id,as_of:dataset.asOf,...paging,total:total.n,items:z.array(cardSchema).parse(rows.map(r=>r.card))});
  });
  app.get('/api/opportunities/:id',async(req,res)=>{const dataset=await resolveDataset(req.query);res.json(await cardFor(dataset.id,req.params.id));});
  app.get('/api/opportunities/:id/evidence',async(req,res)=>{
    const dataset=await resolveDataset(req.query);const maxNodes=z.coerce.number().int().min(10).max(100).parse(req.query.max_nodes??50);
    const card=await cardFor(dataset.id,req.params.id);res.json({dataset_id:dataset.id,as_of:dataset.asOf,...projectEvidence(card,maxNodes)});
  });
  app.get('/api/sources/:id',async(req,res)=>{
    const dataset=await resolveDataset(req.query);const id=z.uuid().parse(req.params.id);
    const [found]=await db.select({record:s.sourceRecords,file:s.sourceFiles}).from(s.sourceRecords).innerJoin(s.sourceFiles,and(eq(s.sourceRecords.fileId,s.sourceFiles.id),eq(s.sourceRecords.datasetId,s.sourceFiles.datasetId))).where(and(eq(s.sourceRecords.id,id),eq(s.sourceRecords.datasetId,dataset.id)));
    if(!found)throw new HttpError(404,'Source not found in selected dataset');
    res.json(sourceSchema.parse({id,dataset_id:dataset.id,as_of:dataset.asOf,filename:found.file.filename,locator:found.record.locator,external_id:found.record.externalId,payload:found.record.payload,raw_text:found.record.rawText,content_hash:found.record.contentHash}));
  });
  app.use((_req,res)=>res.status(404).json({error:'Route not implemented'}));
  app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    if(error instanceof z.ZodError)return res.status(400).json({error:'Invalid request or response schema'});
    if(error instanceof HttpError)return res.status(error.status).json({error:error.message});
    console.error('API operation failed; no customer payload logged.');res.status(500).json({error:'Operation unavailable'});
  });
  return app;
}
