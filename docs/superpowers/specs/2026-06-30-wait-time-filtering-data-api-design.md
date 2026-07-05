# Wait-Time Filtering + Supabase Data API Migration — Design
**Date:** 2026-06-30
**Branch:** `feat/advanced-filtering`
**Status:** Approved for implementation

---

## Problem

Two separate issues, fixed together because the second blocks the first:

1. `supabase-py` (the Python client in `backend/db.py`) is broken in this environment. Every backend module that talks to Supabase (`services/facilities.py`, `services/chat.py`, `services/auth.py`, the `/facilities/nearby` RPC call in `main.py`) goes through it.
2. The "Wait Time" dropdown in `MapPanel.tsx` renders but does nothing — ER wait times scraped by `workers/scraper.py` into Supabase `wait_times` and an Upstash Redis hash never reach the API.

Fixing wait-time filtering requires a working DB connection, so the Data API migration goes first / together.

---

## 1. Supabase Data API migration

`backend/db.py` stops instantiating `supabase-py`'s `Client` and becomes a small REST helper over Supabase's PostgREST + GoTrue endpoints — the same approach `workers/scraper.py` already uses successfully in production.

### `db.py` — new shape

```python
import os
import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].strip()
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip()

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

def supabase_select(table: str, params: dict, single: bool = False) -> list[dict] | dict | None:
    """GET /rest/v1/{table}?{params}. params uses PostgREST operators, e.g.
    {"select": "*", "user_id": "eq.<id>", "order": "updated_at.desc", "limit": "5"}.
    single=True sets Accept: application/vnd.pgrst.object+json (404/406 on no rows -> None)."""

def supabase_insert(table: str, rows: list[dict]) -> list[dict]:
    """POST /rest/v1/{table} with Prefer: return=representation. Returns inserted rows."""

def supabase_rpc(fn_name: str, payload: dict) -> list[dict]:
    """POST /rest/v1/rpc/{fn_name}."""

def supabase_auth_get_user(token: str) -> dict:
    """GET /auth/v1/user with the caller's bearer token (not the service key).
    Raises on non-200. Replaces client.auth.get_user(token)."""
```

All four functions raise `requests.HTTPError` on failure (via `raise_for_status()`); callers keep their existing `try/except` → `HTTPException` translation at the service-function boundary, unchanged from today's pattern in `services/facilities.py`.

### Consumers migrated in this pass

| File | Current call | New call |
|---|---|---|
| `services/facilities.py` | `.table("facilities_clean").select(...).eq(...).contains(...)` | `supabase_select("facilities_clean", {"select": "...", "is_operational": "eq.true", "category": "eq.hospital", "accepted_severity": "cs.{urgent}"})` |
| `services/chat.py` `create_session` | `.table("sessions").insert(...)` | `supabase_insert("sessions", [{...}])[0]` |
| `services/chat.py` `add_message` | `.table("messages").insert(...)` | `supabase_insert("messages", [{...}])[0]` |
| `services/chat.py` `get_past_conversations` | `.table("sessions").select("*").eq(...).order(...).limit(...)` | `supabase_select("sessions", {"select": "*", "user_id": f"eq.{user_id}", "order": "updated_at.desc", "limit": str(session_limit)})` |
| `services/chat.py` `get_older_messages` | `.maybe_single()` cursor lookup | `supabase_select("messages", {...}, single=True)` → `None` on no rows |
| `services/auth.py` `verify_token` | `client.auth.get_user(token)` | `supabase_auth_get_user(token)` |
| `main.py` `/facilities/nearby` | `client.rpc("nearby_facilities", {...})` | `supabase_rpc("nearby_facilities", {...})` |

`PostgREST` operator cheatsheet needed for this migration: `eq.`, `lt.`, `cs.{value}` (array contains), `order=col.desc`, `limit=`.

`requirements.txt`: drop `supabase==2.*`; `requests==2.*` already present covers everything. Add `redis` (next section).

---

## 2. Wait-time cache-aside layer

New file `backend/services/wait_times.py`. Single entry point:

```python
def get_wait_minutes_map() -> dict[str, int | None]:
    """facility_id (str) -> wait_minutes (int) or None if no data anywhere."""
```

**Flow (cache-aside):**

