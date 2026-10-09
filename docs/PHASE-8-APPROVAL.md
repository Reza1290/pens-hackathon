# Phase 8 approval packet - labels, checklist and synthetic live budget

**Decision requested: approve this concrete packet and its ten-call synthetic Jev
budget, or identify amendments. No approval has been recorded.** This is the existing
Phase 8. Original fixtures, failures and reports are retained. The final commit,
SHA-256 hashes and prompt/model pins are in the generated acceptance plan linked
in the completion message; approving a different plan requires an explicit amendment.

## Meaning of the three judgments

1. **Response coverage** concerns exactly the identified reply: addressed = it
   responds to the complete precise request; partially_addressed = some part is
   addressed; not_addressed = the visible reply does not address this requirement;
   insufficient_evidence = missing contents/scope prevent deciding coverage.
   A reference pointer engages with a broad reference request. An explicitly S2-only
   reply does not address S1. Neither judgment says what happened elsewhere.
2. **Fulfillment** is separate: established only for the narrow fact actually
   evidenced; insufficient_evidence when fulfillment cannot be determined;
   not_established reserved for affirmative evidence of non-fulfillment. Customer
   acceptance needs its own explicit, dated, scoped customer statement and is
   **not established in any case here**. Acknowledgment/pointer is not delivery proof.
3. **Next action** must have a supported task and responsible person. AM is the
   assigned internal account manager; X the documented customer requester, not an
   inferred approver. AM may prepare/obtain missing evidence and ask X to clarify
   needs while authority is unknown. No unproven approver, meeting or intermediary
   route is selected. All actions are proposed; no messages/CRM writes are authorized.

## Concrete fulfillment rubric (proposed for approval)

- **Reference suitability:** require visible reference identity, relevant product/use
  case and evidence matching the decision-maker's documented comparison criteria.
  Confirm an appropriate contact route/consent before any introduction. Merely saying
  "here is the reference" addresses a broad request but establishes neither contents,
  suitability nor customer acceptance. No unseen reference is certified here.
- **Schedule completeness:** a full schedule needs milestones/deliverables, responsible
  parties, dates (including completion), dependencies and material prerequisites.
  The rollout fixture explicitly asks only for a start date, so the given date addresses
  it. Do not reinterpret that as a complete schedule. Full-schedule fulfillment remains
  unproved without those details.
- **Numeric-value provision:** an explicit request for a numeric ROI/payback value is
  fulfilled as *data provision* when the correctly scoped value and requested unit are
  visible. This does not certify inputs, arithmetic, financial validity or acceptance.
  A request for an ROI business case requires supporting inputs/calculation evidence;
  a bare number cannot fulfill it. The two held-out established results use only the
  narrow data-provision meaning.

**Remaining semantic choices:** these three rubric boundaries are the decisions to
approve or amend. Recommended choices are exactly the definitions above. Clear scope,
attribution, cancellation-intent and authority-withdrawal corrections need no separate
technical permission. Approval still covers the unseen row labels; authoring them
has not made them independently reviewed.

## Cases to approve

Each row groups the paired English/Indonesian cases; both have the same proposed
outcomes. Full immutable identities/source IDs are in the linked fixture files.
Requests are from X on 2026-08-01; replies from AM on 2026-08-02, linked to the request,
account A/decision S1, as-of 2026-09-01, unless stated otherwise. X/Y employment begins
2025-01-01; AM is assigned to A. In reported cases Y is the speaker and X the subject;
in contradiction cases both statements are X's on the same date with ordering unknown;
role-change employment ends 2026-08-01. S2 is explicit in the wrong-decision reply.
Missing/comparison rows are dataset metadata, not invented customer messages.

`IE` = insufficient_evidence; `N/A` = no requirement/reply judgment, excluded from that
metric. All acceptance fields remain unknown. `Prepare` = AM prepares/obtains requested
evidence, may consult X and confirms authority. `Verify` = AM checks supplied values and
remaining needs with X. `Clarify` = AM clarifies current decision scope/authority;
cancellation intent remains distinct from confirmation.
No row selects an approver, joint meeting or intermediary. Generic contact/authority
rows are next-action checks, not a complete role-extraction/cancellation-state benchmark.

[Revised 28 cases](../tests/fixtures/phase8-review-v2.json) (eight development, 20
acceptance-named; all runs to date were provisional):

