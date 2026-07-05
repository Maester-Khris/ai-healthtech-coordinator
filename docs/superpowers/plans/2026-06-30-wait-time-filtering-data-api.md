# Wait-Time Filtering + Supabase Data API Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken `supabase-py` client with direct PostgREST/GoTrue REST calls across the whole backend, and wire a real `max_wait_minutes` filter into both facility-search endpoints, backed by a Redis-first / Supabase-fallback cache-aside read of ER wait times.

**Architecture:** `backend/db.py` becomes a thin `requests`-based REST helper (mirroring `workers/scraper.py`'s already-working pattern) instead of a `supabase-py` `Client` factory. A new `backend/services/wait_times.py` reads the Upstash Redis hash `wait_times:current` (written every ~15 min by the scraper) and falls back to a new Postgres RPC (`latest_wait_times`) on miss. A shared `apply_wait_filter()` helper in `services/facilities.py` is called by both `GET /facilities` and `GET /facilities/nearby` — no endpoint merge.

**Tech Stack:** Python 3.11, FastAPI, `requests` (already a dependency), `redis` (new dependency, same package `workers/scraper.py` already uses), pytest + pytest-asyncio + `unittest.mock` (all already dependencies — no new test tooling).

## Global Constraints

- Python virtualenv: `source /home/niki/Documents/workenv/pydev/bin/activate` before any Python/pytest command
- All Python/pytest commands run via `doppler run -- <command>` — `db.py` and `services/wait_times.py` read required env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_URL`) at **module import time**, so tests fail to even collect without Doppler injection
- Python: type hints on all function signatures, Pydantic models for request/response bodies
- TypeScript: strict mode, no `any`
- Severity schema values: `routine | moderate | urgent | emergent` only
- New backend response fields require a matching `shared/types.ts` field before/alongside the backend change
- No new npm packages. One new Python dependency: `redis` (added to `backend/requirements.txt`)
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`), one logical change per commit, no AI co-author trailers, never commit directly to `main`/`preview`
- Active branch: `feat/advanced-filtering`
- Spec: `docs/superpowers/specs/2026-06-30-wait-time-filtering-data-api-design.md`

---

## Codebase Orientation

| File | Role |
|---|---|
| `backend/db.py` | Currently wraps `supabase-py`'s `create_client()` — broken. Becomes a REST helper module. |
| `backend/services/facilities.py` | `get_all_facilities()` — table query via the old client. Gains `apply_wait_filter()`. |
| `backend/services/chat.py` | Session/message CRUD via the old client. |
| `backend/services/auth.py` | `verify_token()` — currently `client.auth.get_user(token)`. |
| `backend/main.py` | `/facilities` (category+severity, in-memory cache) and `/facilities/nearby` (PostGIS RPC) routes. |
| `backend/models.py` | `Facility`, `NearbyFacilityResult` Pydantic models. |
| `backend/cache.py` | In-memory full-facility-list cache (ETag). Untouched by this plan. |
| `backend/middleware/auth.py` | Calls `services.auth.verify_token(token)`, expects `.id` attribute on the return value. |
| `workers/scraper.py` | Reference pattern for REST calls (`SUPABASE_HEADERS`, `requests.get/post`) and the Redis hash shape (`wait_times:current`, JSON value `{"wait_minutes": int|null, ...}`). |
| `migrations/010_nearby_facilities_rpc.sql` | Reference pattern for `LANGUAGE sql STABLE SECURITY DEFINER` RPC functions. |
| `shared/types.ts:30-45,57-68` | `Facility` and `NearbyFacility` interfaces — both need a new `wait_minutes` field. |

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `migrations/011_latest_wait_times_rpc.sql` | Create | "Latest wait per facility" RPC — cache-aside fallback source |
| `backend/db.py` | Modify (rewrite) | REST helpers: `supabase_select`, `supabase_insert`, `supabase_rpc`, `supabase_auth_get_user` |
| `backend/tests/test_db.py` | Create | Unit tests for the four `db.py` helpers (mocked `requests`) |
| `backend/services/auth.py` | Modify | Use `supabase_auth_get_user`, wrap result in `SimpleNamespace` |
| `backend/tests/test_auth_service.py` | Create | Unit tests for `verify_token` (mocked `db.supabase_auth_get_user`) |
| `backend/services/chat.py` | Modify | Use `supabase_select`/`supabase_insert` instead of the old client |
| `backend/tests/test_chat_service.py` | Create | Unit tests asserting correct PostgREST params per function |
| `backend/services/facilities.py` | Modify | Use `supabase_select`; add `apply_wait_filter()` |
| `backend/tests/test_facilities.py` | Create | Unit tests for `get_all_facilities` params + `apply_wait_filter` |
| `backend/services/wait_times.py` | Create | `get_wait_minutes_map()` — Redis-first, Supabase-fallback cache-aside |
| `backend/tests/test_wait_times.py` | Create | Unit tests for both cache-aside branches |
| `backend/models.py` | Modify | Add `wait_minutes: int \| None = None` to `Facility` and `NearbyFacilityResult` |
| `backend/tests/test_models.py` | Create | Unit tests for the new field |
| `shared/types.ts` | Modify | Add `wait_minutes?: number \| null` to `Facility` and `NearbyFacility` |
| `backend/main.py` | Modify | Migrate `/facilities/nearby` to `supabase_rpc`; add `max_wait_minutes` to both routes |
| `backend/tests/test_facilities_routes.py` | Create | Unit tests calling the route handlers directly with mocked dependencies |
| `backend/requirements.txt` | Modify | Remove `supabase==2.*`, add `redis` |

---

## Task 1: Database migration — `latest_wait_times` RPC

**Files:**
- Create: `migrations/011_latest_wait_times_rpc.sql`

