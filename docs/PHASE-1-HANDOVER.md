# Phase 1 handover — 9 October 2026

## Implemented behavior

- npm workspaces for web, API and contracts; exact dependency pins and shared lockfile.
  Loopback-only Express API, Vite proxy and process/database/schema health check.
- Reviewed initial PostgreSQL migration for 23 tables. Composite snapshot FKs and
  entity-kind FKs prevent cross-snapshot/wrong-kind domain references. Assertions
  require exactly one entity or literal target. Money uses numeric and decimal-string DTOs.
- Byte-verified versioned copies preserve the original 16 files. All 229,627 supplied
  records are retained with payload/text, locator and content hash before normalization.
- Seven core sources normalize employees, accounts, contacts, organizations,
  employment, contracts, all 22 deals and interactions/participants. Other eight
  sources are retained for later mapping; readiness is scoped to the Phase 1 slice.
- Repeat import reuses content-manifest identity. Missing/invalid required sources
  prevent readiness. Normalization failure rolls back typed entities while keeping
  source retention and diagnostics. Unresolved historical addresses remain unmerged.
- Rule version `deterministic-expansion-v1.2` produces a C06 candidate without
  account-specific business logic: request details/actions, deal reconciliation,
  follow-through checks, package/term checks, elapsed days and conditional value.
- Verified deal links require supporting evidence; quantity/date alone stays
  ambiguous. Reviewed-link changes invalidate the analysis key. Unchanged analysis
  reuses its run. Historical recommendations remain run-bound; API selects current run.
- Cards preserve freshness, owner/contact, unknown scoped purchasing authority,
  evidence, proposed action, assumptions and deterministic search scope. Read APIs
  expose sources and a fixed, cycle-free graph projection capped at three hops.
- Small React UI shows dataset, request, timing, conditional value, proposed owner
  action and passages. No provider result is mocked or external action performed.

## Verified results

| Check | Actual result |
| --- | --- |
| Clean `npm ci` | Passed; zero known advisories reported after esbuild override |
| `npm run typecheck` | Root tests/config and all workspaces pass |
| `npm test` | 11 tests across 2 files, with fresh disposable PostgreSQL migrations |
| `npm run build` | API and Vite production artifacts build |
| `npm run db:generate` | Final schema matches reviewed migration snapshot; no drift |
| Local migrate/import | Ready C06 slice; 229,627 retained records, no quarantines/duplicate keys, seven nonblocking identity diagnostics preserved |
| C06 reviewed fixture | One signal; I0300 details, E04 owner, K116 contact, unknown purchasing authority; zero C06 deals in all 22 supplied deals |
| Calculation | IDR 37,800,000.00 conditional annual increment; 43 days since request at 2026-10-01 |
| Evidence | All cited source endpoints/locators resolve; graph includes account, signal, contact, owner, contract and sources |
| Development smoke | API health, Vite page and `/api` proxy respond successfully |

Five tests cover rules/parsing and six cover the database/API path: idempotency,
deduplication, quarantine, rollback, decimals, matching, pricing conflicts, evidence,
snapshot isolation and access boundaries. Parameterized cases are not counted as
additional tests. C06 expectations are a redacted reviewed fixture, not committed
raw records or a dataset-wide evaluation. Provider/model calls: **0**; no inference
cost, classifier quality or generalization claim is made.

## Files and scope

Code lives in `apps/api/src/{db,config,cli,modules}`, `apps/web/src`,
`packages/contracts/src`, workspace/config files, Compose and `tests/`.
Setup is in the repository README; Phase 0 manifests/review are retained.
One backend and one PostgreSQL database remain the baseline. No extra services,
trained artifacts, connectors or chat-first workflow were introduced.

## Limitations and unresolved decisions

- C06 is the only source-reviewed automated slice. Narrow text rules miss other
  constructions, including C02's body phrasing; no dataset-wide recall gate is claimed.
  Historical aliases and non-unique/current-invalid employment do not authorize a
  guessed contact. Revisions and unlinked responses need Phase 2 interpretation/review.
- Substantive-response candidates are not proof every requirement is answered.
  Direct reply chains are checked; unlinked later messages are flagged for review.
  No SLA, external-activity absence or purchase probability is invented.
- Core import validates structural fields, dates and references. Other domains are
  retained/count-reconciled, with semantic normalization deferred. Accounts keep
  the Phase 1 subset; other columns remain in raw payloads. Contract decision IDs
  stay source references until typed internal decisions/commitments are implemented.
- Incomplete snapshots stay unavailable to analysis/API. Reimport reuses their
  status; automatic resume after transient normalization failure is not implemented.
  Diagnose before adding recovery; do not delete retained data.
- Continuing terms are assumed. Missing/conflicting contracts or inconsistent base
  annual values suppress scenarios; package changes need new terms. Calculations
  use 40-digit precision and two-decimal half-up output. Tax/fees remain unknown.
- Access is local OS trust, loopback, host/origin and dataset checks. Remote auth,
  production frontend serving and hosting remain undecided. Graph is fixed bounded
  projection; interactive graph UI and general traversal remain later work.
- Full-text retrieval, model adapters/cache, `eval`, C01 stakeholder diagnosis, P01
  authority routing, premise checks, full workflow, drafts and Q&A are unimplemented.
  Required MVP stakeholder acceptance is still open. PDF/attachments remain absent.

## Next concrete task

Execute PRD-0x3: create reviewed labels plus negative/revision fixtures, then verify
Jev's current interface and evaluate bounded judgments before enabling them.
Keep deterministic behavior and explicit unfinished interpretation on provider failure.
PRD-0x4's C01/P01 stakeholder slice remains mandatory before MVP completion.
