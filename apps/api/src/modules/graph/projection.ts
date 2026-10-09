import { graphSchema, type OpportunityCard } from '@kasirnusa/contracts';
import { stableId } from '../ingestion/service.js';
export function projectEvidence(card: OpportunityCard, maxNodes = 50) {
  // Fixed projection, bounded traversal from the selected signal and account.
  const nodes = new Map<string, { id: string; kind: string; label: string }>();
  const edges: { id: string; from: string; to: string; relation: string; evidence_ids: string[] }[] = [];
  const add = (id: string, kind: string, label: string) => nodes.set(id, { id, kind, label });
  const edge = (from: string, to: string, relation: string, evidence_ids: string[]) =>
    edges.push({ id: stableId(card.dataset_id, from, to, relation), from, to, relation, evidence_ids });

  // Core entities
  add(card.id, 'signal', card.signal.kind.replaceAll('_', ' '));
  add(card.account.id, 'account', card.account.name);
  add(card.people.owner.id, 'employee', card.people.owner.name);

  edge(card.id, card.account.id, 'FOR_ACCOUNT', card.evidence.filter(e => e.filename === 'interactions.jsonl').map(e => e.source_id));
  edge(card.account.id, card.people.owner.id, 'OWNED_BY', card.people.owner.evidence_ids);

  if (card.people.contact) {
    add(card.people.contact.id, 'contact', card.people.contact.name);
    edge(card.people.contact.id, card.account.id, 'WORKS_AT_RECORDED', card.people.contact.evidence_ids);
    edge(card.people.contact.id, card.id, 'REQUESTED', card.stakeholder_context[0]?.evidence_ids ?? []);
  }

  // Contract context
  for (const evidence of card.evidence.filter(e => e.filename === 'contracts_billing.csv' && e.source_external_id)) {
    const contractId = stableId(card.dataset_id, 'contract', evidence.source_external_id!);
    add(contractId, 'contract', `Contract ${evidence.source_external_id!}`);
    edge(card.account.id, contractId, 'HAS_CONTRACT', [evidence.source_id]);
  }

  // Proposed Action node: makes explicit the action derived from signal & stakeholder requirements
  const actionId = stableId(card.dataset_id, 'action', card.id);
  add(actionId, 'action', card.next_action.task);
  const actionEv = card.next_action.discussion_points.flatMap(p => p.evidence_ids);
  edge(card.id, actionId, 'SUGGESTS_ACTION', actionEv.length ? actionEv : card.people.owner.evidence_ids);
  edge(card.people.owner.id, actionId, 'ASSIGNED_TO', card.people.owner.evidence_ids);
  if (card.people.contact) {
    edge(actionId, card.people.contact.id, 'ENGAGES', card.people.contact.evidence_ids);
  }

  const limited = [...nodes.values()].slice(0, maxNodes);
  const ids = new Set(limited.map(n => n.id));
  return graphSchema.parse({
    nodes: limited,
    edges: [...new Map(edges.filter(e => ids.has(e.from) && ids.has(e.to)).map(e => [e.id, e])).values()],
    evidence: card.evidence,
    limits: { max_hops: 3, max_nodes: maxNodes, truncated: nodes.size > maxNodes },
  });
}

