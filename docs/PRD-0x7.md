# PRD-0x7 — Phase 6: Evaluate conditional optimization

Status: Assessment implemented; optimization deferred, reviewed/live gates open.
Optional after MVP. Dependency: PRD-0x6 and reviewed evaluation set.
Requirements: AGENTS.md Sections 3, 8, 11, 14 and 17.

## Goal

Determine whether routing or retrieval changes improve measured cost/latency while
preserving agreed evidence quality. Keeping the current implementation is valid.

## In scope and deliverables

- Benchmark rules-only and rules-plus-Jev on the same reviewed set. Report signal
  precision/recall by label, missed requests, extraction/support/authority errors,
  latency, call counts, usage and actual cost with sample sizes.
- Define numerical quality/recall gates with the reviewed set before rollout.
- Only if labeled volume supports it, evaluate multi-label TF-IDF/logistic regression
  with thread-aware splits, grouped near-duplicates and account/time holdouts.
  Select thresholds from evaluation, not demonstrations.
- If justified, implement trusted local offline batch predictions keyed by dataset,
  source record, content hash and model version. Validate before import; unmatched
  changed records continue through rules/Jev. Keep generated artifacts out of Git.
- Consider semantic retrieval only after graph/text-search misses are documented.
  Evaluate separately; do not expand infrastructure without a recorded scope decision.
- Produce a measured enable/defer decision, versioned configuration and rollback plan.

## Definition of done

- [x] Benchmark datasets, labels, splits, versions and sample sizes are documented.
- [ ] Cost/latency and quality comparisons use the same reviewed evaluation scope.
- [ ] Selected gates and thresholds have recorded rationale; no invented savings.
- [ ] Any enabled optimization passes the agreed recall/support gates and fallback checks.
- [ ] If a classifier is enabled, vectorizer/classifier and manifest capture labels,
  training-data hash, dependencies, thresholds and metrics; stale outputs are rejected.
- [x] Enable or defer decision records limitations and rollback; optional components
  are not declared necessary to complete the MVP.
- [x] Relevant checks and shared DoD are satisfied for the assessment tooling.

## Out of scope

Apriori, purchase-probability models, unreviewed labels, a Python HTTP service,
mandatory classifier training, personal performance rankings and causal closure claims.
Reference introductions and response-time analytics need separate scoped PRDs and
adequate evidence; they are not implicitly authorized by this optimization phase.

## Implemented assessment and pending gates

See [Phase 6 handover](PHASE-6-HANDOVER.md) and the
[review checklist](EVALUATION-REVIEW.md). The offline 25-case synthetic assessment
retains the baseline: 15/15 intent labels and 6/6 quantity/period cases match, but
Jev has no live answers and independent review is pending. Numerical gates remain
unset, rather than invented. Classifier/semantic retrieval are disabled; their
artifact and enabled-optimization checkboxes are not applicable until justified.
The reviewed/live comparison checkboxes remain open.
