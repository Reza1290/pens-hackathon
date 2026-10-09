# PRD-0x1 — Phase 0: Verify sources

Status: Planned. Dependency: committed folder baseplate.
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

- [ ] Inventory, mapping and limitations documents exist under `docs/`.
- [ ] Manifest records SHA-256 checksums, file coverage, mapping version and
  verified as-of semantics; snapshot claims are checked against actual dates.
- [ ] Every supplied source is accounted for, including malformed/unresolved data.
- [ ] C06 request details and original source IDs are manually reviewed, corrected
  when necessary, and distinguish expectations from verified findings.
- [ ] Full deal-search coverage is established or explicitly marked incomplete;
  no absence claim is made when required inputs are missing/unusable.
- [ ] Pricing units/discount representation and identity/temporal matching are
  documented, with unresolved terms retained as unknowns.
- [ ] Shared DoD and handover requirements in `docs/README.md` are satisfied.

## Validation

Compare parsed counts to file counts; check duplicate and dangling IDs; inspect
dated records and source locators manually. Keep sensitive review artifacts local
and commit only safe metadata or redacted summaries.

## Out of scope

Application runtime, migrations, import implementation, model calls, UI, Q&A,
classifier training and declaring a completed C06 opportunity.
