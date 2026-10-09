# Phase 5 handover — grounded account questions

PRD-0x6 has implemented, locally tested retrieval/Q&A and constrained generation
infrastructure. Human semantic review and live provider evaluation remain open;
this is not a claim that all MVP acceptance gates have passed.

## Completed behavior

- `POST /api/qa` accepts an authorized dataset, optional account/opportunity UUID,
  a question (maximum 500 characters), English/Indonesian language, up to three
  previous questions, optional positive outlet quantity and joint/intermediary route.
- Exact account IDs/names resolve account context. Multiple or conflicting account
  references request clarification rather than retrieving another account's data.
  An opportunity supplied with a different account is rejected. History is bounded,
  untrusted and never accepted as factual evidence.
- Supported question categories retrieve prepared findings, reconciliation checks,
  scoped stakeholder assertions and action plans. General searches use PostgreSQL
  `simple` full-text ranking plus normalized keyword/Indonesian-English aliases,
  strictly bounded by dataset, account, event date and six interaction records.
- General search results are labeled source excerpts rather than an inferred answer.
  No match produces a precise unsupported result; no evidence is fabricated.
- Outlet questions call existing decimal arithmetic and display formula, inputs,
  assumptions and sources. Only the existing verified quantity or a smaller quantity
  uses its terms; larger scenarios require confirmation rather than bypass package
  checks. Zero, negative, fractional or multiple ambiguous quantities ask clarification.
- Decline questions run the deterministic premise check before generating anything.
  C01 still reports insufficient decline evidence, alongside actionable integration
  concern/remediation findings labeled renewal. P01 remains new sale. Renewal
  friction is never presented as a measured repeat-order decline.
- Detail/action views embed account questions, cited claim cards, recorded checks,
  premise and limitations, generation status/calls/cost/latency and editable drafts.
  Changing resource/route/snapshot clears prior answer/draft state and aborts requests.
- Template answers/drafts work without credentials. Optional model customization
  selects/reorders supplied fact IDs or selects grounded discussion points for a
  draft. Unknown IDs, duplicate selections, new prose and extra properties are rejected.
  Core action/unknowns remain in the draft; generated output cannot change authority,
  pricing, commercial terms, scope or perform an external action.

## Intentional implementation limit

Unrestricted LLM paraphrases are not released: a source ID alone does not verify
semantic claim support. Generation is an extractive fact-selection plan, followed
by server templates. English/Indonesian framing works; original evidence/action
text retains its original language. This conservative design is an explicit limit
relative to fully fluent bilingual explanations/customized prose in the PRD.
Human review and live evaluation are needed before expanding that behavior.

## Provider and provenance controls

`QA_LIVE_ENABLED=false` by default. Live calls require explicit server configuration
of that switch, `LLM_API_KEY` and an exact `LLM_MODEL`. No model or price is guessed.
`MODEL_MAX_CALLS` bounds physical attempts per API process, including retries;
timeouts/concurrency and advisory-lock cache reuse follow the shared Interpreter.
Q&A plans use `grounded-generation-v1`, `fact-plan-v1` and `qa-limits-v1` versions.
Sources, question, facts, language and model enter the cache key. Cache hits are
revalidated and cost zero new calls; errors never become successful inference.
Per-request call counts remain correct under concurrency. Retry request costs are
unknown when total usage cannot be established. Known cost uses configured rates.

Citation IDs must exist in the selected dataset and in the assembled evidence.
Claims come from existing deterministic read models or explicitly labeled source
excerpts; model output cannot introduce a claim. This does not replace independent
human review of extraction/recommendation semantics. Customer passages are data,
not instructions. No model SQL, sending, CRM writes, connectors or embeddings.

The Responses schema follows [official OpenAI structured-output documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
OpenAI Docs skill was used for this implementation check. Schema conformance is
not proof of semantic correctness.

## Files and validation

Contracts: `packages/contracts/src/index.ts`; retrieval/answers:
`apps/api/src/modules/qa/service.ts`; endpoint: API `app.ts`; generation:
`ai/schemas/interpretation.ts`, `ai/providers/generative.ts`, `ai/router.ts`.
Web: `components/AccountQA.tsx`, `pages/App.tsx`, typed client. Configuration:
`config/env.ts`, `.env.example`. No new database or migration.

- Typecheck and API/frontend build passed.
- All 29 Vitest tests passed. New integration assertions cover calculation inputs,
  missing pricing, scoped citation resolution, premise plus diagnosis, source
  instruction injection, unsupported questions, cross-snapshot isolation, account
  resolution, history limits, model failure, invented facts, usage and cache reuse.
- All six Playwright journeys passed using installed Microsoft Edge, including
  C01 premise plus useful diagnosis/source opening, Indonesian draft edits, C06
  deterministic value and cross-account clarification; all Phase 4 journeys remain.
- `npm run eval:qa -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340`
  passed 26 curated source-case regression questions (13 English, 13 Indonesian),
  with zero missing expected references and zero invalid citation references.
  Observed run latency, including source-resolution checks: median 91 ms, p95 178 ms.
  Zero live calls, zero estimated call cost. These timings describe this one local
  run, not a production target. Report:
  `artifacts/evaluations/qa-6cc6da25-eb60-47e7-ae54-b18975cdc0f4/report.json` (ignored).
- Unsupported semantic claims and live model quality are **not independently measured**.
  Synthetic provider doubles validate contracts/cache/failure behavior, not live inference.

Reproduce with local PostgreSQL, the imported/analyzed/diagnosed snapshot and
`npm run dev`; then `npm run eval:qa -- --dataset <uuid>`. Evaluation writes only
IDs/metrics to ignored artifacts, not raw passages; default Q&A writes auditable
unavailable model-run records and makes no external call.

## Remaining gates and next task

Human-reviewed answer/claim support, alias/retrieval misses beyond showcased
accounts, fluent bilingual generation and live provider quality/cost remain open.
Local OS-user access remains the security boundary; remote authentication/hosting
is not implemented. No complete purchase/renewal/payment ledger is supplied.
Follow-up history is question-only, not a fully conversational assistant.

Next: review these 26 cases and agree numerical quality gates, select/configure a
model and run explicit live evaluation. PRD-0x7 optimization remains conditional
on that evidence; classifier/semantic retrieval should not be added yet.
