# PRD-0x2 — Phase 1: Build the deterministic C06 path

Status: Implemented and locally verified, 9 October 2026. Dependency: PRD-0x1 source mappings and reviewed evidence.
Requirements: FR-01–08; AGENTS.md Sections 15–19.

## Goal

Turn retained evidence into one reproducible expansion action card using a
repeatable PostgreSQL import, deterministic reconciliation and code calculations.

## In scope and deliverables

- Scaffold npm workspaces, React/Vite/TypeScript frontend, Express/TypeScript API,
  shared Zod DTOs, Drizzle/node-postgres, Vitest and local PostgreSQL Compose.
  Verify current official compatibility, pin supported versions/runtime and commit
  a shared lockfile. Add `.env.example` with placeholders and real setup commands.
- Add database client, loopback API, Vite proxy and process/database health route.
  Define the authorization boundary for dataset-scoped local data access.
- Create reviewed migrations for dataset/source retention, C06 domain tables,
  graph identities/assertions, runs, matches, findings and recommendations.
- Stage all supplied source records with raw payloads and row/line locators.
  Normalize mapped entities in transactions; resolve references in a second pass.
  Report duplicates/quarantines and reconcile counts before marking a dataset ready.
- Implement deterministic keys, composite snapshot constraints, evidence references,
  decimal money strings and repeatable imports; changed content is a new snapshot.
- Implement generic request/deal matching, follow-through checks, transparent priority,
  elapsed days and conditional outlet-value calculation. Use manually reviewed
  C06 facts to validate the path; never hardcode account-specific business answers.
- Expose dataset/account/opportunity/source/evidence endpoints with pagination,
  validation and freshness. Graph projection combines typed joins and supported
  assertions, with account/dataset scope, cycle prevention and bounded traversal.
- Establish `dev`, `db:generate`, `db:migrate`, `data:import`, `data:analyze`,
  `typecheck`, `test` and `build` scripts only when implemented and verified.

## Definition of done

- [x] A fresh setup can migrate and import using documented commands.
- [x] Re-importing an identical manifest creates no duplicate entities or signals.
- [x] Missing/unusable deal inputs prevent a false unmatched-deal conclusion.
- [x] Reviewed C06 evidence produces one card meeting every Section 7 card field;
  unknowns remain null/explicit and recommendations remain proposed actions.
- [x] A valid matching deal suppresses the absence finding while retaining the request.
- [x] Missing-record findings retain scope, criteria, rule version, dataset and as-of.
- [x] Every material claim opens its source or deterministic check; synthetic fixtures
  cover matching, ambiguous/missing terms, decimals and snapshot isolation.
- [x] Revenue shows quantity × monthly rate × 12 × (1 − discount), assumptions,
  currency and annualized basis; elapsed time uses verified snapshot/source dates.
- [x] Disposable database tests cover idempotency, cross-snapshot FK rejection,
  rollback/quarantine and evidence resolution without touching imported demo data.
- [x] Typecheck, relevant tests and production build pass; shared DoD is recorded.

## Out of scope

Model interpretation, stakeholder diagnosis release, full workflow UI, Q&A,
autonomous writes, deployment and optional ML. A shell frontend is sufficient
here; final workflow acceptance belongs to PRD-0x5.

## Results and handover

See [Phase 1 handover](PHASE-1-HANDOVER.md) for implemented behavior, files,
actual checks, retained-only domains, limitations and next task. All supplied
records are retained; a C06 rules candidate resolves evidence and calculates
conditional value without provider calls. Eleven tests, typecheck, build,
migration-drift and local HTTP/proxy checks pass. Full MVP delivery remains open.
