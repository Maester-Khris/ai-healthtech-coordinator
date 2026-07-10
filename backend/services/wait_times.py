import json
import logging
import os

import redis
from prometheus_client import Counter

from db import supabase_rpc
from observability import _registry

logger = logging.getLogger(__name__)

REDIS_HASH_KEY = "wait_times:current"

redis_client = redis.from_url(os.environ["UPSTASH_REDIS_URL"].strip(), decode_responses=True)

WAIT_TIMES_CACHE_OUTCOME = Counter(
    "wait_times_cache_outcome_total",
    "Outcome of each wait-time cache read, by branch",
    ["outcome"],
    registry=_registry,
)


def get_wait_minutes_map() -> dict[str, int | None]:
    """
    Cache-aside read of current ER wait times, keyed by facility_id.

    1. Try the Redis hash workers/scraper.py writes every ~15 min. Each
       entry is parsed independently so one malformed value doesn't
       discard every other facility's good data for the request.
    2. On Redis error or an empty hash (cold start before the first scrape),
       fall back to the latest_wait_times Supabase RPC and best-effort
       populate Redis for the next read.
    3. If both Redis and the Supabase fallback fail, degrade to an empty
       map rather than raising — missing wait data always passes filters,
       same convention as the hours filters.

    Each of the 3 outcomes above increments WAIT_TIMES_CACHE_OUTCOME with a
    matching label, so /metrics can compute the cache hit rate and Redis
    fallback frequency the case study needs (Sprint 17).
    """
    try:
        raw = redis_client.hgetall(REDIS_HASH_KEY)
    except Exception:
        logger.warning("redis_unavailable_falling_back_to_supabase")
        raw = None

    if raw:
        wait_map: dict[str, int | None] = {}
        for fid, v in raw.items():
            try:
                wait_map[fid] = json.loads(v).get("wait_minutes")
            except (ValueError, AttributeError, TypeError):
                logger.warning("wait_times_entry_malformed", extra={"facility_id": fid})
        if wait_map:
            WAIT_TIMES_CACHE_OUTCOME.labels(outcome="redis_hit").inc()
        return wait_map

    try:
        rows = supabase_rpc("latest_wait_times", {})
    except Exception:
        logger.warning("wait_times_fallback_failed_returning_empty")
        WAIT_TIMES_CACHE_OUTCOME.labels(outcome="total_failure").inc()
        return {}

    wait_map = {r["facility_id"]: r["wait_minutes"] for r in rows}

    try:
        pipe = redis_client.pipeline()
        for r in rows:
            pipe.hset(REDIS_HASH_KEY, r["facility_id"], json.dumps({
                "wait_minutes": r["wait_minutes"],
                "raw_wait": r.get("raw_wait"),
                "source": r.get("source"),
                "updated_at": r.get("recorded_at"),
            }))
        pipe.execute()
    except Exception:
        logger.warning("redis_populate_failed")

    WAIT_TIMES_CACHE_OUTCOME.labels(outcome="supabase_fallback").inc()
    return wait_map
