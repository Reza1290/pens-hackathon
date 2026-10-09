import { graphSchema,type AccountDiagnosis } from '@kasirnusa/contracts';
import { stableId } from '../ingestion/service.js';
export function projectDiagnosis(d: AccountDiagnosis, maxNodes = 50) {
  const nodes = new Map<string, { id: string; kind: string; label: string }>();
  const edges: { id: string; from: string; to: string; relation: string; evidence_ids: string[] }[] = [];
  const add = (id: string, kind: string, label: string) => nodes.set(id, { id, kind, label });
  const edge = (from: string, to: string, relation: string, ids: string[]) =>
    edges.push({ id: stableId(d.dataset_id, from, to, relation), from, to, relation, evidence_ids: ids });

  // Core entities
  add(d.account_id, 'account', d.account.name);
  add(d.owner.id, 'employee', d.owner.name);
  edge(d.account_id, d.owner.id, 'OWNED_BY', d.owner.evidence_ids);

  // Stakeholders and assertions
  for (const p of d.stakeholder_context) {
    add(p.person.id, 'contact', p.person.name);
    edge(d.account_id, p.person.id, p.current ? 'CURRENT_STAKEHOLDER' : 'HISTORICAL_STAKEHOLDER', p.employments.flatMap(e => e.evidence_ids));
    for (const a of p.statements) {
      add(a.scope_id, 'interaction', a.event_date);
      edge(p.person.id, a.scope_id, `${a.predicate}_${a.attribution.toUpperCase()}`, a.evidence_ids);
    }
  }

  // Internal decisions
  for (const decision of d.internal_decisions) {
    add(decision.id, 'decision', decision.external_id);
    edge(d.account_id, decision.id, 'HAS_INTERNAL_DECISION', decision.evidence_ids);
    add(decision.approver_id, 'employee', 'Internal KasirNusa decision-maker');
    edge(decision.id, decision.approver_id, 'DECIDED_BY_INTERNAL_EMPLOYEE', decision.evidence_ids);
  }

  // Unmet commitments
  for (const finding of d.findings.filter(f => f.type === 'unmet_commitment')) {
    for (const decision of d.internal_decisions.filter(item => item.evidence_ids.some(id => finding.evidence_ids.includes(id)))) {
      for (const person of d.stakeholder_context.filter(p => p.statements.some(a => a.predicate === 'RAISES_CONCERN' && a.evidence_ids.some(id => finding.evidence_ids.includes(id))))) {
        edge(person.person.id, decision.id, 'CONCERN_ABOUT_COMMITMENT', finding.evidence_ids);
      }
    }
  }

  // Proposed Action node: makes explicit the recommended action and who it involves
  const actionId = stableId(d.dataset_id, 'action', d.id);
  add(actionId, 'action', d.action_plan.task);
  const actionEv = d.action_plan.discussion_points.flatMap(p => p.evidence_ids);
  edge(d.account_id, actionId, 'SUGGESTS_ACTION', actionEv.length ? actionEv : d.owner.evidence_ids);
  edge(d.owner.id, actionId, 'ASSIGNED_TO', d.owner.evidence_ids);
  for (const recId of d.action_plan.recipient_ids) {
    edge(actionId, recId, 'ENGAGES', []);
  }

  const limited = [...nodes.values()].slice(0, maxNodes);
  const ids = new Set(limited.map(n => n.id));
  return graphSchema.parse({
    nodes: limited,
    edges: [...new Map(edges.filter(e => ids.has(e.from) && ids.has(e.to)).map(e => [e.id, e])).values()],
    evidence: d.evidence,
    limits: { max_hops: 3, max_nodes: maxNodes, truncated: nodes.size > maxNodes },
  });
}

