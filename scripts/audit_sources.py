"""Phase 0 source inspection only: never imports or changes original records.

Run from the repository root: python scripts/audit_sources.py
Detailed diagnostics are written to ignored data/processed; the manifest contains
checksums and aggregate metadata only. CSV locators are 1-based data-record numbers
(header excluded); JSONL locators are physical line numbers.
"""
import csv
import hashlib
import io
import json
import re
from collections import Counter
from datetime import date
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw"
VERSION = "kasirnusa-2026-10-01"
AS_OF = date(2026, 10, 1)
PRIMARY = {
    "crm_accounts.csv": ["account_id"], "crm_contacts.csv": ["contact_id"],
    "crm_deals.csv": ["deal_id"], "employees.csv": ["employee_id"],
    "contracts_billing.csv": ["contract_id"], "outlets.csv": ["outlet_id"],
    "support_tickets.csv": ["ticket_id"], "bugs.csv": ["bug_id"],
    "features.csv": ["feature_id"], "decision_log.csv": ["decision_id"],
    "interactions.jsonl": ["interaction_id"], "releases.csv": ["versi"],
    "contact_employment_history.csv": ["contact_id", "organisasi", "jabatan", "mulai"],
    "product_usage_daily.csv": ["tanggal", "outlet_id"],
    "feature_usage_monthly.csv": ["bulan", "account_id", "feature_id"],
}
DATES = {
    "contact_employment_history.csv": ["mulai", "selesai"],
    "contracts_billing.csv": ["mulai", "tanggal_renewal"],
    "crm_deals.csv": ["stage_sejak", "dibuat"],
    "decision_log.csv": ["tanggal"], "interactions.jsonl": ["tanggal"],
    "product_usage_daily.csv": ["tanggal"], "feature_usage_monthly.csv": ["bulan"],
    "support_tickets.csv": ["dibuat", "diselesaikan"],
    "bugs.csv": ["dibuat", "selesai"], "releases.csv": ["tanggal_rilis"],
}
INTEGERS = {
    "crm_accounts.csv": ["jumlah_outlet", "nps_terakhir"],
    "crm_deals.csv": ["outlet", "nilai_tahunan"],
    "contracts_billing.csv": ["outlet_kontrak", "harga_per_outlet_bulan", "diskon_pct", "nilai_tahunan", "keterlambatan_bayar_12bln"],
    "product_usage_daily.csv": ["jumlah_transaksi", "transaksi_offline_tersinkron"],
    "feature_usage_monthly.csv": ["pengguna_aktif"],
}
REQUIRED = {
    **PRIMARY,
    "contact_employment_history.csv": ["contact_id", "organisasi", "jabatan", "mulai"],
    "crm_accounts.csv": ["account_id", "nama", "tipe", "account_owner_id"],
    "crm_contacts.csv": ["contact_id", "nama", "email", "account_id_saat_ini"],
    "crm_deals.csv": ["deal_id", "account_id", "tipe", "stage", "stage_sejak", "dibuat", "owner_id", "status"],
    "interactions.jsonl": ["interaction_id", "tanggal", "tipe", "isi"],
    "contracts_billing.csv": ["contract_id", "account_id", "paket", "mulai", "tanggal_renewal"],
}
data = {}
files = []
issues = []


def issue(filename, locator, field, code):
    issues.append({"file": filename, "locator": locator, "field": field, "code": code})


