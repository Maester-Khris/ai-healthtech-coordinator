"""
Reads the JSON files export_primary_data.py wrote and bulk-inserts them
into whichever Supabase project SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
point at in the current process env. Intended invocation:

    doppler run --config eval -- python scripts/eval_seed/seed_eval_db.py \
        <facilities-export.json> <wait-times-export.json>

Assumes the eval project's schema was already applied (Task 1) and its
tables are empty — this script does not truncate or upsert, it inserts.
"""
import json
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from db import supabase_insert  # noqa: E402

logger = logging.getLogger(__name__)


def chunk_list(items: list, size: int) -> list[list]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def seed_table(table: str, rows: list[dict], chunk_size: int = 200) -> int:
    if not rows:
        return 0
    inserted = 0
    # ponytail: no resume/dedup on failure — truncate the target table before
    # re-running if a partial failure below leaves it in a half-seeded state.
    for chunk in chunk_list(rows, chunk_size):
        try:
            supabase_insert(table, chunk)
        except Exception:
            logger.error(
                "seed_chunk_failed",
                extra={"table": table, "rows_inserted_before_failure": inserted, "chunk_size": len(chunk)},
            )
            raise
        inserted += len(chunk)
    return inserted


def load_export(path: str) -> list[dict]:
    with open(path) as f:
        return json.load(f)


def with_scraped_at(rows: list[dict]) -> list[dict]:
    """
    latest_wait_times() never returns scraped_at, so every seeded row would
    otherwise insert with it NULL — and wait_times' unique index is
    (facility_id, scraped_at), which Postgres never treats two NULLs as
    equal on. Without this, re-seeding silently duplicates every row.
    """
    return [{**row, "scraped_at": row.get("recorded_at")} for row in rows]


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) != 3:
        print("usage: seed_eval_db.py <facilities-export.json> <wait-times-export.json>")
        sys.exit(1)

    facilities_path, wait_times_path = sys.argv[1], sys.argv[2]

    facilities = load_export(facilities_path)
    facilities_count = seed_table("facilities_clean", facilities)
    logger.info("seeded_facilities", extra={"count": facilities_count})

    wait_times = with_scraped_at(load_export(wait_times_path))
    wait_times_count = seed_table("wait_times", wait_times)
    logger.info("seeded_wait_times", extra={"count": wait_times_count})

    print(f"facilities_clean: {facilities_count} rows")
    print(f"wait_times: {wait_times_count} rows")


if __name__ == "__main__":
    main()
