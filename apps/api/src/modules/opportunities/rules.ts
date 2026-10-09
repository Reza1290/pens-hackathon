import Decimal from 'decimal.js';
const Money=Decimal.clone({precision:40,rounding:Decimal.ROUND_HALF_UP});
export const RULE_VERSION = 'deterministic-expansion-v2.2';
export type Request = { quantity:number|null; location:string|null; targetPeriod:string|null; kind:'quotation_request'|'explicit_plan'; requestedActions:('quotation'|'implementation_schedule')[] };
export function extractRequest(text: string): Request | null {
  const futureOpening=/\b(?:awal|early|Q[1-4]|kuartal\s*[1-4])\s*20\d{2}\b.*\b(?:buka|membuka|tambah|open|opening)\b/i.test(text);
  const quoteRequest=/\b(?:mohon|minta|please|request)\b.*\b(?:penawaran|quotation|quote)\b/i.test(text);
  if ((!/\b(berencana|rencana|akan (?:buka|membuka|tambah)|plan(?:ning)?|intend)\b/i.test(text) && !futureOpening && !quoteRequest) || isCancellation(text) || /\b(tidak (?:jadi|berencana|akan)|not planning|do not plan)\b/i.test(text)) return null;
  if (!/\b(outlet|cabang|gerai|branches|stores)\b/i.test(text)) return null;
  // A quotation for an existing base or renewal is not incremental expansion.
  if (!/\b(?:membuka|buka|tambah|tambahan|menambah|open|opening|additional|new|ekspansi|expansion)\b/i.test(text)) return null;
  const quantities=[...text.matchAll(/\b(\d+)\s*(?:outlet|cabang|gerai|branches|stores)\b/gi)].map(m=>Number(m[1]));
  const quantity=quantities.length===1 && Number.isSafeInteger(quantities[0]) && quantities[0]>0 ? quantities[0] : null;
  const quarter=text.match(/(?:kuartal\s*([1-4])|Q([1-4]))\s*(20\d{2})/i);
  const early=text.match(/\b(awal|early)\s*(20\d{2})/i);
  const locations=[...text.matchAll(/\bdi\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)(?=\s+(?:pada|awal|kuartal|tahun|Q[1-4])|[.,]|$)/g)];
  const requestedActions:Request['requestedActions']=[];
  if(/mohon (?:penawaran|.*penawaran)|quotation|please.*quote/i.test(text))requestedActions.push('quotation');
  if(/jadwal implementasi|implementation schedule/i.test(text))requestedActions.push('implementation_schedule');
  return { quantity, location:locations.length===1?locations[0][1]:null, targetPeriod:quarter?`${quarter[3]}-Q${quarter[1]||quarter[2]}`:early?`${early[2]}-early`:null,requestedActions,
    kind:/mohon (?:penawaran|.*jadwal)|quotation|please.*quote/i.test(text)?'quotation_request':'explicit_plan' };
}
export type DealCandidate = { id:string; accountId:string; type:string; outlets:number|null; status:string; confirmedSignalKey?:string };
export function reconcile(accountId:string, signalKey:string, candidates:DealCandidate[], complete:boolean) {
  const scoped=candidates.filter(d=>d.accountId===accountId && d.type==='expansion');
  if (!complete) return { status:'insufficient_coverage' as const, candidates:scoped, reason:'Required deal coverage is incomplete.' };
  const matches=scoped.filter(d=>d.confirmedSignalKey===signalKey && !['Kalah','Closed Lost','cancelled'].includes(d.status));
  if (matches.length===1) return { status:'matched' as const,candidates:matches,reason:'Verified same-request scope link.' };
  if (scoped.length) return { status:'ambiguous' as const,candidates:scoped,reason:'Quantity/date alone cannot verify scope; deal location and target period are unavailable.' };
  return { status:'unmatched' as const,candidates:[],reason:'No same-account expansion deal in supplied scope.' };
}
export function annualIncrement(quantity:number, rate:string, discountPercent:string) {
  if (!Number.isSafeInteger(quantity) || quantity<=0 || !new Money(rate).isFinite() || new Money(rate).isNegative() || !new Money(discountPercent).isFinite() || new Money(discountPercent).lt(0) || new Money(discountPercent).gt(100)) throw new Error('Invalid scenario inputs');
  return new Money(quantity).times(rate).times(12).times(new Money(1).minus(new Money(discountPercent).div(100))).toFixed(2);
}
export function contractTermsConsistent(outlets:number,rate:string,discountPercent:string,annualValue:string){
  return new Money(outlets).times(rate).times(12).times(new Money(1).minus(new Money(discountPercent).div(100))).toDecimalPlaces(2).eq(annualValue);
}
export function elapsedDays(start:string, asOf:string) {
  const days=(Date.parse(`${asOf}T00:00:00Z`)-Date.parse(`${start}T00:00:00Z`))/86400000;
  if (!Number.isInteger(days) || days<0) throw new Error('Invalid analysis date interval');
  return days;
}
export function responseType(text:string): 'acknowledgement'|'substantive_candidate'|'cancellation'|'unclear' {
  if (isCancellation(text)) return 'cancellation';
  // Delivery requires review of actual terms/schedule, not merely a promise to check.
  if (/nanti.*(?:cek|kabari)|saya cek|akan (?:kirim|siapkan)|will (?:send|prepare|check)/i.test(text)) return 'acknowledgement';
  if (/\b(?:mohon|minta|please|request)\b[^.!?]*(?:penawaran|quotation|quote|jadwal implementasi)/i.test(text)) return 'unclear';
  if (/penawaran.*(?:Rp|IDR|\d)|jadwal implementasi.*\d|quotation.*\d/i.test(text)) return 'substantive_candidate';
  if (/terima kasih|thank(?:s| you)|received/i.test(text)) return 'acknowledgement';
  return 'unclear';
}
export function isCancellation(text:string) {
  // Negated cancellations and a single cancelled feature are not rollout cancellation.
  return /\b(?:rencana|ekspansi|pembukaan|rollout|expansion|request|permintaan)\b[^.!?]*\b(?:batal|dibatalkan|cancelled|canceled)\b/i.test(text) && !/\b(?:tidak|belum|not|never)\s+(?:jadi\s+)?(?:batal|dibatalkan|cancelled|canceled)\b/i.test(text);
}