for path in sorted(RAW.iterdir()):
    if not path.is_file():
        continue
    payload = path.read_bytes()
    entry = {"filename": path.name, "relative_path": path.relative_to(ROOT).as_posix(),
             "sha256": hashlib.sha256(payload).hexdigest(), "bytes": len(payload)}
    files.append(entry)
    try:
        source = payload.decode("utf-8-sig", errors="strict")
        entry["encoding"] = "UTF-8 BOM" if payload.startswith(b"\xef\xbb\xbf") else "UTF-8"
    except UnicodeDecodeError:
        entry["encoding"] = "invalid UTF-8"
        issue(path.name, None, None, "encoding_error")
        continue
    if path.suffix not in (".csv", ".jsonl"):
        entry["kind"] = "documentation"
        continue
    rows = []
    columns = []
    if path.suffix == ".csv":
        reader = csv.DictReader(io.StringIO(source, newline=""), strict=True)
        columns = reader.fieldnames or []
        if len(columns) != len(set(columns)):
            issue(path.name, 0, None, "duplicate_header")
        try:
            for locator, row in enumerate(reader, 1):
                if None in row or any(value is None for value in row.values()):
                    issue(path.name, locator, None, "invalid_column_count")
                rows.append((locator, row))
        except csv.Error:
            issue(path.name, reader.line_num, None, "csv_parse_error")
    else:
        for locator, line in enumerate(source.splitlines(), 1):
            try:
                row = json.loads(line)
                if not isinstance(row, dict) or any(not isinstance(v, str) for v in row.values()):
                    raise ValueError("Expected object with string fields")
                for key in row:
                    if key not in columns:
                        columns.append(key)
                rows.append((locator, row))
            except (ValueError, TypeError):
                issue(path.name, locator, None, "json_parse_or_shape_error")
    data[path.name] = rows
    entry.update(kind="records", columns=columns, records=len(rows),
                 physical_lines=len(source.splitlines()),
                 empty_counts={key: sum(row.get(key) in (None, "") for _, row in rows) for key in columns})
    for key in REQUIRED.get(path.name, []):
        if key not in columns:
            issue(path.name, 0, key, "missing_required_column")
    keys = Counter(tuple(row.get(key, "") for key in PRIMARY.get(path.name, columns)) for _, row in rows)
    entry["duplicate_key_groups"] = sum(n > 1 for n in keys.values())
    entry["duplicate_key_extra_records"] = sum(n - 1 for n in keys.values() if n > 1)
    entry["exact_duplicate_extra_records"] = len(rows) - len({json.dumps(row, sort_keys=True) for _, row in rows})
    entry["date_ranges"] = {}
    for key in DATES.get(path.name, []):
        valid = []
        future = 0
        for locator, row in rows:
            value = row.get(key)
            if not value:
                continue
            try:
                parsed = date.fromisoformat(value + "-01" if key == "bulan" else value)
                valid.append(value)
                future += parsed > AS_OF
            except ValueError:
                issue(path.name, locator, key, "invalid_date")
        entry["date_ranges"][key] = {"min": min(valid, default=None), "max": max(valid, default=None), "after_snapshot": future}
    for locator, row in rows:
        for key in REQUIRED.get(path.name, []):
            if row.get(key) in (None, ""):
                issue(path.name, locator, key, "missing_required_value")
        for key in INTEGERS.get(path.name, []):
            if row.get(key):
                try:
                    if int(row[key]) < 0:
                        issue(path.name, locator, key, "negative_number")
                except ValueError:
                    issue(path.name, locator, key, "invalid_integer")
        for start, end in [("mulai", "selesai"), ("dibuat", "diselesaikan"), ("dibuat", "selesai"), ("dibuat", "stage_sejak")]:
            if row.get(start) and row.get(end) and row[end] < row[start]:
                issue(path.name, locator, end, "end_before_start")

# Two-pass reference audit: empty optional references are counted, not fabricated.
targets = {name: {row[PRIMARY[name][0]] for _, row in rows}
           for name, rows in data.items() if len(PRIMARY.get(name, [])) == 1}
refs = {
    "account_id": "crm_accounts.csv", "account_id_saat_ini": "crm_accounts.csv",
    "account_owner_id": "employees.csv", "owner_id": "employees.csv",
    "champion_contact_id": "crm_contacts.csv", "contact_id": "crm_contacts.csv",
    "pelapor_contact_id": "crm_contacts.csv", "outlet_id": "outlets.csv",
    "feature_id": "features.csv", "fitur_terkait": "features.csv", "fitur_dijanjikan": "features.csv", "bug_id": "bugs.csv",
    "decision_id": "decision_log.csv", "deal_id": "crm_deals.csv",
    "diminta_oleh": "employees.csv", "diputuskan_oleh": "employees.csv",
    "bukti_interaction_id": "interactions.jsonl", "membalas_id": "interactions.jsonl",
    "versi_aplikasi": "releases.csv",
}
outlet_accounts = {row["outlet_id"]: row["account_id"] for _, row in data["outlets.csv"]}
contact_accounts = {row["contact_id"]: row["account_id_saat_ini"] for _, row in data["crm_contacts.csv"]}
interactions = {row["interaction_id"]: row for _, row in data["interactions.jsonl"]}
emails = Counter(row["email"].strip().lower() for name in ("crm_contacts.csv", "employees.csv") for _, row in data[name])
for name, rows in data.items():
    for locator, row in rows:
        for field, target in refs.items():
            if name == target or not row.get(field):
                continue
            if row[field] not in targets.get(target, set()):
                issue(name, locator, field, "unresolved_reference")
        if row.get("outlet_id") in outlet_accounts and row.get("account_id") != outlet_accounts[row["outlet_id"]]:
            issue(name, locator, "outlet_id", "outlet_account_mismatch")
        if row.get("champion_contact_id") in contact_accounts and row["account_id"] != contact_accounts[row["champion_contact_id"]]:
            issue(name, locator, "champion_contact_id", "current_champion_account_mismatch")
        for participant in filter(None, row.get("peserta", "").split(";")):
            if participant not in targets["employees.csv"] | targets["crm_contacts.csv"]:
                issue(name, locator, "peserta", "unresolved_participant")
        if name == "interactions.jsonl":
            for field in ("dari", "ke"):
                for email in filter(None, re.split(r"[;,]", row[field])):
                    matches = emails[email.strip().lower()]
                    if matches != 1:
                        issue(name, locator, field, "unresolved_email" if matches == 0 else "ambiguous_email")
            parent = interactions.get(row["membalas_id"])
            if parent and (parent["tanggal"] > row["tanggal"] or parent["account_id"] != row["account_id"]):
                issue(name, locator, "membalas_id", "reply_date_or_account_mismatch")
        if name == "features.csv":
            for field in ("target_awal", "target_terkini"):
                if row[field] and row[field] != "Belum ditetapkan" and not re.fullmatch(r"\d{4}-Q[1-4]", row[field]):
                    issue(name, locator, field, "invalid_quarter")
        if name == "contracts_billing.csv":
            try:
                discount = Decimal(row["diskon_pct"])
                expected = Decimal(row["outlet_kontrak"]) * Decimal(row["harga_per_outlet_bulan"]) * 12 * (1 - discount / 100)
                if not 0 <= discount <= 100:
                    issue(name, locator, "diskon_pct", "discount_out_of_range")
                if expected != Decimal(row["nilai_tahunan"]):
                    issue(name, locator, "nilai_tahunan", "annual_value_formula_mismatch")
                if row["batas_outlet_paket"] != "tanpa batas" and int(row["batas_outlet_paket"]) < 0:
                    issue(name, locator, "batas_outlet_paket", "invalid_package_limit")
            except (ValueError, ArithmeticError):
                issue(name, locator, None, "invalid_commercial_number")

