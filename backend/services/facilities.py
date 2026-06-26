import json as json_lib
import logging
from fastapi import HTTPException
from db import get_supabase_client

logger = logging.getLogger(__name__)


def get_all_facilities(
    category: str | None = None,
    severity: str | None = None,
) -> list[dict]:
    try:
        client = get_supabase_client()
        query = client.table("facilities_clean").select(
            "id:facility_id, name:facility_name, category, source_facility_type, "
            "accepted_severity, address, lat, lng, phone, business_status, weekday_hours"
        ).eq("is_operational", True)

        if category is not None:
            query = query.eq("category", category)
        if severity is not None:
            query = query.contains("accepted_severity", [severity])

        response = query.execute()

        # weekday_hours is a text column storing a JSON array string; parse it
        for f in response.data:
            wh = f.get("weekday_hours")
            if isinstance(wh, str):
                try:
                    f["weekday_hours"] = json_lib.loads(wh)
                except (ValueError, TypeError):
                    f["weekday_hours"] = []
            elif wh is None:
                f["weekday_hours"] = []

        return response.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error("supabase_query_failed", extra={"error_type": type(e).__name__})
        raise HTTPException(status_code=503, detail="Database unavailable")
