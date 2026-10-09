# PRD-0x9 — Phase 8: Validate and selectively enable the AI workflow

Status: Validation infrastructure complete; review/live gates open. See [Phase 8 handover](PHASE-8-HANDOVER.md).

Dependency: PRD-0x8 / Phase 7 integration and its handover recorded 10 October 2026. PRD-0x7 optimization remains deferred; classifier and semantic-retrieval gates are not prerequisites for this phase.

Requirements: AGENTS.md evidence, scope, model-routing, evaluation and stakeholder-guidance contracts; verify current repository section numbers before editing.

## Goal

Establish which existing AI capabilities are reliable enough to enable for the local stakeholder-guidance workflow. Resolve specific defects, provide a traceable path from extracted candidate to accepted evidence, and record a per-capability enable/defer decision backed by reviewed normal-workflow tests.

This phase completes validation and controlled activation, not a rewrite of the application. It does not promise general accuracy, cost savings or production readiness.

## Starting point

The supplied Phase 7 handover reports:

- Complete local owner-X/intermediary-Y ingestion-to-answer/draft behavior, including negative cases.
- Connected retrieval with explicit links and bounded coverage, four requirement-assessment outcomes, scoped stakeholder routes, historical precedents, deterministic premise checks and source-bound answers.
- 43 tests, seven browser journeys and 26/26 source regression checks previously passed. These are reported historical results, not reruns performed for this PRD.
- Four synthetic live calls: requirement assessment, extraction and answer selection matched expectations; the planner returned stakeholder guidance where account diagnosis was expected.
- All four capability flags default false. Complex extractions remain unresolved candidates until semantic review. Generated answers select existing fact IDs rather than inventing new prose claims.

The implementing agent must inspect the current code, configuration and handovers and record the actual starting commit. The prior handover's baseline commit is not assumed to be current HEAD. Keep historical source analysis as of 1 October 2026 unless a verified newer dataset is selected.

## Work order and deliverables

### 1. Adjudicate the planner discrepancy before changing routing

Inspect the exact smoke question, selected account/context, expected operation, actual plan, arguments and resulting evidence/answer.

- Decide whether this is an implementation defect, ambiguous expected label, or an acceptable alternate route. Compare the user's requested information and required checks, not only operation names.
- An alternate stakeholder route is acceptable only if it preserves required premise checks, evidence and answer scope. It is not acceptable if it skips a requested metric comparison or account diagnosis.
- Record reviewer rationale before changing the expectation. Never relabel the test solely to make the existing output pass.
- If defective, repair the operation descriptions, planner schema/prompt or deterministic validation/fallback. Add regression cases for Indonesian/English paraphrases, ambiguous questions and comparison periods.
- Separate required clarifications from valid alternate plans. Reject account, scope, date or metric changes not justified by the question/context.

Deliverable: planner adjudication record, minimal fix if needed, and rerun regression results.

### 2. Create a reviewed semantic evaluation set

Use the existing synthetic fixtures and verified source cases as starting material. Add held-out variants covering authority, ROI, references, pricing, rollout, integration, negation, cancellations, reported speech, contradictions, role changes, partial replies, unrelated replies and missing evidence.

For each case record:

- Dataset/source revision, language, account/decision scope, question and allowed context.
- Required evidence, unacceptable cross-scope evidence, accepted answer/judgment and supporting passages.
- Acceptable operation(s), required clarification/abstention, and expected action route.
- Author, reviewer, review status and adjudicated disagreements.

Keep related threads and near-duplicates in the same split. Separate development/tuning cases from acceptance cases; report per-language and per-label sample sizes. Model-generated labels are proposals until reviewed. Do not describe the implementing agent's own self-check as independent human review.

Before final acceptance runs, record numerical gates and their rationale with the reviewed set. Measure planner task success, per-choice requirement assessment, unsupported extractions, authority/scope errors, justified abstention and action correctness. Set zero tolerated occurrences in the acceptance suite for cross-account evidence leakage, unsupported authority promotion and unauthorized external actions; finite-suite success does not prove zero production error.

If reviewers or adequate examples are unavailable, prepare the review package and mark the quality gate open. Do not invent approval or numerical quality results.