summary = Counter((i["file"], i["field"], i["code"]) for i in issues)
manifest = {
    "schema_version": "source-manifest-v1", "dataset_version": VERSION,
    "mapping_version": "phase0-v1", "audit_version": "phase0-audit-v1",
    "as_of": AS_OF.isoformat(), "as_of_source": "README.md: operational period and snapshot bullets",
    "documented_operational_period": {"start": "2025-10-01", "end": "2026-09-30"},
    "status": "inspected_not_imported", "raw_layout": "unversioned_originals_preserved",
    "expected_record_files": sorted(PRIMARY),
    "missing_record_files": sorted(set(PRIMARY) - set(data)),
    "missing_documentation": ["Studi Kasus Hackathon_PESERTA.pdf"],
    "files": files,
    "issue_summary": [{"file": f, "field": field, "code": code, "count": count}
                      for (f, field, code), count in sorted(summary.items(), key=lambda x: str(x[0]))],
    "limitations": ["Aggregate audit does not prove external activity completeness.",
                    "Email/event-date employment matching and case interpretation require manual review.",
                    "Forecasts and renewal dates after snapshot are not observed future events."]
}
canonical = json.dumps([(f["filename"], f["sha256"]) for f in files], separators=(",", ":"))
manifest["content_manifest_sha256"] = hashlib.sha256(canonical.encode()).hexdigest()
manifest_path = ROOT / "data/manifests" / f"{VERSION}.json"
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
local = ROOT / "data/processed" / VERSION
local.mkdir(parents=True, exist_ok=True)
(local / "source-audit.json").write_text(json.dumps({"issues": issues}, indent=2) + "\n", encoding="utf-8")
inventory = ["# Phase 0 source inventory", "", "Generated by `python scripts/audit_sources.py`; aggregate metadata only.", "",
             "| File | Records | Bytes | Duplicate key extras |", "| --- | ---: | ---: | ---: |"]
for f in files:
    inventory.append(f"| `{f['filename']}` | {f.get('records', 'documentation')} | {f['bytes']} | {f.get('duplicate_key_extra_records', '—')} |")
inventory += ["", "All listed files decode as strict UTF-8 unless noted in the manifest. CSV counts exclude headers.",
              "JSONL counts represent successfully parsed objects; parse errors remain in local diagnostics.", "",
              "## Observed date ranges", "", "| File / field | Minimum | Maximum | After snapshot |", "| --- | --- | --- | ---: |"]
for f in files:
    for field, span in f.get("date_ranges", {}).items():
        inventory.append(f"| `{f['filename']}` / `{field}` | {span['min']} | {span['max']} | {span['after_snapshot']} |")
inventory += ["", "## Nonempty validation issues", "", "| File | Field | Check | Count |", "| --- | --- | --- | ---: |"]
for item in manifest["issue_summary"]:
    inventory.append(f"| `{item['file']}` | `{item['field']}` | {item['code']} | {item['count']} |")
inventory += ["", "The manifest also records every header and per-field empty count. Optional blanks are not errors.",
              "Detailed issue locators are in ignored `data/processed/kasirnusa-2026-10-01/source-audit.json`.", ""]
(ROOT / "docs/SOURCE-INVENTORY.md").write_text("\n".join(inventory), encoding="utf-8")
print(json.dumps({"files": len(files), "records": sum(len(rows) for rows in data.values()),
                  "issue_summary": manifest["issue_summary"], "manifest": manifest_path.relative_to(ROOT).as_posix()}, indent=2))
