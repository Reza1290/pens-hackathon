# PRD-0x8 — Phase 7: Complete stakeholder guidance and grounded Q&A
Status: Integration implemented; reviewed/live gates open. See [Phase 7 handover](PHASE-7-HANDOVER.md).
Dependency: Existing MVP through PRD-0x6 and the supplied implementation audit. PRD-0x7 provides optimization assessment tooling; its optional classifier, semantic-retrieval and live optimization gates do not block this phase.
Requirements: AGENTS.md Sections 4–8, 10–13 and 16–20. Verify section numbering against the repository copy before editing.
## Goal

Complete the existing evidence-to-action workflow so a user can ask why an account's purchasing progress is weak, retrieve related communications and commitments, and receive a supported recommendation about who to involve and what to discuss.
The required outcome is a complete owner-X/intermediary-Y scenario through ingestion, scoped retrieval, requirement assessment, action selection, cited answer and reviewable draft. Merely adding provider keys or passing isolated adapter tests does not complete this phase.
Keep the current React/Vite, Express/TypeScript and PostgreSQL/Drizzle architecture. Extend existing modules and preserve deterministic behavior.
## Starting point and evidence boundary

The supplied audit reports working imports, relational graph/evidence storage, deterministic opportunities, stakeholder rules, templates, provider adapters, caching and evaluation infrastructure. It identifies gaps in operation routing, connected-source retrieval, general requirement assessment, commercial scope and end-to-end integration.
This PRD is based on that audit and the supplied PRD-0x7. It does not independently certify the local repository or earlier test results. The implementing agent must inspect current files and record the starting commit before changing them. Prior counts of 32 backend tests, six browser journeys and the 25-case synthetic assessment are historical reports, not acceptance evidence for this phase.
## Required user scenario

Synthetic Account A contains:
- A dated customer statement explicitly establishing X's approval role for expansion S.
- X's request for ROI evidence before deciding on S.
- A dated statement that Y handles operational inputs and prepares the proposal for X.
- Sales emails to Y about S that discuss features without addressing ROI.
- Related replies, plus an unrelated reply that must not satisfy the ROI requirement.
For “What should we do next for Account A?”, the system should recommend, when supported:
Work with Y to prepare the ROI evidence requested by X, then ask Y to arrange a joint commercial discussion with X.

If the question instead alleges lower repeat orders, check the metric and comparison period first. Report insufficient evidence of decline when appropriate, while explaining the narrower documented purchasing friction. Never invent an expansion decline from an unconfirmed renewal or an unanswered email.
An owner's title or a request for ROI alone does not establish purchasing authority. X's requirements remain attributed to X; working with Y does not mean Y shares those preferences.
## In scope and deliverables

