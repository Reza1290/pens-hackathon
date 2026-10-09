import { useEffect,useRef } from 'react';
import cytoscape from 'cytoscape';
import { graphSchema } from '@kasirnusa/contracts';
import type { z } from 'zod';
export function Graph({graph,onEvidence}:{graph:z.infer<typeof graphSchema>;onEvidence:(id:string)=>void}){
  const container=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!container.current)return;
    const cy=cytoscape({container:container.current,elements:[...graph.nodes.map(n=>({data:{id:n.id,label:n.label}})),...graph.edges.map(e=>({data:{id:e.id,source:e.from,target:e.to,label:e.relation.replaceAll('_',' '),evidence:e.evidence_ids}}))],layout:{name:'breadthfirst',directed:true,padding:35},style:[{selector:'node',style:{'background-color':'#216b57',label:'data(label)','font-size':11,'text-wrap':'wrap','text-max-width':'110px','text-valign':'bottom','text-margin-y':8}},{selector:'edge',style:{width:1.5,'line-color':'#9caeaa','target-arrow-color':'#9caeaa','target-arrow-shape':'triangle','curve-style':'bezier',label:'data(label)','font-size':8,'text-background-color':'#fafbf8','text-background-opacity':1}}],minZoom:0.15,maxZoom:2});
    cy.on('tap','edge',event=>{const ids=event.target.data('evidence') as string[];if(ids[0])onEvidence(ids[0]);});
    const observer=new ResizeObserver(()=>{cy.resize();cy.fit(undefined,35);});observer.observe(container.current);
    return()=>{observer.disconnect();cy.destroy();};
  },[graph,onEvidence]);
  const name=(id:string)=>graph.nodes.find(n=>n.id===id)?.label??id;
  return <section><h2>Relationship path</h2><p>Bounded to {graph.limits.max_hops} hops / {graph.limits.max_nodes} nodes. {graph.limits.truncated?'Path truncated.':'Complete within these limits.'} Select a relationship to inspect its evidence.</p><div ref={container} className="graph" role="img" aria-label="Evidence relationship graph; equivalent relationships listed below"/><details><summary>Accessible relationship list ({graph.edges.length})</summary><ul>{graph.edges.map(e=><li key={e.id}>{name(e.from)} → {e.relation.replaceAll('_',' ')} → {name(e.to)} {e.evidence_ids.map(id=><button key={id} onClick={()=>onEvidence(id)}>View source {graph.evidence.find(v=>v.source_id===id)?.source_external_id??'record'}</button>)}</li>)}</ul></details></section>;
}
