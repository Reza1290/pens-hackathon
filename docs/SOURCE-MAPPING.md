# Phase 0 field mapping — phase0-v1

Inspected 9 October 2026. This is a schema design input, not implemented SQL.
Exact headers, empty counts and checksums are in the [manifest](../data/manifests/kasirnusa-2026-10-01.json).
All fields remain in retained source payloads even when a typed mapping is deferred.

## Shared conventions

Source IDs are external strings, unique within dataset/source namespace; domain
rows will use UUIDs registered in `entities`. Every entity keeps source-record
references and dataset-scoped FKs. Repeat imports key source records by manifest,
file and logical record locator, not ingestion time. CSV locators below count
data records from 1 excluding the header; JSONL locators count physical lines.

Empty strings become nullable values where allowed, never zero or fabricated IDs.
Required candidates for Phase 1 are IDs, account/type/status on relevant commercial
rows, source event dates, owner references, source text and observation keys/counts.
The audit checks a minimum per-file required-field set; optional blank statistics
are explicit in the manifest. Final request/table constraints belong to Phase 1.
Do not mark a dataset ready if a required column/file or key is missing.

Date-only values map to SQL `date`. No timezone/timestamp is provided. Feature
targets are year-quarter periods or an explicit unknown, not precise dates.
Store money as `numeric` plus `IDR`; return decimal strings. Source integer Rupiah
values do not establish tax treatment. `diskon_pct` is percentage points: divide
by 100 before calculations. Version strings such as `4.10` remain text.

## Identity and commercial sources

| File → table | Actual columns → proposed fields | Cardinality / null policy |
| --- | --- | --- |
| `crm_accounts.csv` → `accounts` | `account_id` → external_id; `nama` → name; `tipe` → customer/prospect enum; `industri` → industry; `kota` → city; `paket` → reported_package; `jumlah_outlet` → reported_outlet_count; `account_owner_id` → employee FK; `champion_contact_id` → reported champion contact FK; `nps_terakhir` → reported_nps; `health_score_dashboard` → reported_health_label | 45 unique accounts. `pelanggan` → customer, `prospek` → prospect. Package/champion/NPS/health can be empty for prospects. Reported health is not a derived expansion score. Installed/planned counts are not incremental orders. |
| `employees.csv` → `employees` | `employee_id` → external_id; `nama` → name; `jabatan` → title; `email` → email | 10 unique internal employees. Titles do not grant customer authority. |
| `crm_contacts.csv` → `contacts` | `contact_id` → external_id; `nama` → name; `email` → current_email; `account_id_saat_ini` → current account FK; `jabatan_saat_ini` → current reported title | 160 unique contacts; one current affiliation in this snapshot. Historical email aliases are not supplied. |
| `contact_employment_history.csv` → `contact_employments`, `organizations` | `contact_id` → contact FK; `account_id` → nullable account FK; `organisasi` → organization display name; `jabatan` → role; `mulai` → start_date; `selesai` → nullable end_date | 217 rows, one per role interval. Proposed natural key: contact + organization + role + start date. Blank account denotes an external organization, not a missing customer ID. Open end means recorded ongoing employment, not unlimited verified authority. Organization names alone must not merge people. |
| `crm_deals.csv` → `deals` | `deal_id` → external_id; `account_id` → account FK; `tipe` → commercial_context; `stage` → stage; `stage_sejak` → current_stage_since; `dibuat` → created_date; `owner_id` → employee FK; `outlet` → reported_scope_outlets; `nilai_tahunan` → annual_value; `status` → status; `alasan_kalah` → nullable loss_reason; `kompetitor` → nullable competitor | 22 unique deals. `baru`/`renewal`/`ekspansi` → new_sale/renewal/expansion. No update timestamp, full stage transitions, target location or target rollout quarter. Do not assume every outlet scope is incremental. Closing-stage dates are proxies, not purchase-ledger dates. |
| `contracts_billing.csv` → `contracts` | `contract_id` → external_id; `account_id` → account FK; `paket` → package; `outlet_kontrak` → contracted_outlets; `batas_outlet_paket` → nullable numeric outlet_limit plus unlimited flag; `mulai` → start_date; `tanggal_renewal` → renewal_date; `harga_per_outlet_bulan` → monthly_rate_per_outlet; `diskon_pct` → discount_percent; `nilai_tahunan` → reported_annual_value; `keterlambatan_bayar_12bln` → reported_late_payment_count_12m; `decision_id` → nullable internal decision FK | 40 unique contracts, one per customer here. `tanpa batas` is an explicit unlimited limit, not numeric zero. No invoice/payment ledger or separate billing rows. Renewal date is future schedule, not observed renewal/expiry confirmation. |
| `decision_log.csv` → `decisions` | `decision_id` → external_id; `tanggal` → decision_date; `tipe` → type; `account_id` → account FK; `deal_id` → nullable deal FK; `diminta_oleh` → requesting employee FK; `diputuskan_oleh` → deciding employee FK; `keputusan` → outcome; `nilai` → original value/terms text; `alasan` → rationale; `bukti_interaction_id` → nullable interaction FK; `fitur_dijanjikan` → nullable feature FK; `status_janji` → nullable recorded commitment status | 30 unique internal decisions. `nilai` mixes percentages and free text, so it is not universally money. Preserve conditions/rationale and status without manufacturing a customer approval assertion. |

