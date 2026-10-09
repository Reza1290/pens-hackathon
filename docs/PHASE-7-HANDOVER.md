# Phase 7 handover — stakeholder guidance and grounded Q&A

Recorded 10 October 2026. **Integration implemented; reviewed/live gates open.**
Baseline: `ce66773f828a249d3c771e2da58e7f9a807b6e68`.
Historical source analysis remains as of 1 October 2026.

## Delivered behavior

The Q&A endpoint validates one allowlisted operation, resolves authorized context,
retrieves connected evidence, performs deterministic premise/value checks and
returns validated facts and proposed actions. Optional DeepSeek planning and fact
selection have bounded fallbacks. Bare “why?” or “berapa?” produces clarification.
Comparison metric and all four dates pass through shared contracts, API and UI;
incomplete date entry cannot silently lose the requested comparison.

Connected retrieval follows explicit reply links, evidence-backed assertions and
their entity targets. It preserves full retrieved passages, hashes, attribution,
inclusion paths, unresolved parents, attachment and coverage metadata. Boundaries
are dataset/account/as-of, two reply hops, 24 combined records, 24,000 characters,
2,000 ms; these settings are not measured quality thresholds. Explicit decision
tokens constrain thread expansion. Participants are recorded as sender/recipient;
shared participants alone do not create a meeting/decision connection. Unlinked
meetings and attachments remain unavailable. Routine messages remain searchable.

Requirement assessment supports ROI/payback, references, pricing, rollout and
integration. Four statuses persist through diagnoses and Q&A and render in the
UI. Literal candidates are labeled; optional Jev receives actual requirement and
follow-up text. Missing attachment, unresolved scope or truncated coverage causes
abstention. Addressed text never establishes fulfillment or customer acceptance.

The raw owner-X/intermediary-Y fixture passes import → connected retrieval →
assessment → ordered operational preparation/joint discussion → API/UI/Q&A/draft.
Partial, complete, missing attachment and wrong-decision reply cases are exercised.
Requirements retain their holder; an intermediary does not inherit preferences.
Authority follows dated employment and resolved thread/decision scope. Conflicting
or unresolved authority does not select a confident approver. Prerequisites take
priority over ordered sales preparation. Direct contact requires explicit direct
authority; intermediary/joint/clarification routes remain available.

Historical commercial exceptions are retrieved separately (maximum six), with
original rationale, internal approving employee, dates, scope differences and
unknown comparability. They do not authorize a new discount. Expansion listing
is selected-account scoped (maximum 12); account selection remains required.

Answers and drafts use backend fact/evidence bindings. Generative output can only
select valid fact IDs; extra prose/unsupported IDs are rejected. Exact source quotes
are checked against stored payloads. Arithmetic and role attribution remain in
code. This constrains new model claims; it does not independently certify the
semantic correctness of rule candidates. No messages are sent or CRM records changed.

## Files and storage compatibility

- Shared DTOs: `packages/contracts/src/index.ts`.
- API query flow: `apps/api/src/app.ts`, `modules/qa/{planner,retrieval,precedents,service}.ts`.
- Stakeholder analysis: `modules/stakeholders/{rules,requirements,service}.ts`.
- Model schemas/prompts, three generative adapters, Jev adapter and router versions.
- UI: `AccountQA.tsx`, `pages/App.tsx`; `.env.example` documents independent flags.
- Synthetic acceptance tests: `phase7.test.ts`, `database.test.ts`,
  `e2e/phase7.spec.ts` and raw snapshot fixtures.
- Synthetic live tooling: `apps/api/src/cli/phase7-smoke.ts`.

No physical SQL migration is required: existing JSONB diagnoses/assertions/findings
store additive fields. Old DTO fields have conservative defaults; old scoped
assertions are not assigned invented decision targets. Rebuilding diagnoses creates
versioned analysis runs and updates the current read model, retaining old sources,
assertions, recommendations and model runs. A completed cached analysis restores
its own saved diagnosis when switching feature configurations.

Interpretation cache changes from three-choice schemas to
`interpretation-v2-four-choice` / `bounded-interpretation-v2`. Planner uses
`operation-plan-v1` / `operation-planner-v1`; answer selection uses
`fact-plan-v1` / `grounded-generation-v2`. Scope, input text, source revisions,
operation and model identity participate in cache identity. Obsolete three-choice
distributions fail validation; successful cache hits are validated again.

## Validation actually run