**Background:** `wait_times` (migration 005) is an append-only history log — multiple rows per facility over time. PostgREST's plain `select` query string can't express "latest row per facility" (`DISTINCT ON`), so this RPC exists purely as the cache-aside fallback for `services/wait_times.py` when Redis is unreachable or empty. Pattern matches `migrations/010_nearby_facilities_rpc.sql` (`LANGUAGE sql STABLE SECURITY DEFINER`).

- [ ] **Step 1: Write the migration file**

Create `migrations/011_latest_wait_times_rpc.sql`:

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

- [ ] **Step 2: Apply it in Supabase**

Open the Supabase SQL Editor for this project and run the full content of `migrations/011_latest_wait_times_rpc.sql`.

- [ ] **Step 3: Smoke test the RPC**

```sql
SELECT * FROM latest_wait_times() LIMIT 5;
```
Expected: up to 5 rows, one `facility_id` per row, no duplicate `facility_id` values. If `wait_times` is empty (no scraper runs yet), 0 rows is also a valid result — `services/wait_times.py` (Task 6) handles an empty result as "no data" rather than an error.

- [ ] **Step 4: Update migrations README**

Read `migrations/README.md`. Add a row to the table:
```
| 011_latest_wait_times_rpc.sql | Latest wait_minutes per facility (DISTINCT ON), cache-aside fallback | applied — 2026-06-30 |
```

- [ ] **Step 5: Commit**

```bash
git add migrations/011_latest_wait_times_rpc.sql migrations/README.md
git commit -m "feat: add latest_wait_times RPC for wait-time cache-aside fallback"
```

---

## Task 2: Rewrite `db.py` as a Supabase REST helper

**Files:**
- Modify: `backend/db.py`
- Test: `backend/tests/test_db.py`

**Interfaces:**
- Produces:
  - `supabase_select(table: str, params: dict, single: bool = False) -> list[dict] | dict | None`
  - `supabase_insert(table: str, rows: list[dict]) -> list[dict]`
  - `supabase_rpc(fn_name: str, payload: dict) -> list[dict]`
  - `supabase_auth_get_user(token: str) -> dict`
- All four raise `requests.HTTPError` on non-2xx (except `supabase_select(..., single=True)`, which returns `None` on 404/406 instead of raising — PostgREST returns 406 for `Accept: application/vnd.pgrst.object+json` when zero rows match).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_db.py`:

```python
"""
Unit tests for db.py's Supabase REST helpers. All HTTP calls are mocked —
no network or real Supabase project required (env vars still need to be
set, even to dummy values, since db.py reads them at import time).
"""

import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import db


class TestSupabaseSelect:
    @patch("db.requests.get")
    def test_builds_correct_url_and_params(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, json=lambda: [{"id": "1"}])
        mock_get.return_value.raise_for_status = lambda: None

        result = db.supabase_select("facilities_clean", {"select": "*", "category": "eq.hospital"})

        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert args[0] == f"{db.SUPABASE_URL}/rest/v1/facilities_clean"
        assert kwargs["params"] == {"select": "*", "category": "eq.hospital"}
        assert kwargs["headers"]["apikey"] == db.SUPABASE_KEY
        assert result == [{"id": "1"}]

    @patch("db.requests.get")
    def test_single_true_sets_object_accept_header(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, json=lambda: {"id": "1"})
        mock_get.return_value.raise_for_status = lambda: None

        db.supabase_select("messages", {"select": "created_at"}, single=True)

        _, kwargs = mock_get.call_args
        assert kwargs["headers"]["Accept"] == "application/vnd.pgrst.object+json"

    @patch("db.requests.get")
    def test_single_true_404_returns_none(self, mock_get):
        mock_get.return_value = MagicMock(status_code=404)

        result = db.supabase_select("messages", {"select": "created_at"}, single=True)

        assert result is None

    @patch("db.requests.get")
    def test_single_true_406_returns_none(self, mock_get):
        mock_get.return_value = MagicMock(status_code=406)

        result = db.supabase_select("messages", {"select": "created_at"}, single=True)

        assert result is None


class TestSupabaseInsert:
    @patch("db.requests.post")
    def test_posts_with_return_representation_header(self, mock_post):
        mock_post.return_value = MagicMock(status_code=201, json=lambda: [{"id": "new-1"}])
        mock_post.return_value.raise_for_status = lambda: None

        result = db.supabase_insert("sessions", [{"user_id": "u1", "title": "t"}])

        args, kwargs = mock_post.call_args
        assert args[0] == f"{db.SUPABASE_URL}/rest/v1/sessions"
        assert kwargs["json"] == [{"user_id": "u1", "title": "t"}]
        assert kwargs["headers"]["Prefer"] == "return=representation"
        assert result == [{"id": "new-1"}]


class TestSupabaseRpc:
    @patch("db.requests.post")
    def test_posts_to_rpc_path(self, mock_post):
        mock_post.return_value = MagicMock(status_code=200, json=lambda: [{"facility_id": "a"}])
        mock_post.return_value.raise_for_status = lambda: None

        result = db.supabase_rpc("nearby_facilities", {"user_lat": 43.6, "user_lng": -79.4})

        args, kwargs = mock_post.call_args
        assert args[0] == f"{db.SUPABASE_URL}/rest/v1/rpc/nearby_facilities"
        assert kwargs["json"] == {"user_lat": 43.6, "user_lng": -79.4}
        assert result == [{"facility_id": "a"}]


