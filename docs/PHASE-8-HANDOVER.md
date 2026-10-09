# Phase 8 — validate and selectively enable the AI workflow

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
