"""
Seed script: upserts ODHF v1.1 healthcare facilities into Supabase.
Run via: doppler run -- python seed/run.py
"""

import csv
import os
import re
import sys
from pathlib import Path

# Present so callers who add dotenv later don't break; not used here.
try:
    import dotenv  # noqa: F401
except ImportError:
    pass

from supabase import create_client

CSV_PATH = Path(__file__).parent / "data" / "odhf_v1.1.csv"
BATCH_SIZE = 50

CATEGORY_MAP = {
    "Hospitals": "hospital",
    "Ambulatory health care services": "ambulatory",
    "Nursing and residential care facilities": "residential",
}

SEVERITY_MAP = {
    "hospital": ["emergent", "urgent", "moderate", "routine"],
    "ambulatory": ["urgent", "moderate", "routine"],
    "residential": ["routine"],
}

EM_DASH = "\x96"  # Windows-1252 byte stored as latin-1 char


def clean(s: str) -> str:
    return s.replace(EM_DASH, "-").strip()


def build_address(row: dict) -> str:
    prebuilt = clean(row.get("source_format_str_address", ""))
    if prebuilt:
        return prebuilt

    parts = [
        row.get("street_no", "").strip(),
        row.get("street_name", "").strip(),
    ]
    street = " ".join(p for p in parts if p)
    city = row.get("city", "").strip()
    postal = row.get("postal_code", "").strip()

    if street:
        addr = f"{street}, {city}, ON {postal}".strip()
    elif city or postal:
        addr = f"{city}, ON {postal}".strip()
        print(f"WARN (address fallback): {row.get('facility_name', '')!r}")
    else:
        addr = ""

    return clean(re.sub(r" {2,}", " ", addr))


def transform(row: dict) -> dict | None:
    name = clean(row.get("facility_name", ""))

    raw_lat = row.get("latitude", "").strip()
    raw_lng = row.get("longitude", "").strip()
    if not raw_lat or not raw_lng:
        print(f"SKIP (no coords): {name}")
        return None
    try:
        lat = float(raw_lat)
        lng = float(raw_lng)
    except ValueError:
        print(f"SKIP (no coords): {name}")
        return None

    odhf_type = row.get("odhf_facility_type", "").strip()
    category = CATEGORY_MAP.get(odhf_type, "ambulatory")

    raw_sft = row.get("source_facility_type", "").strip().lower()
    if not raw_sft:
        raw_sft = "general"
        print(f"INFO (source_facility_type defaulted): {name}")

    address = build_address(row)

    return {
        "name": name,
        "category": category,
        "source_facility_type": raw_sft,
        "accepted_severity": SEVERITY_MAP[category],
        "address": address,
        "lat": lat,
        "lng": lng,
        "source": "odhf",
    }


def main() -> None:
    url = os.environ.get("SUPABASE_URL")
    # key = os.environ.get("SUPABASE_ANON_KEY")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url:
        raise RuntimeError("SUPABASE_URL is not set in the environment")
    if not key:
        # raise RuntimeError("SUPABASE_ANON_KEY is not set in the environment")
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not set in the environment")

    client = create_client(url, key)

    total_on = 0
    total_toronto = 0
    skipped_coords = 0
    upserted = 0
    failed_batches = 0

    records: list[dict] = []

    with CSV_PATH.open(encoding="latin-1", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            if row.get("province", "").strip().lower() != "on":
                continue
            total_on += 1

            if "toronto" not in row.get("CSDname", "").lower():
                continue
            total_toronto += 1

            record = transform(row)
            if record is None:
                skipped_coords += 1
                continue

            records.append(record)

    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        try:
            client.table("facilities").upsert(
                batch,
                on_conflict="name,lat,lng",
            ).execute()
            upserted += len(batch)
        except Exception as exc:
            failed_batches += 1
            print(f"ERROR batch {i // BATCH_SIZE}: {exc}", file=sys.stderr)

    print()
    print(f"Total rows in Ontario:   {total_on}")
    print(f"Toronto region rows:     {total_toronto}")
    print(f"Skipped (no coords):     {skipped_coords}")
    print(f"Upserted successfully:   {upserted}")
    print(f"Failed batches:          {failed_batches}")


if __name__ == "__main__":
    main()
