# C06 manually reviewed evidence path

Reviewed 9 October 2026 against `kasirnusa-2026-10-01`, mapping `phase0-v1`.
This is a redacted source-review specification for Phase 1, not an imported signal,
production action-card fixture or completed sales action. Original names, emails
and full passages remain in local raw files. Dataset checksums are in the manifest.

## Source references

CSV record numbers exclude headers; add one for the physical line in these files.
JSONL references are physical line numbers. Supporting fields are named explicitly.

| Source | Locator / external ID | Supported facts |
| --- | --- | --- |
| `interactions.jsonl` | line 300 / I0300, `tanggal`, `account_id`, `dari`, `ke`, `isi` | 19 August 2026 request for 10 additional outlets in Jakarta, Q2 2027, requesting quotation and implementation schedule; intent to continue using the product. Preserve quarter precision. |
| `crm_accounts.csv` | record 6 / C06, `tipe`, `account_owner_id`, `champion_contact_id`, `jumlah_outlet` | Existing customer; internal owner E04; recorded champion K116; reported base 30 outlets. |
| `crm_contacts.csv` | record 116 / K116, `email`, `account_id_saat_ini`, `jabatan_saat_ini` | Request sender matches the current C06 contact by exact email; recorded CFO title. Title/request alone does not establish scoped purchasing approval. |
| `contact_employment_history.csv` | record 159 / K116, `account_id`, `jabatan`, `mulai`, `selesai` | C06 CFO employment from 2 January 2020, no recorded end; valid at request and snapshot. |
| `employees.csv` | record 4 / E04, `employee_id`, `email`, `jabatan` | Internal account owner matches the addressed email exactly. |
| `contracts_billing.csv` | record 6 / K-C06, commercial fields | Enterprise, 30 contracted outlets, unlimited package limit, IDR 350,000/outlet/month, 10 percentage-point discount, IDR 113,400,000 annual base; starts 1 July 2026, renewal scheduled 1 July 2027. |

## Recorded search results

All **22** supplied deals parsed with unique IDs, required values and resolvable
account/owner references. Searching all accounts/types/stages/statuses for C06
returns **0** rows before any narrower scope or timing filters are applied.
Thus: **No matching record found in the supplied data as of 1 October 2026.**
This verifies supplied-file coverage, not completeness of the external CRM or
activity outside this snapshot. The production finding must retain this scope,
the content-manifest hash and its eventual rule/query version.

All **350** interactions were inspected for C06 or a reply to I0300. There are
**14** C06 interactions; I0300 is the latest. There are **0** later C06 interactions
and **0** explicit `membalas_id=I0300` replies anywhere in the supplied file.
No recorded acknowledgement, quotation, implementation answer, cancellation or
quantity revision was found after this request. Earlier generic training/usage
messages are unrelated to the request. Do not say nobody responded outside the data.

## Phase 1 matching and follow-through rule specification

Proposed rule version: `reconciliation-v1`; configurable, not yet implemented.

1. Require ready snapshot and usable complete supplied deal input. Select same-account
   deals of expansion type; inspect other commercial types as separately labeled context.
2. Compare requested incremental scope against explicit deal scope, target period,
   creation/stage dates and recorded status. The deal file lacks location/rollout-period
   columns, so matching on quantity/date alone is a candidate, not automatic certainty.
3. Preserve ambiguous candidates and reasons; no arbitrary date window or SLA is adopted.
   A verified same-request deal resolves the unmatched finding without deleting the signal.
4. Follow explicit reply chains and same-account later messages about the same request.
   Acknowledgement or a promise to check is not a delivered quotation/schedule.
   Classify each requested deliverable separately; preserve partial responses.
5. Check cancellation, negation and revised scope with dated evidence; do not infer
   active status merely from no response. This request is recorded and not cancelled
   in supplied later evidence; present current intent as subject to confirmation.

## Conditional calculations and proposed action

Verified inputs yield a **conditional IDR 37,800,000 annual increment**:
`10 × 350000 × 12 × (1 − 10/100)`.
The current contract's base value separately reconciles:
`30 × 350000 × 12 × 0.9 = 113400000`.
All 40 supplied contracts reconcile to their recorded annual values under this formula.
Continuing the rate and discount for new outlets is an assumption requiring confirmation;
no new terms, tax, fees, signed revenue or calendar-year revenue are established.
Unlimited package limit removes a recorded outlet-cap issue, not every implementation prerequisite.

Elapsed time is **43 calendar days since request**:
`date(2026-10-01) − date(2026-08-19)`. This is neither time since a substantive
response nor time in CRM stage; there is no C06 deal stage to measure.

Proposed owner task: E04 should confirm the request/scope with K116, obtain a
quotation and rollout schedule, verify continuing commercial terms and ask who
approves this expansion and which operational/technical stakeholders must join.
K153 is a recorded C06 operational contact, but evidence does not yet establish
their role in this specific rollout. Keep authority and involvement as questions
to verify. No completed action or draft sending is implied.

## Remaining unknowns

Current purchasing authority, operational prerequisites, detailed outlet rollout
dates, implementation costs, approval conditions, applicability of current discount,
external follow-up/CRM activity and whether intent changed after the snapshot.