## Communications and product sources

| File → table | Actual columns → proposed fields | Cardinality / null policy |
| --- | --- | --- |
| `interactions.jsonl` → `interactions`, `interaction_participants` | `interaction_id` → external_id; `tanggal` → event_date; `tipe` → interaction_type; `account_id` → nullable account FK; `dari` → original sender address; `ke` → original recipient addresses; `peserta` → semicolon-separated contact/employee IDs; `subjek` → subject; `isi` → body/source text; `membalas_id` → nullable parent interaction FK | 350 objects with the same 10 fields. Empty account is permitted for general internal messages; meeting recipients/participants vary by type. Exact email resolves first; unresolved historical addresses stay unresolved with candidate evidence. Each participant row preserves its original locator. Reply FK does not imply every reply is substantive. |
| `outlets.csv` → `outlets` | `outlet_id` → external_id; `account_id` → account FK; `kota` → city; `mode_offline_aktif` → boolean (`ya`/`tidak`) | 620 unique outlets. No opening/closing dates or status history; outlet inventory cannot establish purchase events. |
| `product_usage_daily.csv` → `product_usage_daily` | `tanggal` → observation_date; `outlet_id` → outlet FK; `account_id` → account FK; `versi_aplikasi` → release/version FK; `jumlah_transaksi` → server_recorded_transactions; `transaksi_offline_tersinkron` → nullable offline_synced_transactions | 226,300 unique date/outlet observations. Counts are nonnegative integers; blank offline count is not zero. Avoid adding offline counts to server counts without documented overlap semantics. |
| `feature_usage_monthly.csv` → `feature_usage_monthly` | `bulan` → year_month (first-day storage with month precision); `account_id` → account FK; `feature_id` → feature FK; `pengguna_aktif` → active_users | 1,178 unique month/account/feature observations; counts integer. Missing feature/month combinations are not automatically zero. |
| `support_tickets.csv` → `support_tickets` | `ticket_id` → external_id; `dibuat` → created_date; `account_id` → account FK; `outlet_id` → nullable outlet FK; `pelapor_contact_id` → nullable reporter contact FK; `kategori` → category; `prioritas` → priority; `status` → status; `versi_aplikasi` → release/version FK; `judul` → title; `deskripsi` → description; `bug_id` → nullable bug FK; `diselesaikan` → nullable resolved_date | 640 unique tickets. No feature ID exists here; a feature request needs evidenced interpretation, not a guessed FK. Counts/open status alone cannot prove a buying blocker. |
| `bugs.csv` → `bugs` | `bug_id` → external_id; `judul` → title; `versi_terdampak` → reported affected-version text; `status` → status; `dibuat` → created_date; `selesai` → nullable resolved_date; `fitur_terkait` → feature FK | 4 unique bugs. Affected-version text does not establish a release that fixed the bug. Keep exact text until its cardinality/grammar is defined. |
| `releases.csv` → `releases` | `versi` → external version key; `tanggal_rilis` → release_date | 3 unique versions. No explicit delivered-feature/fixed-bug lists; no invented release junctions. |
| `features.csv` → `features` | `feature_id` → external_id; `nama` → name; `status` → recorded status; `target_awal` → nullable original target period; `target_terkini` → nullable current target period/status; `catatan` → nullable notes | 8 unique features. Preserve `Belum ditetapkan` as unknown target and original text. Quarterly targets are forecasts; recorded release status is not a precise delivery timestamp. |

## Provenance and derived tables

All 15 record sources feed `source_files` and `source_records` before normalization;
README and the absent brief belong in dataset coverage metadata. Parse failures
feed `ingestion_errors` with raw bytes/locators preserved. Full supplied deal scope
must load for missing-deal checks, even while other domain mappings are deferred.

Phase 1 needs `datasets`, `entities`, `entity_sources`, source retention, C06 account,
employee, contact/employment, contract, interaction and deal tables plus
`expansion_signals`, `signal_deal_matches`, `analysis_runs`, `findings`,
`finding_evidence`, `recommendations`, `assertions` and `assertion_evidence` where
reviewed text facts require them. Later product sources can remain staged until
their slice is built. `model_runs` is Phase 2; no training/model tables are needed now.

Assertions keep speaker, subject, account/deal/signal scope, direct/reported
attribution, source span/field, event date, interpretation method and verification
state. Imported typed FKs are projected graph edges, not duplicated editable claims.
Missing-record findings retain query scope/as-of/version and never become timeless
absence edges. Internal decisions and titles never substitute for purchasing authority.