| Case IDs | Source request/statement (EN / ID) | Specific reply (EN / ID) | Coverage | Fulfillment | Supported next action |
| --- | --- | --- | --- | --- | --- |
| authority-en / authority-id | I am authorized to decide procurement for S1. / Saya berwenang memutuskan pengadaan S1. | (no supplied record) / (no supplied record) | N/A | N/A | Clarify |
| roi-en / roi-id | For S1 I require ROI and payback evidence. / Untuk S1 saya memerlukan bukti ROI dan payback. | For S1 here is ROI 20%. / Untuk S1 berikut ROI 20%. | partially_addressed | IE | Prepare |
| reference-en / reference-id | For S1 I require a reference. / Untuk S1 saya memerlukan referensi. | For S1 here is the requested reference. / Untuk S1 berikut referensi yang diminta. | addressed | IE | Prepare |
| pricing-en / pricing-id | For S1 I require pricing. / Untuk S1 saya memerlukan harga. | For S1 our product has stock controls. / Untuk S1 produk kami memiliki kontrol stok. | not_addressed | IE | Prepare |
| rollout-en / rollout-id | For S1 I require an implementation start date. / Untuk S1 saya memerlukan tanggal mulai implementasi. | For S1 here is the implementation start date: 12 October 2026. / Untuk S1 berikut tanggal mulai implementasi: 12 Oktober 2026. | addressed | IE | Prepare |
| integration-en / integration-id | For S1 I require integration status and remaining defects. / Untuk S1 saya memerlukan status integrasi dan cacat yang tersisa. | For S1 integration status is in the unavailable attachment. / Untuk S1 status integrasi ada di lampiran yang tidak tersedia. | insufficient_evidence | IE | Prepare |
| negation-en / negation-id | I am no longer authorized to approve purchases for S1. This is an authority withdrawal, not a purchase rejection. / Saya tidak lagi berwenang menyetujui pembelian untuk S1. Ini pencabutan wewenang, bukan penolakan pembelian. | (no supplied record) / (no supplied record) | N/A | N/A | Clarify |
| cancellation-en / cancellation-id | Please cancel the S1 expansion request; cancellation has not been confirmed. / Mohon batalkan permintaan ekspansi S1; pembatalan belum dikonfirmasi. | (no supplied record) / (no supplied record) | N/A | N/A | Clarify (AM); cancellation intent is not confirmation. |
| reported-en / reported-id | Y reports: X decides procurement for S1 and requires ROI. / Y melaporkan: X memutuskan pengadaan S1 dan memerlukan ROI. | (no supplied record) / (no supplied record) | N/A | N/A | Clarify |
| contradiction-en / contradiction-id | I am authorized to approve procurement for S1. / Saya berwenang menyetujui pengadaan S1. | I am not authorized to approve procurement for S1. / Saya tidak berwenang menyetujui pengadaan S1. | N/A | N/A | Clarify |
| role_change-en / role_change-id | My employment with Account A ended on 1 August 2026. / Pekerjaan saya di Akun A berakhir pada 1 Agustus 2026. | (no supplied record) / (no supplied record) | N/A | N/A | Clarify |
| wrong_decision-en / wrong_decision-id | For S1 I require ROI. / Untuk S1 saya memerlukan ROI. | For S2 here is ROI 20%. / Untuk S2 berikut ROI 20%. | not_addressed | IE | Prepare |
| missing-en / missing-id | Dataset metadata: no requirement/reply records in supplied scope. | No record; no claim about activity outside the snapshot. | N/A | N/A | Clarify |
| comparison-en / comparison-id | User query: Why are repeat orders lower? / Mengapa pesanan ulang turun? | Metadata: metric and comparison periods unselected; no source record. | N/A | N/A | AM clarifies metric/baseline/periods; no decline assumed. |

[Eight frozen cases](../tests/fixtures/phase8-heldout-v1.json), four bilingual families
kept together. Frozen in `8a40632`; already exposed to deterministic regression, not a
new blind benchmark. Labels are unchanged; prior runs and later authority-control
changes are disclosed in the [execution journal](../tests/fixtures/phase8-heldout-runs.json).

| Case IDs | Source request (EN / ID) | Specific reply (EN / ID) | Coverage | Fulfillment | Supported next action |
| --- | --- | --- | --- | --- | --- |
| holdout_roi_number-en / holdout_roi_number-id | For S1 I require a numeric ROI value. / Untuk S1 saya memerlukan angka ROI. | For S1 here is ROI 17%. / Untuk S1 berikut ROI 17%. | addressed | established | Verify |
| holdout_payback_pending-en / holdout_payback_pending-id | For S1 I require payback evidence. / Untuk S1 saya memerlukan bukti payback. | For S1 I will prepare payback evidence next week. / Untuk S1 saya akan siapkan bukti payback minggu depan. | partially_addressed | IE | Prepare |
| holdout_reference_pointer-en / holdout_reference_pointer-id | For S1 I require a reference. / Untuk S1 saya memerlukan referensi. | For S1 here is the requested reference in the attachment. / Untuk S1 berikut referensi yang diminta dalam lampiran. | addressed | IE | Prepare |
| holdout_pricing_noise-en / holdout_pricing_noise-id | For S1 I require pricing. / Untuk S1 saya memerlukan harga. | For S1 here is the implementation schedule: 15 October 2026. / Untuk S1 berikut jadwal implementasi: 15 Oktober 2026. | not_addressed | IE | Prepare |

