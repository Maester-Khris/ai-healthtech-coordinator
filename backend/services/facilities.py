import json as json_lib
import logging
from fastapi import HTTPException
from db import supabase_select

logger = logging.getLogger(__name__)


def get_all_facilities(
    category: str | None = None,
    severity: str | None = None,
) -> list[dict]:
    params = {
        "select": "id:facility_id,name:facility_name,category,source_facility_type,"
                  "accepted_severity,address,lat,lng,phone,business_status,weekday_hours",
        "is_operational": "eq.true",
    }
    if category is not None:
        params["category"] = f"eq.{category}"
    if severity is not None:
        params["accepted_severity"] = f"cs.{{{severity}}}"

    try:
        data = supabase_select("facilities_clean", params) or []

        # weekday_hours is a text column storing a JSON array string; parse it
        for f in data:
            wh = f.get("weekday_hours")
            if isinstance(wh, str):
                try:
                    f["weekday_hours"] = json_lib.loads(wh)
                except (ValueError, TypeError):
                    f["weekday_hours"] = []
            elif wh is None:
                f["weekday_hours"] = []

        return data
    except HTTPException:
        raise
    except Exception as e:
        logger.error("supabase_query_failed", extra={"error_type": type(e).__name__})
        raise HTTPException(status_code=503, detail="Database unavailable")


def apply_wait_filter(
    records: list[dict],
    id_key: str,
    max_wait_minutes: int | None,
    wait_map: dict[str, int | None],
) -> list[dict]:
    """
    Annotates each record with wait_minutes from wait_map. When max_wait_minutes
    is set, drops records whose wait_minutes exceeds it — records with no wait
    data (None) always pass, same convention as the open_24h/open_weekends
    hours filters (missing data never hides a result).
    """
    for r in records:
        r["wait_minutes"] = wait_map.get(r[id_key])

    if max_wait_minutes is None:
        return records

    return [r for r in records if r["wait_minutes"] is None or r["wait_minutes"] <= max_wait_minutes]
