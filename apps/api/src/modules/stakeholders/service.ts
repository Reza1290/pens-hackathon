import { and,eq,inArray } from 'drizzle-orm';
import { z } from 'zod';
import { diagnosisSchema,cardSchema,type AccountDiagnosis,type Evidence } from '@kasirnusa/contracts';
import type { Database } from '../../db/client.js';
import * as s from '../../db/schema/index.js';
import { stableId } from '../ingestion/service.js';
import { sha256 } from '../ingestion/manifest.js';
import { extractStatements,authority,selectAction,STAKEHOLDER_VERSION,type Candidate } from './rules.js';
import { retrieveConnected } from '../qa/retrieval.js';
import { assessRequirement } from './requirements.js';
import { env } from '../../config/env.js';
import { Interpreter } from '../../ai/router.js';
import { jevProvider } from '../../ai/providers/jev.js';
import { selectedGenerativeProvider } from '../../ai/providers/selected.js';
import type { Provider } from '../../ai/providers/interface.js';
import { extractionSchema,SCHEMA_VERSION } from '../../ai/schemas/interpretation.js';
const runtimes=new WeakMap<Database,{judgment:Interpreter;extraction:Interpreter}>();
const runtimeFor=(db:Database)=>{let pair=runtimes.get(db);if(!pair){pair={judgment:new Interpreter(db,{live:env.QA_JEV_ENABLED==='true',maxCalls:env.MODEL_MAX_CALLS,timeoutMs:env.MODEL_TIMEOUT_MS}),extraction:new Interpreter(db,{live:env.ANALYSIS_EXTRACTION_ENABLED==='true',maxCalls:env.MODEL_MAX_CALLS,timeoutMs:env.MODEL_TIMEOUT_MS})};runtimes.set(db,pair);}return pair;};