class TestSupabaseAuthGetUser:
    @patch("db.requests.get")
    def test_uses_caller_token_as_bearer(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, json=lambda: {"id": "u1", "email": "a@b.com"})
        mock_get.return_value.raise_for_status = lambda: None

        result = db.supabase_auth_get_user("user-jwt-token")

        args, kwargs = mock_get.call_args
        assert args[0] == f"{db.SUPABASE_URL}/auth/v1/user"
        assert kwargs["headers"]["Authorization"] == "Bearer user-jwt-token"
        assert kwargs["headers"]["apikey"] == db.SUPABASE_KEY
        assert result == {"id": "u1", "email": "a@b.com"}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source /home/niki/Documents/workenv/pydev/bin/activate
cd /home/niki/Documents/saas/medicoordai
doppler run -- pytest backend/tests/test_db.py -v
```
Expected: FAIL — `AttributeError: module 'db' has no attribute 'supabase_select'` (and similar for the other three).

- [ ] **Step 3: Rewrite `db.py`**

Replace the full content of `backend/db.py`:

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
    headers = dict(HEADERS)
    if single:
        headers["Accept"] = "application/vnd.pgrst.object+json"

    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=headers, params=params, timeout=10)

    if single and r.status_code in (404, 406):
        return None

    r.raise_for_status()
    return r.json()


def supabase_insert(table: str, rows: list[dict]) -> list[dict]:
    headers = dict(HEADERS)
    headers["Prefer"] = "return=representation"

    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=headers, json=rows, timeout=10)
    r.raise_for_status()
    return r.json()


def supabase_rpc(fn_name: str, payload: dict) -> list[dict]:
    r = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/{fn_name}", headers=HEADERS, json=payload, timeout=10)
    r.raise_for_status()
    return r.json()


def supabase_auth_get_user(token: str) -> dict:
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {token}",
    }
    r = requests.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
doppler run -- pytest backend/tests/test_db.py -v
```
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/db.py backend/tests/test_db.py
git commit -m "feat: replace supabase-py client with direct PostgREST/GoTrue REST calls"
```

---

## Task 3: Migrate `services/auth.py`

**Files:**
- Modify: `backend/services/auth.py`
- Test: `backend/tests/test_auth_service.py`

**Interfaces:**
- Consumes: `db.supabase_auth_get_user(token: str) -> dict` (Task 2)
- Produces: `verify_token(token: str) -> object` — unchanged signature, return value still exposes `.id` and `.email` (consumed by `backend/middleware/auth.py:27` and `backend/main.py`'s `/me` route)

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_auth_service.py`:

```python
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi import HTTPException

from services.auth import verify_token


class TestVerifyToken:
    @patch("services.auth.supabase_auth_get_user")
    def test_valid_token_returns_object_with_id_and_email(self, mock_get_user):
        mock_get_user.return_value = {"id": "u1", "email": "a@b.com"}

        user = verify_token("good-token")

        assert user.id == "u1"
        assert user.email == "a@b.com"

    @patch("services.auth.supabase_auth_get_user")
    def test_response_missing_id_raises_401(self, mock_get_user):
        mock_get_user.return_value = {}

        with pytest.raises(HTTPException) as exc_info:
            verify_token("bad-token")
        assert exc_info.value.status_code == 401

    @patch("services.auth.supabase_auth_get_user", side_effect=Exception("network error"))
    def test_request_failure_raises_401(self, mock_get_user):
        with pytest.raises(HTTPException) as exc_info:
            verify_token("expired-token")
        assert exc_info.value.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
doppler run -- pytest backend/tests/test_auth_service.py -v
```
Expected: FAIL — `verify_token` still references the old `get_supabase_client`, so `patch("services.auth.supabase_auth_get_user")` raises `AttributeError` (no such name in the module yet).

- [ ] **Step 3: Rewrite `services/auth.py`**

Replace the full content of `backend/services/auth.py`:

```python
import types
from fastapi import HTTPException

from db import supabase_auth_get_user


def verify_token(token: str) -> object:
    """
    Verify a Supabase JWT and return a user object exposing .id and .email.
    Raises HTTPException 401 if the token is invalid, expired, or unverifiable.
    """
    try:
        data = supabase_auth_get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token verification failed") from exc

    if not data.get("id"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return types.SimpleNamespace(id=data["id"], email=data.get("email"))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
doppler run -- pytest backend/tests/test_auth_service.py -v
```
Expected: PASS — 3 tests.

- [ ] **Step 5: Run the existing chat test suite to confirm no regression**

```bash
doppler run -- pytest backend/tests/test_chat.py -v
```
Expected: PASS — all tests (they mock `middleware.auth.verify_token` directly, so they exercise the import chain through `services.auth` → `db` without hitting the network).

- [ ] **Step 6: Commit**

```bash
git add backend/services/auth.py backend/tests/test_auth_service.py
git commit -m "feat: migrate token verification to Supabase Auth REST endpoint"
```

---

## Task 4: Migrate `services/chat.py`

**Files:**
- Modify: `backend/services/chat.py`
- Test: `backend/tests/test_chat_service.py`

**Interfaces:**
- Consumes: `db.supabase_select`, `db.supabase_insert` (Task 2)
- Produces: same four function signatures as before — `generate_session_title`, `create_session`, `add_message`, `get_past_conversations`, `get_older_messages` — unchanged, consumed by `backend/routers/chat.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_chat_service.py`:

