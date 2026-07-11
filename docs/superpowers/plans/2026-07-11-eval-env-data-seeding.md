# Eval Environment Data Seeding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the newly created eval Supabase project + eval Upstash Redis (Doppler config `eval`) with the minimum data Sprint 17's 3 case-study metrics actually need, sourced from the existing `preview` project — without ever copying user data, and without building new migration tooling.

**Architecture:** Two one-off Python scripts under `backend/scripts/eval_seed/`, both reusing `backend/db.py`'s existing PostgREST helpers (`supabase_select`/`supabase_insert`/`supabase_rpc`) rather than a new HTTP client. `export_primary_data.py` runs under `doppler run --config preview` and writes a timestamped JSON snapshot to disk. `seed_eval_db.py` runs under `doppler run --config eval` and reads that snapshot to bulk-insert into the eval project. Schema (tables + RPC functions) is applied to the eval project manually via the Supabase SQL editor, following this repo's existing migration convention (see `migrations/README.md`) — no migration-runner is introduced. A third script creates disposable test accounts directly in the eval project (never copied from `preview`). **Redis gets no seeding script at all** — `backend/services/wait_times.py`'s existing cache-aside logic already writes back to Redis (`pipe.hset(...)`) whenever it falls through to the Supabase RPC on an empty hash, which is exactly the eval Redis's state on first read; the first `/facilities` (or `/chat/message` with a triage hit) call against the eval backend self-populates it from the `wait_times` rows Task 3 seeds. Confirmed in Task 5, Step 4.

**Tech Stack:** Python 3.11, `requests` (already a dependency, same as `backend/db.py`) — zero new dependencies.

## Global Constraints

- Reuse `backend/db.py`'s `supabase_select`/`supabase_insert`/`supabase_rpc` for every read/write against either Supabase project — no raw SQL client, no new HTTP wrapper.
- No PII ever leaves `preview`: `profile`, `sessions`, `messages`, `auth.users` are never read or copied. Only `facilities_clean` (public ODHF/Google Places data) and a `wait_times` snapshot (facility-level, no user data) are copied.
- Schema setup (`migrations/001..013.sql`) on the eval project is a **manual** step via the Supabase SQL editor — matches the existing convention documented in `migrations/README.md`. No automated migration runner is built.
- Every script is a standalone CLI entry point invoked via `doppler run --config <preview|eval> -- python backend/scripts/eval_seed/<script>.py`, matching this repo's existing `doppler run --` convention (`CLAUDE.md`).
- `nearby_facilities` RPC (migration 010) and its `coordinates` PostGIS backfill are **out of scope** unless Phase B's load scripts are confirmed to hit `GET /facilities/nearby` — flagged as an open question in Task 1, not assumed.
- Fixing `workers/scraper.py`'s Toronto-vs-Ontario region-matching bug (documented in `artifacts/facility_clean_schema.md`) is **out of scope** — this plan copies existing `wait_times` snapshot data instead of live-scraping into eval.
- Exported/seeded data files and generated test-account credentials must never be committed — added to `.gitignore` in Task 2 and Task 4.
- This plan file itself stays untracked until you explicitly approve committing it (repo rule: commits always need explicit approval).

---

### Task 1: Apply schema to the eval Supabase project (manual, operator-run)

**Files:** none (operator checklist only — no code in this task)

- [ ] **Step 1: Open the eval project's SQL editor**

Supabase Dashboard → select the new eval project → SQL Editor → New query.

- [ ] **Step 2: Run the eval-scoped migration subset, in order**

