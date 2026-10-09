import { graphSchema, type OpportunityCard } from '@kasirnusa/contracts';
import { stableId } from '../ingestion/service.js';
export function projectEvidence(card:OpportunityCard,maxNodes=50) {
  // Fixed projection, not unrestricted traversal or model SQL. At most three hops
  // from the selected signal; visited IDs prevent cycles and duplicate nodes.
  const nodes=new Map<string,{id:string;kind:string;label:string}>();
  const edges: {id:string;from:string;to:string;relation:string;evidence_ids:string[]}[]=[];
  const add=(id:string,kind:string,label:string)=>nodes.set(id,{id,kind,label});
  const edge=(from:string,to:string,relation:string,evidence_ids:string[])=>edges.push({id:stableId(card.dataset_id,from,to,relation),from,to,relation,evidence_ids});
  add(card.id,'signal',card.signal.kind); add(card.account.id,'account',card.account.name);
  add(card.people.owner.id,'employee',card.people.owner.name);
  edge(card.id,card.account.id,'FOR_ACCOUNT',card.evidence.filter(e=>e.filename==='interactions.jsonl').map(e=>e.source_id));
  edge(card.account.id,card.people.owner.id,'OWNED_BY',card.people.owner.evidence_ids);
  if(card.people.contact){add(card.people.contact.id,'contact',card.people.contact.name);edge(card.people.contact.id,card.account.id,'WORKS_AT_RECORDED',card.people.contact.evidence_ids);edge(card.people.contact.id,card.id,'REQUESTED',card.stakeholder_context[0]?.evidence_ids??[]);}
  for(const evidence of card.evidence.filter(e=>e.filename==='contracts_billing.csv'&&e.source_external_id)){
    const contractId=stableId(card.dataset_id,'contract',evidence.source_external_id!);
    add(contractId,'contract',evidence.source_external_id!);edge(card.account.id,contractId,'HAS_CONTRACT',[evidence.source_id]);edge(contractId,evidence.source_id,'SUPPORTED_BY',[evidence.source_id]);
  }
  for(const evidence of card.evidence){add(evidence.source_id,'source',`${evidence.filename} #${evidence.locator}`);edge(card.id,evidence.source_id,'SUPPORTED_BY',[evidence.source_id]);}
  const limited=[...nodes.values()].slice(0,maxNodes);const ids=new Set(limited.map(n=>n.id));
  return graphSchema.parse({nodes:limited,edges:[...new Map(edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).map(e=>[e.id,e])).values()],evidence:card.evidence.filter(e=>ids.has(e.source_id)),limits:{max_hops:3,max_nodes:maxNodes,truncated:nodes.size>maxNodes}});
}