### 3. Make extraction review operational

Retain complex extraction as a candidate until evidence support and commercial scope have been checked. Exact text-span matching is necessary for quoted text but does not prove the interpretation.

Implement the smallest review workflow that allows a reviewer to:

- Inspect candidate claim, original passage, holder/speaker, attribution, dates, proposed scope and conflicts.
- Accept, reject or leave unresolved; corrections create a traceable revision.
- Record reviewer identity, rationale and reviewed source/model/schema versions.

Use states such as `pending_review`, `accepted`, `rejected` and `superseded`, mapped to existing schema where practical. Accepted candidates may affect authority or actions only after deterministic identity, date, scope and contradiction validation. Ambiguous decision scope remains unresolved even when the wording is understood.

Only accepted, current claims enter the authoritative action read model. Source changes or material claim corrections invalidate the relevant acceptance/cache and trigger scoped recomputation. Rejection or supersession removes dependent claims from current recommendations while retaining history. Repeated review/recompute must be idempotent.

A local CLI or minimal UI is sufficient; building a separate review product is out of scope. Unattended promotion of high-impact authority/commitment claims is not a prerequisite for this phase. Any future auto-accept policy needs separately reviewed evidence and a documented gate, not just model confidence.

Deliverable: one complex extraction demonstrated through candidate → review → accepted/rejected result → updated diagnosis, plus invalidation and no-review behavior.

### 4. Verify failures, cache boundaries and budgets per operation

Cover planner, Jev requirement judgment, complex extraction and answer/fact selection independently.

| Area | Required checks |
| --- | --- |
| Provider response | Timeout, connection failure, rate limit/server error, malformed output, invalid choices/fact IDs and exhausted bounded retries |
| Cache | Valid hit; invalidation by changed source, account/decision scope, as-of date, choices, prompt/schema/model version; rejected/stale results never reused |
| Budget | Physical calls including retries remain within the configured operation/request limits; defined input/output limits; cache hits do not report new provider calls |
| Persistence | Partial failures cannot silently overwrite a valid diagnosis or promote unresolved claims; retries/review are idempotent |
| Fallback | Clear deterministic result, clarification or explicit unavailable outcome; never manufacture an AI assessment |
| Configuration | Each flag works independently; disabling a feature restores the correct baseline configuration/read model |

Use deterministic provider simulators for repeatable failure injection; do not deliberately overload a live provider to manufacture errors. Run a bounded live compatibility check with synthetic content when credentials are available. Distinguish injected failures from failures actually observed live. Do not claim an unexercised live failure path was verified.

Record unknown costs as unknown. Token/call budgets can be enforced without prices; a monetary-cost gate remains unresolved until applicable rates are verified and configured.

### 5. Exercise the normal workflow with providers

Adapter-only smoke checks are insufficient. Run the reviewed scenarios through the normal analysis/API/UI path with individual features enabled in an isolated test configuration, then together within the existing budgets.

Mandatory demonstrations:

1. Owner X / intermediary Y: retrieve related messages, assess missing ROI evidence, prepare through Y and propose the joint discussion.
2. Partial, complete, wrong-decision and missing-attachment variants: preserve attribution and choose the appropriate assessment or abstention.
3. A complex extraction that remains unresolved before review and affects the diagnosis only after valid acceptance.
4. Repeat-order question with complete synthetic history versus inadequate history: calculate only supported comparisons; no fabricated decline.
5. Provider-unavailable and stale-cache scenarios: preserve deterministic behavior and show degraded capability accurately.

Use synthetic content for live provider acceptance unless transmission of actual customer records is explicitly authorized. Source-case regressions can remain local or use provider simulators; report the distinction. Never include credentials in fixtures or logs.

Record expected/observed operation, retrieved evidence IDs, judgments, accepted claims, answer/action, physical calls, tokens, latency, cache behavior and known/unknown costs. Retain the run configuration and source hashes. A second identical request should demonstrate valid cache reuse where designed.

### 6. Selectively enable capabilities and document rollback

Produce a decision for each existing flag:

| Flag | Acceptance focus |
| --- | --- |
| `QA_PLANNER_ENABLED` | Reviewed routing/clarification behavior, valid arguments and fallback |
| `QA_JEV_ENABLED` | Four-choice semantic assessment, abstention and scope |
| `ANALYSIS_EXTRACTION_ENABLED` | Candidate generation, review lifecycle and no unreviewed authority promotion |
| `QA_LIVE_ENABLED` | Valid fact selection, preserved evidence bindings and output fallback |

Inspect exact flag behavior in current code before using this mapping; document dependencies. Passing one capability does not enable all four. Use `enable_for_local_trial`, `defer` or `blocked`, with evidence and remaining limitations. Keep defaults conservative and do not silently alter the user's normal environment during evaluation.

If a local trial is activated, record selected flags, dataset, source-transmission scope and run budgets. Validate the rollback sequence: disable selected flags, restart and rebuild/restore the corresponding diagnosis configuration. Preserve original data, accepted-review history and previous model runs.

Deliverables: PHASE-8-HANDOVER.md, reviewed evaluation results, capability decision matrix, actual commands/results and updated AGENTS.md/PRD status. Do not close PRD-0x7 optimization gates merely because Phase 8 integration checks pass.

## Data limitations and deferred work

Keep these visible, but do not block all local validation on solving them:

- **Missing attachments:** require actual document bytes and a future ingestion/linking scope. Until then expose the gap and abstain when necessary.
- **Unlinked communications:** current explicit-link retrieval cannot reliably assign every message to a decision. Preserve unresolved scope; propose broader matching separately after reviewing real misses.
- **Repeat-order/revenue history:** complete event data is needed for real decline claims. Document required fields: stable transaction/event ID, account, event type, event date, status/cancellation/refund treatment, incremental quantity, amount/currency and coverage period. Contracts and snapshots alone are not automatically a transaction ledger. Test with synthetic complete/incomplete examples; do not manufacture customer history. (Use existing CRM deal history, contract records, and daily usage first. Define the requested metric and validate its dates, meaning, and coverage. Report comparisons as recorded deal activity, contracted value, or product usage, as appropriate. Request additional history only when the available data cannot support the specific claim.)
- **Production deployment/authentication:** separate deployment PRD; this phase remains a local workspace.
- **TF-IDF/logistic regression and semantic retrieval:** remain deferred under PRD-0x7 until their own quality/cost evidence justifies them.

## Definition of done

- [x] Current starting commit, flags and actual capabilities are documented.
- [ ] Planner discrepancy has a reviewed adjudication and any necessary fix/regression coverage.
- [ ] Evaluation cases, independent review, splits, sample sizes and predeclared numerical gates are recorded.
- [x] Extraction candidate review, acceptance/rejection, invalidation and scoped recomputation work without granting unverified authority.
- [x] Failure/cache/budget matrix covers each operation, with simulated versus live evidence labeled.
- [ ] Normal-path reviewed live scenarios pass the agreed gates for each capability proposed for activation.
- [x] Deterministic regressions and relevant database/browser tests are rerun and exact results recorded.
- [x] Token/call/latency results are recorded; monetary cost is known where rates are configured and explicitly unknown otherwise.
- [x] Per-capability enable/defer decisions and rollback results are documented.
- [x] AGENTS.md and handovers distinguish implemented, simulated-tested, live-tested, independently reviewed and enabled states.
- [x] Missing-data and production limitations remain explicit; PRD-0x7 gates are not closed without their own evidence.

If independent review or provider access is unavailable, finish the review tooling, deterministic tests and review package. Report “validation infrastructure complete; review/live gates open.” Do not declare the phase or all AI capabilities fully accepted.

## Out of scope

Rebuilding the graph, changing the FE/BE stack, unrestricted text-to-SQL, free-form generation merely for appearance, broad unlinked-message matching, attachment ingestion, production authentication/deployment, autonomous messaging/CRM writes, purchase-probability models, mandatory classifier training and causal explanations unsupported by evidence.

## First concrete task

Reproduce and review the planner mismatch using its saved input/output and current routing contracts. Determine whether it lost required behavior before changing either the prompt or test expectation. In the same baseline report, enumerate which of the four capability operations still lack failure/cache/budget checks. That report determines the smallest implementation fixes for the rest of this phase.