```python
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.chat import create_session, add_message, get_past_conversations, get_older_messages


class TestCreateSession:
    @patch("services.chat.supabase_insert")
    def test_inserts_into_sessions_table(self, mock_insert):
        mock_insert.return_value = [{"id": "s1", "user_id": "u1", "title": "hi"}]

        result = create_session("u1", "hi")

        mock_insert.assert_called_once_with("sessions", [{"user_id": "u1", "title": "hi"}])
        assert result == {"id": "s1", "user_id": "u1", "title": "hi"}


class TestAddMessage:
    @patch("services.chat.supabase_insert")
    def test_inserts_into_messages_table(self, mock_insert):
        mock_insert.return_value = [{"id": "m1", "role": "user", "content": "hi"}]

        result = add_message("s1", "u1", "user", "hi")

        mock_insert.assert_called_once_with(
            "messages", [{"session_id": "s1", "user_id": "u1", "role": "user", "content": "hi"}]
        )
        assert result == {"id": "m1", "role": "user", "content": "hi"}


class TestGetPastConversations:
    @patch("services.chat.supabase_select")
    def test_fetches_sessions_then_messages_per_session(self, mock_select):
        def side_effect(table, params, single=False):
            if table == "sessions":
                return [{"id": "s1"}]
            if table == "messages":
                return [{"id": "m2", "created_at": "2"}, {"id": "m1", "created_at": "1"}]
            raise AssertionError(f"unexpected table {table}")

        mock_select.side_effect = side_effect

        sessions, messages = get_past_conversations("u1", session_limit=5, message_limit=20)

        assert sessions == [{"id": "s1"}]
        # messages come back oldest-first (reversed from the desc-ordered query)
        assert messages["s1"] == [{"id": "m1", "created_at": "1"}, {"id": "m2", "created_at": "2"}]

        sessions_call = mock_select.call_args_list[0]
        assert sessions_call.args[0] == "sessions"
        assert sessions_call.args[1]["user_id"] == "eq.u1"
        assert sessions_call.args[1]["order"] == "updated_at.desc"
        assert sessions_call.args[1]["limit"] == "5"


class TestGetOlderMessages:
    @patch("services.chat.supabase_select")
    def test_no_cursor_match_returns_empty_list(self, mock_select):
        mock_select.return_value = None  # cursor lookup found nothing

        result = get_older_messages("s1", "missing-id", limit=20)

        assert result == []

    @patch("services.chat.supabase_select")
    def test_cursor_found_fetches_older_messages(self, mock_select):
        def side_effect(table, params, single=False):
            if single:
                return {"created_at": "2024-01-15T10:00:00"}
            return [{"id": "m1", "created_at": "2024-01-14T10:00:00"}]

        mock_select.side_effect = side_effect

        result = get_older_messages("s1", "before-id", limit=20)

        assert result == [{"id": "m1", "created_at": "2024-01-14T10:00:00"}]
        messages_call = mock_select.call_args_list[1]
        assert messages_call.args[1]["created_at"] == "lt.2024-01-15T10:00:00"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
doppler run -- pytest backend/tests/test_chat_service.py -v
```
Expected: FAIL — `services.chat` doesn't import `supabase_select`/`supabase_insert` yet, so `patch(...)` raises `AttributeError`.

- [ ] **Step 3: Rewrite `services/chat.py`**

Replace the full content of `backend/services/chat.py`:

```python
from db import supabase_select, supabase_insert


def generate_session_title(first_message: str) -> str:
    title = first_message.strip()
    return title[:50] + ("..." if len(title) > 50 else "")


def create_session(user_id: str, title: str) -> dict:
    rows = supabase_insert("sessions", [{"user_id": user_id, "title": title}])
    return rows[0]


def add_message(session_id: str, user_id: str, role: str, content: str) -> dict:
    rows = supabase_insert("messages", [{
        "session_id": session_id,
        "user_id": user_id,
        "role": role,
        "content": content,
    }])
    return rows[0]


def get_past_conversations(user_id: str, session_limit: int = 5, message_limit: int = 20) -> tuple[list, dict]:
    """
    Returns (sessions_list, messages_dict).
    sessions_list: up to `session_limit` most recent sessions for the user.
    messages_dict: { session_id: [last `message_limit` messages, chronological] }
    """
    sessions = supabase_select("sessions", {
        "select": "*",
        "user_id": f"eq.{user_id}",
        "order": "updated_at.desc",
        "limit": str(session_limit),
    }) or []

    messages: dict[str, list] = {}
    for session in sessions:
        sid = session["id"]
        msgs = supabase_select("messages", {
            "select": "*",
            "session_id": f"eq.{sid}",
            "order": "created_at.desc",
            "limit": str(message_limit),
        }) or []
        messages[sid] = list(reversed(msgs))

    return sessions, messages


def get_older_messages(session_id: str, before_id: str, limit: int = 20) -> list:
    """
    Cursor-based pagination — returns messages older than `before_id`.
    Always hits Supabase; older messages are not cached.
    """
    cursor = supabase_select("messages", {"select": "created_at", "id": f"eq.{before_id}"}, single=True)

    if not cursor:
        return []

    cursor_ts = cursor["created_at"]

    msgs = supabase_select("messages", {
        "select": "*",
        "session_id": f"eq.{session_id}",
        "created_at": f"lt.{cursor_ts}",
        "order": "created_at.desc",
        "limit": str(limit),
    }) or []

    return list(reversed(msgs))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
doppler run -- pytest backend/tests/test_chat_service.py -v
```
Expected: PASS — 5 tests.

- [ ] **Step 5: Run the existing chat test suite to confirm no regression**

```bash
doppler run -- pytest backend/tests/test_chat.py -v
```
Expected: PASS — unchanged, all tests mock at the `routers.chat` boundary.

- [ ] **Step 6: Commit**

```bash
git add backend/services/chat.py backend/tests/test_chat_service.py
git commit -m "feat: migrate chat session/message CRUD to PostgREST REST calls"
```

---

## Task 5: Migrate `services/facilities.py` + add `apply_wait_filter`

**Files:**
- Modify: `backend/services/facilities.py`
- Test: `backend/tests/test_facilities.py`