1. Explicit operation planning for user questions
Implement this normal Q&A path:
User question and selected context → LLM operation plan → backend validation → scoped retrieval → deterministic premise/calculation checks → optional focused Jev judgment → grounded answer → output validation.
- Add a versioned planner schema with a discriminated union of allowlisted operations. Suggested operations: account diagnosis, expansion listing, stakeholder guidance, value scenario, commercial-precedent lookup and source search. Map these to existing services; names are contracts to establish, not assumed existing functions.
- Each operation has its own arguments. Resolve account/dataset IDs, commercial scope, intent and any comparison periods. Validate date ranges, limits, access and supported metric definitions server-side.
- An unresolved account, meaning of “repeat order,” or comparison period produces a targeted clarification when it changes the answer. Do not silently invent a baseline.
- Carry comparison arguments through the shared DTO, Q&A endpoint and UI. Show the interpreted metric and periods in the answer.
- Plans cannot contain executable SQL, arbitrary URLs, filesystem paths or unrestricted tool names. Execute parameterized backend functions only.
- Bound the number of operations and provider calls. Support one clear plan/result cycle first; any repair or additional retrieval is explicitly budgeted.
- When planning is unavailable or invalid, use deterministic routing only for clearly supported requests; otherwise request clarification or return a capability limitation. Broad words such as “why” or “berapa” cannot alone determine the operation.
2. Bounded retrieval of connected evidence
Replace Q&A's isolated top-hit search with a shared retrieval service that returns an evidence bundle.
- Seed retrieval using account/deal/signal context, relevant graph assertions and text matches.
- Expand through reply parents and descendants, participants, linked meetings, decisions, commitments and supporting source records. Use explicit links or documented matching criteria; same-account membership alone is insufficient to establish relevance to one decision.
- Enforce dataset/access boundaries, as-of date and decision scope. Separate customer-context evidence from cross-account commercial precedents.
- Preserve original passages, source IDs, event dates, attribution, relationship path and inclusion reasons. Include contradictory evidence, unresolved source links and missing-attachment metadata.
- Configure hop, record, text/token and time limits; prevent cycles, deduplicate and return coverage/truncation metadata. Document initial limits as operational settings, not measured quality thresholds.
- If missing or truncated evidence affects a judgment, retrieve a bounded additional slice or report insufficient evidence. “Not retrieved” must not become “never happened.”
- Routine-classified messages remain eligible for retrieval. A local classifier or Jev label must not permanently remove original messages from search.
The returned bundle should contain scope, sources/passages, assertions, relationships, coverage and any deterministic results. The answer must cite the exact source revisions actually provided.
3. General requirement-versus-follow-up assessment
Replace integration-specific concern handling with an assessment of each documented requirement against relevant follow-ups. Support ROI evidence, customer references, pricing conditions, rollout prerequisites and product commitments without account-name hardcoding.
- Represent each requirement with subject/holder, speaker, direct/reported attribution, account and optional deal/signal scope, event/validity dates and evidence.
- Use existing rules for clear extraction; wire complex extraction fallback into normal analysis when enabled and required. Validate model-extracted claims before persistence. If unavailable, retain an unresolved case rather than fabricate an extraction.
- Supply Jev the requirement and selected follow-up passages, not only a summary or category.
- Define four choices consistently across schemas, prompts, persistence, API and UI: addressed, partially_addressed, not_addressed, insufficient_evidence.
- addressed: the supplied response explicitly responds to the requirement. partially_addressed: it responds to only part or lacks requested details. not_addressed: adequate supplied text does not address it. insufficient_evidence: coverage, attachment availability, attribution or scope prevents a reliable judgment.
- Preserve requirement ID, assessed source IDs, assessment scope, model/prompt/schema versions and limitations with the result. Backend validation checks references; do not assume the provider natively emits unrestricted explanation fields.
- Addressing a concern, fulfilling a promise and obtaining customer acceptance are separate facts. A reply discussing an integration does not prove the integration shipped or the customer accepted the plan.
- Migrate/version stored results safely when adding the fourth choice; do not reinterpret historical results or reuse stale cached three-choice judgments.
4. Decision-scoped stakeholder guidance and action plans
- Enforce authority and requirements at their recorded commercial scope. Replace unsafe account-wide reuse with explicit scope references and validated queries. Backfill ambiguous existing assertions as unresolved; do not invent specific decision targets.
- Preserve employment validity and distinguish internal employee approvals from customer-side purchasing authority.
- Support direct decision-maker, joint discussion, intermediary preparation, resolve-prerequisite and clarify-evidence routes. Direct contact requires supported authority and a suitable recorded contact path; otherwise prefer an introduction/joint route or clarification.
- Produce ordered tasks, not just a contact list: who gathers operational data, what evidence they prepare, which requirement it addresses, and who joins the commercial discussion next.
- Each task and talking point must reference supporting evidence or be clearly labeled a proposed action. Recommendations do not create commitments or claim completed work.
- Wire the same action plan into the account/opportunity UI, Q&A and editable draft. Support account diagnosis without inventing an expansion signal or value.
5. Commercial precedent retrieval
- Add bounded lookup over prior decisions using supplied commercial context: decision type, product/package where available, quantity/volume, contract/payment conditions and relevant dates.
- Return comparable records with original rationale, approving employee, conditions, scope differences and unknowns. Missing fields must remain unknown.
- Label every result as historical precedent, not current entitlement or authorization. Do not automatically apply discounts or treat repeated examples as an official policy.
- Keep precedent evidence separate from the customer's own commitments. Similar customers' preferences must not become this customer's preferences.
6. Grounded explanations, drafts and model accounting
- Extend the current fact-selection interface where necessary to produce useful explanations and tailored drafts from validated evidence. Free-form prose is optional; a constrained answer schema with claim/evidence bindings is acceptable.
- Separate observed facts, code-calculated results, model interpretations, hypotheses and proposed actions. Explain what is unknown.
- Validate citation existence, scope and whether the cited passage supports the claim. A valid source ID alone is insufficient. Model support judgments are fallible; unsupported or unresolved assertions must be omitted, qualified or routed to clarification/template fallback.
- Use structured templates for deterministic claims and arithmetic. Do not allow generation to change quantities, dates, pricing assumptions or role attribution.
- Enforce claim/evidence bindings for drafts too; never invent product delivery dates, approved discounts or customer consent.
- Reuse current caching, budgets and usage infrastructure. Include scope, as-of date, source hashes, operation/choices and model/prompt/schema versions in cache identity as applicable.
- Report planner, Jev, extraction and answer-generation calls separately, including failures and unknown costs. Mark degraded/template mode in capability metadata. No savings or accuracy claims without measurements.
7. Specification and handover repair
- Update AGENTS.md with the explicit query flow, retrieval contract, four-choice assessment and scoped action routes.
- Replace obsolete global “not implemented” statements with evidence-backed per-capability status. Preserve limitations and open gates.
- Produce PHASE-7-HANDOVER.md with changed files, migrations/backfill behavior, commands actually run, results, capability flags, provider configuration requirements and rollback steps.
- Keep PRD-0x7's pending reviewed/live optimization gates open unless separately satisfied. This phase does not enable the optional classifier or semantic retrieval.
## Acceptance cases

