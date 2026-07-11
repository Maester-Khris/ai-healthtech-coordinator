"""
Exports facilities_clean and a latest-wait-times snapshot from whichever
Supabase project SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY point at in the
current process env. Intended invocation:

    doppler run --config preview -- python scripts/eval_seed/export_primary_data.py

Writes two timestamped JSON files under scripts/eval_seed/exports/ —
input for seed_eval_db.py (Task 3). Never touches profile/sessions/
messages/auth.users — those hold user data and are never copied.
"""
import json
import logging
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from db import supabase_select, supabase_rpc  # noqa: E402

logger = logging.getLogger(__name__)

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "exports")


def export_facilities() -> list[dict]:
    rows = supabase_select("facilities_clean", {"select": "*"})
    if len(rows) in (1000, 10000):
        # ponytail: fails loud instead of paginating — add real pagination if
        # facilities_clean ever legitimately approaches this row count.
        raise RuntimeError(
            f"export returned exactly {len(rows)} rows, matching a common PostgREST "
            "page-size default — likely truncated, not a real full export"
        )
    return rows


def export_latest_wait_times() -> list[dict]:
    return supabase_rpc("latest_wait_times", {})


def write_export(data: list[dict], filename: str) -> str:
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "w") as f:
        json.dump(data, f, indent=2, default=str)
    return filename


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    facilities = export_facilities()
    facilities_path = write_export(facilities, os.path.join(EXPORT_DIR, f"facilities_{stamp}.json"))
    logger.info("exported_facilities", extra={"count": len(facilities), "path": facilities_path})

    wait_times = export_latest_wait_times()
    wait_times_path = write_export(wait_times, os.path.join(EXPORT_DIR, f"wait_times_{stamp}.json"))
    logger.info("exported_wait_times", extra={"count": len(wait_times), "path": wait_times_path})

    print(f"facilities: {facilities_path}")
    print(f"wait_times: {wait_times_path}")


if __name__ == "__main__":
    main()
