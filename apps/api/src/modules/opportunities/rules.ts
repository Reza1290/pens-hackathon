import Decimal from 'decimal.js';
const Money=Decimal.clone({precision:40,rounding:Decimal.ROUND_HALF_UP});
export const RULE_VERSION = 'deterministic-expansion-v1.2';
export type Request = { quantity:number|null; location:string|null; targetPeriod:string|null; kind:'quotation_request'|'explicit_plan'; requestedActions:('quotation'|'implementation_schedule')[] };
export function extractRequest(text: string): Request | null {
  if (!/\b(berencana|rencana|akan (?:buka|membuka|tambah)|plan(?:ning)?|intend)\b/i.test(text) || /\b(tidak (?:jadi|berencana)|batal|cancelled|canceled|not planning)\b/i.test(text)) return null;
  if (!/\b(outlet|cabang|gerai|branches|stores)\b/i.test(text)) return null;
  const quantities=[...text.matchAll(/\b(\d+)\s*(?:outlet|cabang|gerai|branches|stores)\b/gi)].map(m=>Number(m[1]));
  const quantity=quantities.length===1 && quantities[0]>0 ? quantities[0] : null;
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
  if (/\b(batal|cancelled|canceled)\b/i.test(text)) return 'cancellation';
  // Delivery requires review of actual terms/schedule, not merely a promise to check.
  if (/nanti.*(?:cek|kabari)|terima kasih|saya cek|akan (?:kirim|siapkan)/i.test(text)) return 'acknowledgement';
  if (/penawaran.*(?:Rp|IDR|\d)|jadwal implementasi.*\d|quotation.*\d/i.test(text)) return 'substantive_candidate';
  return 'unclear';
}
