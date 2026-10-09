# PRD-0x6 — Phase 5: Grounded account Q&A

Status: Planned. Dependencies: PRD-0x3 provider gates and PRD-0x5 workflow.
Requirements: FR-09–10, FR-13; AGENTS.md Sections 7, 8, 17, 18 and 20.

## Goal

Answer Indonesian/English account questions with retrieved evidence, deterministic
calculations and explicit limitations, and prepare customized drafts for review.

## In scope and deliverables

- Add `POST /api/qa` with validated question, optional account/opportunity context
  and bounded conversation context. Embed Q&A in detail/action views.
- Retrieve bounded graph facts and PostgreSQL full-text passages with an explicit
  `simple` configuration plus normalized keyword/alias matching; evaluate misses.
- Resolve ambiguous account references and metric meanings before dependent analysis.
  Run outcome-premise checks before generating explanations of decline.
- Code handles scenario arithmetic and dates. Generate cited answers from retrieved
  evidence; validate citation existence, scope and claim support before display.
- Use versioned generative operations for explanations/custom drafts, provider budgets,
  cache and usage tracking. Preserve template drafts when generation is unavailable.

## Definition of done

- [ ] Reviewed Indonesian and English questions cover expansion, follow-through,
  stakeholder evidence, outlet-value scenarios, renewal concerns and action drafts.
- [ ] Context and references stay within the selected authorized account/dataset;
  cross-account leakage and malicious instructions in source text are rejected.
- [ ] Unsupported questions state a precise limitation; absent data and unavailable
  interpretation never become fabricated evidence.
- [ ] Outcome questions return structured premise checks before the narrower diagnosis;
  delayed expansion is not described as reduced existing revenue.
- [ ] Every answer citation resolves and supports its associated claim; numerical
  values reference backend calculation inputs and assumptions.
- [ ] Drafts use the selected action and documented requirements, remain editable,
  and never trigger an external message or system write.
- [ ] Evidence-boundary, unsupported-answer, provider-failure and citation checks pass.
- [ ] Evaluation reports actual sample counts, unsupported claims, latency and model
  calls/cost; shared DoD records what remains unverified.

## Out of scope

Semantic retrieval unless missed-evidence evaluation justifies it, unrestricted SQL,
web enrichment, whole-history prompts, invented decline explanations and autonomous
messages. No generalization or savings claim without measured evidence.