1. `redis_client.hgetall("wait_times:current")` — same Upstash hash `workers/scraper.py` already writes every ~15 min. Parse each JSON value's `wait_minutes`.
2. If Redis raises (connection error) **or** the hash is empty (cold start, before the scraper's first run) → fallback:
   - `supabase_rpc("latest_wait_times", {})` — new RPC, one row per facility (latest `recorded_at`). See migration below. A plain PostgREST `select` can't express "latest per facility" without `DISTINCT ON`, hence the RPC.
   - Build the same `{facility_id: wait_minutes}` shape from the RPC rows.
   - Best-effort write back into the Redis hash (`HSET` per facility) so the next request hits cache. Failures here are logged, not raised — the response still succeeds with Supabase data.
3. Return the map. No TTL/staleness logic — the scraper is the freshness authority; Redis is trusted whenever it's reachable and non-empty.

Redis client construction:

```python
import redis
redis_client = redis.from_url(os.environ["UPSTASH_REDIS_URL"].strip(), decode_responses=True)
```

Same `redis.from_url` call `workers/scraper.py` already uses. `UPSTASH_REDIS_URL` must be present in the backend's Doppler config (it already exists for the worker's Doppler config — confirm it's shared/copied over; this is a deployment check, not a code change).

### Migration: `migrations/011_latest_wait_times_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION latest_wait_times()
RETURNS TABLE (
  facility_id  uuid,
  wait_minutes integer,
  recorded_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (facility_id)
    facility_id,
    wait_minutes,
    recorded_at
  FROM wait_times
  ORDER BY facility_id, recorded_at DESC;
$$;
```

`SECURITY DEFINER` + `STABLE` matches the existing `nearby_facilities` RPC (migration 010) — same rationale: no table credentials exposed beyond the service role, query plan cached after first call.

---

## 3. Aggregator integration — no endpoint merge

`GET /facilities` and `GET /facilities/nearby` stay as two endpoints (per design decision). Both gain an optional `max_wait_minutes: int` query param and call one shared filter helper.

New function in `services/facilities.py`, imported into `main.py` and used by both routes (both already import from `services.facilities` today):

```python
def apply_wait_filter(
    records: list[dict],
    id_key: str,                 # "id" for /facilities, "facility_id" for /facilities/nearby
    max_wait_minutes: int | None,
    wait_map: dict[str, int | None],
) -> list[dict]:
    for r in records:
        r["wait_minutes"] = wait_map.get(r[id_key])
    if max_wait_minutes is None:
        return records
    return [r for r in records if r["wait_minutes"] is None or r["wait_minutes"] <= max_wait_minutes]
```

**Filter semantics:** `max_wait_minutes` is a maximum (facility's current wait must be ≤ threshold). Facilities with no wait data (`None`) always pass — same "missing data never hides a result" convention already established for the `open_24h` / `open_weekends` hours filters in the db-migration sprint.

**`main.py` route changes:**

```python
@app.get("/facilities")
async def facilities(request: Request, category: str | None = None, severity: str | None = None, max_wait_minutes: int | None = None) -> Response:
    ...existing cache + category/severity filter logic, unchanged...
    wait_map = get_wait_minutes_map()
    data = apply_wait_filter(data, "id", max_wait_minutes, wait_map)
    ...existing ETag computation, unchanged (now naturally varies as wait data changes)...
```

```python
@app.get("/facilities/nearby")
async def facilities_nearby(lat: float, lng: float, radius_m: int = 5000, category: str | None = None, max_wait_minutes: int | None = None) -> list[NearbyFacilityResult]:
    ...existing RPC call via supabase_rpc, unchanged...
    wait_map = get_wait_minutes_map()
    data = apply_wait_filter(response_data, "facility_id", max_wait_minutes, wait_map)
    return data
```

`get_wait_minutes_map()` is called fresh on every request (cheap — one Redis `HGETALL`, no extra network hop beyond what the orchestrator design doc already budgets at ~5–20ms). The existing in-memory `cache.py` facility-list cache is untouched; it only ever held the static category/severity-filterable list, never live wait data, so no invalidation logic needs to change there.

### Models

`backend/models.py`:
```python
class Facility(BaseModel):
    ...
    wait_minutes: int | None = None   # new

class NearbyFacilityResult(BaseModel):
    ...
    wait_minutes: int | None = None   # new
```

`shared/types.ts` — matching nullable field added to `Facility` and `NearbyFacility` interfaces (type-only change; CLAUDE.md requires the shared type to exist before/alongside any backend response field — no frontend UI wiring in this task).

---

## Error handling

- Redis unreachable: caught, logged (`log.warning("redis_unavailable_falling_back_to_supabase")`), falls through to Supabase RPC. Never raises to the route handler.
- Supabase RPC `latest_wait_times` failure (both layers down): `get_wait_minutes_map()` raises; the route's existing `try/except → HTTPException(503)` pattern (already present in `facilities.py` / `main.py`) catches it. No new error-handling shape needed — same as today's `supabase_query_failed` path.
- Redis write-back failure on fallback: caught, logged, ignored. Does not affect the response.

---

## Testing

Non-trivial logic gets one runnable check each (ponytail rule — branch/loop logic, not full suites):

- `backend/tests/test_wait_times.py` — `apply_wait_filter`: asserts max-threshold filtering, `None` always passes, `max_wait_minutes=None` is a no-op. Pure function, no mocking needed.
- `get_wait_minutes_map()` — one test with a fake Redis client raising `ConnectionError` to assert fallback path is taken (mock `supabase_rpc` to return canned rows, assert the returned map matches).

### Smoke test (manual, same pattern as the db-migration spec)

```bash
source /home/niki/Documents/workenv/pydev/bin/activate
doppler run -- uvicorn backend.main:app --reload &
sleep 3
curl -s "http://localhost:8000/facilities?max_wait_minutes=30" | python3 -m json.tool | head -40
curl -s "http://localhost:8000/facilities/nearby?lat=43.6426&lng=-79.3871&radius_m=10000&max_wait_minutes=30" | python3 -m json.tool | head -40
kill %1 2>/dev/null
```
Expected: both responses include `wait_minutes` on every object; no object has `wait_minutes` both non-null and `> 30`.

---

## Out of scope

| Item | Reason |
|---|---|
| Frontend wait-dropdown wiring | Backend-only task; dropdown currently labeled as a minimum-wait filter and needs a copy fix to match the max-wait semantics implemented here — separate frontend follow-up |
| `wait_times` history retention/cleanup | Append-only log growth not addressed here |
| Full Layer 0–3 search orchestrator (`search-orchestrator-design.md`) | Explicitly deferred in the db-migration spec; this task keeps the existing two-endpoint shape |
| Redis TTL / staleness invalidation | Scraper cadence (~15 min) is trusted as freshness authority; no extra invalidation logic added |