**Skip `004_facility_update_place_info.sql`, `006_add_google_place_id.sql`, `007_db_health_rpc.sql`, and `008_fix_db_health_rpc.sql` entirely.** All four only touch the *legacy* `facilities` table: `004`/`006` `ALTER TABLE facilities`, and `007`/`008` run `ANALYZE public.facilities` plus a `pg_stat_user_tables WHERE relname IN ('facilities', ...)` query. `facilities` was created directly via the Supabase table editor back in Sprint 2, predates `migrations/`, and has no file that creates it — so on a fresh eval project it doesn't exist, and any of these four will either no-op uselessly or error outright. None of the 4 case studies' current backend code queries `facilities` anymore either (`get_all_facilities()` in `backend/services/facilities.py` reads `facilities_clean` only, since Sprint 14) — this table is dead weight for eval.

`005_wait_time_table.sql` also can't run as-is: it declares `facility_id uuid not null references facilities(id)` — a foreign key into the same missing legacy table. Use this eval-only variant instead (identical except the dangling `references` clause is dropped):

```sql
create table if not exists wait_times (
    id           bigserial    primary key,
    facility_id  uuid         not null,
    wait_minutes integer      not null,
    raw_wait     text,
    source       text,
    scraped_at   timestamptz,
    recorded_at  timestamptz  default now()
);

create unique index if not exists wait_times_facility_scraped_idx
    on wait_times (facility_id, scraped_at);
```

Copy/paste and run in this exact order, one at a time, waiting for each to succeed before running the next:

```
001_profile.sql
002_sessions.sql
003_messages.sql
005_wait_time_table.sql          ← use the eval-only variant above, not the file as-is
009_facilities_add_geolocation.sql
010_nearby_facilities_rpc.sql    ← see Step 3 before running
011_latest_wait_times_rpc.sql
012_latest_wait_times_rpc_add_fields.sql
013_profile_onboarding_extensions.sql
```

Each file is idempotent (per `migrations/README.md`) — safe to re-run if something looks wrong.

- [ ] **Step 3: Decide on `010_nearby_facilities_rpc.sql` before running it**

`nearby_facilities` is used only by `GET /facilities/nearby` (`backend/main.py:119-142`) — a PostGIS proximity feature separate from the in-memory Haversine ranking that case studies 1 and 2 actually measure (`backend/services/proximity.py`, used inside `LLMAgent._handle_triage`). None of the 3 case studies' `METRIC PENDING` fields name this RPC.

Run it anyway (schema completeness, cheap) **but know that it will return zero rows until `coordinates` is backfilled** — `009_facilities_add_geolocation.sql` only backfills `coordinates` for rows that existed *at migration time*; it does not auto-populate on insert (no trigger). If Phase B's JMeter script for case study 3 is confirmed to hit `/facilities/nearby`, run this after Task 2's facilities seed completes:

```sql
UPDATE facilities_clean
SET coordinates = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL;
```

If Phase B never touches `/facilities/nearby`, skip this backfill — `coordinates` staying NULL doesn't affect `GET /facilities`, `/chat/message`, or `/metrics`.

- [ ] **Step 4: Confirm the eval Doppler config has both connection paths**

```bash
doppler secrets get SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY UPSTASH_REDIS_URL --config eval --plain
```

