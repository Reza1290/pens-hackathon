# Account Expansion Assistant

KasirNusa account-expansion discovery and stakeholder-aware sales guidance.
Product scope and engineering requirements live in [AGENTS.md](AGENTS.md).

## Current state

The repository has a folder baseplate only. No application, dependencies,
database schema, importer, model integration, or evaluation is implemented.
The directories are retained with `.gitkeep` files. Runtime versions, package
manifests, lockfile, Compose configuration, and environment examples will be
added and verified during application scaffolding. No runtime commands work yet.

## Layout

| Path | Responsibility |
| --- | --- |
| `apps/web/src/` | React/Vite frontend: pages, feature UI, typed API client |
| `apps/api/src/` | Express/TypeScript API and shared batch modules |
| `apps/api/src/db/` | PostgreSQL/Drizzle schema, client, reviewed migrations |
| `apps/api/src/modules/` | Ingestion, accounts, interactions, opportunities, stakeholders, graph, recommendations, Q&A |
| `apps/api/src/ai/` | Backend-only provider adapters, prompts, output schemas |
| `packages/contracts/src/` | Shared Zod DTOs and TypeScript types |
| `data/raw/` | Original local data, excluded from Git |
| `data/processed/` | Generated labels/interchange data, excluded from Git |
| `data/manifests/` | Versioned checksums, verified snapshot and mapping metadata |
| `tests/fixtures/` | Small synthetic/redacted acceptance fixtures |
| `artifacts/evaluations/` | Generated evaluation reports, excluded from Git |
| `ml/intent_classifier/`, `models/intent_classifier/` | Reserved optional classifier locations; no training or artifacts |
| `docs/` | Development phase PRDs and handover documentation |

## Source handling

Existing inputs remain under `data/raw/`. The supplied README states a snapshot
of **1 October 2026**, with operational coverage from 1 October 2025 through
30 September 2026 and some older deal/decision history. This is documentation
evidence, not a completed audit of actual dates or completeness.

Phase 0 must inspect actual schemas, verify coverage and source IDs, and plan
immutable `data/raw/<dataset-version>/` storage before import. The challenge PDF
was not found in the current file inventory; record that limitation or locate it.
Keep customer data, generated model artifacts and secrets out of commits.

## Development sequence

Verify sources first; build a deterministic C06 evidence path, automate validated
interpretation, implement C01 stakeholder diagnosis with the supporting P01 case,
deliver the three product views, and then add grounded Q&A. Optimization is
conditional on evaluation. Expansion, renewal and new-sale context stay separate.

See the [development plan](docs/README.md) for phase PRDs, definitions of done,
acceptance checks and out-of-scope work. All implementation phases remain planned.
