# Phase 2 handover — interpretation infrastructure

9 October 2026. PRD-0x3 is partially implemented and locally tested; it is **not**
fully accepted. Live model evaluation and human approval remain pending.

## Implemented behavior

- Rules recognize future opening language and keep renewal quotations separate
  from incremental expansion. Substantive terms after thanks are distinguished
  from a promise to prepare them; negated cancellation remains active.
- Exact complete repeated scope is deduplicated. Linked customer revisions update
  the original signal, keep its request date, retain supporting history and recompute
  value. Cancellation suppresses value. Ambiguous quantity/scope remains unclear;
  unrelated requests with unknown scope are not merged automatically.
- Versioned Jev bounded judgments and one generative extraction adapter are available
  through a scoped CLI. Exact quotes/spans, dated candidates, identities, attribution,
  output distributions and provider model versions are validated before caching.
- The additive migration creates `model_runs`: success/failure status, scoped cache
  metadata, model/prompt/schema versions, usage, latency and estimated or unknown
  cost. Success-only cache, concurrent duplicate suppression, bounded retries,
  timeouts, call/size budgets and offline capability are implemented.
- `npm run eval` reports separate synthetic intent/extraction and provider judgment
  metrics, sample counts, unanswered cases, calls and cumulative usage. Generated
  reports stay under ignored `artifacts/evaluations/`.

Main files: `modules/opportunities/rules.ts` and `service.ts`; `ai/` context,
router, prompts, schemas and providers; `cli/interpret.ts` and `eval.ts`; Drizzle
schema and `0001_tiresome_vertigo.sql`; provider/rules/disposable-database tests;
synthetic evaluation fixtures and redacted C02 expectations. Root scripts and
environment example document explicit opt-in provider use.

## Verification and actual results

- Typecheck and production build pass. All **19 tests** pass in three files,
  including fresh migrations in a disposable local database.
- Failure/cache tests use synthetic transports, not actual Jev or LLM inference.
  They check timeout, retry, unavailable/invalid outcomes, changed-input keys,
  invalid persisted cache rejection, budget accounting and source scope.
- The local developer database received the additive migration and reanalysis.
  All 229,627 retained records remain; two current opportunities are produced.
  Rule version: `deterministic-expansion-v2.2`; current analysis run:
  `2b71c59b-152b-5430-a227-979da5b2b5b1`. Migration generation reports no schema drift.
- Read-only C06 verification confirms I0300, ten Jakarta outlets in Q2 2027,
  no matching supplied deal, Rp37,800,000 conditional annual increment and 43 days
  at the 1 October snapshot. C02 verification confirms I0253/I0255, six Sidoarjo
  branches early 2027, one acknowledgement, no supplied deal and a package-check
  route. Its value is null because new commercial terms are required. The owner's
  title alone does not establish purchasing authority.
- Offline evaluation uses 25 assistant-curated synthetic cases: 15 intent cases
  match 15/15 expected labels; six quantity/period cases match 6/6 expected values.
  The other ten cover roles,
  support and concerns. No live provider call is made. Synthetic results do not
  establish dataset precision/recall or production model quality.
- A scoped offline C06 interpretation returns `unavailable`, zero calls, and
  automatic acceptance disabled. No mock judgment enters graph facts or cards.

## Remaining limitations and decisions

Human-reviewed dataset labels and numerical gates are not agreed. Jev availability
with the project's credentials, Indonesian quality, concern/authority judgments,
and a rules-versus-Jev live comparison remain unverified. Select the generative
model and runtime rates/budget before live extraction evaluation. The current
fixtures are regression checks, not an independently reviewed benchmark.

Provider successes remain unverified candidates in `model_runs`. Automatic
fallback selection, promotion into reusable graph assertions, contradiction review
and dependent model-finding invalidation remain gated; no card consumes model
outputs yet. Rule assertions retain supporting fields/passages, dates, method and
unreviewed verification state, but are not human-accepted interpretations.

Interpretation currently retrieves only supplied interactions and event-valid
contact candidates. Seven core sources remain normalized; support/product/decision
records are retained for the next phase. Multiple requests within an unlinked,
identical complete scope can still require human separation. Complex negation,
relative dates and multi-quantity revisions need reviewed fallback interpretation.

## Next concrete work

Review/correct the labels, configure provider access in the ignored server
environment, run the same live judgment cases, and agree gates before enabling
automatic model acceptance. PRD-0x4 can proceed with deterministic C01 renewal
diagnosis, P01 evaluator/intermediary routing and premise checks while these model
gates remain open. Stakeholder guidance, workflow, drafts and Q&A are still required
before the MVP is complete.