Expected: three non-empty values, pointing at the new eval Supabase project and the new eval Upstash instance (not `preview`'s).

---

### Task 2: Export script — pull `facilities_clean` + latest wait times from `preview`

**Files:**
- Create: `backend/scripts/eval_seed/export_primary_data.py`
- Test: `backend/scripts/eval_seed/tests/test_export_primary_data.py`
- Modify: `.gitignore` (append exports dir)

**Interfaces:**
- Produces: `export_facilities() -> list[dict]`, `export_latest_wait_times() -> list[dict]`, `write_export(data: list[dict], filename: str) -> str` (returns the written file path) — consumed by Task 3.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/eval_seed/tests/test_export_primary_data.py
import json
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.eval_seed.export_primary_data import (
    export_facilities,
    export_latest_wait_times,
    write_export,
)

FACILITY_ROW = {
    "facility_id": "665e2daa-cccf-40c1-b0d7-e5b16751ccc3",
    "facility_name": "Rockcliffe Care Community",
    "category": "residential",
    "source_facility_type": "long-term care home",
    "accepted_severity": ["routine"],
    "address": "3015 lawrence avenue e, toronto, ON M1P 2V7",
    "lat": 43.75467751,
    "lng": -79.24789355,
    "phone": "(416) 264-3201",
    "google_place_id": "ChIJubZufszR1IkRp1Y1dHuLQVI",
    "business_status": "OPERATIONAL",
    "is_operational": True,
    "weekday_hours": '["Monday: 8:30 AM - 7:00 PM"]',
    "last_enriched_at": "2026-06-16T08:59:29.214357+00:00",
    "dbt_run_at": "2026-06-16T14:40:52.266742+00:00",
}

WAIT_TIME_ROW = {
    "facility_id": "665e2daa-cccf-40c1-b0d7-e5b16751ccc3",
    "wait_minutes": 42,
    "raw_wait": "42 min",
    "source": "erstat",
    "recorded_at": "2026-07-10T03:08:00+00:00",
}


class TestExportFacilities:
    @patch("scripts.eval_seed.export_primary_data.supabase_select")
    def test_selects_all_columns_no_filter(self, mock_select):
        mock_select.return_value = [FACILITY_ROW]

        result = export_facilities()

        assert result == [FACILITY_ROW]
        mock_select.assert_called_once_with("facilities_clean", {"select": "*"})

    @patch("scripts.eval_seed.export_primary_data.supabase_select")
    def test_warns_on_suspiciously_round_row_count(self, mock_select, caplog):
        mock_select.return_value = [FACILITY_ROW] * 1000

        with caplog.at_level("WARNING"):
            result = export_facilities()

        assert len(result) == 1000
        assert any("possible_truncation" in r.message for r in caplog.records)


class TestExportLatestWaitTimes:
    @patch("scripts.eval_seed.export_primary_data.supabase_rpc")
    def test_calls_latest_wait_times_rpc(self, mock_rpc):
        mock_rpc.return_value = [WAIT_TIME_ROW]

        result = export_latest_wait_times()

        assert result == [WAIT_TIME_ROW]
        mock_rpc.assert_called_once_with("latest_wait_times", {})


class TestWriteExport:
    def test_writes_valid_json_matching_input(self, tmp_path):
        target = str(tmp_path / "facilities.json")

        written_path = write_export([FACILITY_ROW], target)

        assert written_path == target
        with open(target) as f:
            assert json.load(f) == [FACILITY_ROW]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/eval_seed/tests/test_export_primary_data.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/eval_seed/export_primary_data.py
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
        logger.warning(
            "possible_truncation",
            extra={"row_count": len(rows), "reason": "count matches a common PostgREST page-size default"},
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
```

Create `backend/scripts/eval_seed/__init__.py` and `backend/scripts/__init__.py` (empty files, needed for the `scripts.eval_seed.export_primary_data` import path used by the test):

```bash
touch backend/scripts/__init__.py backend/scripts/eval_seed/__init__.py backend/scripts/eval_seed/tests/__init__.py
```

Append to `.gitignore`:

```
backend/scripts/eval_seed/exports/
backend/scripts/eval_seed/*_accounts.json
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/eval_seed/tests/test_export_primary_data.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit** (after explicit user approval)

```bash
git add backend/scripts/__init__.py backend/scripts/eval_seed/__init__.py backend/scripts/eval_seed/tests/__init__.py backend/scripts/eval_seed/export_primary_data.py backend/scripts/eval_seed/tests/test_export_primary_data.py .gitignore
git commit -m "feat(system-eval): add eval-env export script for facilities + latest wait times"
```

---

### Task 3: Seed script — insert exported data into the eval project

**Files:**
- Create: `backend/scripts/eval_seed/seed_eval_db.py`
- Test: `backend/scripts/eval_seed/tests/test_seed_eval_db.py`

**Interfaces:**
- Consumes: JSON files written by `write_export()` (Task 2) — each a flat `list[dict]` matching `facilities_clean` or `wait_times` row shape.
- Produces: `chunk_list(items: list, size: int) -> list[list]`, `seed_table(table: str, rows: list[dict], chunk_size: int = 200) -> int` (returns total rows inserted) — standalone, no downstream consumers in this plan.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/eval_seed/tests/test_seed_eval_db.py
import json
import os
import sys
from unittest.mock import patch, call

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.eval_seed.seed_eval_db import chunk_list, seed_table, load_export


class TestChunkList:
    def test_splits_into_even_chunks(self):
        assert chunk_list([1, 2, 3, 4], 2) == [[1, 2], [3, 4]]

    def test_last_chunk_is_partial(self):
        assert chunk_list([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]]

    def test_empty_input_returns_empty_list(self):
        assert chunk_list([], 200) == []


class TestSeedTable:
    @patch("scripts.eval_seed.seed_eval_db.supabase_insert")
    def test_inserts_in_chunks(self, mock_insert):
        rows = [{"facility_id": str(i)} for i in range(5)]
        mock_insert.return_value = []

        total = seed_table("facilities_clean", rows, chunk_size=2)

        assert total == 5
        assert mock_insert.call_count == 3
        mock_insert.assert_has_calls([
            call("facilities_clean", rows[0:2]),
            call("facilities_clean", rows[2:4]),
            call("facilities_clean", rows[4:5]),
        ])

    @patch("scripts.eval_seed.seed_eval_db.supabase_insert")
    def test_empty_rows_skips_insert_entirely(self, mock_insert):
        total = seed_table("facilities_clean", [], chunk_size=200)

        assert total == 0
        mock_insert.assert_not_called()


class TestLoadExport:
    def test_reads_json_file(self, tmp_path):
        path = tmp_path / "facilities.json"
        path.write_text(json.dumps([{"facility_id": "a"}]))

        result = load_export(str(path))

        assert result == [{"facility_id": "a"}]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/eval_seed/tests/test_seed_eval_db.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.eval_seed.seed_eval_db'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/eval_seed/seed_eval_db.py
"""
Reads the JSON files export_primary_data.py wrote and bulk-inserts them
into whichever Supabase project SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
point at in the current process env. Intended invocation:

    doppler run --config eval -- python scripts/eval_seed/seed_eval_db.py \
        <facilities-export.json> <wait-times-export.json>

Assumes the eval project's schema was already applied (Task 1) and its
tables are empty — this script does not truncate or upsert, it inserts.
"""
import json
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from db import supabase_insert  # noqa: E402

logger = logging.getLogger(__name__)


def chunk_list(items: list, size: int) -> list[list]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def seed_table(table: str, rows: list[dict], chunk_size: int = 200) -> int:
    if not rows:
        return 0
    for chunk in chunk_list(rows, chunk_size):
        supabase_insert(table, chunk)
    return len(rows)


def load_export(path: str) -> list[dict]:
    with open(path) as f:
        return json.load(f)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) != 3:
        print("usage: seed_eval_db.py <facilities-export.json> <wait-times-export.json>")
        sys.exit(1)

    facilities_path, wait_times_path = sys.argv[1], sys.argv[2]

    facilities = load_export(facilities_path)
    facilities_count = seed_table("facilities_clean", facilities)
    logger.info("seeded_facilities", extra={"count": facilities_count})

    wait_times = load_export(wait_times_path)
    wait_times_count = seed_table("wait_times", wait_times)
    logger.info("seeded_wait_times", extra={"count": wait_times_count})

    print(f"facilities_clean: {facilities_count} rows")
    print(f"wait_times: {wait_times_count} rows")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/eval_seed/tests/test_seed_eval_db.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit** (after explicit user approval)

```bash
git add backend/scripts/eval_seed/seed_eval_db.py backend/scripts/eval_seed/tests/test_seed_eval_db.py
git commit -m "feat(system-eval): add eval-env seed script for facilities + wait times"
```

---

### Task 4: Disposable test-account creation for the eval project

**Files:**
- Create: `backend/scripts/eval_seed/create_eval_test_accounts.py`
- Test: `backend/scripts/eval_seed/tests/test_create_eval_test_accounts.py`

**Interfaces:**
- Produces: `generate_test_email(index: int) -> str`, `create_test_account(email: str, password: str) -> dict` (returns `{"id": str, "email": str, "password": str}`), `write_accounts(accounts: list[dict], filename: str) -> str` — standalone, consumed later by Phase B's load scripts (not part of this plan).

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/eval_seed/tests/test_create_eval_test_accounts.py
import json
import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.eval_seed.create_eval_test_accounts import (
    generate_test_email,
    create_test_account,
    write_accounts,
)


class TestGenerateTestEmail:
    def test_deterministic_per_index(self):
        assert generate_test_email(0) == "eval-test-0@medicoord-eval.test"
        assert generate_test_email(7) == "eval-test-7@medicoord-eval.test"


class TestCreateTestAccount:
    @patch("scripts.eval_seed.create_eval_test_accounts.requests.post")
    def test_calls_gotrue_admin_endpoint_with_email_confirm(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "user-uuid-1"}
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        result = create_test_account("eval-test-0@medicoord-eval.test", "s3cret-pass")

        assert result == {
            "id": "user-uuid-1",
            "email": "eval-test-0@medicoord-eval.test",
            "password": "s3cret-pass",
        }
        call_kwargs = mock_post.call_args.kwargs
        assert call_kwargs["json"]["email"] == "eval-test-0@medicoord-eval.test"
        assert call_kwargs["json"]["email_confirm"] is True


class TestWriteAccounts:
    def test_writes_valid_json(self, tmp_path):
        target = str(tmp_path / "accounts.json")
        accounts = [{"id": "1", "email": "a@b.test", "password": "x"}]

        written_path = write_accounts(accounts, target)

        assert written_path == target
        with open(target) as f:
            assert json.load(f) == accounts
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/eval_seed/tests/test_create_eval_test_accounts.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.eval_seed.create_eval_test_accounts'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/eval_seed/create_eval_test_accounts.py
"""
Creates disposable, pre-confirmed test accounts directly in the eval
Supabase project via GoTrue's admin endpoint (bypasses email
verification — fine for a throwaway eval project only). Never reads or
copies any account from preview/prod. Intended invocation:

    doppler run --config eval -- python scripts/eval_seed/create_eval_test_accounts.py --count 5

Writes credentials to eval_test_accounts.json (gitignored) for Phase B's
load scripts to authenticate with.
"""
import argparse
import json
import logging
import os
import secrets
import sys

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"].strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip()

ACCOUNTS_PATH = os.path.join(os.path.dirname(__file__), "eval_test_accounts.json")


def generate_test_email(index: int) -> str:
    return f"eval-test-{index}@medicoord-eval.test"


def create_test_account(email: str, password: str) -> dict:
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    payload = {"email": email, "password": password, "email_confirm": True}

    resp = requests.post(f"{SUPABASE_URL}/auth/v1/admin/users", headers=headers, json=payload, timeout=10)
    resp.raise_for_status()
    user = resp.json()

    return {"id": user["id"], "email": email, "password": password}


def write_accounts(accounts: list[dict], filename: str) -> str:
    with open(filename, "w") as f:
        json.dump(accounts, f, indent=2)
    return filename


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=5)
    args = parser.parse_args()

    accounts = []
    for i in range(args.count):
        email = generate_test_email(i)
        password = secrets.token_urlsafe(16)
        account = create_test_account(email, password)
        logger.info("created_test_account", extra={"email": email})
        accounts.append(account)

    path = write_accounts(accounts, ACCOUNTS_PATH)
    print(f"{len(accounts)} test accounts written to {path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/eval_seed/tests/test_create_eval_test_accounts.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit** (after explicit user approval)

```bash
git add backend/scripts/eval_seed/create_eval_test_accounts.py backend/scripts/eval_seed/tests/test_create_eval_test_accounts.py
git commit -m "feat(system-eval): add disposable test-account creation script for eval project"
```

---

### Task 5: End-to-end dry run (operator-run verification, no code)

**Files:** none

- [ ] **Step 1: Export from `preview`**

```bash
cd backend
doppler run --config preview -- python scripts/eval_seed/export_primary_data.py
```

Expected: two file paths printed, row counts roughly matching known state (~380-410 facilities per Sprint 14's last verified run; wait-times count varies with scrape history).

- [ ] **Step 2: Seed the eval project**

```bash
doppler run --config eval -- python scripts/eval_seed/seed_eval_db.py \
  scripts/eval_seed/exports/facilities_<stamp>.json \
  scripts/eval_seed/exports/wait_times_<stamp>.json
```

Expected: `facilities_clean: N rows` / `wait_times: M rows`, no errors.

- [ ] **Step 3: Create test accounts**

```bash
doppler run --config eval -- python scripts/eval_seed/create_eval_test_accounts.py --count 5
```

Expected: `5 test accounts written to .../eval_test_accounts.json`.

- [ ] **Step 4: Spot-check via REST directly against the eval project**

```bash
doppler run --config eval -- python -c "
from db import supabase_select, supabase_rpc
print(len(supabase_select('facilities_clean', {'select': 'facility_id'})))
print(supabase_rpc('latest_wait_times', {})[:2])
"
```

Expected: a row count matching Step 1/2, and 2 sample wait-time rows with non-null `wait_minutes`.

- [ ] **Step 4b: Confirm Redis self-populates on first read (no separate seed script exists for it)**

Once the eval backend service is deployed and reachable (Task 6 from the Phase A instrumentation plan, run against this eval config instead of `preview`), hit `GET /facilities` once and inspect the eval Upstash instance:

```bash
doppler run --config eval -- python -c "
import redis, os
r = redis.from_url(os.environ['UPSTASH_REDIS_URL'].strip(), decode_responses=True)
print(r.hlen('wait_times:current'))
"
```

Expected: `0` before the first request, non-zero after — confirming `get_wait_minutes_map()`'s existing Supabase-fallback-then-writeback path (`backend/services/wait_times.py`) populated Redis from the rows Task 3 seeded, with no dedicated Redis-seeding code needed.

- [ ] **Step 5: Report back**

Confirm row counts, flag any insert failures (e.g. a facility_id collision, which would mean the eval project's `facilities_clean` wasn't actually empty before seeding), and confirm whether Task 1 Step 3's `nearby_facilities`/`coordinates` backfill is needed based on Phase B's finalized load-script design.

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers schema setup (manual, matching existing convention) + the `nearby_facilities` scoping question. Task 2 covers the export half of the user's proposed `doppler run --config preview` → file → `doppler run --config eval` flow. Task 3 covers the seed half. Task 4 covers disposable test accounts (no PII, never copied from `preview`). Task 5 is the end-to-end dry run tying all 3 scripts together.
- **No new dependencies:** all three scripts use `requests` (already in `backend/requirements.txt`) via `backend/db.py`'s existing helpers, or directly for the one GoTrue admin call `db.py` doesn't already expose.
- **Scope discipline:** `workers/scraper.py`'s region-matching bug and the `nearby_facilities`/`coordinates` backfill are both named and explicitly deferred rather than silently pulled into this plan.
- **Type consistency:** `write_export`/`write_accounts` both return the file path they wrote (`str`), matching how Task 5's operator steps reference them. `seed_table`'s `rows: list[dict]` matches the shape `load_export` returns and the shape `write_export` (Task 2) produces.
