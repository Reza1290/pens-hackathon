import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { cardSchema, type OpportunityCard, type Evidence } from '@kasirnusa/contracts';
import type { Database } from '../../db/client.js';
import * as s from '../../db/schema/index.js';
import { stableId } from '../ingestion/service.js';
import { sha256 } from '../ingestion/manifest.js';
import { collectSignals, reconcile, annualIncrement, elapsedDays, responseType, contractTermsConsistent, RULE_VERSION, type SignalMessage } from './rules.js';

export async function analyzeDataset(db:Database,datasetId:string,asOf:string) {
  z.uuid().parse(datasetId); z.iso.date().parse(asOf);
  const [dataset]=await db.select().from(s.datasets).where(eq(s.datasets.id,datasetId));
  if (!dataset || dataset.status!=='ready') throw new Error('Analysis requires a ready imported dataset');
  if (asOf!==dataset.asOf) throw new Error('Use the verified dataset snapshot date for historical analysis');
  const coverage=dataset.coverage as {deals_complete:boolean;normalization_complete:boolean;files:{filename:string;retained:number;valid:number;quarantined:number}[]};
  const reviewedSupport=await db.select({assertion:s.assertions,evidence:s.assertionEvidence}).from(s.assertions).innerJoin(s.assertionEvidence,and(eq(s.assertions.id,s.assertionEvidence.assertionId),eq(s.assertions.datasetId,s.assertionEvidence.datasetId))).where(and(eq(s.assertions.datasetId,datasetId),eq(s.assertions.predicate,'MATCHES_DEAL'),eq(s.assertions.verification,'manually_verified'),eq(s.assertionEvidence.relation,'support'))).orderBy(s.assertions.id);
  const reviewedLinks=reviewedSupport.map(r=>r.assertion);
  const runId=stableId(datasetId,'analysis',RULE_VERSION,asOf,sha256(JSON.stringify(reviewedSupport)));
  const [previous]=await db.select().from(s.analysisRuns).where(eq(s.analysisRuns.id,runId));
  if(previous?.status==='completed') return { dataset_id:datasetId,run_id:runId,reused:true };
  const [accounts,employees,contacts,employments,contracts,deals,interactions,sources]=await Promise.all([
    db.select().from(s.accounts).where(eq(s.accounts.datasetId,datasetId)),
    db.select().from(s.employees).where(eq(s.employees.datasetId,datasetId)),
    db.select().from(s.contacts).where(eq(s.contacts.datasetId,datasetId)),
    db.select().from(s.employments).where(eq(s.employments.datasetId,datasetId)),
    db.select().from(s.contracts).where(eq(s.contracts.datasetId,datasetId)),
    db.select().from(s.deals).where(eq(s.deals.datasetId,datasetId)),
    db.select().from(s.interactions).where(eq(s.interactions.datasetId,datasetId)),
    db.select({ record:s.sourceRecords,file:s.sourceFiles }).from(s.sourceRecords).innerJoin(s.sourceFiles,and(eq(s.sourceRecords.fileId,s.sourceFiles.id),eq(s.sourceRecords.datasetId,s.sourceFiles.datasetId))).where(and(eq(s.sourceRecords.datasetId,datasetId),inArray(s.sourceFiles.filename,['crm_accounts.csv','employees.csv','crm_contacts.csv','contact_employment_history.csv','contracts_billing.csv','crm_deals.csv','interactions.jsonl']))),
  ]);
  const evidenceFor=(filename:string,externalId:string,field:string):Evidence|null=>{
    const found=sources.find(x=>x.file.filename===filename && x.record.externalId===externalId);
    if(!found) return null;
    return { source_id:found.record.id,source_external_id:externalId,filename,locator:found.record.locator,field,passage:found.record.payload[field]??'' };
  };
  const cards: { card:OpportunityCard; sourceId:string; dedupKey:string; assertions:{id:string;sources:Evidence[];eventDate:string}[] }[]=[];
  // Read-only scoped authority remains unknown in Phase 1; candidates require exact
  // current identity AND valid event-date employment before processing text.
  for (const account of accounts.filter(a=>a.type==='customer')) {
    const owner=employees.find(e=>e.id===account.ownerId)!;
    const messages=interactions.filter(i=>i.accountId===account.id && i.eventDate<=asOf).sort((a,b)=>a.eventDate.localeCompare(b.eventDate)||a.externalId.localeCompare(b.externalId));
    const eligible=(m:SignalMessage)=>{
      const candidates=contacts.filter(c=>c.accountId===account.id&&c.email.toLowerCase()===m.sender.toLowerCase());
      if(candidates.length!==1)return false;
      const jobs=employments.filter(e=>e.contactId===candidates[0].id&&e.accountId===account.id&&e.start<=m.eventDate&&(!e.end||e.end>=m.eventDate));
      return jobs.length===1&&(!jobs[0].end||jobs[0].end>=asOf);
    };
    for (const group of collectSignals(account.id,messages,eligible)) {
      const {origin:message,request,dedupKey}=group;
      const matchingContacts=contacts.filter(c=>c.accountId===account.id && c.email.toLowerCase()===message.sender.toLowerCase());
      if(matchingContacts.length!==1) continue;
      const contact=matchingContacts[0];
      const employment=employments.filter(e=>e.contactId===contact.id && e.accountId===account.id && e.start<=message.eventDate && (!e.end || e.end>=message.eventDate));
      if(employment.length!==1 || (employment[0].end && employment[0].end<asOf)) continue;
      const id=stableId(datasetId,'signal',dedupKey);
      const requestEvidence=evidenceFor('interactions.jsonl',group.details.externalId,'isi')!;
      const accountEvidence=evidenceFor('crm_accounts.csv',account.externalId,'account_owner_id')!;
      const nameEvidence=evidenceFor('crm_accounts.csv',account.externalId,'nama')!;
      const ownerEvidence=evidenceFor('employees.csv',owner.externalId,'jabatan')!;
      const contactEvidence=evidenceFor('crm_contacts.csv',contact.externalId,'jabatan_saat_ini')!;
      const employmentSource=sources.find(x=>x.file.filename==='contact_employment_history.csv' && x.record.payload.contact_id===contact.externalId && x.record.payload.account_id===account.externalId && x.record.payload.mulai===employment[0].start)!;
      const employmentEvidence:Evidence={ source_id:employmentSource.record.id,source_external_id:contact.externalId,filename:employmentSource.file.filename,locator:employmentSource.record.locator,field:'mulai/selesai',passage:`${employment[0].start} / ${employment[0].end ?? 'recorded ongoing'}` };
      const evidence=[requestEvidence,accountEvidence,nameEvidence,ownerEvidence,contactEvidence,employmentEvidence];
      for(const supporting of group.chain){const e=evidenceFor('interactions.jsonl',supporting.externalId,'isi');if(e&&!evidence.some(x=>x.source_id===e.source_id&&x.field===e.field))evidence.push(e);}
      const scopedContracts=contracts.filter(c=>c.accountId===account.id && c.start<=message.eventDate && c.start<=asOf && c.renewal>asOf);
      const contract=scopedContracts.length===1?scopedContracts[0]:null;
      const consistentTerms=contract?contractTermsConsistent(contract.outlets,contract.monthlyRate,contract.discountPercent,contract.annualValue):false;
      let contractEvidence:Evidence|null=null;
      if(contract) { contractEvidence=evidenceFor('contracts_billing.csv',contract.externalId,'harga_per_outlet_bulan'); if(contractEvidence) evidence.push(contractEvidence, evidenceFor('contracts_billing.csv',contract.externalId,'diskon_pct')!,evidenceFor('contracts_billing.csv',contract.externalId,'batas_outlet_paket')!,evidenceFor('contracts_billing.csv',contract.externalId,'nilai_tahunan')!); }
      const verified=reviewedLinks.filter(a=>a.subjectId===id && a.accountId===account.id);
      const match=reconcile(account.id,id,deals.map(d=>({...d,confirmedSignalKey:verified.some(a=>a.objectId===d.id)?id:undefined})),coverage.deals_complete);
      for(const candidate of match.candidates) { const deal=deals.find(d=>d.id===candidate.id)!; const e=evidenceFor('crm_deals.csv',deal.externalId,'outlet'); if(e)evidence.push(e); }
      for(const support of reviewedSupport.filter(r=>r.assertion.subjectId===id&&r.assertion.accountId===account.id&&match.candidates.some(d=>d.id===r.assertion.objectId))){
        const found=sources.find(x=>x.record.id===support.evidence.sourceId);
        if(found)evidence.push({source_id:found.record.id,source_external_id:found.record.externalId,filename:found.file.filename,locator:found.record.locator,field:support.evidence.field,passage:support.evidence.passage});
      }
      // Thread descendants allow explicit cancellation/revision without claiming an
      // unrelated later account message answered the request.
      const chain=new Set(group.chain.map(m=>m.id));
      const cancelled=group.status==='cancelled'; let responses=0; let acknowledgement=0; let substantive=0;
      for(const later of group.chain.filter(m=>m.id!==message.id)) {
        const kind=responseType(later.body);
        if(later.sender.toLowerCase()===owner.email.toLowerCase()){ responses++; if(kind==='acknowledgement')acknowledgement++;if(kind==='substantive_candidate')substantive++; }
      }
      const unrelatedLater=messages.filter(m=>m.eventDate>message.eventDate && !chain.has(m.id));
      const search={dataset_id:datasetId,dataset_version:dataset.version,manifest_hash:dataset.manifestHash,as_of:asOf,rule_version:RULE_VERSION,account_id:account.externalId,files:['crm_deals.csv'],criteria:'Same account and expansion type; all stages/statuses. Explicit verified scope required for a match.',total_deals:deals.length,account_deals:deals.filter(d=>d.accountId===account.id).length,coverage_complete:coverage.deals_complete};
      const findings:OpportunityCard['findings']=[];
      if(match.status==='unmatched') findings.push({type:'missing_deal',label:`No matching record found in the supplied data as of ${asOf}.`,check:search,evidence_ids:[requestEvidence.source_id]});
      if(match.status==='ambiguous'||match.status==='insufficient_coverage')findings.push({type:match.status,label:match.reason,check:search,evidence_ids:[requestEvidence.source_id]});
      findings.push({type:'follow_through',label:responses===0 && unrelatedLater.length===0?`No recorded follow-up found in the supplied data as of ${asOf}.`:substantive>0?'Recorded response may contain terms or schedule; substantive completeness requires review.':acknowledgement>0?'Recorded acknowledgement does not establish delivery of quotation or schedule.':'Later account messages require review; no explicit substantive response established.',check:{as_of:asOf,rule_version:RULE_VERSION,request_id:message.externalId,total_interactions:interactions.length,account_interactions:messages.length,thread_responses:responses,acknowledgements:acknowledgement,substantive_candidates:substantive,unlinked_later_messages:unrelatedLater.length},evidence_ids:[requestEvidence.source_id]});
      if(contract&&contractEvidence)findings.push({type:'package_context',label:contract.unlimited?'Recorded package has no outlet limit; implementation prerequisites still need confirmation.':'Check additional outlet quantity against the recorded package limit; new terms may be required.',evidence_ids:[contractEvidence.source_id]});
      if(contract&&contractEvidence&&!consistentTerms)findings.push({type:'commercial_terms_conflict',label:'Recorded rate, discount and annual contract value do not reconcile; confirm terms before estimating expansion.',evidence_ids:[contractEvidence.source_id]});
      const exceedsLimit=contract && !contract.unlimited && request.quantity!==null && contract.outlets+request.quantity>(contract.outletLimit??0);
      const card=cardSchema.parse({ id,dataset_id:datasetId,dataset_version:dataset.version,as_of:asOf,commercial_context:'expansion',account:{id:account.id,external_id:account.externalId,name:account.name},
        signal:{kind:request.kind,status:group.status,date:message.eventDate,additional_outlets:request.quantity,location:request.location,target_period:request.targetPeriod,requested_actions:request.requestedActions,interpretation:'rules_candidate'},
        reconciliation:{status:match.status,candidate_ids:match.candidates.map(d=>d.id),check:search},findings,
        people:{owner:{id:owner.id,external_id:owner.externalId,name:owner.name,role:owner.title,evidence_ids:[ownerEvidence.source_id,accountEvidence.source_id]},contact:{id:contact.id,external_id:contact.externalId,name:contact.name,role:contact.title,evidence_ids:[contactEvidence.source_id,employmentEvidence.source_id]}},
        stakeholder_context:[{person_id:contact.id,role:employment[0].role,valid_at_request:true,authority:'unknown',knowledge:'The sender documented this expansion request; broader operational/technical knowledge is not established.',expressed_requirements:request.kind==='quotation_request'?['Quotation and requested rollout details must be confirmed from the source passage.']:['Confirm rollout scope and decision requirements.'],source_date:message.eventDate,attribution:'direct',evidence_ids:[requestEvidence.source_id,employmentEvidence.source_id]}],
        next_action:{route:exceedsLimit?'resolve_prerequisite_first':match.status==='matched'?'follow_up_recorded_deal':'clarify_authority_or_requirement',owner_id:owner.id,recipient_ids:[contact.id],review_status:'proposed',task:cancelled?'Verify cancellation and close the proposed follow-up after human review.':exceedsLimit?'Confirm package upgrade and pricing before preparing expansion terms.':'Confirm the expansion request, prepare quotation and implementation options, and clarify who approves this purchase.',discussion_points:[{text:'Confirm quantity, location and rollout period against the recorded request.',evidence_ids:[requestEvidence.source_id]},{text:'Ask who approves this scoped expansion and which operational/technical stakeholders should join.',evidence_ids:[contactEvidence.source_id,requestEvidence.source_id]},{text:'Confirm current pricing and discount applicability to new outlets.',evidence_ids:contractEvidence?[contractEvidence.source_id]:[requestEvidence.source_id]}]},
        value_scenario:contract&&contractEvidence&&consistentTerms&&request.quantity&&!exceedsLimit&&!cancelled?{amount:annualIncrement(request.quantity,contract.monthlyRate,contract.discountPercent),currency:'IDR',basis:'annual_increment',formula:'additional_outlets × monthly_rate × 12 × (1 − discount_percent / 100)',inputs:{additional_outlets:request.quantity,monthly_rate:contract.monthlyRate,discount_percent:contract.discountPercent},assumptions:['Current rate and discount are assumed to apply to the additional outlets; confirm new terms.','Annualized conditional value; not signed or calendar-year revenue. Tax and implementation fees are unknown.'],evidence_ids:[requestEvidence.source_id,contractEvidence.source_id]}:null,
        elapsed_days:elapsedDays(message.eventDate,asOf),evidence,unknowns:['Scoped customer purchasing authority','Current expansion intent and implementation prerequisites','Approval of continuing commercial terms',...(!contract?['No unique currently applicable contract found']:[]),...(exceedsLimit?['Package upgrade pricing required']:[])],limitations:['Rules candidate requiring review; model judgments are not accepted into action cards.','No activity outside supplied data is established.','No future delivery dates, approval or external action is implied.'] });
      cards.push({card,sourceId:requestEvidence.source_id,dedupKey,assertions:[{id:stableId(id,'details',RULE_VERSION),sources:evidence.filter(e=>e.filename==='interactions.jsonl'),eventDate:group.details.eventDate}]});
    }
  }
  await db.transaction(async tx=>{
    await tx.insert(s.analysisRuns).values({id:runId,datasetId,asOf,ruleVersion:RULE_VERSION,status:'running'});
    for(const {card,sourceId,dedupKey,assertions} of cards) {
      await tx.insert(s.entities).values({id:card.id,datasetId,kind:'signal',externalId:dedupKey}).onConflictDoNothing();
      const values={accountId:card.account.id,requestDate:card.signal.date,quantity:card.signal.additional_outlets,location:card.signal.location,targetPeriod:card.signal.target_period,kind:card.signal.kind,status:card.signal.status,dedupKey,runId,sourceId};
      await tx.insert(s.signals).values({id:card.id,datasetId,externalId:dedupKey,...values}).onConflictDoUpdate({target:s.signals.id,set:values});
      await tx.insert(s.entitySources).values({datasetId,entityId:card.id,sourceId}).onConflictDoNothing();
      for(const assertion of assertions){
        await tx.insert(s.assertions).values({id:assertion.id,datasetId,subjectId:card.id,predicate:'EXPANSION_DETAILS',literal:card.signal,objectId:null,accountId:card.account.id,eventDate:assertion.eventDate,speakerId:card.people.contact?.id ?? null,attribution:'direct',method:RULE_VERSION,verification:'unreviewed_rules_candidate',runId}).onConflictDoNothing();
        for(const source of assertion.sources){
          await tx.insert(s.entitySources).values({datasetId,entityId:card.id,sourceId:source.source_id}).onConflictDoNothing();
          await tx.insert(s.assertionEvidence).values({datasetId,assertionId:assertion.id,sourceId:source.source_id,field:source.field,passage:source.passage,relation:'support'}).onConflictDoNothing();
        }
      }
      for(const candidate of card.reconciliation.candidate_ids)await tx.insert(s.signalMatches).values({id:stableId(runId,card.id,candidate),datasetId,signalId:card.id,dealId:candidate,runId,status:card.reconciliation.status,reason:'See versioned scoped reconciliation check in recommendation card.'});
      for(const [index,finding]of card.findings.entries()){
        const id=stableId(runId,card.id,'finding',String(index));
        await tx.insert(s.findings).values({id,datasetId,accountId:card.account.id,signalId:card.id,runId,commercialContext:'expansion',type:finding.type,details:finding});
        for(const sourceId of new Set(finding.evidence_ids))await tx.insert(s.findingEvidence).values({datasetId,findingId:id,sourceId,checkResult:finding.check??null});
      }
      await tx.insert(s.recommendations).values({id:stableId(runId,card.id,'recommendation'),datasetId,signalId:card.id,runId,ownerId:card.people.owner.id,contactId:card.people.contact?.id,route:card.next_action.route,reviewStatus:'proposed',card});
    }
    await tx.update(s.analysisRuns).set({status:'completed'}).where(eq(s.analysisRuns.id,runId));
  });
  return {dataset_id:datasetId,run_id:runId,reused:false,signals:cards.length};
}
