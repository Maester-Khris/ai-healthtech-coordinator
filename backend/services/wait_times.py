import json
import logging
import os

import redis

from db import supabase_rpc

logger = logging.getLogger(__name__)

REDIS_HASH_KEY = "wait_times:current"

redis_client = redis.from_url(os.environ["UPSTASH_REDIS_URL"].strip(), decode_responses=True)


def get_wait_minutes_map() -> dict[str, int | None]:
    """
    Cache-aside read of current ER wait times, keyed by facility_id.

    1. Try the Redis hash workers/scraper.py writes every ~15 min.
    2. On Redis error or an empty hash (cold start before the first scrape),
       fall back to the latest_wait_times Supabase RPC and best-effort
       populate Redis for the next read.
    3. If both Redis and the Supabase fallback fail, degrade to an empty
       map rather than raising — missing wait data always passes filters,
       same convention as the hours filters.
    """
    try:
        raw = redis_client.hgetall(REDIS_HASH_KEY)
        if raw:
            return {fid: json.loads(v).get("wait_minutes") for fid, v in raw.items()}
    except Exception:
        logger.warning("redis_unavailable_falling_back_to_supabase")

    try:
        rows = supabase_rpc("latest_wait_times", {})
    except Exception:
        logger.warning("wait_times_fallback_failed_returning_empty")
        return {}

    wait_map = {r["facility_id"]: r["wait_minutes"] for r in rows}

    try:
        for r in rows:
            redis_client.hset(REDIS_HASH_KEY, r["facility_id"], json.dumps({
                "wait_minutes": r["wait_minutes"],
                "raw_wait": r.get("raw_wait"),
                "source": r.get("source"),
                "updated_at": r.get("recorded_at"),
            }))
    except Exception:
        logger.warning("redis_populate_failed")

    return wait_map
