# Phase 3 handover — stakeholder diagnosis

9 October 2026. PRD-0x4 deterministic backend is implemented and locally verified.
Final method version: `stakeholder-rules-v1.2`.
Workflow UI is PRD-0x5; live model evaluation and human gates in PRD-0x3 remain open.

## Implemented behavior

Account diagnoses exist independently of expansion signals. They preserve
commercial context, owner, historical/current employment, dated scoped statements,
direct/reported attribution, internal decisions, findings, proposed routes and
audience-specific discussion points. Account diagnoses default to null value;
explicit signal scope can retain that signal's validated commercial scenario.
Prospect and renewal diagnoses never invent expansion value.

Rules match exact senders and dated account employment. Meeting statements need
an unambiguous named attendee, and reported procurement authority needs a unique
role valid at the source date. A title alone supplies no purchasing authority.
Each statement retains interaction scope, source passage, speaker, subject,
date, method and unreviewed verification state. Contradictory/outdated authority
is surfaced; requirements from another company are not transferred.
Denied/changed requirements remain visible and trigger clarification instead of
silently reusing an earlier affirmative requirement.

The migration adds `decisions` and `account_diagnoses` and permits account-only
findings/recommendations. Internal requesting/deciding IDs reference employees.
Rationale, original terms and commitment status are retained; an old exception
does not authorize a new discount. Derived concern-to-commitment assertions link
the stakeholder to the internal decision with both sources. Graph projection
exposes bounded account/person/interaction/decision/evidence paths, not just names.

Routes support joint discussions, preparation through an intermediary, prerequisite
resolution and clarification. Documented requirements change discussion content;
technical contributors stay involved. Ticket counts/open status are context.
A ticket prerequisite requires an explicit reference and requirement for resolution
before purchase/rollout. Undated feature status remains recorded context needing
verification, not a fabricated current delivery date.

Question responses include a structured premise check. Ambiguous repeat orders
need metric/period clarification. Actual expansion orders, renewals and revenue
remain insufficient data because the supplied snapshot has no complete purchase
or payment ledger. An explicitly selected `closed_expansion_deal_proxy` compares
recorded currently won expansion deals by stage-entry date over equal-length
periods. Its status describes this proxy only, never all real repeat orders.

## Commands and API

```powershell
npm run db:migrate
npm run data:analyze -- --dataset <uuid> --as-of 2026-10-01
npm run data:diagnose -- --dataset <uuid>
npm run data:verify-stakeholders -- --dataset <uuid> --fixture tests/fixtures/stakeholders-review.json
```

Use `--account C01` for one account, or prepare an optional `--signal <uuid>` /
`--deal <uuid>` scope with an explicit account. A simultaneous signal/deal scope
requires a verified same-request link. Runs are versioned and reused; new inputs
produce a new run. Imports still normalize the seven original core files; the
diagnosis batch separately normalizes retained internal decisions. Feature/ticket
records remain retained-source context, not newly claimed complete domain imports.

Read endpoints use internal account UUIDs and authorized `dataset_id`:

- `/api/accounts/:id/diagnosis`
- `/api/accounts/:id/stakeholders`
- `/api/accounts/:id/diagnosis/evidence`

Diagnosis accepts prepared `signal_id` / `deal_id` scope and `route=intermediary`.
Use `question=Why are repeat orders lower?` for premise validation or pass `metric`
and all four `previous_start`, `previous_end`, `current_start`, `current_end` dates.
Invalid/unequal/overlapping/future periods return 400. Missing authorized prepared
scope returns 404. Changed opportunity findings cause 409 until the diagnosis is
rebuilt; stale material is not silently served. Read endpoints do not call models,
write diagnostics, send messages or update CRM.

## Validation and results

- All **26 tests** pass in four files. Typecheck and production build pass.
  Migration generation reports no schema drift. Database tests use a fresh,
  disposable migrated database, leaving developer records intact.
- Synthetic tests cover owner/intermediary routes, changed ROI/reference requirements,
  reported attribution, title-only/negative/outdated authority, temporal exclusions,
  premise/proxy calculation, period validity, explicit ticket prerequisites,
  unresolved internal approvals, optional scope and stale diagnosis rejection.
- The supplied snapshot produces **45 account diagnoses**, **30 normalized internal
  decisions** and **four stakeholder statements** from the narrow implemented
  patterns. Zero unresolved decision rows were found here. A repeat batch reuses
  all 45 runs. This is coverage reporting, not a model/generalization result.
- C01 source verification covers D-2025-11, I0331 and I0344: renewal context,
  prerequisite-first action, Yoga's reported integration concern, no inferred
  purchasing authority, Rina historical, and unavailable attachment disclosure.
  Its evidence projection has 28 nodes and 24 passages.
- P01 I0343 verification distinguishes Fajar's direct evaluator/intermediary role
  from Rina's reported procurement authority. Joint and intermediary routes both
  retain Fajar. New-sale context and null value stay separate; no C01 requirement
  is reused. Its projection has 15 nodes and 11 passages.
- C02 diagnosis preserves package/follow-through findings and ticket context
  without manufacturing ticket blockers; its projection has 13 nodes and 15
  passages. Existing C02/C06 card verification still passes, including C06's
  Rp37,800,000 conditional annual increment and 43 elapsed days at the snapshot.
- No live Jev/LLM calls were added. Real-source expectations are assistant-inspected
  regression fixtures; independent human acceptance and broader evaluation remain
  pending. Original data and generated outputs stay ignored.

## Remaining limitations and next task

Extraction is deliberately narrow. Complex names, historical email aliases,
multi-speaker pronouns, ambiguous reported roles and less literal concern responses
need review/model evaluation. A concern check says one recorded email does not
mention integration; it does not prove every communication or unavailable attachment
ignored it. Candidate authority is specific to the recorded interaction; it is not
a permanent profile or guaranteed authority for future deals.

SQL stores rules assertions and dated provenance, but displayed statements remain
unreviewed candidates. The C01/P01 source checks do not establish general precision,
causality or commercial improvement. No complete order/revenue decline is proven.
Typed support/product imports, model promotion and remote authentication remain
outside this completed slice.

Next: PRD-0x5. Build opportunity, account/evidence and action-plan views, selected
account/dataset navigation, focused graph rendering and editable template drafts.
Show premise checks before any explanation and preserve direct/reported attribution.
Grounded Q&A and customized LLM drafts remain PRD-0x6. The MVP is still incomplete.
