# Phase 6 handover — optimization assessment

PRD-0x7 assessment tooling is implemented. Decision: **defer optimization and retain
the existing baseline**. Reviewed-set/live comparison gates remain open; this
phase does not claim that the full MVP or its model evaluation is complete.

## Completed behavior

`npm run eval -- --dataset <uuid>` now writes three ignored artifacts:

- `report.json`: rules-only, Jev-only and rules-plus-Jev with rules fallback on
  exactly the same case IDs. Per-label support, precision, full-scope recall,
  unanswered counts and missed-request IDs are explicit. Unanswered positives
  stay in the denominator. Provider-only results are no longer mislabeled as
  rules-plus-Jev.
- `optimization.json`: versioned policy, dataset/snapshot, rule/prompt/model versions,
  evaluation content/label hash, same-scope comparisons, measured physical calls,
  cache hits, known token usage/cost and unknown-usage counts, timings, deferral
  reasons and rollback. No savings percentage is invented. Unreviewed claim-support
  and authority-error metrics remain null, rather than zero.
- `label-review.json`: the synthetic passages and proposed labels with empty
  reviewed-label, reviewer, source-support, thread and duplicate-group fields.
  This is a review packet, not an approved dataset or a training set.

Policy `config/optimization.json` records current routing/retrieval and keeps
classifier/semantic retrieval disabled. All numerical gates remain null because
none have been agreed on a reviewed set. The assessment validates this policy;
it is not a hot-switch configuration or an automated promotion mechanism.
Changing the policy to enable an optional component is rejected.

The comparison evaluator is in `modules/evaluation/optimization.ts`; the CLI is
`cli/eval.ts`. Three focused tests cover unanswered-positive recall, identical
comparison scopes with fallback, duplicate-case rejection and fail-closed deferral.
No dependency, schema, application behavior or trained artifact was added.

## Actual local results

Run: `artifacts/evaluations/a6f60e2a-e1e2-4269-b3d2-472c0e9f147a/` (ignored).
Dataset: `kasirnusa-2026-10-01`, as of 2026-10-01.

| Measurement | Result and scope |
| --- | --- |
| Synthetic evaluation cases | 25 across intent, role, relevance and concern-addressed |
| Rules intent | 15 answered, 15 correct against assistant-curated labels |
| Buying-request labels | Three quotation requests and three explicit plans; no misses on these six fixtures |
| Quantity / target-period extraction | Six cases, six correct for each field |
| Jev | Zero answers; all 25 unavailable in the offline run |
| Physical calls / new input or output tokens | Zero |
| Known estimated call cost | USD 0 for this no-call run |
| Live benefit, savings, semantic support, authority errors | Not measured |

This set uses **evaluation only**, with no training split. Thread/time/account
holdouts and near-duplicate grouping are unreviewed/not available for these
synthetic cases. No classifier may be trained from this packet as if those checks
had already been completed. All displayed precision/recall describes this small
synthetic regression set, not real-data generalization.

Rules timing measures local rule execution; provider timing includes DB/cache
accounting. Offline provider timing is not model inference latency, and there is
no quality/cost improvement comparison to publish. Per-response retry usage/cost
stays unknown when earlier attempts cannot be totaled; cache hits count zero new
calls/tokens/cost. Historical cumulative usage is separately labeled in the report.

Validation: typecheck passed, all **32 Vitest tests** passed, API/frontend build
passed, and the offline evaluator successfully generated the decision/review
packet. No browser behavior changed, so the already passing Phase 5 browser
journeys were not rerun for this evaluation-only change.

## Decision, rollback and next concrete task

Keep rules, PostgreSQL graph/text retrieval and explicit model opt-in. Do not add
TF-IDF/logistic regression, semantic retrieval or another service/database yet.
The 26 Phase 5 showcased Q&A regressions had no missing expected references;
that is not a representative retrieval-miss benchmark justifying embeddings.

Rollback is retaining this committed baseline. `QA_LIVE_ENABLED=false` disables
new Q&A model calls; CLI inference requires its separate explicit `--live` option.
No model predictions are promoted into source records, opportunities or diagnoses.

Next concrete task: follow [Evaluation review checklist](EVALUATION-REVIEW.md),
review source-grounded labels and claim support, agree numerical recall/support/
authority gates and configure a versioned provider for an explicit live benchmark.
The review packet is not automatically consumed as approved input. A reviewed
set requires a versioned manifest and an audited ingestion path before promotion.
Phase 2/5 human/live gates remain open. Optional optimization is not required to
finish the core MVP.
