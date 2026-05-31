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
        query = client.table("facilities").select(
            "name,category,source_facility_type,accepted_severity,address,lat,lng"
        )

        if category is not None:
            query = query.eq("category", category)
        if severity is not None:
            query = query.contains("accepted_severity", [severity])

        response = query.execute()
        return response.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error("supabase_query_failed", extra={"error_type": type(e).__name__})
        raise HTTPException(status_code=503, detail="Database unavailable")
