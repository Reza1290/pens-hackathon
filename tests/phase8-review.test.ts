import { readFileSync } from 'node:fs';
import { describe,it,expect } from 'vitest';
import { evaluateCase } from './helpers/phase8-evaluation.js';
const packet=JSON.parse(readFileSync(new URL('./fixtures/phase8-review-v2.json',import.meta.url),'utf8'));
describe('Phase 8 corrected review packet (provisional, no live calls)',()=>{
  for(const c of packet.cases)it(c.id,()=>{const result=evaluateCase(c);expect(Object.values(result.checks)).not.toContain(false);});
});
