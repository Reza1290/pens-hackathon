# Phase 8 revised review packet (v2)

Status: **provisional; no independent labels or acceptance thresholds approved**.
This corrects Phase 8. It introduces no architecture or optimization phase.
Original [v1 review table](PHASE-8-CASE-REVIEW-v1.md),
[original fixture](../tests/fixtures/phase8-review.json), technical-review notes,
model runs and review history are preserved. The [v2 fixture](../tests/fixtures/phase8-review-v2.json)
links every original case ID/expectation/source hash and records the revision reason.

## Three separate judgments

- **Response coverage**: the identified reply addresses all, some, none, or an
  indeterminable amount of the precise request: addressed / partially_addressed /
  not_addressed / insufficient_evidence. It is not a conclusion about the entire
  conversation. Runtime `status` retains this meaning for compatibility and now
  includes `reply_source_id` and `response_scope: specific_reply`.
- **Fulfillment**: established / not_established / insufficient_evidence, with its
  own evidence IDs and rationale. In these checks only a narrowly explicit request
  for a numeric ROI/payback value can be established from an inline value. This does
  not establish arithmetic correctness, business-case validity or customer acceptance.
  Documents, delivery, suitability and acceptance need their own evidence. The
  not_established label is reserved for affirmative evidence of non-fulfillment;
  absence of proof remains insufficient_evidence. Customer acceptance stays unproven.
- **Next action**: a supported task, responsible person, permissible participants,
  route and evidence. The assigned AM can prepare/obtain missing pricing or ROI
  evidence and consult the requester without selecting an unsupported approver.
  Unverified authority blocks approver selection, not useful preparation.

All cases have account/decision/as-of metadata, dated attributed records and
employment context. Requests and replies are separate. X is a customer stakeholder,
Y a colleague/reporter, AM the assigned account manager; titles do not imply authority.
The role-change case ends employment on 2026-08-01, as-of 2026-09-01. Missing records
are dataset metadata. Comparison cases put the decline question in the user query.
A cancellation request remains intent; there is no confirmed cancellation event.
The conflict pair consistently concerns authority in both languages, without reliable
within-day ordering. Purchase rejection and authority withdrawal have separate
bilingual unit controls; the legacy withdrawal fixture now explicitly says berwenang.

The original generic route label AD/SG is no longer used as proof of semantic success.
Comparison cases require account_diagnosis with metric/period clarification. Other
cases assess supported work and participants, without assuming meetings/intermediaries.

## Revised cases

Evidence cells list separate request and reply IDs. Full passages, attribution,
dates and role records are in v2. Every next-action row also cites its case's
`-metadata` record for the AM assignment. Coverage/fulfillment marked N/A have no
requirement/reply pair and are excluded from those denominators, not counted as passes.
`IE` = insufficient_evidence. `prepare` = AM prepares/obtains evidence, may consult X,
and confirms authority; no approver or joint/intermediary route is selected.