**Interfaces:**
- Consumes: `db.supabase_select` (Task 2)
- Produces:
  - `get_all_facilities(category: str | None = None, severity: str | None = None) -> list[dict]` — unchanged signature
  - `apply_wait_filter(records: list[dict], id_key: str, max_wait_minutes: int | None, wait_map: dict[str, int | None]) -> list[dict]` — new, consumed by `main.py` (Task 9) for both `/facilities` (`id_key="id"`) and `/facilities/nearby` (`id_key="facility_id"`)

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_facilities.py`:

```python
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.facilities import get_all_facilities, apply_wait_filter


class TestGetAllFacilities:
    @patch("services.facilities.supabase_select")
    def test_always_on_operational_filter(self, mock_select):
        mock_select.return_value = []

        get_all_facilities()

        params = mock_select.call_args.args[1]
        assert params["is_operational"] == "eq.true"
        assert "category" not in params
        assert "accepted_severity" not in params

    @patch("services.facilities.supabase_select")
    def test_category_and_severity_filters_forwarded(self, mock_select):
        mock_select.return_value = []

        get_all_facilities(category="hospital", severity="urgent")

        params = mock_select.call_args.args[1]
        assert params["category"] == "eq.hospital"
        assert params["accepted_severity"] == "cs.{urgent}"

    @patch("services.facilities.supabase_select")
    def test_weekday_hours_json_string_parsed_to_list(self, mock_select):
        mock_select.return_value = [{"weekday_hours": '["Monday: 9-5"]'}]

        result = get_all_facilities()

        assert result[0]["weekday_hours"] == ["Monday: 9-5"]

    @patch("services.facilities.supabase_select")
    def test_weekday_hours_none_becomes_empty_list(self, mock_select):
        mock_select.return_value = [{"weekday_hours": None}]

        result = get_all_facilities()

        assert result[0]["weekday_hours"] == []


class TestApplyWaitFilter:
    def test_annotates_wait_minutes_from_map(self):
        records = [{"id": "a"}, {"id": "b"}]
        result = apply_wait_filter(records, "id", None, {"a": 10, "b": 50})

        assert result[0]["wait_minutes"] == 10
        assert result[1]["wait_minutes"] == 50

    def test_no_threshold_returns_all_records(self):
        records = [{"id": "a"}, {"id": "b"}]
        result = apply_wait_filter(records, "id", None, {"a": 10, "b": 50})

        assert len(result) == 2

    def test_excludes_records_above_threshold(self):
        records = [{"id": "a"}, {"id": "b"}]
        result = apply_wait_filter(records, "id", 30, {"a": 10, "b": 50})

        assert [r["id"] for r in result] == ["a"]

    def test_at_threshold_is_included(self):
        records = [{"id": "a"}]
        result = apply_wait_filter(records, "id", 30, {"a": 30})

        assert len(result) == 1

    def test_missing_wait_data_always_passes(self):
        records = [{"id": "a"}]
        result = apply_wait_filter(records, "id", 5, {})

        assert len(result) == 1
        assert result[0]["wait_minutes"] is None

    def test_works_with_facility_id_key(self):
        records = [{"facility_id": "x"}]
        result = apply_wait_filter(records, "facility_id", 10, {"x": 5})

        assert len(result) == 1
        assert result[0]["wait_minutes"] == 5
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
doppler run -- pytest backend/tests/test_facilities.py -v
```
Expected: FAIL — `services.facilities` has no `apply_wait_filter`, and `get_all_facilities` still calls the old client (no `supabase_select` to patch).

- [ ] **Step 3: Rewrite `services/facilities.py`**

Replace the full content of `backend/services/facilities.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
doppler run -- pytest backend/tests/test_facilities.py -v
```
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/services/facilities.py backend/tests/test_facilities.py
git commit -m "feat: migrate facility queries to PostgREST, add apply_wait_filter"
```

---

## Task 6: Create `services/wait_times.py` — cache-aside wait time read

**Files:**
- Create: `backend/services/wait_times.py`
- Test: `backend/tests/test_wait_times.py`

**Interfaces:**
- Consumes: `db.supabase_rpc` (Task 2), `redis.from_url`
- Produces: `get_wait_minutes_map() -> dict[str, int | None]`, consumed by `main.py` (Task 9)

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_wait_times.py`:

```python
import json
import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.wait_times import get_wait_minutes_map


class TestGetWaitMinutesMap:
    @patch("services.wait_times.redis_client")
    def test_redis_hit_returns_parsed_wait_minutes(self, mock_redis):
        mock_redis.hgetall.return_value = {
            "fac-1": json.dumps({"wait_minutes": 12, "source": "erstat"}),
            "fac-2": json.dumps({"wait_minutes": None, "source": "erstat"}),
        }

        result = get_wait_minutes_map()

        assert result == {"fac-1": 12, "fac-2": None}

    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_redis_empty_falls_back_to_supabase_rpc(self, mock_redis, mock_rpc):
        mock_redis.hgetall.return_value = {}
        mock_rpc.return_value = [
            {"facility_id": "fac-1", "wait_minutes": 20, "recorded_at": "2026-06-30T00:00:00Z"},
        ]

        result = get_wait_minutes_map()

        mock_rpc.assert_called_once_with("latest_wait_times", {})
        assert result == {"fac-1": 20}

    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_redis_connection_error_falls_back_to_supabase_rpc(self, mock_redis, mock_rpc):
        mock_redis.hgetall.side_effect = ConnectionError("redis down")
        mock_rpc.return_value = [
            {"facility_id": "fac-1", "wait_minutes": 30, "recorded_at": "2026-06-30T00:00:00Z"},
        ]

        result = get_wait_minutes_map()

        assert result == {"fac-1": 30}

    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_fallback_writes_back_to_redis(self, mock_redis, mock_rpc):
        mock_redis.hgetall.return_value = {}
        mock_rpc.return_value = [
            {"facility_id": "fac-1", "wait_minutes": 20, "recorded_at": "2026-06-30T00:00:00Z"},
        ]

        get_wait_minutes_map()

        mock_redis.hset.assert_called_once()
        args, _ = mock_redis.hset.call_args
        assert args[0] == "wait_times:current"
        assert args[1] == "fac-1"
        assert json.loads(args[2])["wait_minutes"] == 20

    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_redis_writeback_failure_does_not_raise(self, mock_redis, mock_rpc):
        mock_redis.hgetall.return_value = {}
        mock_redis.hset.side_effect = ConnectionError("redis down")
        mock_rpc.return_value = [
            {"facility_id": "fac-1", "wait_minutes": 20, "recorded_at": "2026-06-30T00:00:00Z"},
        ]

        result = get_wait_minutes_map()  # must not raise

        assert result == {"fac-1": 20}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
