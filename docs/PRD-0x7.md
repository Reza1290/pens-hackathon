# PRD-0x7 — Phase 6: Evaluate conditional optimization

Status: Planned, optional after MVP. Dependency: PRD-0x6 and reviewed evaluation set.
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

- [ ] Benchmark datasets, labels, splits, versions and sample sizes are documented.
- [ ] Cost/latency and quality comparisons use the same reviewed evaluation scope.
- [ ] Selected gates and thresholds have recorded rationale; no invented savings.
- [ ] Any enabled optimization passes the agreed recall/support gates and fallback checks.
- [ ] If a classifier is enabled, vectorizer/classifier and manifest capture labels,
  training-data hash, dependencies, thresholds and metrics; stale outputs are rejected.
- [ ] Enable or defer decision records limitations and rollback; optional components
  are not declared necessary to complete the MVP.
- [ ] Relevant checks and shared DoD are satisfied.

## Out of scope

Apriori, purchase-probability models, unreviewed labels, a Python HTTP service,
mandatory classifier training, personal performance rankings and causal closure claims.
Reference introductions and response-time analytics need separate scoped PRDs and
adequate evidence; they are not implicitly authorized by this optimization phase.
