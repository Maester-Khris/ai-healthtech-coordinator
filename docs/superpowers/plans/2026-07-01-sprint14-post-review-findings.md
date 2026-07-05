# Sprint 14 — Post-Review Findings Backlog

Generated: 2026-07-01  
Branch: `feat/advanced-filtering`  
Source: final `/code-review high` after Sprint 14 task execution

These findings were **not fixed in Sprint 14**. Pass this file directly to the next implementation conversation — no additional context needed to act on each item.

---

## CONFIRMED — must fix before next merge to `preview`

---

### F1 — HIGH · `backend/middleware/auth.py:28`

**Problem:** `AuthMiddleware.dispatch()` catches all exceptions with bare `except Exception:`, silently treating every auth failure as "unauthenticated". Task 8 introduced `HTTPException(503)` for Supabase outages — that 503 now gets swallowed here and the request proceeds as an anonymous user instead of returning an error to the client.

**Current code:**
```python
# middleware/auth.py lines 25-32
try:
    user = verify_token(token)
    request.state.user_id = user.id
except Exception:                          # ← swallows 503
    logger.warning(
        "auth_token_invalid",
        extra={"path": request.url.path},
    )
```

**`verify_token` now raises (services/auth.py):**
- `HTTPException(401)` — bad/expired token (should silently swallow → treat as anon)
- `HTTPException(503)` — Supabase is down (should NOT swallow → let it propagate so client sees 503)

**Fix:** Re-raise any `HTTPException` that is not a 401:
```python
from fastapi import HTTPException

try:
    user = verify_token(token)
    request.state.user_id = user.id
except HTTPException as exc:
    if exc.status_code != 401:
        raise                              # propagate 503, 502, etc.
    logger.warning("auth_token_invalid", extra={"path": request.url.path})
```

**Test to add** (`backend/tests/test_auth_middleware.py` or inline in existing test file):
```python
def test_middleware_propagates_503_when_auth_service_down():
    from fastapi import FastAPI, HTTPException
    from starlette.testclient import TestClient
    from starlette.responses import PlainTextResponse
    from backend.middleware.auth import AuthMiddleware

    app = FastAPI()
    app.add_middleware(AuthMiddleware)

    @app.get("/probe")
    async def probe():
        return PlainTextResponse("ok")

    with patch("backend.middleware.auth.verify_token",
               side_effect=HTTPException(503, "Auth service unavailable")):
        with TestClient(app, raise_server_exceptions=False) as client:
            resp = client.get("/probe", headers={"Authorization": "Bearer tok"})
    assert resp.status_code == 503
```

---

### F2 — HIGH · `workers/scraper.py:429`

**Problem:** `resolve_unmatched_facility()` returns `None` for **two distinct reasons**: (a) facility is genuinely outside Toronto bounds / not found on Places API, or (b) a transient network timeout. Currently both cases trigger `sadd(NEGATIVE_CACHE_KEY, official)` — permanently blacklisting real hospitals after one flaky request. After one bad run, the scraper skips those names forever.

**Current code:**
```python
# scraper.py lines 426-430
created = resolve_unmatched_facility(official)
if created is None:
    unmatched.append(official)
    redis_client.sadd(NEGATIVE_CACHE_KEY, official)   # ← also fires on timeout
    continue
```

**`resolve_unmatched_facility` internals (look at the function):** returns `None` on:
- `requests.RequestException` (network error, timeout) — transient
- geometry missing — transient/ambiguous
- `_in_toronto_bounds()` fails — permanent

**Fix:** Use a sentinel to distinguish transient from permanent. Simplest approach — add a second return value or use a custom exception for transient failures:

```python
# In resolve_unmatched_facility, raise instead of returning None for network errors:
# (find the requests.get / requests.RequestException block and raise)

class _TransientLookupError(Exception):
    pass

# Then in build_facility_map:
try:
    created = resolve_unmatched_facility(official)
except _TransientLookupError:
    unmatched.append(official)
    continue                    # no sadd — try again next run
if created is None:             # genuine: out-of-region or not found
    unmatched.append(official)
    redis_client.sadd(NEGATIVE_CACHE_KEY, official)
    continue
```

**Test to add** (`workers/tests/test_scraper.py`):
```python
def test_transient_network_error_does_not_add_to_negative_cache(monkeypatch, ...):
    # mock requests.get to raise requests.ConnectionError
    # assert redis_client.sadd was NOT called
```

---

### F3 — MEDIUM · `workers/scraper.py:433-435`

**Problem:** When `resolve_unmatched_facility()` succeeds and the returned `google_place_id` already exists in `place_id_to_facility_id` (a different scraped name resolving to the same Place), the code maps it and continues — but never adds `official` to the negative cache. On the next 15-min run, the same facility name fires **two** Google Places API calls again (text search + place details) before hitting this dedup path.

**Current code:**
```python
place_id = created["google_place_id"]
if place_id in place_id_to_facility_id:
    facility_map[clean] = place_id_to_facility_id[place_id]
    continue                # ← no sadd, will repeat Places API calls next run
```