| ID / actual query | Evidence | Response coverage | Fulfillment | Next action | Changed expectation / reason |
| --- | --- | --- | --- | --- | --- |
| authority-en / What should we do next? | authority-en-request: I am authorized to decide procurement for S1. | N/A | N/A | clarify scope/current authority (AM) | Separate attributed records; remove unsupported route assumptions. |
| authority-id / Apa langkah berikutnya? | authority-id-request: Saya berwenang memutuskan pengadaan S1. | N/A | N/A | clarify scope/current authority (AM) | Separate attributed records; remove unsupported route assumptions. |
| roi-en / What should we do next? | roi-en-request: For S1 I require ROI and payback evidence.; roi-en-reply: For S1 here is ROI 20%. | partially_addressed | IE; acceptance unknown | prepare (AM; X may clarify) | Separate attributed records; remove unsupported route assumptions. |
| roi-id / Apa langkah berikutnya? | roi-id-request: Untuk S1 saya memerlukan bukti ROI dan payback.; roi-id-reply: Untuk S1 berikut ROI 20%. | partially_addressed | IE; acceptance unknown | prepare (AM; X may clarify) | Separate attributed records; remove unsupported route assumptions. |
| reference-en / What should we do next? | reference-en-request: For S1 I require a reference.; reference-en-reply: For S1 here is the requested reference. | addressed | IE; acceptance unknown | prepare (AM; X may clarify) | Coverage recognizes the visible response to the broad request; reference contents, suitability and acceptance remain unverified. |
| reference-id / Apa langkah berikutnya? | reference-id-request: Untuk S1 saya memerlukan referensi.; reference-id-reply: Untuk S1 berikut referensi yang diminta. | addressed | IE; acceptance unknown | prepare (AM; X may clarify) | Coverage recognizes the visible response to the broad request; reference contents, suitability and acceptance remain unverified. |
| pricing-en / What should we do next? | pricing-en-request: For S1 I require pricing.; pricing-en-reply: For S1 our product has stock controls. | not_addressed | IE; acceptance unknown | prepare (AM; X may clarify) | Separate attributed records; remove unsupported route assumptions. |
| pricing-id / Apa langkah berikutnya? | pricing-id-request: Untuk S1 saya memerlukan harga.; pricing-id-reply: Untuk S1 produk kami memiliki kontrol stok. | not_addressed | IE; acceptance unknown | prepare (AM; X may clarify) | Separate attributed records; remove unsupported route assumptions. |
| rollout-en / What should we do next? | rollout-en-request: For S1 I require an implementation start date.; rollout-en-reply: For S1 here is the implementation start date: 12 October 2026. | addressed | IE; acceptance unknown | prepare (AM; X may clarify) | Narrowed the precise request to a start date, so one date addresses it. A full schedule would require a different case. |
| rollout-id / Apa langkah berikutnya? | rollout-id-request: Untuk S1 saya memerlukan tanggal mulai implementasi.; rollout-id-reply: Untuk S1 berikut tanggal mulai implementasi: 12 Oktober 2026. | addressed | IE; acceptance unknown | prepare (AM; X may clarify) | Narrowed the precise request to a start date, so one date addresses it. A full schedule would require a different case. |
| integration-en / What should we do next? | integration-en-request: For S1 I require integration status and remaining defects.; integration-en-reply: For S1 integration status is in the unavailable attachment. | insufficient_evidence | IE; acceptance unknown | prepare (AM; X may clarify) | Separate attributed records; remove unsupported route assumptions. |
| integration-id / Apa langkah berikutnya? | integration-id-request: Untuk S1 saya memerlukan status integrasi dan cacat yang tersisa.; integration-id-reply: Untuk S1 status integrasi ada di lampiran yang tidak tersedia. | insufficient_evidence | IE; acceptance unknown | prepare (AM; X may clarify) | Separate attributed records; remove unsupported route assumptions. |
| negation-en / What should we do next? | negation-en-request: I am no longer authorized to approve purchases for S1. This is an authority withdrawal, not a purchase rejection. | N/A | N/A | clarify scope/current authority (AM) | Explicit withdrawal of authority, not rejection of a purchase. |
| negation-id / Apa langkah berikutnya? | negation-id-request: Saya tidak lagi berwenang menyetujui pembelian untuk S1. Ini pencabutan wewenang, bukan penolakan pembelian. | N/A | N/A | clarify scope/current authority (AM) | Explicit withdrawal of authority, not rejection of a purchase. |
| cancellation-en / What should we do next? | cancellation-en-request: Please cancel the S1 expansion request; cancellation has not been confirmed. | N/A | N/A | clarify scope/current authority (AM) | Cancellation intent only; no confirmed cancellation event. |
| cancellation-id / Apa langkah berikutnya? | cancellation-id-request: Mohon batalkan permintaan ekspansi S1; pembatalan belum dikonfirmasi. | N/A | N/A | clarify scope/current authority (AM) | Cancellation intent only; no confirmed cancellation event. |
| reported-en / What should we do next? | reported-en-request: Y reports: X decides procurement for S1 and requires ROI. | N/A | N/A | clarify scope/current authority (AM) | Y is reporter; X is subject. No intermediary role or joint-meeting authorization is implied. |
| reported-id / Apa langkah berikutnya? | reported-id-request: Y melaporkan: X memutuskan pengadaan S1 dan memerlukan ROI. | N/A | N/A | clarify scope/current authority (AM) | Y is reporter; X is subject. No intermediary role or joint-meeting authorization is implied. |
| contradiction-en / What should we do next? | contradiction-en-request: I am authorized to approve procurement for S1.; contradiction-en-reply: I am not authorized to approve procurement for S1. | N/A | N/A | clarify scope/current authority (AM) | Both languages now concern conflicting authority assertions; same event date provides no trustworthy resolution. |
| contradiction-id / Apa langkah berikutnya? | contradiction-id-request: Saya berwenang menyetujui pengadaan S1.; contradiction-id-reply: Saya tidak berwenang menyetujui pengadaan S1. | N/A | N/A | clarify scope/current authority (AM) | Both languages now concern conflicting authority assertions; same event date provides no trustworthy resolution. |
| role_change-en / What should we do next? | role_change-en-request: My employment with Account A ended on 1 August 2026. | N/A | N/A | clarify scope/current authority (AM) | Dated employment ends 2026-08-01; analysis as of 2026-09-01. |
| role_change-id / Apa langkah berikutnya? | role_change-id-request: Pekerjaan saya di Akun A berakhir pada 1 Agustus 2026. | N/A | N/A | clarify scope/current authority (AM) | Dated employment ends 2026-08-01; analysis as of 2026-09-01. |
| wrong_decision-en / What should we do next? | wrong_decision-en-request: For S1 I require ROI.; wrong_decision-en-reply: For S2 here is ROI 20%. | not_addressed | IE; acceptance unknown | prepare (AM; X may clarify) | The specific S2 reply is not_addressed for S1; whether S1 was answered elsewhere is unknown. |
| wrong_decision-id / Apa langkah berikutnya? | wrong_decision-id-request: Untuk S1 saya memerlukan ROI.; wrong_decision-id-reply: Untuk S2 berikut ROI 20%. | not_addressed | IE; acceptance unknown | prepare (AM; X may clarify) | The specific S2 reply is not_addressed for S1; whether S1 was answered elsewhere is unknown. |
| missing-en / What should we do next? | missing-en-metadata: no supplied records | N/A | N/A | clarify scope/current authority (AM) | Empty source list with explicit dataset/search coverage metadata, not a fabricated customer statement. |
| missing-id / Apa langkah berikutnya? | missing-id-metadata: no supplied records | N/A | N/A | clarify scope/current authority (AM) | Empty source list with explicit dataset/search coverage metadata, not a fabricated customer statement. |
| comparison-en / Why are repeat orders lower? | comparison-en-metadata: no supplied records | N/A | N/A | clarify metric and periods (AM) | Decline question is the actual query; missing metric/periods are dataset/request metadata. |
| comparison-id / Mengapa pesanan ulang turun? | comparison-id-metadata: no supplied records | N/A | N/A | clarify metric and periods (AM) | Decline question is the actual query; missing metric/periods are dataset/request metadata. |

