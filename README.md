# Account Expansion Assistant

KasirNusa account-expansion discovery and stakeholder-aware sales guidance.
Product scope and engineering requirements live in [AGENTS.md](AGENTS.md).

## Current state

Phase 0 inspection and Phase 1 deterministic C06 slice are implemented: React/Vite,
Express/TypeScript, shared Zod DTOs, PostgreSQL/Drizzle migrations, retained-source
import, analysis, evidence endpoints and a local review UI. Phase 3 adds account
stakeholder diagnoses, C01 renewal/P01 procurement routes and outcome-premise checks.
The full three-view workflow, drafts and Q&A remain planned.
Phase 2 adds deterministic revision/cancellation handling, scoped provider adapters,
durable cache/failure records and synthetic evaluation. Live model evaluation and
human acceptance gates remain open. This is not a complete MVP.
See [Phase 3 handover](docs/PHASE-3-HANDOVER.md).

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
npm run data:diagnose -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340
npm run data:verify-stakeholders -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340 --fixture tests/fixtures/stakeholders-review.json
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

Account `/diagnosis`, `/stakeholders`, and `/diagnosis/evidence` read endpoints
return prepared stakeholder guidance independently of an expansion signal.
They support prepared signal/deal scope, intermediary preparation and structured
outcome-premise checks. After changing opportunity analysis, rerun `data:diagnose`
to refresh its dependencies. See [Phase 3 API usage](docs/PHASE-3-HANDOVER.md).

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
Phase 2 infrastructure is tested with live evaluation gates open; Phase 3's
deterministic backend and Phase 4 workflow are locally verified; Phase 5 has tested grounded Q&A with live/human gates open;
Phase 6 assessment is implemented; optimization is deferred. Run `python scripts/audit_sources.py` to
regenerate the checksum manifest and inventory from the original `data/raw/` files
with Python 3.10 or newer (verified with Python 3.14.7). This standard-library tool
does not import or change customer records; diagnostics are stored in ignored
`data/processed/`. See the [source review](docs/C06-SOURCE-REVIEW.md) and
[limitations](docs/SOURCE-LIMITATIONS.md) before building the runtime.

## Sales workflow and template drafts

Open the local Vite URL from `npm run dev`. Select a snapshot and inspect an
opportunity, or use **Investigate account** for independent stakeholder diagnosis.
Evidence and context opens original sources and a bounded relationship path;
**Action plan** shows the supported route and editable template draft. No message
is sent and edits are not saved. English/Indonesian template framing preserves the
selected action text in its original language.

Draft preparation endpoints are `POST /api/opportunities/:id/draft` and
`POST /api/accounts/:id/draft`, scoped by `dataset_id`. They accept
`{"language":"en"}` or `{"language":"id"}` and use the server's prepared action;
account drafts also support `route=intermediary`.
See [Phase 4 handover](docs/PHASE-4-HANDOVER.md) for browser tests and limitations.

```powershell
npx playwright install chromium
npm run test:e2e
```

Browser journeys require the imported/analyzed/diagnosed snapshot described above.
Playwright starts the local dev server when needed. Alternatively set
`PLAYWRIGHT_CHANNEL=msedge` to use installed Microsoft Edge on Windows.

## Account questions

Detail and action views now include **Ask about this account**. Questions about
expansion, stakeholders, follow-up, renewal concerns and outlet scenarios return
cited facts/checks and proposed actions. Decline questions show the premise check
alongside the useful diagnosis; they do not fabricate lower orders. General
searches return labeled source excerpts or an explicit unsupported result.

`POST /api/qa` accepts `dataset_id`, optional `account_id`/`opportunity_id`,
`question`, `language` (`en`/`id`), bounded prior-question `history` and optional
`additional_outlets`/`route`. Cross-account questions require clarification.
Draft questions return an editable review-only draft. No messages are sent.

The default uses backend templates. Optional model fact selection requires server
`QA_LIVE_ENABLED=true`, `LLM_API_KEY` and an exact `LLM_MODEL`; fluent generated
prose and live model quality remain gated. See [Phase 5 handover](docs/PHASE-5-HANDOVER.md).

```powershell
# Requires the local dev API and prepared snapshot:
npm run eval:qa -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340
```

## Optimization assessment

`npm run eval -- --dataset <uuid>` also produces `optimization.json` and
`label-review.json` beside its evaluation report under ignored artifacts. It
compares rules, provider-only and provider-with-rules-fallback on identical cases;
unanswered positives stay in recall denominators. The current decision is **defer**:
labels are unreviewed, live comparison is unavailable and numerical gates are not
agreed. No classifier, embeddings or additional infrastructure is enabled.
See [Phase 6 handover](docs/PHASE-6-HANDOVER.md) and
[review checklist](docs/EVALUATION-REVIEW.md).

## Provider setup

The [TypeSafe skill](.agents/skills/typesafe-ai/SKILL.md) is installed for Codex in
this repository. Use it for TypeSafe/Jev work. The user-selected generative provider
is DeepSeek; configure `LLM_PROVIDER=deepseek` plus credentials/model in ignored `.env`.
`npm run providers:check -- --dataset <uuid> --live` checks both providers using
synthetic input with at most one physical attempt each. Jev and DeepSeek connectivity are verified;
Gemini remains available but its last generation test returned HTTP 402. Live UI generation remains disabled.
See [provider setup handover](docs/PROVIDER-SETUP-HANDOVER.md).

See [DeepSeek setup and live-check results](docs/DEEPSEEK-SETUP.md) for the current
provider selection and remaining evaluation gates.