export const diagnosisScopeKey=(accountId:string,signalId?:string,dealId?:string)=>JSON.stringify([accountId,signalId??null,dealId??null]);
const decisionRow=z.object({decision_id:z.string().min(1),tanggal:z.iso.date(),account_id:z.string().min(1),deal_id:z.string(),diminta_oleh:z.string().min(1),diputuskan_oleh:z.string().min(1),keputusan:z.string(),nilai:z.string(),alasan:z.string(),fitur_dijanjikan:z.string(),status_janji:z.string()});
export async function analyzeStakeholders(db:Database,datasetId:string,accountId:string,scope:{signalId?:string;dealId?:string}={},modelOptions?:{runtime:Interpreter;jev?:Provider;extractor?:Provider}){
  z.uuid().parse(datasetId);z.uuid().parse(accountId);
  const [dataset]=await db.select().from(s.datasets).where(eq(s.datasets.id,datasetId));
  if(dataset?.status!=='ready')throw new Error('Ready dataset required');
  const [account]=await db.select().from(s.accounts).where(and(eq(s.accounts.datasetId,datasetId),eq(s.accounts.id,accountId)));
  if(!account)throw new Error('Account outside dataset');
  const [employees,contacts,jobs,messages,deals,contracts,rows,cards]=await Promise.all([
    db.select().from(s.employees).where(eq(s.employees.datasetId,datasetId)),
    db.select().from(s.contacts).where(eq(s.contacts.datasetId,datasetId)),
    db.select().from(s.employments).where(and(eq(s.employments.datasetId,datasetId),eq(s.employments.accountId,accountId))),
    db.select().from(s.interactions).where(and(eq(s.interactions.datasetId,datasetId),eq(s.interactions.accountId,accountId))),
    db.select().from(s.deals).where(and(eq(s.deals.datasetId,datasetId),eq(s.deals.accountId,accountId))),
    db.select().from(s.contracts).where(and(eq(s.contracts.datasetId,datasetId),eq(s.contracts.accountId,accountId))),
    db.select({record:s.sourceRecords,file:s.sourceFiles}).from(s.sourceRecords).innerJoin(s.sourceFiles,and(eq(s.sourceRecords.fileId,s.sourceFiles.id),eq(s.sourceRecords.datasetId,s.sourceFiles.datasetId))).where(and(eq(s.sourceRecords.datasetId,datasetId),inArray(s.sourceFiles.filename,['crm_accounts.csv','crm_contacts.csv','employees.csv','contact_employment_history.csv','interactions.jsonl','decision_log.csv','features.csv','support_tickets.csv','contracts_billing.csv','crm_deals.csv']))),
    db.select({card:s.recommendations.card}).from(s.signals).innerJoin(s.recommendations,and(eq(s.signals.id,s.recommendations.signalId),eq(s.signals.runId,s.recommendations.runId),eq(s.signals.datasetId,s.recommendations.datasetId))).where(and(eq(s.signals.datasetId,datasetId),eq(s.signals.accountId,accountId))).orderBy(s.signals.id),
  ]);
  const opportunityCards=cards.map(row=>cardSchema.parse(row.card));
  const selected=scope.signalId?opportunityCards.find(c=>c.id===scope.signalId):undefined;
  const deal=scope.dealId?deals.find(d=>d.id===scope.dealId):undefined;
  if(scope.signalId&&!selected||scope.dealId&&!deal)throw new Error('Signal/deal outside selected account or dataset');
  if(selected&&deal&&(selected.reconciliation.status!=='matched'||!selected.reconciliation.candidate_ids.includes(deal.id)))throw new Error('Signal/deal combination needs a verified same-request link');
  const scopeKey=diagnosisScopeKey(accountId,scope.signalId,scope.dealId);
  const relevant=rows.filter(r=>r.record.accountExternalId===account.externalId||['employees.csv','crm_contacts.csv','contact_employment_history.csv','features.csv'].includes(r.file.filename));
  const runId=stableId(datasetId,STAKEHOLDER_VERSION,scopeKey,sha256(JSON.stringify([relevant.map(r=>[r.record.id,r.record.contentHash]),opportunityCards,SCHEMA_VERSION,env.QA_JEV_ENABLED,env.ANALYSIS_EXTRACTION_ENABLED,modelOptions?.jev?.model,modelOptions?.extractor?.model])));
  const [previous]=await db.select().from(s.analysisRuns).where(eq(s.analysisRuns.id,runId));
  if(previous?.status==='completed'){
    const [saved]=await db.select().from(s.recommendations).where(and(eq(s.recommendations.datasetId,datasetId),eq(s.recommendations.runId,runId),eq(s.recommendations.accountId,accountId)));
    if(saved){const restored=diagnosisSchema.parse(saved.card);await db.insert(s.diagnoses).values({id:restored.id,datasetId,accountId,runId,signalId:scope.signalId??null,dealId:scope.dealId??null,scopeKey,diagnosis:restored}).onConflictDoUpdate({target:[s.diagnoses.datasetId,s.diagnoses.scopeKey],set:{runId,diagnosis:restored}});}
    return {dataset_id:datasetId,account_id:accountId,run_id:runId,reused:true};
  }
  const evidence:Evidence[]=[];
  const addEvidence=(row:typeof rows[number],field:string,passage?:string)=>{
    const item:Evidence={source_id:row.record.id,source_external_id:row.record.externalId,filename:row.file.filename,locator:row.record.locator,field,passage:passage??row.record.payload[field]??''};
    if(!evidence.some(e=>e.source_id===item.source_id&&e.field===field&&e.passage===item.passage))evidence.push(item);return item;
  };
  const find=(file:string,id:string)=>rows.find(r=>r.file.filename===file&&r.record.externalId===id);
  const owner=employees.find(e=>e.id===account.ownerId)!;
  const ownerSource=addEvidence(find('employees.csv',owner.externalId)!,'jabatan');
  const accountSource=addEvidence(find('crm_accounts.csv',account.externalId)!,'account_owner_id');
  const people:Candidate[]=jobs.map(job=>{
    const contact=contacts.find(c=>c.id===job.contactId)!;
    const source=rows.find(r=>r.file.filename==='contact_employment_history.csv'&&r.record.payload.contact_id===contact.externalId&&r.record.payload.account_id===account.externalId&&r.record.payload.mulai===job.start&&r.record.payload.jabatan===job.role)!;
    const history=addEvidence(source,'mulai/selesai',`${job.role}: ${job.start} / ${job.end??'recorded ongoing'}`);
    const identity=addEvidence(find('crm_contacts.csv',contact.externalId)!,'nama');
    return {id:contact.id,name:contact.name,email:contact.email,role:job.role,start:job.start,end:job.end,current:job.start<=dataset.asOf&&(!job.end||job.end>=dataset.asOf)&&contact.accountId===accountId,evidenceIds:[history.source_id,identity.source_id]};
  });
  const currentIds=[...new Set(people.filter(p=>p.current).map(p=>p.id))];
  const selectedBundle=selected||deal?await retrieveConnected(db,{datasetId,accountId,asOf:dataset.asOf,seedSourceIds:selected?.evidence.map(e=>e.source_id)??[],query:deal?.externalId,signalId:selected?.id,dealId:scope.dealId}):null;
  const sourceSubset=selectedBundle?new Set(selectedBundle.sources.map(e=>e.id)):null;
  const decisionInputs=rows.filter(r=>r.file.filename==='decision_log.csv'&&r.record.accountExternalId===account.externalId);
  const statements=messages.filter(m=>m.eventDate<=dataset.asOf).flatMap(message=>{
    const source=find('interactions.jsonl',message.externalId)!;
    if(sourceSubset&&!sourceSubset.has(source.record.id))return [];
    const speakers=[...employees,...contacts].filter(p=>p.email.toLowerCase()===message.sender.toLowerCase());
    const raw=source.record.payload;
    const result=extractStatements({id:message.id,date:message.eventDate,text:message.body,sourceId:source.record.id,speakerId:speakers.length===1?speakers[0].id:null,attendeeIds:people.filter(p=>raw.peserta.split(';').includes(contacts.find(c=>c.id===p.id)!.externalId)).map(p=>p.id)},people);
    const root=(id:string)=>{const seen=new Set<string>();let current=messages.find(m=>m.id===id);while(current?.parentId&&!seen.has(current.id)){seen.add(current.id);const parent=messages.find(m=>m.id===current!.parentId&&m.accountId===accountId&&m.eventDate<=dataset.asOf);if(!parent)return null;current=parent;}return seen.has(current?.id??'')?null:current?.id??null;};
    const threadRoot=root(message.id);let decisionScope=threadRoot;
    if(threadRoot){
      let cursor:typeof message|undefined=message;const seen=new Set<string>();
      while(cursor&&!seen.has(cursor.id)){
        seen.add(cursor.id);const tokens=[...new Set(cursor.body.match(/\b(?:DL\d+|DL-[\w-]+|DEAL-[\w-]+|S\d+|S-[\w-]+)\b/g)??[])];
        if(tokens.length){decisionScope=tokens.length===1?stableId(accountId,'thread-decision-scope',threadRoot,tokens[0]):null;break;}
        cursor=cursor.parentId?messages.find(m=>m.id===cursor!.parentId):undefined;
      }
    }
    for(const statement of result){statement.decision_scope_id=decisionScope;addEvidence(source,'isi',statement.text);}
    return result;
  });
  const stakeholders=[...new Set(people.map(p=>p.id))].map(id=>{
    const person=contacts.find(c=>c.id===id)!;const episodes=people.filter(p=>p.id===id),current=episodes.some(p=>p.current);
    const claims=statements.filter(a=>a.person_id===id).map(a=>({...a,current:a.current&&episodes.some(e=>e.current&&e.start<=a.event_date&&(!e.end||e.end>=a.event_date))}));
    return {person:{id,external_id:person.externalId,name:person.name,role:episodes.find(e=>e.current)?.role??episodes.at(-1)!.role,evidence_ids:[...new Set(episodes.flatMap(e=>e.evidenceIds))]},current,employments:episodes.map(p=>({role:p.role,start:p.start,end:p.end,evidence_ids:p.evidenceIds})),authority:authority(claims),statements:claims,unknowns:['Authority applies only to the recorded interaction/decision scope, not all future deals.',...(claims.some(a=>a.attribution==='reported')?['Reported statements require confirmation with the stakeholder.']:[]),...(current?[]:['Historical stakeholder: verify the current replacement; do not recommend this contact for the account.'])]};
  });
  const allStatements=stakeholders.flatMap(p=>p.statements);
  const findings:AccountDiagnosis['findings']=[];const prerequisites:{text:string;evidenceIds:string[]}[]=[];
  if(env.ANALYSIS_EXTRACTION_ENABLED==='true'||modelOptions?.extractor){
    const candidates=people.slice(0,12).map(p=>({id:p.id,role:p.role,start:p.start,end:p.end}));
    for(const message of messages.filter(m=>m.eventDate<=dataset.asOf&&(!sourceSubset||sourceSubset.has(find('interactions.jsonl',m.externalId)!.record.id))&&!statements.some(a=>a.scope_id===m.id)&&/require|need|memerlukan|membutuhkan|syarat/i.test(m.body)).slice(0,2)){
      const record=find('interactions.jsonl',message.externalId)!;const speaker=[...contacts,...employees].find(p=>p.email.toLowerCase()===message.sender.toLowerCase());
      const result=await (modelOptions?.runtime??runtimeFor(db).extraction).run({datasetId,accountId,sources:[{id:record.record.id,field:'isi',text:message.body.slice(0,12000),eventDate:message.eventDate,speakerId:speaker?.id??null}],candidates,subjectId:null,claim:'complex-requirement-extraction-v1'},'extract_details',modelOptions?.extractor??selectedGenerativeProvider());
      const item=addEvidence(record,'isi');
      const [usage]=await db.select().from(s.modelRuns).where(eq(s.modelRuns.id,result.runId));
      // Span/identity validation precedes persistence. Candidate semantics still
      // require review, so inferred approval cannot enter current authority/routes.
      findings.push({type:'unresolved_complex_interpretation',label:result.status==='succeeded'?'Validated source-span extraction candidates require semantic verification before they affect authority or action.':'Complex requirement interpretation is unavailable; retained evidence requires review.',evidence_ids:[item.source_id],check:{run_id:result.runId,status:result.status,calls:result.calls,cost_usd:result.cached?'0':result.calls>1?null:usage.costUsd,input_tokens:usage.inputTokens,output_tokens:usage.outputTokens,prompt_version:usage.promptVersion,schema_version:usage.schemaVersion,candidates:result.status==='succeeded'?extractionSchema.parse(result.value):null,automatic_acceptance:false}});
    }
  }
  const normalizedDecisions: typeof s.decisions.$inferInsert[]=[];const internal:AccountDiagnosis['internal_decisions']=[];
  const commitmentLinks:{subjectId:string;decisionId:string;eventDate:string;speakerId:string|null;attribution:'direct'|'reported';sourceIds:string[]}[]=[];
  const invalidDecisions:typeof rows[number][]=[];
  for(const row of decisionInputs){
    const parsed=decisionRow.safeParse(row.record.payload);
    if(!parsed.success){invalidDecisions.push(row);continue;}
    const d=parsed.data;if(d.tanggal>dataset.asOf)continue;
    const requester=employees.find(e=>e.externalId===d.diminta_oleh),approver=employees.find(e=>e.externalId===d.diputuskan_oleh),linkedDeal=d.deal_id?deals.find(e=>e.externalId===d.deal_id):null;
    if(!requester||!approver||d.deal_id&&!linkedDeal){invalidDecisions.push(row);continue;}
    if(deal&&d.deal_id!==deal.externalId)continue;
    const id=stableId(datasetId,'decision',d.decision_id);
    normalizedDecisions.push({id,datasetId,externalId:d.decision_id,accountId,eventDate:d.tanggal,dealId:linkedDeal?.id??null,requesterId:requester.id,approverId:approver.id,outcome:d.keputusan,value:d.nilai,rationale:d.alasan,featureExternalId:d.fitur_dijanjikan||null,commitmentStatus:d.status_janji||null,sourceId:row.record.id});
    const rationale=addEvidence(row,'alasan'),status=addEvidence(row,'status_janji');addEvidence(row,'diputuskan_oleh');addEvidence(row,'diminta_oleh');
    addEvidence(find('employees.csv',approver.externalId)!,'jabatan');addEvidence(find('employees.csv',requester.externalId)!,'jabatan');
    internal.push({id,external_id:d.decision_id,date:d.tanggal,requester_id:requester.id,approver_id:approver.id,outcome:d.keputusan,rationale:d.alasan,commitment_status:d.status_janji||null,evidence_ids:[rationale.source_id,status.source_id]});
    const concerns=allStatements.filter(a=>a.current&&a.predicate==='RAISES_CONCERN'&&/integrasi/i.test(a.text));
    if(/belum ditepati/i.test(d.status_janji)&&/integrasi/i.test(d.alasan)&&concerns.length){
      const ids=[row.record.id,...concerns.flatMap(a=>a.evidence_ids)];
      findings.push({type:'unmet_commitment',label:'An internal decision records an unfulfilled integration commitment; a current stakeholder raises the promised integration concern.',evidence_ids:ids});
      for(const concern of concerns)commitmentLinks.push({subjectId:concern.person_id,decisionId:id,eventDate:concern.event_date,speakerId:concern.speaker_id,attribution:concern.attribution,sourceIds:[row.record.id,...concern.evidence_ids]});
      prerequisites.push({text:'Obtain verified integration status, remediation options and an accountable delivery plan; address the stakeholder’s documented concern before asking for renewal.',evidenceIds:ids});
      const feature=find('features.csv',d.fitur_dijanjikan);
      if(feature){const item=addEvidence(feature,'status');addEvidence(feature,'target_terkini');findings.push({type:'product_delivery_context',label:`Recorded feature status: ${feature.record.payload.status}; current target: ${feature.record.payload.target_terkini||'unknown'}. Verify current product status; no delivery date is inferred.`,evidence_ids:[item.source_id]});}
    }
  }
  if(invalidDecisions.length)findings.push({type:'unresolved_internal_decisions',label:'Some retained decision rows cannot be normalized safely; inspect unresolved references before relying on them.',check:{count:invalidDecisions.length,as_of:dataset.asOf},evidence_ids:invalidDecisions.map(r=>addEvidence(r,'alasan').source_id)});
  for(const concern of allStatements.filter(a=>a.current&&a.predicate==='RAISES_CONCERN')){
    const person=contacts.find(c=>c.id===concern.person_id)!;
    const later=messages.filter(m=>m.eventDate>concern.event_date&&m.eventDate<=dataset.asOf&&m.sender.toLowerCase()===owner.email.toLowerCase()&&m.recipients.split(/[;,]/).some(email=>email.trim().toLowerCase()===person.email.toLowerCase())).sort((a,b)=>b.eventDate.localeCompare(a.eventDate))[0];
    if(later&&/integrasi/i.test(concern.text)&&!/integrasi|integration/i.test(later.body)){
      const source=addEvidence(find('interactions.jsonl',later.externalId)!,'isi');
      findings.push({type:'engagement_mismatch',label:'This recorded follow-up does not mention the integration concern. This does not establish that every communication ignored it.',check:{concern_scope_id:concern.scope_id,followup_id:later.externalId,method:'bounded_literal_concern_check'},evidence_ids:[...concern.evidence_ids,source.source_id]});
      if(/lampir|attach/i.test(later.body))findings.push({type:'unavailable_attachment',label:'The referenced attachment contents are unavailable here; its coverage of the concern is unknown.',evidence_ids:[source.source_id]});
    }
  }
  const scopedCards=selected?[selected]:scope.dealId?[]:opportunityCards;
  for(const card of scopedCards){
    for(const item of card.evidence)if(!evidence.some(e=>e.source_id===item.source_id&&e.field===item.field&&e.passage===item.passage))evidence.push(item);
    findings.push(...card.findings);
    if(card.next_action.route==='resolve_prerequisite_first')prerequisites.push({text:'Confirm package capacity and approved upgrade pricing before quoting additional outlets.',evidenceIds:card.evidence.filter(e=>e.filename==='contracts_billing.csv').map(e=>e.source_id)});
  }
  const tickets=rows.filter(r=>r.file.filename==='support_tickets.csv'&&r.record.accountExternalId===account.externalId&&r.record.payload.dibuat<=dataset.asOf);
  if(tickets.length)findings.push({type:'ticket_context',label:'Support records are relevant account context. Counts and open status alone do not establish an expansion blocker.',check:{dataset_version:dataset.version,as_of:dataset.asOf,account_id:account.externalId,records:tickets.length,blocker_claim:false},evidence_ids:[]});
  for(const ticket of tickets.filter(t=>!t.record.payload.diselesaikan||t.record.payload.diselesaikan>dataset.asOf)){
    const linked=messages.find(m=>m.eventDate<=dataset.asOf&&m.body.split(/[.!?]/).some(clause=>clause.includes(ticket.record.externalId??'__missing_ticket__')&&/harus|wajib|require|need|cannot|syarat/i.test(clause)&&/selesai|resolved?|fixed?|diperbaiki/i.test(clause)&&/ekspansi|rollout|pembelian|purchase/i.test(clause)&&!/bukan.*syarat|tidak.*(?:harus|wajib)/i.test(clause)));
    if(linked){const source=addEvidence(find('interactions.jsonl',linked.externalId)!,'isi'),detail=addEvidence(ticket,'deskripsi');const ids=[source.source_id,detail.source_id];findings.push({type:'documented_ticket_prerequisite',label:'A recorded purchasing/rollout prerequisite explicitly references this unresolved ticket; verify resolution before proceeding.',evidence_ids:ids});prerequisites.push({text:`Verify resolution of the documented prerequisite ${ticket.record.externalId} before rollout/purchase.`,evidenceIds:ids});}
  }
  for(const p of stakeholders.filter(p=>p.authority==='conflicting_or_outdated'))findings.push({type:'authority_uncertainty',label:'Authority evidence is contradictory or outdated; clarify the current decision scope.',evidence_ids:p.statements.filter(a=>a.predicate==='APPROVER_FOR').flatMap(a=>a.evidence_ids)});
  for(const p of stakeholders.filter(p=>p.statements.some(a=>a.current&&a.predicate==='REQUESTS_EVIDENCE'&&a.polarity==='denied')))findings.push({type:'requirement_uncertainty',label:'A requirement has been denied or changed; confirm which dated requirements remain applicable rather than silently reusing the earlier statement.',evidence_ids:p.statements.filter(a=>a.predicate==='REQUESTS_EVIDENCE').flatMap(a=>a.evidence_ids)});
  const commercialContext=deal?deal.type:selected||scopedCards.length?'expansion':allStatements.some(a=>a.current&&a.predicate==='RAISES_CONCERN')&&messages.some(m=>/renewal/i.test(m.body))?'renewal':account.type==='prospect'?'new_sale':'unknown';
  const productOwners=prerequisites.some(p=>/integrasi|integration/i.test(p.text))?employees.filter(e=>/product manager|product owner/i.test(e.title)):[];
  const productOwnerIds=productOwners.length===1?[productOwners[0].id]:[];
  for(const candidate of productOwners)addEvidence(find('employees.csv',candidate.externalId)!,'jabatan');
  const action=selectAction({ownerId:owner.id,statements:allStatements,currentIds,prerequisites,baseEvidenceIds:[accountSource.source_id],productOwnerIds,preferred:'joint'});
  const requirementAssessments:AccountDiagnosis['requirement_assessments']=[];
  for(const statement of allStatements.filter(a=>a.current&&a.polarity==='affirmed'&&['REQUESTS_EVIDENCE','RAISES_CONCERN'].includes(a.predicate))){
    const bundle=await retrieveConnected(db,{datasetId,accountId,asOf:dataset.asOf,seedSourceIds:[statement.evidence_ids[0]],dealId:scope.dealId,signalId:scope.signalId});
    const assessment=assessRequirement(statement,bundle);
    if((env.QA_JEV_ENABLED==='true'||modelOptions?.jev)&&!bundle.coverage.truncated&&!bundle.coverage.unresolved_links.length&&!bundle.sources.some(s=>s.attachment_unavailable)){
      const requirement=bundle.sources.find(s=>s.interaction_id===statement.scope_id);
      const followups=bundle.sources.filter(s=>assessment.source_ids.includes(s.id)&&s.interaction_id!==statement.scope_id);
      if(requirement&&followups.length>0&&followups.length<=3){
        const result=await (modelOptions?.runtime??runtimeFor(db).judgment).run({datasetId,accountId,subjectId:statement.person_id,candidates:people.slice(0,12).map(p=>({id:p.id,role:p.role,start:p.start,end:p.end})),claim:JSON.stringify({requirement_id:statement.id,decision_scope:statement.decision_scope_id,hashes:[requirement,...followups].map(s=>s.hash)}),sources:[requirement,...followups].map(s=>({id:s.id,field:'isi',text:s.text.slice(0,12000),eventDate:s.date,speakerId:s.interaction_id===statement.scope_id?statement.speaker_id:null}))},'concern_addressed',modelOptions?.jev??jevProvider(env.JEV_API_KEY,env.JEV_MODEL));
        if(result.status==='succeeded'){assessment.status=(result.value as {choice:typeof assessment.status}).choice;assessment.method='jev-four-choice-v2';assessment.limitations.push('Fallible model interpretation; not fulfillment or customer acceptance.');}
        const [usage]=await db.select().from(s.modelRuns).where(eq(s.modelRuns.id,result.runId));
        assessment.model_run_id=result.runId;assessment.calls=result.calls;assessment.cost_usd=result.cached?'0':result.calls>1?null:usage.costUsd;assessment.prompt_version=usage.promptVersion;assessment.schema_version=usage.schemaVersion;
        assessment.limitations.push(`Judgment ${result.status}; run ${result.runId}; calls ${result.calls}.`);
      }
    }
    requirementAssessments.push(assessment);
    for(const src of bundle.sources){const row=find('interactions.jsonl',src.external_id!);if(row)addEvidence(row,'isi',src.text);}
    findings.push({type:'requirement_coverage',label:`Recorded requirement: ${assessment.status}. ${assessment.missing_details.length?'Missing requested details: '+assessment.missing_details.join(', '):''}`,evidence_ids:assessment.source_ids,check:{...assessment}});
    if(['joint_decision_maker_discussion','prepare_through_intermediary'].includes(action.route)&&!prerequisites.length&&(assessment.status==='not_addressed'||assessment.status==='partially_addressed')){
      const intermediaries=allStatements.filter(a=>a.current&&a.predicate==='INTERMEDIARY_FOR'&&a.decision_scope_id===statement.decision_scope_id);
      const approvers=allStatements.filter(a=>a.current&&a.predicate==='APPROVER_FOR'&&a.decision_scope_id===statement.decision_scope_id&&a.polarity==='affirmed');
      if(intermediaries.length&&approvers.length&&approvers.some(a=>authority(allStatements.filter(p=>p.person_id===a.person_id&&p.decision_scope_id===a.decision_scope_id))!=='conflicting_or_outdated')){
        action.tasks.push({order:action.tasks.length+1,owner_ids:[...new Set(intermediaries.map(a=>a.person_id))],text:`Gather operational inputs and prepare the documented evidence requested by ${contacts.find(c=>c.id===statement.person_id)?.name??'the requirement holder'}: ${statement.text}`,requirement_ids:[statement.id],evidence_ids:[...new Set([...assessment.source_ids,...intermediaries.flatMap(a=>a.evidence_ids)])],status:'proposed'});
        action.tasks.push({order:action.tasks.length+1,owner_ids:[owner.id,...new Set(intermediaries.map(a=>a.person_id)),...new Set(approvers.map(a=>a.person_id))],text:'Ask the intermediary to arrange a joint commercial discussion with the scoped decision-maker after preparing the requested evidence.',requirement_ids:[statement.id],evidence_ids:[...new Set(approvers.flatMap(a=>a.evidence_ids))],status:'proposed'});
      }
    }
  }
  if(action.tasks.length)action.task=action.tasks.map(t=>`${t.order}. ${t.text}`).join(' ');
  if(action.recipient_ids.length===0)action.recipient_ids=currentIds;
  for(const card of scopedCards)for(const point of card.next_action.discussion_points)action.discussion_points.push({audience_ids:card.people.contact&&currentIds.includes(card.people.contact.id)?[card.people.contact.id]:[],text:point.text,evidence_ids:point.evidence_ids});
  const diagnosis=diagnosisSchema.parse({id:stableId(datasetId,'diagnosis',scopeKey),dataset_id:datasetId,dataset_version:dataset.version,as_of:dataset.asOf,account_id:accountId,account,signal_id:scope.signalId??null,deal_id:scope.dealId??null,commercial_context:commercialContext,
    owner:{id:owner.id,external_id:owner.externalId,name:owner.name,role:owner.title,evidence_ids:[ownerSource.source_id,accountSource.source_id]},findings,stakeholder_context:stakeholders,action_plan:action,premise_check:null,value_scenario:selected?.value_scenario??null,internal_decisions:internal,evidence,
    requirement_assessments:requirementAssessments,unknowns:['Current stakeholder requirements and authority must be confirmed in this decision scope.','No complete repeat-order or revenue ledger establishes a decline.'],limitations:['Deterministic statement candidates, not live model judgments or verified personality facts.','Internal decisions are KasirNusa approvals; they never establish customer purchasing authority.','No activity outside the supplied snapshot is established.','Requirements from another organization are not transferred into this account.'],method:STAKEHOLDER_VERSION,dependencies:{opportunity_hash:sha256(JSON.stringify(opportunityCards))}});
  await db.transaction(async tx=>{
    await tx.insert(s.analysisRuns).values({id:runId,datasetId,asOf:dataset.asOf,ruleVersion:STAKEHOLDER_VERSION,status:'running'});
    for(const decision of normalizedDecisions){await tx.insert(s.entities).values({id:decision.id!,datasetId,kind:'decision',externalId:decision.externalId}).onConflictDoNothing();await tx.insert(s.decisions).values(decision).onConflictDoNothing();await tx.insert(s.entitySources).values({datasetId,entityId:decision.id!,sourceId:decision.sourceId}).onConflictDoNothing();}
    for(const row of invalidDecisions)await tx.insert(s.ingestionErrors).values({id:stableId(datasetId,'stakeholder-decision-error',row.record.id),datasetId,fileId:row.file.id,locator:row.record.locator,code:'invalid_or_unresolved_internal_decision',disposition:'retained_requires_review'}).onConflictDoNothing();
    for(const statement of allStatements){
      await tx.insert(s.assertions).values({id:stableId(runId,statement.id),datasetId,subjectId:statement.person_id,objectId:null,literal:{...statement,account_id:accountId,signal_id:scope.signalId??null,deal_id:scope.dealId??null},accountId,eventDate:statement.event_date,speakerId:statement.speaker_id,predicate:statement.predicate,attribution:statement.attribution,method:STAKEHOLDER_VERSION,verification:statement.verification,runId});
      for(const e of evidence.filter(e=>statement.evidence_ids.includes(e.source_id)))await tx.insert(s.assertionEvidence).values({datasetId,assertionId:stableId(runId,statement.id),sourceId:e.source_id,field:e.field,passage:e.passage,relation:'support'}).onConflictDoNothing();
    }
    for(const link of commitmentLinks){const id=stableId(runId,'commitment-concern',link.subjectId,link.decisionId);await tx.insert(s.assertions).values({id,datasetId,subjectId:link.subjectId,predicate:'CONCERN_ABOUT_COMMITMENT',objectId:link.decisionId,literal:null,accountId,eventDate:link.eventDate,speakerId:link.speakerId,attribution:link.attribution,method:STAKEHOLDER_VERSION,verification:'unreviewed_rules_candidate',runId}).onConflictDoNothing();for(const e of evidence.filter(e=>link.sourceIds.includes(e.source_id)))await tx.insert(s.assertionEvidence).values({datasetId,assertionId:id,sourceId:e.source_id,field:e.field,passage:e.passage,relation:'support'}).onConflictDoNothing();}
    for(const [index,finding] of findings.entries()){
      const id=stableId(runId,'finding',String(index));await tx.insert(s.findings).values({id,datasetId,accountId,signalId:scope.signalId??null,runId,commercialContext:diagnosis.commercial_context,type:finding.type,details:finding});
      for(const sourceId of new Set(finding.evidence_ids))await tx.insert(s.findingEvidence).values({datasetId,findingId:id,sourceId,checkResult:finding.check??null});
      if(!finding.evidence_ids.length&&finding.check)await tx.insert(s.findingEvidence).values({datasetId,findingId:id,sourceId:null,checkResult:finding.check});
    }
    await tx.insert(s.recommendations).values({id:stableId(runId,'account-recommendation'),datasetId,accountId,signalId:null,runId,ownerId:owner.id,route:action.route,reviewStatus:'proposed',card:diagnosis});
    await tx.insert(s.diagnoses).values({id:diagnosis.id,datasetId,accountId,runId,signalId:scope.signalId??null,dealId:scope.dealId??null,scopeKey,diagnosis}).onConflictDoUpdate({target:[s.diagnoses.datasetId,s.diagnoses.scopeKey],set:{runId,diagnosis}});
    await tx.update(s.analysisRuns).set({status:'completed'}).where(eq(s.analysisRuns.id,runId));
  });
  return {dataset_id:datasetId,account_id:accountId,run_id:runId,reused:false,statements:allStatements.length,decisions:normalizedDecisions.length,unresolved_decisions:invalidDecisions.length};
}