## Provisional results and frozen holdout

| Set | Coverage | Fulfillment | Next actions |
| --- | --- | --- | --- |
| Revised 28 cases | 12/12; 16 N/A | 12/12; 16 N/A | 28/28 |
| Frozen eight-case bilingual set | 8/8 | 8/8 | 8/8 |

A passing fulfillment check often means **correctly retaining insufficient_evidence**,
not that the customer's requirement was fulfilled. Revised set: all 12 fulfillment
results remain insufficient_evidence. Held-out set: two narrowly requested numeric
values established, six insufficient_evidence; customer acceptance established in zero.
Non-requirement authority/cancellation cases only contribute next-action checks here;
this runner does not claim complete role extraction or cancellation-state evaluation.
Existing unit/DB tests separately cover authority, signal cancellation and review safety.

The fresh set has four English/Indonesian families held together and was frozen in
commit `8a40632`, before its first execution. [Immutable labels](../tests/fixtures/phase8-heldout-v1.json)
and [freeze hash](../tests/fixtures/phase8-heldout-freeze.json) are separate from
[execution history](../tests/fixtures/phase8-heldout-runs.json). Its scenarios are new
inputs/variants authored by the implementer; some share requirement categories with
development cases. This is not an independently blind or distribution-generalization
holdout. No labels changed after execution. A later authority-disambiguation fix
came from the user's requirement and an existing legacy test, not a held-out failure;
any final rerun is a regression confirmation, not a second fresh measurement.

Commands: `npx tsx scripts/evaluate-phase8-review.ts` and the explicit `--heldout`
variant. The normal unit suite excludes held-out labels so they are not silently
repeated during development. Reports retain packet hash, Git commit, working-diff
hash, timestamp, expected/observed dimensions and zero provider calls.

## Remaining review decisions (recommendations)

1. **Reference fulfillment**: define what a suitable reference needs for a particular
   decision. Recommend named customer/contact plus decision-specific criteria, with
   acceptance recorded separately. A pointer already counts as responsive to a broad
   request; it cannot certify any of these fulfillment facts.
2. **Full implementation schedule**: the corrected case explicitly requests a start
   date, which the visible reply supplies. If a full schedule is intended, recommend
   requiring milestones, responsibilities and dates in a separate scoped case; a single
   date would cover only part. Do not reinterpret the now-precise start-date fixture.
3. **Numeric fulfillment**: recommend keeping the narrow data-provision meaning in
   the two numeric held-out cases. If the business requirement is a validated ROI
   business case, require inputs/calculation review and label current evidence insufficient.
4. **Release checklist**: recommend all agreed finite-suite requirements passing with
   zero leakage, unsupported authority promotion or unauthorized external action.
   This is a finite release checklist, never a claim of 100% general accuracy.

Open gates: independent approval of unseen revised/held-out labels, approval of the
release checklist/thresholds and adequacy, reviewed acceptance execution, and live
provider validation of the changed coverage prompt. No new live calls were made.
All capability enable/defer decisions stay defer; existing user flags are unchanged.
Classifier optimization, semantic retrieval and deployment remain outside scope.
