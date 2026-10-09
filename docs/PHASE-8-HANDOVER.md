# Phase 8 review-packet correction (current)

This addendum supersedes the earlier review-label proposals, not their recorded
history. Starting code commit `a7ebced`; packet/held-out label freeze `8a40632`.
[Revised review table and decisions](PHASE-8-CASE-REVIEW.md).
Original v1 packet/table and review/model history remain preserved.

Implemented separation:

- Coverage refers to one identified reply (`reply_source_id`), with the existing
  four-choice status. Explicit S2 text is not_addressed for an S1 requirement;
  no conclusion is made about other communications. Assessors can select a reply;
  default selection is deterministic date/ID order, not evidence of within-day
  chronology. Existing scoped retrieval still excludes unrelated-decision material;
  it cannot claim a negative about a reply it did not retrieve. The S2 regression
  supplies that specific linked reply explicitly to the assessor.
- Fulfillment has independent evidence IDs, reason and status. Reference pointers
  can address broad requests but do not prove contents/delivery/suitability or
  acceptance. Only explicit narrow numeric-value requests have a deterministic
  established path here; that means provision of the value, not correctness.
- Next actions can prepare/obtain requirement evidence through the assigned AM and
  clarify with the requester while authority is unknown. No unsupported approver,
  joint meeting or intermediary route is inferred. Explicit authority withdrawal
  is distinct from purchase rejection in bilingual rule controls.

