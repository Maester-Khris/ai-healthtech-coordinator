# Wait-Time/Data-API Implementation Review Findings — Backlog

**Date:** 2026-06-30
**Source:** code-review (high effort, 8-angle + verify) on the committed implementation `f8bf7a9..HEAD` (10 commits, `backend/db.py`, `backend/services/{auth,chat,facilities,wait_times}.py`, `backend/main.py`, `backend/models.py`, `shared/types.ts`, `migrations/011_latest_wait_times_rpc.sql`).
**Status:** Logged for later — dedicate a session to fix. Not designed/fixed yet; these are bug reports, not approved fix specs.
**Sanity check:** `doppler run -- pytest backend/ -v` → **95 passed**, 0 failed, run 2026-06-30. The implementation is functionally correct against its own test suite; the findings below are about failure-mode/resilience/efficiency gaps the tests don't (and in some cases structurally can't) cover, not broken behavior on the happy path.

---

## ACTION ITEM (not a code fix): GitHub Actions secrets

**`.github/workflows/ci.yml`'s backend job has no `env:`/secrets block for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_URL`.** `backend/db.py` and `backend/services/wait_times.py` now read these via `os.environ[...]` at module import time (previously only `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` were needed, lazily, inside `get_supabase_client()` — `UPSTASH_REDIS_URL` is entirely new to the backend). Without these set as repo secrets and wired into the workflow's `env:`, `pytest tests/ -v` fails at collection (verified locally: confirmed by running pytest with these unset). **To do:** add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_URL` as GitHub Actions repo secrets and reference them in `.github/workflows/ci.yml`'s backend job `env:` block. Flagging here so it isn't forgotten before the next push touching `backend/`.

---

## 1. A Redis+Supabase double-failure can take down `/facilities` and `/facilities/nearby` entirely — CONFIRMED
**Location:** `backend/main.py:105,141`, `backend/services/wait_times.py:32`

`get_wait_minutes_map()` is called with no try/except in both routes (in `/facilities/nearby` it sits after the only existing try/except, which wraps just the proximity RPC call). Its own internal fallback (`supabase_rpc("latest_wait_times", {})`, used when Redis is down or empty) is itself unguarded. If both fail, the exception propagates as an unhandled 500 — even though core facility data was already fetched/cached successfully.

**Direction (not designed yet):** wrap `get_wait_minutes_map()` calls in main.py (or internally) with a try/except that degrades to an empty wait map (`{}`) on failure, logging a warning — consistent with the "missing wait data always passes filters" convention already established.

---

## 2. `UPSTASH_REDIS_URL` is now a hard boot-time requirement for the whole API — CONFIRMED
**Location:** `backend/services/wait_times.py:13`

Before this diff, only `workers/scraper.py` needed this var; the backend had zero Redis dependency. `main.py` now imports `services.wait_times` unconditionally at module level, so a missing var crashes the entire API (not just wait-time filtering) on startup.

**Direction (not designed yet):** confirm `UPSTASH_REDIS_URL` is provisioned in the backend's actual deploy config (Render/Doppler), same as the GitHub Actions action item above. If acceptable as-is (fail-fast is a defensible choice), no code change needed — just confirm provisioning.

---

## 3. ETag churns every ~15 min regardless of `max_wait_minutes` usage; Redis is hit before the 304 short-circuit — CONFIRMED
**Location:** `backend/main.py:105-110`

Order is: fetch wait map (Redis round-trip) → annotate `wait_minutes` → compute ETag → compare `If-None-Match`. A polling client using conditional requests now pays a Redis round-trip on every poll even when the answer is 304, and the ETag changes on every scraper tick even when no facility's actual displayed data changed.

**Direction (not designed yet):** either move the wait-map fetch after a category/severity-only ETag pre-check (two-stage ETag), or accept the churn as intended (wait time is part of the resource now) — needs a decision, not just a fix.

---

## 4. `apply_wait_filter` mutates the shared in-memory facility cache in place — CONFIRMED
**Location:** `backend/services/facilities.py:57`, `backend/main.py:99`

When no category/severity filter narrows the list, `/facilities` operates on the exact same dict objects held in `cache.py`'s process-wide cache (no copy). Currently harmless (value gets overwritten correctly next request) but couples two previously-independent caches and is a latent race under concurrent requests (FastAPI runs sync routes in a threadpool).

**Direction (not designed yet):** build fresh per-record dicts in `apply_wait_filter` instead of mutating in place.

---

## 5. `db.py`'s module-level env var read changes a clear runtime error into a bare crash — CONFIRMED
**Location:** `backend/db.py:4-5`

Old: `os.environ.get(...)` + descriptive `RuntimeError`, raised lazily on first DB call. New: bracket access at import time → bare `KeyError` on process start, before any logging.

**Direction (not designed yet):** low priority if env vars are reliably provisioned (see action item above) — could keep bracket access but wrap in a clearer startup check if diagnosability matters more than fail-fast simplicity.

---

## 6. Cache-aside fallback writes a smaller JSON shape to Redis than the scraper's documented schema — CONFIRMED
**Location:** `backend/services/wait_times.py:37`

Scraper writes `{wait_minutes, raw_wait, source, updated_at}`; the fallback write-back here writes only `{wait_minutes}`. Verified zero current blast radius (nothing reads the other fields yet), but it's a real schema drift between two writers of the same Redis hash key.

**Direction (not designed yet):** match the scraper's write-back shape, or accept the partial shape as intentional since the only reader (`get_wait_minutes_map`) only ever reads `wait_minutes`.

---

## 7. Two test-quality gaps — CONFIRMED
**Location:** `backend/tests/test_facilities_routes.py`, `backend/tests/test_wait_times.py`

(a) Route tests call `main.facilities_nearby()` directly, bypassing FastAPI's response-model validation against `NearbyFacilityResult` — a malformed RPC response that would 500 in production isn't caught by this suite. (b) The Redis-failure test raises Python's builtin `ConnectionError`, not `redis.exceptions.ConnectionError` (confirmed: not a subclass) — passes today only because the implementation's except clause is broad.

**Direction (not designed yet):** (a) add at least one TestClient-based test through the real ASGI stack for `/facilities/nearby`. (b) use `redis.exceptions.ConnectionError` in the test.

---

## 8. `auth.py`'s rewrite kept the blanket-401 behavior despite having the data to fix it — CONFIRMED
**Location:** `backend/services/auth.py:12`

`r.status_code` is available before `raise_for_status()` is called, so the new code could distinguish "Supabase says invalid token" (401) from "Supabase is unreachable" (timeout/5xx) — it doesn't, collapsing both into the same 401. Pre-existing weakness (old code had it too), not a new regression.

**Direction (not designed yet):** branch on `r.status_code` before raising; map non-401 failures to 503 instead of 401.

---

## 9. `redis` added to `requirements.txt` unpinned — CONFIRMED
**Location:** `backend/requirements.txt:10`

Inconsistent with the file's dominant pinning convention (`fastapi==0.111.*`, etc.) — minor. Note `python-dotenv`/`httpx` are also unpinned, so not a unique outlier.

**Direction (not designed yet):** pin to a major version range, e.g. `redis==5.*`.