- `npm run typecheck`: passed across root/API/web/contracts.
- `npm test`: 43 tests across six files, including disposable migrated PostgreSQL,
  all four simulated Jev choices, obsolete distributions, extraction success/failure,
  analysis rollback, planner fallback, periods, listing and precedents.
- `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e`: seven browser journeys passed.
  The new raw fixture uses a separately migrated random test database and real API;
  teardown removes only that verified test database and its synthetic files.
- `npm run build`: API and Vite build passed.
- `npm run data:diagnose -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340`:
  45 diagnoses, four statements, 30 decisions, zero unresolved decisions.
- `npm run data:verify-stakeholders -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340 --fixture tests/fixtures/stakeholders-review.json`:
  C01 renewal/prerequisite, P01 new-sale/joint route and C02 expansion/prerequisite verified.
- `npm run eval:qa -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340`:
  26/26 source regression checks; zero missing expected evidence, zero invalid
  citations, zero live calls. This checks specific cases, not generalization.
  An initial attempt required starting the stopped local API; rerun passed.

## Synthetic live smoke — review pending

Command: `npx tsx apps/api/src/cli/phase7-smoke.ts --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340 --live`.
Four physical calls, one maximum per operation, synthetic content only.
No imported customer passages or credentials were logged/transmitted as fixture text.

| Operation | Model | Expected | Observed | Input/output tokens | Latency |
| --- | --- | --- | --- | --- | --- |
| Planner | deepseek-flash | account diagnosis | stakeholder guidance; valid schema, expectation mismatch | 2410/22 | 983 ms |
| Requirement | jev-1.13.0 | partially addressed | partially addressed | 897/64 | 439 ms |
| Extraction | deepseek-flash | requirement source-span candidate | validated candidate | 1130/169 | 1156 ms |
| Answer selection | deepseek-flash | prepare-evidence fact ID | selected expected fact ID | 444/10 | 662 ms |

All outputs passed structural validation; three matched their predeclared expected
behavior. The smoke command exited nonzero for the planner mismatch. The cached
inspection made zero additional calls and retained that mismatch. The planner
choice can still expose stakeholder actions, but its routing expectation needs
review; this is not recorded as a passed live acceptance gate. Jev estimated cost
was USD 0.0000376740. DeepSeek costs remain unknown without configured rates.
Independent human review is pending. Live adapter checks do not substitute for
reviewed normal-workflow quality/cost evaluation.

Current TypeSafe [API](https://docs.typesafe.ai/api),
[Choice](https://docs.typesafe.ai/primitives/choice) and
[citation cookbook](https://docs.typesafe.ai/cookbooks/citation_check) were read
using the installed TypeSafe skill. Markdown endpoint reads failed; normal pages
were available. Four-choice confidence remains fallible interpretation.

## Configuration, remaining gates and rollback

`QA_PLANNER_ENABLED`, `QA_JEV_ENABLED`, `ANALYSIS_EXTRACTION_ENABLED`,
`QA_LIVE_ENABLED` independently default to false. Normal calls retain existing
`MODEL_MAX_CALLS` and timeout budgets; no unlimited repair loop is added.
Planner, judgment, extraction and generation outcomes/calls are reported separately;
unknown cost stays null. Cost/usage remains queryable by model-run ID. Degraded
template mode is visible. This work does not enable these flags in the user's `.env`.
DeepSeek uses configured `DEEPSEEK_API_KEY`/model; Jev uses `JEV_API_KEY`/model.
Pricing estimates require configured input/output rates.

Open work: independently review the smoke set and planner discrepancy; evaluate
semantic requirement/extraction support on reviewed examples; audit provider
cache/failure/budget behavior for every new operation, including live failure paths.
Complex extraction is integrated into normal analysis but remains a validated,
unresolved candidate until semantic review; it does not automatically grant
authority or satisfy requirements. Literal assessments have limited language
coverage. Explicit decision-token/thread matching cannot resolve every implicit
commercial scope; ambiguous links must be clarified. Discount lookup depends on
literal recorded values/rationale; quantity/payment/package comparability may be
unknown. No measured general quality, savings or latency claim is made.

For operational rollback, disable the four independent flags, restart the API and
rerun `data:diagnose` for the selected dataset. Old completed baseline configurations
restore their own read model. For code rollback, revert the Phase 7 commit and rerun
the previous diagnosis CLI; retain migrations and historical records. Do not delete
the database or reinterpret old model outputs. PRD-0x7's reviewed/live optimization
gates remain open; classifier and semantic retrieval remain disabled.
