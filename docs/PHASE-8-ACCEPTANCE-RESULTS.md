# Phase 8 reviewed acceptance results

User approval: **"yes i approve"**, recorded against the concrete packet and ten-call
budget. Receipt: [committed acceptance record](PHASE-8-ACCEPTANCE-RECORD.json).
Executed application/test commit: **c7bb8a0892e5118ea3ddf39aacd3fcde82addac0**.
The following documentation commit does not change tested code or approved fixtures.
Approval is the user's review decision, not independently blind annotation or agent
self-approval. Original proposal fields, packet, frozen labels and previous reports
remain unchanged; the append-only receipt supersedes their historical pending status.
The legacy `phase8-review-report.ts` reads only proposal fields and will still report
pending; use this receipt/result for the current approval and execution decision.

## Results against the approved checklist

| Dimension | Passed | Failed | Not applicable |
| --- | --- | --- | --- |
| Deterministic response coverage | 20 | 0 | 16 |
| Deterministic fulfillment | 20 | 0 | 16 |
| Deterministic next actions | 36 | 0 | 0 |
| Unit/database normal workflow and safety regressions | 81 | 0 | 0 |
| Live Jev response coverage | 10 | 0 | 0 |

Deterministic fulfillment: 18 correct insufficient-evidence results and two narrow
numeric-value provision results, **zero established customer acceptance**. These
matches do not mean 20 customer requirements were fulfilled. No N/A counted as success.
Revised packet: 12/12 coverage and fulfillment, 28/28 actions. Previously exposed
held-out cases: 8/8 in each dimension. Full report retains the development/acceptance/
held-out split and individual expected/observed values; this is a finite checklist,
not general accuracy, population recall or a newly blind holdout.

Live per label: addressed 2/2, partially_addressed 2/2, not_addressed 4/4,
insufficient_evidence 2/2. English 5/5 and Indonesian 5/5. Wrong-decision and missing
attachment pairs matched. No malformed output, provider error, timeout or retry.
No labels/prompts/code were changed to obtain these results. No fixes or reruns needed.

## Exact execution and usage

Command (after writing the exact user approval to a separate receipt):

```powershell
npx tsx scripts/phase8-acceptance.ts --run --plan artifacts/evaluations/phase8-acceptance-plan-c7bb8a0.json --approval artifacts/evaluations/phase8-approval-user-c7bb8a0.json
```

Exit 0, passed=true. Nested `npm test`: eight files, 81 tests, 17.29 seconds.
The API/review/cache/fallback tests used simulated providers. Browser/type/build
results remain the previously recorded preparation checks, not rerun live results.
Node emitted DEP0190 for the fixed `npm test` child-process invocation on Windows;
this was a warning, not a test failure. No user-controlled shell arguments were used.

Report: `artifacts/evaluations/phase8-acceptance-51474c15-0061-49a7-9e3c-d107cb137ccd.json`.
Plan SHA-256: `f44e3da93ca18a13e5517daa70e7846ecb984c7ba03adcb22532cd33628aa184`.
Fixture and report hashes, exact approval, versions and timestamps are copied into
the committed record. Raw synthetic requests/responses remain in the local report;
no credentials or supplied customer passages were transmitted or committed.

Model `jev-1.13.0`, prompt `bounded-interpretation-v4`, schema
`interpretation-v2-four-choice`. Exactly **10 physical calls**, zero retries;
approved budget is exhausted and the run is claimed against accidental replay.
**14,108 input / 630 output tokens**, summed call latency **3,164 ms**,
range **277-485 ms**. Entire runner about 21.24 seconds including tests.
Estimated cost from reported usage: **USD 0.000592536** at $0.042/M input tokens,
free output. Exact billed amount/credits/taxes remain unknown. No DeepSeek calls.
No additional calls were requested or performed.

## Gate disposition and per-capability recommendation

Closed for the approved scope: user review of 36 labels and concrete fulfillment
rubric; finite-suite criteria; conditional planner-equivalence adjudication;
reviewed deterministic checklist; updated Jev four-choice synthetic prompt evaluation.
The original planner mismatch remains historical. The generic alternate route is
accepted only with required actions/evidence intact; metric questions still require
premise/period checks. No assumption of universal equivalence is added.

| Capability | Recommendation | Evidence and remaining limitation |
| --- | --- | --- |
| Jev coverage | defer flag activation pending current normal-path live check | Direct prompt evaluation passes 10/10; current-prompt normal API workflow was simulated, not live. Broader Jev intent/role/relevance quality is not tested by these ten calls. |
| Planner | defer additional activation; retain user's setting | User adjudication and simulated scope/metric/action regressions pass; no new reviewed live planner set was run. |
| Extraction | defer | Review lifecycle/safety regressions pass; prior live candidate success is historical and no candidate is approved by this packet. Broad extraction semantics remain unmeasured. |
| Grounded answer selection | defer additional activation; retain user's setting | Simulated citation/action/fallback checks pass; no new reviewed live answer-quality set was run. |

These are per-capability decisions, not a rejection of the successful finite run.
The remaining PRD normal-path reviewed-live gate stays open: the authorized evaluation
was direct Jev coverage, not all four live capabilities through the API. No further
live budget is assumed. No flags changed: user's planner/answer remain enabled;
Jev/extraction remain disabled. Production, classifier and semantic retrieval are
outside scope. Current deterministic features remain usable.

Rollback: no activation to undo in this run. For a future explicitly enabled local
trial, disable only the affected capability, restart the API, and rebuild diagnoses
under that configuration using `npm run data:diagnose -- --dataset <id>`. Preserve
sources, model runs and review records; revoke accepted claims explicitly if needed.
Disabling a provider does not erase accepted human review history. Existing tests
cover disabled-cache bypass and deterministic fallback; no deployment took place.
