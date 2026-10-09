# PRD-0x1 — Phase 0: Verify sources

Status: Completed source inspection, 9 October 2026. Dependency: committed folder baseplate.
Requirements: AGENTS.md Sections 5, 10, 12, 16 and 19.

## Goal

Establish the actual dataset schemas, snapshot semantics and evidence needed for
the first C06 expansion slice before designing persistent tables or answers.

## In scope and deliverables

- Read source README and challenge PDF if available; document absent inputs.
- Inventory all supplied files, encoding, headers, record counts, checksums,
  date ranges, required fields, nullability, duplicate IDs and reference issues.
- Define dataset version and manifest format. Plan immutable versioned raw
  storage without overwriting original files; do not commit dataset contents.
- Map actual columns to Section 16 tables, including units, cardinality and
  unresolved fields. Distinguish stage-entry dates from creation and updates.
- Inspect I0300 and related C06 interactions, contacts, owner, contracts and
  the complete CRM deal-search scope. Preserve source locators and passages.
- Define configurable deal matching and substantive-follow-up criteria; record
  ambiguity rather than inventing an overdue SLA.
- Identify C01/P01 source dependencies for the later mandatory stakeholder slice.

## Definition of done

- [x] Inventory, mapping and limitations documents exist under `docs/`.
- [x] Manifest records SHA-256 checksums, file coverage, mapping version and
  verified as-of semantics; snapshot claims are checked against actual dates.
- [x] Every supplied source is accounted for, including malformed/unresolved data.
- [x] C06 request details and original source IDs are manually reviewed, corrected
  when necessary, and distinguish expectations from verified findings.
- [x] Full deal-search coverage is established or explicitly marked incomplete;
  no absence claim is made when required inputs are missing/unusable.
- [x] Pricing units/discount representation and identity/temporal matching are
  documented, with unresolved terms retained as unknowns.
- [x] Shared DoD and handover requirements in `docs/README.md` are satisfied.

## Validation

Compare parsed counts to file counts; check duplicate and dangling IDs; inspect
dated records and source locators manually. Keep sensitive review artifacts local
and commit only safe metadata or redacted summaries.

## Out of scope

Application runtime, migrations, import implementation, model calls, UI, Q&A,
classifier training and declaring a completed C06 opportunity.

## Results and handover

- [Inventory](SOURCE-INVENTORY.md): 16 files, including 15 record sources and
  README; 229,627 records, strict UTF-8, no detected duplicate keys/malformed rows.
- [Mapping](SOURCE-MAPPING.md): all actual columns, units, cardinality, nullable
  handling, source retention and minimum C06 normalized-table slice.
- [Manifest](../data/manifests/kasirnusa-2026-10-01.json): SHA-256 and aggregate
  coverage; inspected only, not imported or ready.
- [C06 review](C06-SOURCE-REVIEW.md): request verified, supplied deal/reply searches,
  conditional calculations and proposed generic rule semantics.
- [Limitations](SOURCE-LIMITATIONS.md): stale C01 champion, historical email
  occurrences, missing PDF, unsupported outcome metrics and C01/P01 dependencies.
- [Audit command](../scripts/audit_sources.py): repeatable standard-library source
  inspection; detailed locators stay in ignored processed data.

Validation performed: all 16 file checksums independently checked with PowerShell;
physical line counts reconcile to all 15 parsed record counts; repeat audit yields
byte-identical manifest. Manual source review verified C06 identities/roles/terms,
all 22 deal rows and 14 C06 interactions, and required C01/P01 evidence. All 40
contract values reconcile to the documented formula using decimal arithmetic.
Documentation links, whitespace and ignored diagnostic/raw-data paths are checked
before commit. No application tests/build apply to this inspection-only phase.

Implementation remains unstarted: no runtime, SQL, import, model calls, production
fixtures or UI. Missing brief and semantic completeness remain explicit limitations.
Next task: PRD-0x2 runtime scaffold and retained-source schema/migrations, then
byte-verified versioned raw storage and repeatable PostgreSQL import. No originals
were moved, changed or committed.
