import { and,eq } from 'drizzle-orm';
import { db,pool } from '../db/client.js';
import * as s from '../db/schema/index.js';
import { requiredArg } from './args.js';
import { analyzeStakeholders } from '../modules/stakeholders/service.js';
const optional=(name:string)=>process.argv.includes(`--${name}`)?requiredArg(name):undefined;
try{
  const datasetId=requiredArg('dataset'),externalId=optional('account');
  const accounts=await db.select().from(s.accounts).where(and(eq(s.accounts.datasetId,datasetId),externalId?eq(s.accounts.externalId,externalId):undefined)).orderBy(s.accounts.externalId);
  if(!accounts.length)throw new Error('No account in selected dataset');
  if((optional('signal')||optional('deal'))&&!externalId)throw new Error('Explicit account required for signal/deal scope');
  const results=[];for(const account of accounts)results.push(await analyzeStakeholders(db,datasetId,account.id,{signalId:optional('signal'),dealId:optional('deal')}));
  console.log(JSON.stringify({dataset_id:datasetId,accounts:results.length,reused:results.filter(r=>r.reused).length,statements_created:results.reduce((sum,r)=>sum+(r.statements??0),0),decisions_processed:results.reduce((sum,r)=>sum+(r.decisions??0),0),unresolved_decisions:results.reduce((sum,r)=>sum+(r.unresolved_decisions??0),0),...(externalId?{results}:{})},null,2));
}finally{await pool.end();}
