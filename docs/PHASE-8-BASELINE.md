# Phase 8 baseline and planner adjudication

Starting commit: `1531af0073de5d0a262433b9f5aa570479108f2f`.
Inspection date: 10 October 2026. Dataset as-of remains 1 October 2026.
`PRD-0x9.md` was the only untracked file at entry.

Actual nonsecret configuration: planner=true, answer=true, Jev=false,
extraction=false; maximum two calls per runtime, 30-second timeout. These differ
from the Phase 7 defaults. Evaluation will not modify the user's `.env` and will
use synthetic live content only. Source regressions must disable live operations
in an isolated process.

## Planner discrepancy, before changing expectations

Saved synthetic run `1e10dcdf-1b64-4d58-b554-86ecf16feb86` used DeepSeek Flash,
`operation-planner-v1` / `operation-plan-v1`. Input hash:
`8af9b01f9941d47d8ecc3c365887e2f9f8df4e6cd33f43afde4652ccec4ff48a`.
Exact fixture question: “What should we do next for the selected account?”
Context: synthetic ROI/payback requirement; selected account, no signal/deal,
no metric or comparison requested. Saved output: stakeholder_guidance, with
both deal_id and signal_id null. Original expected label: account_diagnosis.

Implementer assessment (not independent review): this question has more than one
plausible operation label. Both routes load the same account diagnosis and retain
ordered proposed actions. Stakeholder guidance emphasizes roles; account diagnosis
also displays findings. The original adapter smoke did not produce an API answer,
so it cannot establish preserved end-to-end behavior. Keep its recorded mismatch.
Add normal-path tests comparing required actions and evidence before treating this
as an acceptable alternate. Independent adjudication remains pending; do not
retroactively change the Phase 7 smoke expectation.

A separate concrete defect exists: an alternative operation can bypass explicit
metric/period handling or alter selected decision scope. Add backend preservation
of these request requirements and reject unsupported scope/baseline changes.
This safeguard does not require changing the ambiguous original expected label.

## Initial coverage gaps

Phase 7 covers schema/fact rejection, selected router failures/cache hits, four
simulated Jev outputs, extraction failure and configuration restoration. It lacks
a uniform per-operation failure/retry/budget matrix, a persisted extraction review
lifecycle, independent semantic labels, reviewed thresholds and live normal-path
acceptance. Prior counts are historical until rerun. All capability acceptance
decisions therefore start at defer, regardless of the user's enabled local flags.
