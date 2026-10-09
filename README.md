# Account Expansion Assistant

KasirNusa account-expansion discovery and stakeholder-aware sales guidance.
Product scope and engineering requirements live in [AGENTS.md](AGENTS.md).

## Current state

Phase 0 inspection and Phase 1 deterministic C06 slice are implemented: React/Vite,
Express/TypeScript, shared Zod DTOs, PostgreSQL/Drizzle migrations, retained-source
import, analysis, evidence endpoints and a local review UI. Broader interpretation,
stakeholder diagnosis, the full three-view workflow, drafts and Q&A remain planned.
Phase 2 adds deterministic revision/cancellation handling, scoped provider adapters,
durable cache/failure records and synthetic evaluation. Live model evaluation and
human acceptance gates remain open. This is not a complete MVP.
See [Phase 2 handover](docs/PHASE-2-HANDOVER.md).

## Local setup

Use Node **24.20.0** (`.node-version`), npm **11.19.0**, and Docker Desktop with
Linux containers. Dependencies are exact-pinned with a shared lockfile; Compose
pins PostgreSQL **18.1**. Run commands from the repository root.

```powershell
npm ci
# Optional: customize the ignored server environment before starting services.
Copy-Item .env.example .env
docker compose up -d db
npm run db:migrate
npm run data:prepare -- --manifest data/manifests/kasirnusa-2026-10-01.json
npm run data:import -- --manifest data/manifests/kasirnusa-2026-10-01.json
```

Supplied files must exist under `data/raw/`; they are excluded from Git.
Preparation creates checksum-verified immutable versioned copies and preserves
originals. Import prints the internal dataset UUID. For the supplied manifest:

```powershell
npm run data:analyze -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340 --as-of 2026-10-01
npm run data:verify -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340 --fixture tests/fixtures/c06-review.json
npm run dev
```

Open **http://127.0.0.1:5173**. Vite proxies `/api` to the loopback API at port
3001 (or configured `API_PORT`). Stop development with Ctrl+C; use
`docker compose stop db` to stop PostgreSQL while preserving its named volume.
Use the verified **1 October 2026** snapshot for historical calculations, not today.

## Checks and migrations

```powershell
npm run typecheck
npm test
npm run build
# After intentional schema edits, review generated SQL before applying it:
npm run db:generate
npm run db:migrate
```

Tests require local PostgreSQL and database-creation privileges. They create a
random `kasirnusa_test_<uuid>` database, apply committed migrations, use synthetic
fixtures, and remove only their own database. They never truncate or migrate the
imported developer database. Production artifacts are in ignored `apps/*/dist`;
`npm run start -w @kasirnusa/api` starts the built API. Production frontend serving
and hosting are not configured.

```powershell
npm run eval -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340
npm run data:verify -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340 --fixture tests/fixtures/c02-review.json
```

Evaluation defaults to offline synthetic regression cases. Provider adapters are
server-side and require explicit CLI `--live` plus configuration; their results
remain unverified candidates, not action-card inputs. See
[provider configuration and limitations](docs/AI-PROVIDERS.md).

An esbuild **0.28.2** override resolves observed development-tool advisories;
clean install, migration generation, tests and builds were checked with it.
Compatibility references: [Vite](https://vite.dev/guide/),
[Express 5](https://expressjs.com/en/guide/migrating-5/),
[Drizzle migrations](https://orm.drizzle.team/docs/drizzle-kit-generate), and
[PostgreSQL image](https://hub.docker.com/_/postgres).

## API and access boundary

Implemented read endpoints: `/api/health`, `/api/datasets`, `/api/accounts`,
`/api/accounts/:id`, `/api/opportunities`, `/api/opportunities/:id`,
`/api/opportunities/:id/evidence`, `/api/sources/:id`. Route IDs are internal UUIDs.
Data queries accept `dataset_id`; omitted selection resolves a ready authorized
snapshot. Lists support `page`, `page_size` (maximum 100); accounts accept `q`,
opportunities accept `account_id`, `kind`, `status`. Evidence paths cap nodes
and follow fixed paths of at most three hops. Source content comes from SQL,
never browser-supplied filesystem paths.

The demo trusts the local OS user. API/database bind to loopback; host/origin
checks reject non-local browser access. `ALLOWED_DATASET_IDS` can restrict ready
snapshots; empty means all locally imported ready snapshots. Every query enforces
snapshot isolation. This is not remote authentication or per-user account access.
Define that boundary before exposing customer data remotely. No upload/admin,
external-message, CRM-write or provider endpoints exist.

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

Original inputs remain under `data/raw/`; byte-identical copies are under
`data/raw/kasirnusa-2026-10-01/`. The source README and observed operational ranges
support the snapshot date; they do not establish external activity completeness.
Every supplied record is retained before seven core inputs normalize; other
domains remain staged for later phases. Malformed/unresolved input is reported,
and unusable required coverage prevents readiness and analysis. The challenge PDF
is absent. Keep raw records, generated artifacts and secrets out of commits.

## Development sequence

Verify sources first; build a deterministic C06 evidence path, automate validated
interpretation, implement C01 stakeholder diagnosis with the supporting P01 case,
deliver the three product views, and then add grounded Q&A. Optimization is
conditional on evaluation. Expansion, renewal and new-sale context stay separate.

See the [development plan](docs/README.md) for phase PRDs, definitions of done,
acceptance checks and out-of-scope work. Phases 0–1 are locally verified;
Phase 2 infrastructure is tested with live evaluation gates open; Phases 3–6
remain planned. Run `python scripts/audit_sources.py` to
regenerate the checksum manifest and inventory from the original `data/raw/` files
with Python 3.10 or newer (verified with Python 3.14.7). This standard-library tool
does not import or change customer records; diagnostics are stored in ignored
`data/processed/`. See the [source review](docs/C06-SOURCE-REVIEW.md) and
[limitations](docs/SOURCE-LIMITATIONS.md) before building the runtime.
