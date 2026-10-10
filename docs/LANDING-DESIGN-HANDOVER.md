# Landing page and context graph — 10 October 2026

Local implementation for design review. No commit or deployment requested.

## Implemented

- `/` introduces the workbench with an interactive, explicitly illustrative account graph, workflow explanation and source-traceability section. It does not fetch account data or invoke models.
- `/opportunities` is the dashboard entry. Landing CTAs retain URL query parameters; dashboard navigation and existing E2E entry URLs were updated. Account and opportunity detail URLs remain unchanged. The dashboard brand links back to the landing page.
- White/warm-gray surfaces, thin borders, orange accents and restrained typography follow the existing dashboard and Cloudflare-inspired brief.
- `Graph.tsx` uses the same node palette as the landing illustration, rectangular labeled nodes, zoom/fit controls, relationship selection and an evidence inspector. All evidence links remain available in the keyboard-accessible relationship list. Node heights accommodate longer action labels.
- Graph lifecycle depends on graph data rather than the evidence callback, avoiding a layout reset when the parent renders a new callback. Empty states and traversal-limit notices remain explicit.

## Files

Landing: `apps/web/src/pages/Landing.tsx`, `landing.css`, `main.tsx`, `index.html`.
Graph: `apps/web/src/components/Graph.tsx`, `graph.css`, `graph-theme.ts`.
Integration: `apps/web/src/pages/App.tsx`; dashboard entry paths in `tests/e2e/workflow.spec.ts` and `qa.spec.ts`.

## Validation and limits

Web TypeScript check and Vite production build passed. Local Chrome checks exercised desktop (1440px) and mobile (390px) landing layouts, interactive node selection, no mobile horizontal overflow and dashboard navigation. Source-backed C06 and C01 account graphs rendered; zoom/fit and relationship-list source opening passed with no browser errors. Screenshots and local review scripts are in ignored `artifacts/`.

These are UI checks, not new evidence/model acceptance results. The full historical E2E suite was not run. Existing Tailwind CDN/font dependencies remain. Large graphs may require zooming or the equivalent relationship list. Next step: user design review; all changes remain uncommitted.
