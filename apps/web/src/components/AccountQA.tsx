import { useEffect,useRef,useState } from 'react';
import type { Evidence,QaResponse } from '@kasirnusa/contracts';
import { api } from '../lib/api';
export function AccountQA({dataset,account,opportunity,route,open}:{dataset:string;account:string;opportunity?:string;route:string;open:(id:string)=>void}){
  const [language,setLanguage]=useState<'en'|'id'>('en');const [question,setQuestion]=useState('');
  const [result,setResult]=useState<QaResponse>();const [history,setHistory]=useState<{question:string}[]>([]);
  const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [draft,setDraft]=useState('');
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function ask(){
    controller.current?.abort();const current=new AbortController();controller.current=current;
    setLoading(true);setError('');setResult(undefined);setDraft('');
    try{const data=await api.qa({dataset_id:dataset,account_id:account,opportunity_id:opportunity,question,language,history,route:route==='intermediary'?'intermediary':'joint'},current.signal);
      if(current.signal.aborted)return;setResult(data);setDraft(data.draft?.body??'');setHistory(previous=>[...previous,{question}].slice(-3));
    }catch(e){if(!current.signal.aborted)setError(e instanceof Error?e.message:'Question unavailable');}finally{if(!current.signal.aborted)setLoading(false);}
  }
  const refs=(ids:string[],evidence:Evidence[])=>ids.map(id=><button key={id} onClick={()=>open(id)}>{evidence.find(e=>e.source_id===id)?.source_external_id??'Source record'}</button>);
  return <section aria-label="Account questions"><h2>Ask about this account</h2><p>Answers use the selected account and historical snapshot. Sources, limitations and proposed actions remain visible.</p><form onSubmit={e=>{e.preventDefault();void ask();}}><label>Answer language<select value={language} onChange={e=>setLanguage(e.target.value as 'en'|'id')}><option value="en">English</option><option value="id">Indonesian</option></select></label><label>Account question<input value={question} onChange={e=>setQuestion(e.target.value)} required maxLength={500} placeholder="What should we discuss with the CFO?"/></label><button disabled={loading||!question.trim()}>Ask account question</button></form>
    {loading&&<p role="status">Retrieving scoped evidence…</p>}{error&&<p role="alert">{error}</p>}
    {result&&<div aria-live="polite"><p className="tags">{result.status.replaceAll('_',' ')} · {result.commercial_context} · as of {result.as_of}</p>
      {result.premise_check&&<div className="notice"><h3>Question premise: {result.premise_check.status.replaceAll('_',' ')}</h3><p>{result.premise_check.coverage}</p><p>{result.premise_check.clarification}</p></div>}
      <p className="intro">{result.answer}</p>{result.claims.map(claim=><article key={claim.id}><span className="tags">{claim.kind.replaceAll('_',' ')}</span><p>{claim.text}</p><span className="refs">{refs(claim.evidence_ids,result.evidence)}</span>{claim.check&&<details><summary>Scope, calculation or recorded check</summary><pre>{JSON.stringify(claim.check,null,2)}</pre></details>}</article>)}
      {result.draft&&<label>Editable answer draft<textarea rows={12} value={draft} onChange={e=>setDraft(e.target.value)}/></label>}
      <ul>{result.limitations.map((t,i)=><li key={i}>{t}</li>)}</ul><p>Generation: {result.generation.status} · {result.generation.cached?'cached':'not cached'} · {result.generation.calls} calls · {result.generation.latency_ms} ms · estimated request cost USD {result.generation.cost_usd??'unknown'}</p>
    </div>}
  </section>;
}
