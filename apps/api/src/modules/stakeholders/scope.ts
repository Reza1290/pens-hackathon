import { stableId } from '../ingestion/service.js';
type Message={id:string;parentId:string|null;accountId:string|null;eventDate:string;body:string};
export function decisionScope(messages:Message[],id:string,accountId:string,asOf:string){
  const chain:Message[]=[];const seen=new Set<string>();let current=messages.find(m=>m.id===id);
  while(current){
    if(seen.has(current.id)||current.accountId!==accountId||current.eventDate>asOf)return null;
    seen.add(current.id);chain.push(current);
    if(!current.parentId)break;
    current=messages.find(m=>m.id===current!.parentId);if(!current)return null;
  }
  if(!chain.length)return null;const root=chain.at(-1)!.id;
  for(const message of chain){const tokens=[...new Set(message.body.match(/\b(?:DL\d+|DL-[\w-]+|DEAL-[\w-]+|S\d+|S-[\w-]+)\b/g)??[])];if(tokens.length)return tokens.length===1?stableId(accountId,'thread-decision-scope',root,tokens[0]):null;}
  return root;
}