**Fix:** Cache the canonical `official` name as "already resolved" by adding it to the negative cache (or a separate "positive dedup" cache; negative cache is simpler if TTL is long enough):

Actually, the negative cache is for names that should NOT be looked up. A better approach: just add the place_id→facility_id mapping persists via `place_id_to_facility_id` (already done). The issue is the fuzzy match fails for this name every run. 

**Simplest fix:** After dedup match, add `official` to `cached_unresolved` in-memory only so subsequent names in the same run don't repeat it (this run is already fine). For cross-run caching, use a separate Redis key or rely on the fuzzy match eventually picking it up after the facility is in the DB.

**Actually, simplest correct fix:** After the dedup match, also add a redis `sadd` but with a short TTL so it expires and is retried weekly rather than never:
```python
if place_id in place_id_to_facility_id:
    facility_map[clean] = place_id_to_facility_id[place_id]
    redis_client.sadd(NEGATIVE_CACHE_KEY, official)   # ← stop re-querying Places
    continue
```

**Note:** This means "we already know where this maps" is treated the same as "this doesn't exist" — acceptable because the facility will be in the DB and fuzzy-matched directly on the next run once `fetch_existing_place_ids` returns it.

**Test to add:**
```python
def test_place_id_dedup_adds_to_negative_cache():
    # resolve returns a created dict with google_place_id already in place_id_to_facility_id
    # assert redis.sadd was called with NEGATIVE_CACHE_KEY and official name
```

---

### F4 — MEDIUM · `backend/services/wait_times.py:44`

**Problem:** Redis writeback on Supabase fallback uses N individual `hset` calls in a loop — one round-trip per facility. The scraper's `update_redis` uses a pipeline for the same pattern. Under normal Toronto ER load (~20 hospitals) this is fine but inconsistent and adds latency on cold start.

**Current code:**
```python
# wait_times.py lines 43-52
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
```

**Fix:** Use pipeline:
```python
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
```

**Existing test to update** (`backend/tests/test_wait_times.py::test_fallback_writes_back_to_redis`):
The test currently asserts `mock_redis.hset.assert_called_once()`. After the pipeline fix, `hset` is called on `mock_redis.pipeline.return_value`, not on `mock_redis` directly. Update the assertion:
```python
mock_pipe = mock_redis.pipeline.return_value
mock_pipe.hset.assert_called_once()
mock_pipe.execute.assert_called_once()
```

---

## PLAUSIBLE — lower priority, address in a cleanup pass

---

### P1 — `workers/scraper.py:417-421` — un-normalized negative cache key

**Problem:** The key added to `NEGATIVE_CACHE_KEY` is `official` — the raw name string from the scraper source (`erstat_data[clean]["official_name"]` or `hlwiw_data[clean]["hlwiw_name"]`). If the same hospital appears in future scrapes with minor name variations (trailing spaces, capitalization), it won't hit the cache and will fire Places API again.

**Relevant code:**
```python
official = (
    erstat_data.get(clean, {}).get("official_name")
    or hlwiw_data.get(clean, {}).get("hlwiw_name")
    or clean
)
```

**Suggested fix:** Normalize before using as cache key: `official.strip().lower()`. Low urgency — hospital names from these specific sources are stable.

---

### P2 — `workers/scraper.py:443` — misleading `matched` count in log

**Problem:** `matched = len(facility_map) - len(new_facilities)` counts both fuzzy-matched AND place_id-dedup-reused entries as "matched". The log line reads "X matched, Y newly created" but X includes the dedup-reuse count which is neither a fuzzy match nor a new creation.

**Relevant code:**
```python
matched = len(facility_map) - len(new_facilities)
log.info("Mapping: %d matched, %d newly created, %d unmatched ...", matched, len(succeeded_ids), ...)
```

**Suggested fix:** Track dedup-reuse count separately with a counter in the loop. Low urgency — observability only.

---

### P3 — `workers/scraper.py:407` — `fetch_existing_place_ids` unconditional on every tick

**Problem:** `fetch_existing_place_ids` fires a Supabase REST query on every 15-min cron run, even when there are no unmatched names. The result is only used on the path where a new facility is being created.

**Relevant code:**
```python
place_id_to_facility_id: dict[str, str] = fetch_existing_place_ids(url, headers)  # line 407 — always called
```

**Suggested fix:** Move the call inside the `if created is not None:` block (lazy fetch), or cache the result in Redis with a 1-hour TTL. Low urgency — one small REST query per run is acceptable at current scale.

---

## Manual steps still pending (not code bugs)

- **Apply migration** `migrations/012_latest_wait_times_rpc_add_fields.sql` in Supabase SQL Editor (adds `raw_wait`, `source` columns to `latest_wait_times()` RPC).
- **Add GitHub Actions secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_URL` — needed for CI backend test job to pass on `feat/advanced-filtering`.
- **Fix stray `_` in `migrations/010_nearby_facilities_rpc.sql:1`** — file starts `_CREATE OR REPLACE FUNCTION` (typo). One-character delete + reapply in Supabase SQL Editor. This is why `/facilities/nearby` returns 400 in production (unrelated to Sprint 14, pre-existing).
