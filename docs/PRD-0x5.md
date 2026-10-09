# PRD-0x5 — Phase 4: Deliver the sales workflow

Status: Implemented and locally verified. Dependency: PRD-0x4 and validated API DTOs.
Requirements: FR-05–08, FR-10–13; AGENTS.md Sections 7 and 18.

## Goal

Let a user discover expansion, inspect evidence and prepare a justified action
through the three required views, including accounts with no expansion signal.

## In scope and deliverables

- Opportunities view with account, request/status, timing, priority category,
  conditional annualized value and missing next step; support pagination/filtering.
- Account/opportunity detail with findings, stakeholder context, original evidence,
  freshness, unknowns and a bounded Cytoscape relationship path. Support account
  investigation independently of an opportunity.
- Action-plan view with owner, direct/joint/intermediary route, rationale and
  evidence-linked discussion points. Show prerequisites and questions to verify.
- Add opportunity/account draft endpoints returning editable template drafts for
  human review, grounded in the selected action. Customized generation is Phase 5.
- Use React Router and one typed API client, selected dataset/account state and
  loading/empty/error states. Show direct/reported attribution and premise checks
  before explanations; calculations and authority remain backend responsibilities.

## Definition of done

- [x] User can navigate C06 opportunity → evidence → action → editable draft.
- [x] User can inspect C01 renewal diagnosis without inventing an expansion signal;
  P01 remains labeled new sale and separate from expansion value.
- [x] Every material factual card/talking point resolves to readable original evidence
  or the corresponding calculation/check; graph edges retain source references.
- [x] Pricing assumptions, commercial context, as-of, coverage and unknowns are visible.
- [x] Dataset/account selection scopes requests and updates consistently; inaccessible
  resources and API failures show appropriate states.
- [x] Drafts remain reviewable/editable and no send or CRM-write behavior exists.
- [x] Keyboard navigation and readable layouts work across the core workflow.
- [x] A small Playwright journey and relevant typecheck/test/build checks pass;
  shared DoD and remaining limitations are recorded.

## Out of scope

A separate fourth chat screen, dashboard-only stakeholder guidance, full-database
graph visualization, frontend revenue calculations, provider credentials in browser
code, hosting rollout and automatic sending.

## Verification and handover

See [Phase 4 handover](PHASE-4-HANDOVER.md) for behavior, checks and limitations.
Template framing supports English/Indonesian; action text stays verbatim.
Grounded generative Q&A and customized drafts remain PRD-0x6.
