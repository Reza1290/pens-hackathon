# Phase 0 limitations and stakeholder dependencies

## Snapshot and validation boundaries

README declares 1 October 2026 snapshot and operational period 1 October 2025–
30 September 2026. Observed daily usage spans exactly that period; feature months
span October 2025–September 2026, interaction dates 3 October 2025–30 September
2026 and ticket creation dates the full operational period. Decisions begin in
February 2024; employment begins in 2012; releases include September 2025. These
are valid historical context, not a conflicting snapshot. Future contract renewal
dates and feature/expansion targets are schedules/forecasts, not observed future activity.

All supplied files decode as strict UTF-8; no malformed rows, missing minimum
required values, duplicate primary/composite keys, invalid tested dates/numbers,
unresolved tested ID references, invalid reply chronology/account links or
contract formula discrepancies were found. This statement is limited to checks
implemented in `scripts/audit_sources.py`; it is not a full semantic integrity claim.

The challenge PDF was not found anywhere in the repository file inventory. Its
constraints remain unverified; record the limitation rather than fabricate its contents.

## Issues to retain during import

- C01's reported champion K017 conflicts with current CRM affiliation P01.
  Employment history places the C01 role's end at 15 August 2026 and P01 start
  at 1 September 2026. Preserve the stale champion assertion with its provenance;
  do not recommend K017 as a current C01 employee or silently rewrite the source.
- Six interaction address occurrences do not match any current contact/employee
  email: sender in I0051, I0159, I0223, I0290 and recipient in I0066, I0224.
  Manual review associates the old C01 address with the K017 role interval;
  current contact data has only the new P01 address. Historical alias resolution
  needs explicit evidence/review and must retain uncertainty; matching a name
  alone is insufficient. Source addresses remain unchanged.
- Source README counts are sometimes approximate: actual deals 22, employment
  rows 217, feature observations 1,178 and daily usage 226,300. Use measured counts.
- No complete purchases/invoices, stage-transition history, historical prices,
  employment email history, attachments or reliably timestamped sent/reply events
  are supplied. Date ranges do not prove complete business-event coverage.
- Empty offline metrics are missing/not-applicable observations, not zero. Current
  outlet inventory has no opening dates. Installed counts/usage cannot establish
  repeat orders or a decline in comparable revenue.

## Required C01 slice: revalidated dependencies

| Source / locator | Supporting fields and design consequence |
| --- | --- |
| `decision_log.csv`, record 18, D-2025-11 | `alasan`, `fitur_dijanjikan=FEAT-07`, `status_janji` record Q3 2026 integration commitment and unfulfilled status. `diminta_oleh=E03`, `diputuskan_oleh=E01` are internal employee approvals. |
| `decision_log.csv`, record 27, D-2026-08 | Product scheduling escalation, waiting status, E09 product owner; no confirmed delivery date. |
| `interactions.jsonl`, line 61, I0061 | Linked evidence for the internal discount decision; retain internal attribution. |
| `contact_employment_history.csv`, records 22/23, K017 | Departed C01 role and current P01 role; prevents stale stakeholder reuse. |
| `crm_contacts.csv`, record 134, K134; employment record 185 | Current C01 CFO role from 1 July 2026, linked by ID/email rather than title alone. |
| `interactions.jsonl`, line 331, I0331 | Meeting documents the CFO's integration concern, vendor evaluation and no renewal commitment; recorded by E03, not a direct email quotation. |
| `interactions.jsonl`, line 344, I0344 | Follow-up message offers usage summary and seeks renewal; recorded body does not address integration. Attachment contents are unavailable; do not generalize to all communication. |
| `features.csv`, record 7, FEAT-07 | In development; original target 2026-Q3, current target not set. Recorded status is snapshot evidence, not a verified future remediation plan. |
| `contracts_billing.csv`, record 1, K-C01; deal record 8, DL-008 | Current contract and historical won renewal; keep renewal diagnosis separate from an expansion opportunity or a proven order decline. |

Phase 3 should obtain verified product status/remediation details and address the
recorded integration concern through the account/product owners. It cannot claim
the CFO caused a repeat-order decline. I0290 also provides a historical routing
statement to the current CFO; preserve its speaker/date rather than inferring
universal procurement authority.

## Supporting P01 slice: revalidated dependencies

I0343 (JSONL line 343) records K052 as technical evaluator and reports procurement
authority residing with the newly joined GM Operations. Contact K017 (contact
record 17) and employment record 23 match P01, that role and September start.
This is **reported scoped authority**, not a directly stated preference or a
universal authority assertion. P01 account record 41 and deal DL-001 (deal record
1) identify new sale and owner E06. Preserve K052 in a proposed joint route and
verify present requirements; no C01 preference transfers to P01.

## Immutable raw-storage and manifest plan

Original files remain untouched under `data/raw/`. Before Phase 1 ingestion,
copy the complete byte-identical collection into `data/raw/kasirnusa-2026-10-01/`,
verify every SHA-256 against the committed manifest, and point the importer to
the versioned directory. Do not move/delete originals or overwrite an existing
version with different content. Changed bytes require a new snapshot/version.

Manifest `source-manifest-v1` records filenames, current relative locations,
SHA-256, byte/record counts, encoding, headers, empty counts, date ranges,
duplicate/check summaries, mapping/audit version and source-backed as-of metadata.
Its content hash is SHA-256 over canonical compact JSON of sorted filename/hash
pairs. It is **inspected_not_imported**, never ready. Phase 1 must add importer
coverage/disposition counts and readiness checks, while retaining source provenance.

## Open decisions for Phase 1

Define final required columns/enums and quarantine policy, interval-boundary
semantics (proposed inclusive source end dates, subject to review), dataset authorization
boundary, decimal precision policy and handling for historical aliases. Record matching
ambiguity; no arbitrary overdue SLA is chosen. Confirm current commercial terms for
new outlets and product remediation with future approved evidence. No model/provider
or runtime version selection is necessary to finish source inspection.