Case	Required behavior
Owner X / intermediary Y	Import raw fixtures, retrieve X's statement plus Y's related exchanges, assess ROI coverage and produce the ordered preparation/joint-discussion action in API and UI
Partial ROI response	Return partially_addressed and specify which requested detail is missing based on the evidence
Complete relevant response	Do not flag the requirement as unaddressed; do not infer customer acceptance without evidence
Unrelated or wrong-deal reply	Do not use it to satisfy the requirement or transfer purchasing authority
Missing attachment / truncated retrieval	Expose the limitation; abstain where contents or coverage could change the judgment
Historical role or contradictory authority	Respect validity, preserve contradiction and clarify instead of confidently selecting an approver
Claimed repeat-order decline	Carry metric/period inputs through Q&A; return a reproducible comparison or explicit insufficient-data result
C01 source regression	Connect the integration commitment to Yoga's documented concern; identify the limited follow-up-text gap and label renewal context
P01 source regression	Distinguish Fajar's technical role from reported GM procurement authority; preserve the joint route and new-sales context
Historical commercial exception	Retrieve comparable conditions and label the result precedent, not entitlement
Routing ambiguity / invalid plan	Avoid keyword-only misrouting; reject invalid arguments and use bounded fallback or clarification
Unsupported generated claim	Reject, qualify or fall back even when the cited source ID exists
Provider failure / stale cache	No fabricated judgments; valid deterministic features continue; stale outputs are not reused


Use source examples only after verifying them against the imported snapshot. Use synthetic fixtures for owner-X/Y and clearly label them; do not rewrite source customer records to manufacture the scenario.
## Definition of done

- [x] Current repository baseline and audit gaps are confirmed with file/commit references.
- [x] The normal Q&A path uses validated operation planning when configured and has a tested deterministic/clarification fallback.
- [x] Related-source retrieval includes bounded thread and decision expansion with scope, provenance and coverage metadata.
- [x] All four assessment choices work through normal analysis/Q&A, persistence and UI; requirement assessment is not integration-specific.
- [x] Authority/requirements cannot leak between unrelated decisions, organizations or invalid time periods.
- [x] Owner-X/Y passes one raw-ingestion-to-answer-and-draft workflow test, including negative cases; tests do not bypass retrieval by injecting only selected conclusions.
- [x] Comparison periods and premise results are supported through Q&A DTOs and UI.
- [x] Commercial precedents retain conditions and do not authorize new terms.
- [x] Answers/drafts have supported claim bindings and reproducible numeric values; unavailable evidence is explicit.
- [ ] Cache, failure, budget and usage behavior is checked for every newly integrated model operation.
- [x] Relevant unit, migrated-database integration and browser checks are rerun; exact results are recorded.
- [ ] A reviewed live provider smoke set exercises planner, Jev judgments, extraction fallback and answer generation; expected-versus-observed results and limitations are recorded without claiming generalization.
- [x] AGENTS.md and PHASE-7-HANDOVER.md accurately distinguish implemented, tested with synthetic responses, live-tested and still-open gates.
If keys or reviewed examples are unavailable, implementation and simulated integration checks may finish, but the live verification checkbox remains open. Report “integration implemented; reviewed/live gates open,” not “fully complete.” A smoke set checks integration and selected behavior; it does not close PRD-0x7's statistical quality or optimization gates.
## Out of scope

Apriori, mandatory TF-IDF/logistic-regression training, enabling semantic retrieval, new graph databases, unrestricted text-to-SQL, new microservices, live connectors, autonomous sending or CRM mutation, discount approval, personal performance rankings and causal claims about purchasing outcomes.
Response-time analytics and reference-introduction workflows require separate scoped PRDs. This phase may use existing relationship evidence for a supported stakeholder recommendation without authorizing outbound contact.
## Implementation order and rollback

1. Inspect baseline; establish scoped contracts and required migrations/backfill.
2. Implement and test connected retrieval independently of models.
3. Generalize requirement assessment and wire provider operations into normal services.
4. Enforce stakeholder scope and assemble ordered action plans/precedents.
5. Integrate query planning, grounded output and UI arguments/states.
6. Run the complete acceptance journey, provider smoke checks when available, and documentation/handover updates.
Keep new planner, provider judgments and answer generation independently configurable. On failure, return the existing validated deterministic result or an explicit limitation. Preserve source records and historical run provenance. Use additive migrations where feasible; document rollback/backfill handling and cache-version changes before rollout. Never silently relabel a model-dependent feature as complete when only its deterministic fallback ran.