doppler run -- pytest backend/tests/test_wait_times.py -v
```
Expected: FAIL — `services.wait_times` module doesn't exist yet (`ModuleNotFoundError`).

- [ ] **Step 3: Create `services/wait_times.py`**

Create `backend/services/wait_times.py`:

```python
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
    """
    try:
        raw = redis_client.hgetall(REDIS_HASH_KEY)
        if raw:
            return {fid: json.loads(v).get("wait_minutes") for fid, v in raw.items()}
    except Exception:
        logger.warning("redis_unavailable_falling_back_to_supabase")

    rows = supabase_rpc("latest_wait_times", {})
    wait_map = {r["facility_id"]: r["wait_minutes"] for r in rows}

    try:
        for fid, minutes in wait_map.items():
            redis_client.hset(REDIS_HASH_KEY, fid, json.dumps({"wait_minutes": minutes}))
    except Exception:
        logger.warning("redis_populate_failed")

    return wait_map
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
doppler run -- pytest backend/tests/test_wait_times.py -v
```
Expected: PASS — 5 tests.

- [ ] **Step 5: Add `redis` to requirements (needed for tests to import the package)**

Read `backend/requirements.txt`. Add a line:
```
redis
```
(Place it alphabetically near `requests==2.*`.)

- [ ] **Step 6: Commit**

```bash
git add backend/services/wait_times.py backend/tests/test_wait_times.py backend/requirements.txt
git commit -m "feat: add cache-aside wait-time read (Redis-first, Supabase RPC fallback)"
```

---

## Task 7: Add `wait_minutes` to `models.py`

**Files:**
- Modify: `backend/models.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Produces: `Facility.wait_minutes: int | None = None`, `NearbyFacilityResult.wait_minutes: int | None = None`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_models.py`:

```python
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import Facility, NearbyFacilityResult


class TestFacilityWaitMinutes:
    def test_defaults_to_none(self):
        f = Facility(
            name="X", category="hospital", source_facility_type="general",
            accepted_severity=["routine"], address="123 St", lat=0.0, lng=0.0,
        )
        assert f.wait_minutes is None

    def test_accepts_explicit_value(self):
        f = Facility(
            name="X", category="hospital", source_facility_type="general",
            accepted_severity=["routine"], address="123 St", lat=0.0, lng=0.0,
            wait_minutes=15,
        )
        assert f.wait_minutes == 15


class TestNearbyFacilityResultWaitMinutes:
    def test_accepts_explicit_value(self):
        r = NearbyFacilityResult(
            facility_id="a", facility_name="X", category="hospital", address="123",
            phone=None, is_operational=True, distance_m=1, eta_walk_min=1,
            eta_transit_min=1, eta_drive_min=1, wait_minutes=15,
        )
        assert r.wait_minutes == 15

    def test_defaults_to_none(self):
        r = NearbyFacilityResult(
            facility_id="a", facility_name="X", category="hospital", address="123",
            phone=None, is_operational=True, distance_m=1, eta_walk_min=1,
            eta_transit_min=1, eta_drive_min=1,
        )
        assert r.wait_minutes is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
doppler run -- pytest backend/tests/test_models.py -v
```
Expected: FAIL — `TypeError: wait_minutes is an unexpected keyword argument` on the tests passing it explicitly.

- [ ] **Step 3: Add the field to both models**

In `backend/models.py`, modify the `Facility` class (around line 20):

```python
class Facility(BaseModel):
    name:                 str
    category:             FacilityCategory
    source_facility_type: str
    accepted_severity:    list[Severity]
    address:              str
    lat:                  float
    lng:                  float
    id:                   UUID | None = None
    source:               str | None = None
    created_at:           datetime | None = None
    updated_at:           datetime | None = None
    phone:                str | None = None
    business_status:      str | None = None
    weekday_hours:        list[str] | None = None
    wait_minutes:         int | None = None
```

Modify `NearbyFacilityResult` (around line 92):

```python
class NearbyFacilityResult(BaseModel):
    facility_id:     str
    facility_name:   str
    category:        str
    address:         str
    phone:           str | None
    is_operational:  bool
    distance_m:      int
    eta_walk_min:    int
    eta_transit_min: int
    eta_drive_min:   int
    wait_minutes:    int | None = None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
doppler run -- pytest backend/tests/test_models.py -v
```
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/tests/test_models.py
git commit -m "feat: add wait_minutes field to Facility and NearbyFacilityResult"
```

---

## Task 8: Add `wait_minutes` to `shared/types.ts`

**Files:**
- Modify: `shared/types.ts`

**Interfaces:**
- Produces: `Facility.wait_minutes?: number | null`, `NearbyFacility.wait_minutes?: number | null`

- [ ] **Step 1: Add the field to `Facility`**

In `shared/types.ts`, the `Facility` interface (lines 30-45) currently ends:

```typescript
  phone?:               string | null;
  business_status?:     string | null;
  weekday_hours?:       string[] | null;
}
```

Change to:

```typescript
  phone?:               string | null;
  business_status?:     string | null;
  weekday_hours?:       string[] | null;
  wait_minutes?:        number | null;
}
```

- [ ] **Step 2: Add the field to `NearbyFacility`**

The `NearbyFacility` interface (lines 57-68) currently ends:

```typescript
  eta_walk_min:    number
  eta_transit_min: number
  eta_drive_min:   number
}
```

Change to:

```typescript
  eta_walk_min:    number
  eta_transit_min: number
  eta_drive_min:   number
  wait_minutes:    number | null
}
```

- [ ] **Step 3: Type-check**

```bash
cd /home/niki/Documents/saas/medicoordai/webapp && npx tsc -b
```
Expected: no errors (the field is optional/nullable on `Facility`, and `NearbyFacility` has no existing object literals that would now be missing a required field — verify by checking the type-check output for any new errors referencing `NearbyFacility`).

- [ ] **Step 4: Commit**

```bash
git add shared/types.ts
git commit -m "feat: add wait_minutes to Facility and NearbyFacility shared types"
```

---

## Task 9: Wire `main.py` — `max_wait_minutes` on both routes

**Files:**
- Modify: `backend/main.py`
- Test: `backend/tests/test_facilities_routes.py`

**Interfaces:**
- Consumes: `services.facilities.apply_wait_filter` (Task 5), `services.wait_times.get_wait_minutes_map` (Task 6), `db.supabase_rpc` (Task 2)
- Produces: `GET /facilities?...&max_wait_minutes=<int>`, `GET /facilities/nearby?...&max_wait_minutes=<int>`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_facilities_routes.py`:

```python
"""
Unit tests for the /facilities and /facilities/nearby route handlers.
Called directly as plain async functions (bypassing the ASGI stack and
app lifespan) — only the filtering logic under test needs exercising.
"""

import asyncio
import json
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

import main


class TestFacilitiesRoute:
    def test_max_wait_minutes_filters_results(self):
        fake_data = [
            {"id": "a", "category": "hospital", "accepted_severity": ["urgent"]},
            {"id": "b", "category": "hospital", "accepted_severity": ["urgent"]},
        ]
        with patch("main.get_cached_facilities", return_value=(fake_data, None)), \
             patch("main.get_wait_minutes_map", return_value={"a": 10, "b": 60}):
            request = type("FakeRequest", (), {"headers": {}})()
            response = asyncio.run(main.facilities(request, max_wait_minutes=30))

        data = json.loads(response.body)
        ids = [r["id"] for r in data]
        assert ids == ["a"]

    def test_no_max_wait_minutes_returns_all(self):
        fake_data = [
            {"id": "a", "category": "hospital", "accepted_severity": ["urgent"]},
            {"id": "b", "category": "hospital", "accepted_severity": ["urgent"]},
        ]
        with patch("main.get_cached_facilities", return_value=(fake_data, None)), \
             patch("main.get_wait_minutes_map", return_value={"a": 10, "b": 60}):
            request = type("FakeRequest", (), {"headers": {}})()
            response = asyncio.run(main.facilities(request))

        data = json.loads(response.body)
        assert len(data) == 2


class TestFacilitiesNearbyRoute:
    def test_max_wait_minutes_filters_results(self):
        fake_rows = [
            {"facility_id": "a", "distance_m": 100},
            {"facility_id": "b", "distance_m": 200},
        ]
        with patch("main.supabase_rpc", return_value=fake_rows), \
             patch("main.get_wait_minutes_map", return_value={"a": 10, "b": 999}):
            result = asyncio.run(main.facilities_nearby(lat=43.6, lng=-79.4, max_wait_minutes=30))

        assert [r["facility_id"] for r in result] == ["a"]

    def test_rpc_failure_raises_500(self):
        from fastapi import HTTPException

        with patch("main.supabase_rpc", side_effect=Exception("rpc down")):
            with pytest.raises(HTTPException) as exc_info:
                asyncio.run(main.facilities_nearby(lat=43.6, lng=-79.4))
        assert exc_info.value.status_code == 500
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
doppler run -- pytest backend/tests/test_facilities_routes.py -v
```
Expected: FAIL — `main.facilities`/`main.facilities_nearby` don't accept `max_wait_minutes` yet, and `main.get_wait_minutes_map`/`main.supabase_rpc` aren't imported into `main.py` yet (`AttributeError` on `patch(...)`).

- [ ] **Step 3: Update `main.py` imports**

In `backend/main.py`, replace:

```python
from services.facilities import get_all_facilities
from db import get_supabase_client
```

with:

```python
from services.facilities import get_all_facilities, apply_wait_filter
from services.wait_times import get_wait_minutes_map
from db import supabase_rpc
```

- [ ] **Step 4: Update the `/facilities` route**

Replace the `facilities` route function:

```python
@app.get("/facilities")
async def facilities(
    request: Request,
    category: str | None = None,
    severity: str | None = None,
    max_wait_minutes: int | None = None,
) -> Response:
    cached_data, _ = get_cached_facilities()

    if cached_data is None:
        raw = get_all_facilities(category=None, severity=None)
        cached_etag = set_cached_facilities(raw)
        cached_data = raw

    data: list[dict] = cached_data
    if category:
        data = [r for r in data if r["category"] == category]
    if severity:
        data = [r for r in data if severity in r.get("accepted_severity", [])]

    wait_map = get_wait_minutes_map()
    data = apply_wait_filter(data, "id", max_wait_minutes, wait_map)

    filtered_etag = f'"{hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()[:32]}"'

    if request.headers.get("If-None-Match", "") == filtered_etag:
        return Response(status_code=304)

    return JSONResponse(
        content=data,
        headers={"ETag": filtered_etag, "Cache-Control": "no-cache"},
    )
```

- [ ] **Step 5: Update the `/facilities/nearby` route**

Replace the `facilities_nearby` route function:

```python
@app.get("/facilities/nearby")
async def facilities_nearby(
    lat:      float,
    lng:      float,
    radius_m: int = 5000,
    category: str | None = None,
    max_wait_minutes: int | None = None,
) -> list[NearbyFacilityResult]:
    try:
        data = supabase_rpc(
            "nearby_facilities",
            {
                "user_lat":       lat,
                "user_lng":       lng,
                "radius_m":       min(radius_m, 50000),
                "facility_types": [category] if category else None,
                "result_limit":   50,
            },
        ) or []
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"proximity search failed: {exc}") from exc

    wait_map = get_wait_minutes_map()
    return apply_wait_filter(data, "facility_id", max_wait_minutes, wait_map)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
doppler run -- pytest backend/tests/test_facilities_routes.py -v
```
Expected: PASS — 4 tests.

- [ ] **Step 7: Commit**

```bash
git add backend/main.py backend/tests/test_facilities_routes.py
git commit -m "feat: add max_wait_minutes filter to /facilities and /facilities/nearby"
```

---

## Task 10: Drop `supabase` dependency, full regression run, manual smoke test

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Remove the unused dependency**

Read `backend/requirements.txt`. Remove the line `supabase==2.*`. Confirm no remaining import of the `supabase` package anywhere in `backend/`:

```bash
grep -rn "^from supabase\|^import supabase" /home/niki/Documents/saas/medicoordai/backend --include="*.py"
```
Expected: no output.

- [ ] **Step 2: Reinstall dependencies and run the full backend test suite**

```bash
source /home/niki/Documents/workenv/pydev/bin/activate
cd /home/niki/Documents/saas/medicoordai
pip install -r backend/requirements.txt
doppler run -- pytest backend/ -v
```
Expected: PASS — every test in `backend/tests/`, including the pre-existing `test_chat.py`, `test_notifications.py`, `llm/test_triage_tools.py`, and every new file added in Tasks 2–9.

- [ ] **Step 3: Manual smoke test**

```bash
doppler run -- uvicorn backend.main:app --reload &
sleep 3
curl -s "http://localhost:8000/facilities?max_wait_minutes=30" | python3 -c "
import json, sys
data = json.load(sys.stdin)
assert all('wait_minutes' in f for f in data), 'wait_minutes missing from /facilities response'
over_limit = [f for f in data if f['wait_minutes'] is not None and f['wait_minutes'] > 30]
assert not over_limit, f'facilities over max_wait_minutes leaked: {over_limit}'
print(f'PASS /facilities — {len(data)} facilities, max_wait_minutes respected')
"
curl -s "http://localhost:8000/facilities/nearby?lat=43.6426&lng=-79.3871&radius_m=10000&max_wait_minutes=30" | python3 -c "
import json, sys
data = json.load(sys.stdin)
assert all('wait_minutes' in f for f in data), 'wait_minutes missing from /facilities/nearby response'
print(f'PASS /facilities/nearby — {len(data)} facilities')
"
curl -s http://localhost:8000/health | python3 -m json.tool
kill %1 2>/dev/null
```
Expected: both PASS lines print, `/health` returns 200 with the existing `{"status": "ok", "llmProvider": ...}` shape (confirms `main.py` still imports and starts cleanly end-to-end, including the lifespan's `get_all_facilities()` call going through the new `db.py`).

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: drop unused supabase-py dependency"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| `db.py` → REST helper (`supabase_select`, `supabase_insert`, `supabase_rpc`, `supabase_auth_get_user`) | Task 2 |
| `services/facilities.py` migrated, `is_operational`/`category`/`accepted_severity` PostgREST operators | Task 5 |
| `services/chat.py` migrated (insert, select, `maybe_single`-equivalent cursor lookup) | Task 4 |
| `services/auth.py` migrated to `/auth/v1/user`, `.id`/`.email` attribute access preserved | Task 3 |
| `/facilities/nearby` RPC call migrated to `supabase_rpc` | Task 9 |
| `requirements.txt`: drop `supabase`, add `redis` | Tasks 6, 10 |
| `latest_wait_times` RPC migration | Task 1 |
| `get_wait_minutes_map()` — Redis-first, Supabase-fallback cache-aside, best-effort write-back | Task 6 |
| `apply_wait_filter()` — max-wait semantics, `None` always passes, shared by both routes | Task 5, wired in Task 9 |
| `max_wait_minutes` param on both `/facilities` and `/facilities/nearby` | Task 9 |
| `Facility.wait_minutes`, `NearbyFacilityResult.wait_minutes` | Task 7 |
| `shared/types.ts` matching fields | Task 8 |
| Error handling: Redis errors logged not raised, Supabase RPC failure propagates as 503/500 via existing patterns | Tasks 6, 9 |
| Smoke test | Task 10 |

### Known limitations carried from the spec (not bugs to fix here)

- `/facilities`'s in-memory list cache (`cache.py`) holds dict objects that `apply_wait_filter` mutates in place when no category/severity filter narrows the list to a new list object. This is harmless — `wait_minutes` is recomputed fresh every request before use — but is worth knowing if debugging the cache later.
- The Redis fallback path (`latest_wait_times` RPC) is only exercised when Redis is empty or unreachable; in normal operation (scraper running every ~15 min) it should rarely fire. Task 6's tests cover it directly since real-world triggering is hard to rely on for CI.

### Out of scope (unchanged from spec)

Frontend wait-dropdown wiring, `wait_times` history retention, the full Layer 0–3 search orchestrator, Redis TTL/staleness invalidation.