export type SignalMessage={id:string;externalId:string;eventDate:string;sender:string;body:string;parentId:string|null};
export type SignalGroup={origin:SignalMessage;details:SignalMessage;request:Request;dedupKey:string;status:'active'|'cancelled'|'unclear';chain:SignalMessage[]};
export function collectSignals(accountId:string,messages:SignalMessage[],eligible:(message:SignalMessage)=>boolean):SignalGroup[] {
  const groups:SignalGroup[]=[]; const byMessage=new Map<string,SignalGroup>();
  for(const message of messages) {
    const linked=message.parentId?byMessage.get(message.parentId):undefined;
    const request=extractRequest(message.body);
    const revision=/\b(?:revisi|ubah|diubah|koreksi|revise|revised|instead|change)\b/i.test(message.body);
    if(linked) {
      linked.chain.push(message);byMessage.set(message.id,linked);
      if(!eligible(message)||message.sender.toLowerCase()!==linked.origin.sender.toLowerCase())continue;
      if(isCancellation(message.body)){linked.status='cancelled';linked.details=message;continue;}
      if(revision){
        const amounts=[...message.body.matchAll(/\b(\d+)\s*(?:outlet|cabang|gerai|branches|stores)\b/gi)].map(m=>Number(m[1]));
        const quantity=amounts.length===1&&Number.isSafeInteger(amounts[0])&&amounts[0]>0?amounts[0]:null;
        linked.request={...linked.request,quantity,location:request?.location??linked.request.location,targetPeriod:request?.targetPeriod??linked.request.targetPeriod,
          kind:request?.kind==='quotation_request'?'quotation_request':linked.request.kind,
          requestedActions:[...new Set([...linked.request.requestedActions,...(request?.requestedActions??[])])]};
        linked.details=message;linked.status=quantity===null?'unclear':'active';
      }else if(request){
        // A changed scope without explicit revision may be another rollout. Retain ambiguity.
        if(JSON.stringify(request)!==JSON.stringify(linked.request)){linked.status='unclear';linked.request={...linked.request,quantity:null};linked.details=message;}
      }
      continue;
    }
    if(!request||!eligible(message))continue;
    const complete=request.quantity!==null&&request.location!==null&&request.targetPeriod!==null;
    const dedupKey=JSON.stringify([accountId,request.quantity,request.location,request.targetPeriod,...(complete?[]:[message.externalId])]);
    const repeated=groups.find(g=>g.dedupKey===dedupKey);
    if(repeated){repeated.chain.push(message);byMessage.set(message.id,repeated);continue;}
    const group:SignalGroup={origin:message,details:message,request,dedupKey,status:'active',chain:[message]};
    groups.push(group);byMessage.set(message.id,group);
  }
  return groups;
}