Contracts, coverage prompt (bounded-interpretation-v4), literal assessment
(requirement-assessment-v2-separated), stakeholder version (v1.7), service and UI
were updated. Jev may update coverage only; its choice never grants fulfillment or
customer acceptance. The TypeSafe skill and current
[Choice guidance](https://docs.typesafe.ai/primitives/choice) informed the single-
judgment prompt scope; no provider API or infrastructure changed.

## Corrected-packet results (provisional)

| Dimension | Revised 28-case packet | Eight frozen held-out cases |
| --- | --- | --- |
| Response coverage | 12/12; 16 not applicable | 8/8 |
| Fulfillment | 12/12; 16 not applicable | 8/8 |
| Next actions | 28/28 | 8/8 |

All 12 revised fulfillment results correctly remain insufficient_evidence. In the
held-out set two narrow numeric-value requirements are established and six remain
insufficient_evidence; none establishes customer acceptance. Non-requirement rows
are not counted as coverage/fulfillment successes. These are deterministic
regression/checklist matches, not measured live-model semantic accuracy.

The original eight development/20 acceptance split is retained; bilingual families
remain together. Acceptance-named cases ran only as provisional technical checks,
not approved acceptance. Eight fresh bilingual variants were frozen before execution
with SHA-256 `1c9fe7de0eae7f30996fe609a743692d699bcba72494799e86ac15138f489a6f`.
They were authored by the implementer and share some requirement categories with
existing cases, so they are not a statistically independent/blind generalization set.

First held-out report: `phase8-heldout-6c0726ce-af3a-429e-b451-2148b7fc928d.json`.
Later regression confirmation: `phase8-heldout-012ecdeb-a09f-4140-91c9-a2bd9282de3f.json`.
Both are under `artifacts/evaluations/`, with full inputs available in frozen fixtures.
The separate execution journal preserves both results. Labels did not change.
After first exposure, an explicit authority-withdrawal fix/control was added to meet
this request. It exposed a legacy test that used ambiguous purchase rejection wording;
that fixture was corrected to say authority was withdrawn. Neither change was driven
by a held-out failure. No tuning against held-out outcomes occurred.

## Commands and results

All database/browser checks use process flags false for QA_PLANNER_ENABLED,
QA_LIVE_ENABLED, QA_JEV_ENABLED and ANALYSIS_EXTRACTION_ENABLED. User `.env` unchanged.

- `npm run typecheck` and `npm run build`: passed. An initial string-array inference
  error was corrected before packet execution; final typecheck passed.
- `npm test`: 78/78 passed in seven files, 15.88 seconds; includes new 28-case checks, single-reply
  history, scope mismatch, unknown-authority preparation and bilingual authority tests.
  Intermediate run: 77/78 passed; the old ambiguous withdrawal fixture failed and
  was corrected as described above, not relabeled to hide a model error.
- `npm run data:diagnose -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340`:
  45 accounts, four statements, 30 decisions, zero unresolved; no provider calls.
- `API_PORT=3002 WEB_PORT=5174 PLAYWRIGHT_CHANNEL=msedge npm run test:e2e`
  (PowerShell process env): seven passed, 16.9 seconds, including the revised display.
- `npx tsx scripts/evaluate-phase8-review.ts`: 12/12, 12/12, 28/28;
  report `phase8-review-v2-401ad583-b947-45bf-9aac-5c40a2a571bc.json`.
- `npx tsx scripts/evaluate-phase8-review.ts --heldout`: first and repeat 8/8 in
  each dimension; repeated output is not an additional fresh holdout sample.
- `npx tsx apps/api/src/cli/phase8-review-report.ts`: revised 28 cases,
  independently reviewed=0, acceptance_eligible=false; all four capability decisions defer.

Provider calls/tokens/cost for this correction: **0 / 0 / USD 0**. No live inference
or new live-latency result. Historical live runs below predate the changed prompt;
they are not acceptance of the revised prompt. No extra live test budget was assumed.

## Open gates

Independent approval of revised and held-out labels; precise fulfillment criteria
(reference suitability, full schedule and numeric-provision meaning); approved finite
release checklist and adequacy; reviewed acceptance; live validation of the changed
coverage prompt. Recommend all agreed finite checks passing with zero leakage,
unsupported authority promotion or external actions, without calling this general
100% accuracy. Existing flags and defer decisions remain unchanged. Classifier
optimization, semantic retrieval and deployment are outside this correction.

---

# Phase 8 - final technical verification, human gates open

Continuation recorded 10 October 2026, starting from `70bd734`.
**Non-blocked fixes and technical verification completed; results provisional.**
No architecture/optimization phase was added. The previous handover is retained
below as historical evidence, not the final code state.

## Extraction root cause and fix

The historical report `phase8-9e453391-2131-406b-8370-f540e75ceef3.json` retained
input context but discarded invalid output and its validator error. Its exact raw
response cannot be recovered. A one-call replay of that exact synthetic context
saved the request/schema, raw DeepSeek response, parsed output and validator error
in `artifacts/evaluations/phase8-extraction-diagnostic.json`. This reproduced a
failure mechanism; it does not prove the discarded historical bytes were identical.

The source was exactly `I need custom procurement documentation for expansion S1.`
(57 JavaScript characters). DeepSeek returned the exact quote but `start:0,end:56`.
The error was `invalid_evidence_scope_or_span`; source ID, speaker and date matched.
It also labeled the document request EXPANSION_DETAILS. Provider response handling
successfully parsed the response; integer schema validation passed; source-span
validation correctly rejected the incorrect end offset.

The validator now calculates offsets only for a **unique verbatim quote in the
identified source field**. Absent, altered or ambiguous quotes still fail. Source,
identity, event date, employment, attribution, decision scope and review authority
checks remain. Raw output is preserved separately from the validated candidate.
The extraction prompt distinguishes requested evidence from quantity/location/period
expansion details. Prompt and stakeholder processing versions invalidate stale caches.
Additive migration `0005_concerned_veda.sql` records nullable model diagnostics;
no historical model/review/source rows are rewritten.

Final live extraction returned REQUESTS_EVIDENCE but again miscounted the end (52).
The exact source anchored it at 57. One valid candidate entered **pending_review**;
zero candidates were promoted. This is successful candidate extraction, unlike the
previous safe rejection. Semantic correctness still requires human review. The
regression uses the failed replay fixture, preserves raw offsets, rejects wrong
quotes/identity/source/speaker/date and ambiguous spans, and exercises review lifecycle.

## Planner adjudication

Original question: "What should we do next for the selected account?" Original
expected operation: account_diagnosis. Actual operation: stakeholder_guidance,
null deal/signal. No metric or periods were requested. The original adapter test
produced no final API answer, so no historical end-to-end success is invented.

Final simulated normal-path checks force each route on the same owner/intermediary
fixture. Both return 200, include operational preparation and joint discussion,
ROI/payback context, not_addressed assessment and evidence. Technical recommendation:
accept either route for this generic question **only when these required outputs
survive**. No original expectation was changed. Independent adjudication remains open.
No further routing change was necessary; existing request-preservation guards keep
metric/period comparisons on account_diagnosis and prevent invented decision scope.
Final live planner chose account_diagnosis with null metric/period/signal/deal.

## Final verification and commands

All customer-source checks ran locally with these process flags false:
`QA_PLANNER_ENABLED`, `QA_LIVE_ENABLED`, `QA_JEV_ENABLED`,
`ANALYSIS_EXTRACTION_ENABLED`. `.env` was unchanged. Snapshot dataset ID:
`93bb692a-2168-5ef3-a37d-8e929f9b6340` (analysis as of 1 October 2026).

| Command | Exact result |
| --- | --- |
| `npm run db:generate` / `npm run db:migrate` | Additive 0005 generated and applied; disposable tests also migrated from scratch |
| `npm run typecheck` | Root/API/web/contracts passed, final rerun passed |
| `npm test` | 48/48 tests, six files; final 16.90 s, includes disposable PostgreSQL integration |
| `npm run build` | API and Vite builds passed |
| `npm run data:diagnose -- --dataset <id>` | 45 accounts, 0 reused, 4 statements, 30 decisions, 0 unresolved decisions |
| `npm run data:verify-stakeholders -- --dataset <id> --fixture tests/fixtures/stakeholders-review.json` | C01 renewal/prerequisite, P01 new-sale/joint route, C02 expansion/prerequisite all verified |
| `API_PORT=3002 WEB_PORT=5174 PLAYWRIGHT_CHANNEL=msedge npm run test:e2e` (PowerShell process env) | Final 7/7 passed, 14.9 s |
| `API_PORT=3002 npx tsx apps/api/src/server.ts` then `npm run eval:qa -- --dataset <id>` | 26/26, zero missing expected evidence, zero invalid citations, zero calls; median 152 ms, p95 259 ms; isolated server stopped |
| `npx tsx apps/api/src/cli/phase8-review-report.ts` | 28 proposals, 0 independently reviewed, acceptance_eligible=false, quality_results=null |
| `npx tsx tests/phase8-extraction-repro.ts` | One diagnostic call before fix; reproduced invalid_evidence_scope_or_span |
| `npx tsx tests/phase8-live.ts --live` | Final four-call normal path passed; repeat 200 with zero new calls; fallback 200 with zero calls; candidate pending, not approved |
| `git diff --check` | Passed |

First browser run was 6/7: C01 loaded a stale diagnosis after the processing-version
change and could not show the question form. Rebuilding source diagnoses resolved
it; final full rerun passed. Original failure trace/context retained under
`artifacts/evaluations/phase8-stale-browser/`. Do not hide this initial failure.
Source Q&A report: `artifacts/evaluations/qa-e716dcf5-3ad3-4e92-9415-ae555147ebf4/report.json`.

Unit/DB provider-failure, retry, budget, corrupted-cache and authority acceptance/
rejection scenarios are **simulations**. Live provider outages and live human
acceptance were not exercised. Browser/source verification used deterministic
providers, not live customer text. The normal live test's pending review is a test
record, not an independent reviewer decision. Temporary synthetic DBs were removed
only after artifacts were saved; original application data/history remain intact.

## Final synthetic live usage

Report: `artifacts/evaluations/phase8-eb6356f0-cb6f-427a-b37c-429d669afda2.json`.
Includes exact synthetic request/response bodies without credentials, context,
source hashes, raw versus normalized output, diagnostic codes, calls and actions.
No supplied customer passage was transmitted. Budgets: two generation calls plus
two analysis calls; the separate diagnostic budget was one call.

| Operation | Physical calls | Input / output tokens | Latency | Estimated USD |
| --- | --- | --- | --- | --- |
| DeepSeek planner | 1 | 2501 / 29 | 772 ms | unknown |
| DeepSeek extraction | 1 | 1290 / 158 | 898 ms | unknown |
| Jev concern assessment | 1 | 1346 / 62 | 427 ms | 0.0000565320 |
| DeepSeek answer selection | 1 | 2630 / 33 | 608 ms | unknown |
| Separate pre-fix diagnostic replay | 1 | 1230 / 160 | not recorded | unknown |

The diagnostic helper now requires explicit `--live` and writes a unique filename
to prevent accidental calls or overwriting the preserved original diagnostic. This
report-only helper guard was added after the live run; no application code changed.

Final workflow totals: **4 physical calls, 7767 input / 282 output tokens**;
summed recorded model-call latency 2705 ms (not end-to-end request latency).
Continuation total including diagnostic: **5 calls, 8997 input / 442 output tokens**.
DeepSeek diagnostic usage reports 640 cached input tokens; charges remain unknown
because rates are unconfigured. Jev cost is an estimate from reported usage and
configured pinned-model rate, not an invoice. Total monetary cost is unknown.
Repeated request and disabled-provider fallback added zero physical calls.

Jev returned not_addressed for the feature-only follow-up to ROI/payback. The
answer selected validated fact IDs and retained ordered actions. Original raw
invalid responses are not counted as successful extraction. One live successful
candidate and one live judgment do not establish broader semantic quality.

## Review decisions and capability recommendations

The [28-row review table](PHASE-8-CASE-REVIEW.md) includes each actual question,
source passage, original judgment/operation/action, proposed correction and decision
needed. Original packet and reviewer fields remain unchanged. Machine-readable
technical notes are in `tests/fixtures/phase8-technical-review.json`; their author
is implementation-agent and independent_approval=false.

Decisions needed: correct unsupported action routes; clarify reference/schedule
sufficiency; separate approval withdrawal from authority; align bilingual conflict
cases; supply dated speaker metadata; move comparison question into the actual
question field; approve conditional generic-route equivalence and numerical gates.
Proposed gate remains 100% of the finite reviewed suite/per-label expectations,
zero cross-account leakage, unsupported authority promotion or external actions.
The reviewed acceptance set has **not** run and must wait for actual user approval.

| Capability | Recommendation | Remaining gate |
| --- | --- | --- |
| Planner | defer additional activation | Independent route/case/gate review; provisional alternate-route test passes |
| Jev assessments | defer | Four-choice semantic review; one live negative case is insufficient |
| Complex extraction | defer | Pending human semantic review, despite successful source-grounded candidate extraction |
| Grounded answer selection | defer additional activation | Reviewed answer/action expectations and finite-suite acceptance |

Existing user flags remain planner=true, answer=true, Jev=false, extraction=false;
these are user settings, not newly certified capability decisions. Deterministic
features remain usable. Rollback stays the existing disable/restart/rebuild procedure;
preserve model/review history. No classifier, semantic retrieval, deployment or new
infrastructure was added.

## Data-gap correction and changed files

Use existing CRM deals for recorded expansion/renewal activity, contracts for
contracted annual value, and daily usage for product transaction counts. They are
not interchangeable with recognized/collected revenue. Ask for extra history only
after selecting a metric and finding the requested dates/coverage unsupported.
Current Q&A executes only the labeled won-expansion CRM proxy comparison; other
period-comparison handlers are an implementation limitation, not absent CSV data.
See [metric-specific coverage](SOURCE-LIMITATIONS.md#metric-specific-coverage-clarification-phase-8).

Changed runtime: `ai/prompts/interpretation.ts`, `ai/schemas/interpretation.ts`,
`ai/router.ts`, `db/schema/index.ts`, migration 0005 plus metadata,
`modules/stakeholders/rules.ts` and `service.ts`.
Changed verification: `tests/providers.test.ts`, `tests/database.test.ts`,
`tests/phase8-live.ts`, new `tests/phase8-extraction-repro.ts`, failed-span fixture,
and separate technical-review fixture.
Changed documentation: this handover, baseline adjudication, case-review table,
SOURCE-LIMITATIONS, PRD-0x9, docs index and AGENTS status.
Final code commit is recorded in the completion message and Git history; no further
code changes are required before human review of the outstanding decisions.

---

# Historical handover before this continuation

Recorded 10 October 2026. **Validation infrastructure complete; review/live gates open.**
Starting commit: `1531af0073de5d0a262433b9f5aa570479108f2f`.
See [baseline/adjudication](PHASE-8-BASELINE.md) and
[review instructions](EXTRACTION-REVIEW.md).

## Implemented changes

- Request-preserving planner validation prevents a model route from bypassing a
  requested metric/period check or inventing a different decision scope/baseline.
  Bilingual regressions cover comparison inputs and invalid scope. The Phase 7
  ambiguous next-action smoke expectation is preserved; independent adjudication
  remains pending. Simulated normal-path stakeholder and diagnosis routes retain
  the required operational-preparation/joint-discussion actions.
- Extraction reviews now have append-only acceptance, rejection, pending and
  supersession history, reviewer/rationale, original model/context/source versions,
  optional corrections and deterministic validation. Only valid accepted model
  candidates enter stakeholder statements/actions. Generation alone cannot promote
  authority. Rejection/stale source removes current dependent authority and triggers
  scoped recomputation. Existing explicit deterministic source rules remain active.
- Cache identity includes question choices, source revisions, as-of and decision
  scope where provided, provider/model and processing versions. Rejected extraction
  runs are excluded from cache reuse. Disabled model runtimes now bypass previously
  successful model caches: disabling a feature restores its deterministic behavior.
- Normal-path test seams support independently enabled operations and combined
  operation with bounded simulated providers. Reused analyses report zero new calls
  in capability metadata; historical model runs retain original usage.
- Added isolated evaluation ports (`API_PORT`, `WEB_PORT`) so source/browser
  regression cannot accidentally use the user's live-enabled API.

## Storage and lifecycle

Additive migrations `0003_gigantic_tarot.sql` and
`0004_bent_young_avengers.sql` add `extraction_reviews` and nullable model input
context. Both were generated, applied locally and exercised in freshly migrated
test databases. There are 27 tables. No raw source rewrite/backfill is performed.
Pre-migration model candidates without captured source provenance cannot be
accepted; regenerate them. Original reviews/model runs are retained.

Stakeholder method is `stakeholder-rules-v1.5-reviewed`. Current diagnoses include a
review dependency hash. Review changes invalidate read models atomically; normal
Q&A or the review CLI rebuilds them. The CLI restores previously prepared scopes.
Source/identity/scope/contradiction checks run again before accepted claims enter
current diagnoses. A failed recomputation cannot leave revoked authority visible.

## Validation run

All supplied customer-source checks were local, with model features disabled in
the evaluation process. `.env` was not changed.

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | Root, API, web and contracts passed |
| `npm test` with four flags false | 47 tests, six files passed |
| Isolated Edge Playwright run, API 3002/web 5174, flags false | Seven browser journeys passed |
| `npm run build` | API and Vite build passed |
| `data:diagnose` on supplied snapshot, flags false | 45 accounts, four statements, 30 decisions, zero unresolved decisions |
| `data:verify-stakeholders` | C01 renewal/prerequisite, P01 new-sale/joint route, C02 expansion/prerequisite passed |
| `eval:qa`, isolated API 3002, flags false | 26/26 checks, zero missing expected evidence, zero invalid citations, zero calls |
| `phase8-review-report.ts` | 28 cases; zero independently reviewed; acceptance ineligible |

Failure injection independently covers planner, Jev requirement judgment,
extraction and answer selection: timeout, connection, retryable rate/server errors,
malformed output, unavailable configuration, bounded retries and exhausted budgets.
Each operation checks valid cache hits, corrupted cached output, source/as-of/scope
changes and disabled-cache behavior. Existing tests cover invalid choices/fact IDs,
model/prompt/schema/parameter key changes and cross-dataset boundaries. Failure
types are simulations, not claims that live outages were exercised.

Review tests demonstrate normal extraction → no authority before review → accepted
authority → rejection → baseline restoration → reacceptance → source-revision
invalidation. Repeated review/recompute is idempotent; stale review acceptance is
rejected. The simulated reviewer name denotes a test actor, not an independent human.
The complete/incomplete comparison fixtures use the explicitly labeled won-CRM-deal
proxy. Actual repeat-order/revenue ledger ingestion remains unavailable.

## Live normal-path compatibility

Command: `npx tsx tests/phase8-live.ts --live`, with process defaults disabled and
test-injected provider capabilities. Raw synthetic owner/intermediary records were
imported into a new local test database, migrated, analyzed and passed through the
normal `/api/qa` route. The test database/files were removed after saving an ignored
synthetic report. No supplied customer content was transmitted.

Report: `artifacts/evaluations/phase8-9e453391-2131-406b-8370-f540e75ceef3.json`.
The report retains exact synthetic inputs, source hashes, outputs, evidence IDs,
action claims, configuration and usage for independent review.

| Operation | Observed result | Input/output tokens | Latency | Estimated USD |
| --- | --- | --- | --- | --- |
| DeepSeek planner | account_diagnosis, valid scope | 2501 / 46 | 757 ms | unknown |
| DeepSeek extraction | invalid output rejected; candidate unresolved | 1229 / 164 | 1283 ms | unknown |
| Jev requirement | not_addressed, matching expected missing ROI | 1346 / 62 | 392 ms | 0.0000565320 |
| DeepSeek answer selection | valid fact selection, ordered action retained | 2625 / 60 | 672 ms | unknown |

Both API requests returned 200; first request used four physical calls, second
used zero new calls. The action gathered operational inputs through Y and proposed
the joint discussion. Invalid extraction did not promote a claim. The compatibility
tool's successful exit checks safe workflow/cache behavior; it is not an acceptance
pass for extraction. This observed invalid output is an additional reason to defer
extraction activation. It was not silently retried or relabeled as successful.
The four-call live run preceded the disabled-cache/review-rejection hardening;
those subsequent changes were verified with deterministic tests, not further live calls.

## Review set, gates and capability decision

`tests/fixtures/phase8-review.json`: 14 English and 14 Indonesian proposed cases,
eight development and 20 acceptance cases. Related bilingual families stay in the
same split. Each case has revision hash, allowed/forbidden evidence, proposed
judgment/action/operations, authorship and pending reviewer fields. The packet is
a review proposal, not certified ground truth or a demonstrated benchmark.

Proposed finite-suite gates require all reviewed task and per-label expectations
to pass, including zero tolerated cross-account leakage, unsupported authority
promotion and unauthorized external actions. These numerical gates require reviewer
approval and adequate cases before acceptance use. No model quality score or
generalization claim is reported. Independent review count is zero.

| Capability | Decision | Remaining reason |
| --- | --- | --- |
| `QA_PLANNER_ENABLED` | defer | Independent routing/alternate-plan adjudication and reviewed suite pending |
| `QA_JEV_ENABLED` | defer | One successful live case does not establish four-choice semantic quality |
| `ANALYSIS_EXTRACTION_ENABLED` | defer | Review lifecycle implemented; live invalid extraction; semantic labels pending |
| `QA_LIVE_ENABLED` | defer | Fact constraints work; independently reviewed normal-workflow quality still pending |

Actual user configuration at entry already enabled planner and answer generation;
Jev/extraction were false. This phase did not change those choices or declare them
accepted. No new normal-environment local trial was activated. DeepSeek rates are
unconfigured, so its monetary gate remains open. Budgets enforce physical calls
including retries; no cost-savings claim is made. Per-runtime budgets remain the
existing process-lifetime caps, not an unlimited per-request allowance.

## Rollback and remaining work

The tests exercise each capability separately, combined, then all disabled. Disabling
generation bypasses cached model outputs; disabling analysis providers restores the
baseline diagnosis configuration. Accepted human review history remains separate
from flags and must be explicitly revoked if desired.

For a local trial rollback, set the selected flags false, restart the local API and
run `data:diagnose -- --dataset <id>` under that same configuration. Preserve reviews,
model runs and source records. Additive tables/columns may remain on code rollback;
do not drop the database. Rebuild diagnoses under the chosen code version.

Next required work: independent review of packet labels, ambiguous planner route
and live report; approve/adjust gates; then run the reviewed acceptance set before
enabling further capabilities. Source cases remain local unless transmission is
explicitly authorized. Live failure paths and general semantic quality remain open.

Missing attachments and implicit/unlinked decisions remain unresolved. Real outcome
analysis needs stable event ID, account, event type/date, status and cancellation/
refund treatment, incremental quantity, amount/currency and verified coverage period.
Contracts/snapshots alone do not supply this history. Deployment/authentication is
a separate PRD. PRD-0x7 classifier and semantic-retrieval gates remain open.
