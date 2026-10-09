import { draftSchema,type AccountDiagnosis,type OpportunityCard } from '@kasirnusa/contracts';

/** Ephemeral templates use only the server's scoped action. No send or persistence. */
export function prepareDraft(resource:OpportunityCard|AccountDiagnosis,language:'en'|'id') {
  const card='signal' in resource;
  const action=card?resource.next_action:resource.action_plan;
  const account=resource.account;
  const accountId=account.id;
  const people=card?[resource.people.owner,...(resource.people.contact?[resource.people.contact]:[])]:[resource.owner,...resource.stakeholder_context.filter(p=>p.current).map(p=>p.person)];
  const names=action.recipient_ids.map(id=>people.find(p=>p.id===id)?.name).filter(Boolean);
  const evidenceIds=[...new Set(action.discussion_points.flatMap(p=>p.evidence_ids))];
  const refs=evidenceIds.map(id=>resource.evidence.find(e=>e.source_id===id)?.source_external_id??id);
  const unknowns=[...new Set([...resource.unknowns,...('unknowns' in action?action.unknowns:[])])];
  const owner=people.find(p=>p.id===action.owner_id)?.name??'Account owner';
  const heading=language==='id'?'Usulan pembahasan':'Proposed discussion';
  // Action text stays verbatim: templates do not invent translations, deadlines or promises.
  const body=[language==='id'?`Halo ${names.join(', ')||'[konfirmasi penerima]'},`:`Hello ${names.join(', ')||'[confirm recipient]'},`,'',`${heading}: ${action.task}`,'',...action.discussion_points.map(p=>`- ${p.text}`),'',language==='id'?'Mohon konfirmasi kebutuhan dan langkah berikutnya.':'Please confirm the requirements and next steps.','',owner,'',language==='id'?'Catatan internal untuk ditinjau (hapus sebelum digunakan):':'Internal review notes (remove before use):',`Context: ${resource.commercial_context}; route: ${action.route}; as of ${resource.as_of}.`,`Evidence: ${refs.join(', ')||'No supporting discussion evidence; clarify first.'}`,...unknowns.map(u=>`- ${u}`)].join('\n');
  return draftSchema.parse({dataset_id:resource.dataset_id,as_of:resource.as_of,account_id:accountId,resource_id:resource.id,commercial_context:resource.commercial_context,language,method:'template-v1',review_status:'human_review_required',route:action.route,owner_id:action.owner_id,recipient_ids:action.recipient_ids,subject:`${heading}: ${account.name}`,body,evidence_ids:evidenceIds,unknowns});
}
