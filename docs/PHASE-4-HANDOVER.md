# Phase 4 handover — sales workflow

PRD-0x5 is implemented and locally verified. Phase 5 grounded Q&A and the
Phase 2 live-provider evaluation gates remain open.

## Completed behavior and files

- Opportunities: backend pagination, account/request/status filters, request-based
  priority category, timing, owner, recorded next step and conditional value.
- Account/opportunity detail: dated findings and checks, source passages and
  readable original SQL records, scoped authority, direct/reported attribution,
  current/historical employment, internal decisions, scenario assumptions and unknowns.
- Lazy-loaded Cytoscape paths with backend bounds, edge evidence buttons and an
  equivalent keyboard-accessible relationship list.
- Action plan: owner/recipients, supported route and audience-specific talking
  points with evidence. P01 supports joint discussion/intermediary preparation;
  C01 preserves renewal context and remediation first.
- Embedded outcome questions request the deterministic premise check before
  diagnosis. This is not generative Q&A; unsupported decline remains insufficient data.
- Typed client and React Router preserve selected snapshot in URLs. Snapshot,
  account, view and route changes clear previous drafts; loading/empty/error states
  are explicit. Opening original evidence moves keyboard focus; closing restores it.
- Editable subject/body templates with evidence links, review notes and no send/save.
  English/Indonesian framing preserves verbatim action text, possibly in its original
  language. Edits are browser-local and discarded on leaving the view.

Shared DTOs: `packages/contracts/src/index.ts`. Server composition:
`apps/api/src/modules/recommendations/drafts.ts` and `app.ts`. UI:
`apps/web/src/pages/App.tsx`, `lib/api.ts`, `components/Graph.tsx`, plain CSS.
Pinned additions: Cytoscape 3.34.3, Playwright 1.64.0. No migration/import change.

## Draft API

`POST /api/opportunities/:id/draft?dataset_id=<uuid>` and
`POST /api/accounts/:id/draft?dataset_id=<uuid>&route=joint|intermediary`
accept `{"language":"en"}` or `{"language":"id"}`. Account drafts also support
existing prepared signal/deal scope. Responses preserve account/resource IDs,
context, date, route, recipients and evidence IDs. The server loads its own action,
rejects browser recipient/action overrides and cancelled opportunity drafts,
and preserves snapshot isolation and stale-diagnosis checks. No database records
or provider calls are created.

## Validation and reproduction

- Typecheck passed across root/contracts/API/web.
- All 26 Vitest tests passed. Disposable PostgreSQL tests include draft grounding,
  renewal/expansion context, unauthorized snapshots, rejected browser overrides,
  cancelled requests and unchanged recommendation counts.
- API/frontend builds passed; graph rendering loads separately.
- Four Playwright journeys passed: C06 evidence → action → editable draft;
  C01 premise/renewal → P01 route and cleared draft; resource/API failures and
  keyboard navigation; snapshot reset with an explicitly synthetic empty snapshot.
- Chromium-based installed Microsoft Edge was used via `PLAYWRIGHT_CHANNEL=msedge`.
  Desktop and 390px mobile screenshots were inspected, and mobile overflow checked.
  This is a limited keyboard check, not a comprehensive accessibility audit.
- C06/C01/P01 source verification is recorded in earlier handovers. Browser tests
  exercise their prepared snapshot; they do not establish model generalization.
  Screenshots/traces contain local data and remain ignored.

Start local PostgreSQL, import/analyze the documented snapshot and run
`data:diagnose`. Install Chromium with `npx playwright install chromium`, then run
`npm run test:e2e`. Alternatively set `$env:PLAYWRIGHT_CHANNEL='msedge'` on Windows
to use installed Edge. Playwright starts `npm run dev` or reuses an existing local
server. It requires the ready, diagnosed `kasirnusa-2026-10-01` snapshot. HTTP calls
are read-only apart from ephemeral template preparation; no customer record changes.
Implementation references: [Playwright](https://playwright.dev/docs/intro),
[browser channels](https://playwright.dev/docs/browsers),
[Cytoscape.js](https://js.cytoscape.org/).

## Limitations and next task

Local OS-user access remains the security boundary; remote hosting is out of scope.
Account selectors load at most 100 rows, sufficient for this 45-account snapshot;
larger datasets need paginated search. No draft persistence, automatic translation
or model prose. Comparison dates/proxy metrics remain available through the API,
not a UI editor. Jev/LLM outputs remain unverified candidates; no live calls here.

Next: PRD-0x6, bounded retrieval and cited Indonesian/English account Q&A with
provider-unavailability, citation support and cross-account evaluation gates.
Classifier and semantic retrieval remain conditional.
