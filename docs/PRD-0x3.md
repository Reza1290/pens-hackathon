# PRD-0x3 — Phase 2: Automate validated interpretation

Status: Planned. Dependency: reproducible PRD-0x2 evidence path.
Requirements: FR-01–04, FR-11–12; AGENTS.md Sections 8, 11 and 17.

## Goal

Extract reusable dated assertions from changed records, measuring quality before
enabling model judgments. Preserve deterministic capability during provider failure.

## In scope and deliverables

- Rules first for candidate intent, quantities, dates, requests and commitments.
  Handle acknowledgement, substantive response, cancellation, negation and revision.
- Verify Jev documentation, availability, models, schemas and costs. Evaluate bounded
  intent, role-evidence, relevance and concern-addressed judgments against reviewed labels.
- Use one generative adapter for extraction rules cannot resolve. Retrieve bounded
  stakeholder candidates before judgments; include insufficient-evidence outcomes.
- Version prompts/schemas/operations; validate outputs, evidence spans and identities
  before persistence. Retain direct/reported speaker attribution and contradictions.
- Cache successful outputs by dataset/scope, content, operation, model, prompt,
  schema and parameter versions. Invalidate dependent findings on changed inputs.
- Enforce timeouts, bounded retries/concurrency and budget controls. Track calls,
  usage, cost and latency; mark unavailable/invalid interpretation explicitly.
- Implement `eval` against human-reviewed labels with sample counts and separate
  metrics for signal labels, extraction, role assignment and support judgments.

## Definition of done

- [ ] Reviewed fixtures cover request repetition, negation, cancellation, revision,
  acknowledgement, ambiguity and unsupported assertions.
- [ ] Repeated messages yield one updated signal rather than duplicate opportunities.
- [ ] Accepted assertions carry source span/field, event date, scope, method/version,
  attribution, verification state and model metadata when applicable.
- [ ] Rules-only and rules-plus-Jev results are measured on the same labeled set;
  thresholds/gates are agreed from evidence before automated acceptance is enabled.
- [ ] If Jev is unavailable, its evaluation/integration is explicitly unfinished;
  mock inference is never presented as real, and deterministic features still work.
- [ ] Invalid outputs and provider failures have explicit outcomes; stale caches are
  rejected and repeated valid requests reuse the appropriate successful output.
- [ ] Call/usage/cost reporting and meaningful provider-failure tests pass.
- [ ] Relevant checks and shared DoD are recorded without generalization claims
  based solely on showcased examples.

## Out of scope

Classifier training, embeddings, unrestricted prose judgments, arithmetic by models,
model-selected identities without constrained candidates and claiming model confidence
is verified truth or purchase probability.