## Finite release checklist and planner adjudication

Proposed pass criteria, subject to this approval:

- Match **all 20 applicable coverage, 20 fulfillment and 36 next-action expectations**;
  16 non-requirement rows are excluded from coverage/fulfillment denominators.
  Report development (8), acceptance-named (20) and exposed-held-out (8) separately.
  An IE expectation is a successful abstention check, not a fulfilled requirement.
- Existing unit/database normal-workflow and safety regressions pass: no cross-account
  leakage, unsupported authority promotion, unreviewed extraction promotion or external
  action. Include review acceptance/revocation, cache invalidation, unavailable-provider
  fallback and preserved metric/period checks. Browser/type/build preparation checks
  are recorded separately and are rerun if affected by fixes.
- Live Jev must match **10/10 labels**, including each choice and both languages;
  report per-choice/per-language counts, abstentions, malformed outputs/timeouts and
  wrong-decision errors. No missing/failed call counts as a match. No confidence
  cutoff is invented; this checklist does not establish population accuracy or recall.
- For "What should we do next for the selected account?", account_diagnosis and
  stakeholder_guidance are conditionally equivalent only when both retain the scoped
  owner/contact actions, operational preparation/joint discussion where evidenced,
  ROI/payback requirements and source citations. Preserve the original recorded label
  mismatch; approval adjudicates the alternative, not a retroactive historical pass.
  Metric/period questions still require account_diagnosis with premise checks; explicit
  scope or a requested full diagnosis must not be discarded by an alternative route.

## Synthetic-only live evaluation and budget

Model: **jev-1.13.0**; prompt **bounded-interpretation-v4**; schema
**interpretation-v2-four-choice**. Use the existing provider adapter and strict output
validation; send only the two synthetic source records, candidate identities and scope/
attachment metadata. Expected labels, approval text and customer data are never sent.
This is direct coverage-prompt evaluation, not live planner/extraction/answer acceptance.
The unavailable-attachment cases exercise prompt abstention directly even where the
normal service skips model interpretation; its existing retrieval/abstention guards stay.

| Live pair (both languages) | Expected coverage | Purpose |
| --- | --- | --- |
| reference | addressed | Broad request and visible pointer, fulfillment unproven |
| roi | partially_addressed | ROI supplied, payback absent |
| pricing | not_addressed | Feature-only reply |
| wrong_decision | not_addressed | Clear S2 reply versus S1 requirement |
| integration | insufficient_evidence | Requested details in unavailable attachment |

**Hard cap: ten physical calls total, one per case; zero automatic retries.**
30-second timeout per call; maximum request body 12,000 UTF-8 bytes. Persist call
reservation before transport; an exclusive approval claim prevents accidentally
re-running the same budget. Interrupted calls consume their reserved allowance.
No new generative-model calls. A later additional live run needs an explicit budget
amendment; failed labels must not be retried until one happens to match.

Estimate: ten calls x 2,000 input tokens x $0.042 / 1,000,000 = **$0.00084**.
Input tokens are estimated, not premeasured. Output tokens are free at the published
[Jev pricing](https://docs.typesafe.ai/models). Actual token usage/latency and estimated
usage-based charges will be reported; exact bill, credits/taxes and any unreported
failed-call usage are unknown. This is a call cap, not a guaranteed invoice amount.

## Execution record, limits and rollback

`npx tsx scripts/phase8-acceptance.ts --prepare` produces a unique plan pinned to a
clean final commit, this packet hash, all fixture hashes and prompt/model versions.
The prepare path cannot invoke a provider. After your explicit approval, record the
actual user response in a separate approval receipt bound to that plan; do not change
historical reviewer fields or invent another reviewer. User review is independent of
the implementer, not a claim of a second external blind annotator.

Then run `--run --plan <plan> --approval <receipt>`: validate all pins and approval,
run the deterministic cases and normal API/safety unit/database regressions, then the
bounded live coverage evaluation. Reports are unique, save each result and raw synthetic
response without credentials, and retain failures. Interrupted runs keep partial reports.
No reviewed acceptance or live call is run until approval. Fixes preserve failed reports;
record the new commit/version and affected checks, without relabeling the approved cases.
Any changed labels, criteria or extra live budget require an explicit amendment.

Until the run completes all four capability recommendations remain defer. Afterwards
assess each independently: coverage results may support a limited Jev trial recommendation;
planner/answer/extraction require their own normal-workflow evidence and any remaining
live gaps stay explicit. Passing this packet does not automatically enable flags or
certify broader extraction, fulfillment, role interpretation or generative model quality.

Current flags stay unchanged (planner/answer enabled by the user, Jev/extraction disabled).
No customer-data transmission is authorized. On a future explicitly enabled local trial,
rollback is disable the affected flag, restart, and rebuild diagnoses under that config;
retain sources, model runs and review history. Accepted claims require explicit revocation
rather than deleting history. No classifier, semantic retrieval or deployment is included.
