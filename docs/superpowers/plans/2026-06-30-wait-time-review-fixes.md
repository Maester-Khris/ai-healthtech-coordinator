# Wait-Time Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the CONFIRMED/PLAUSIBLE findings from the two 2026-06-30 code-review backlogs (`docs/superpowers/plans/2026-06-30-scraper-toronto-enrichment-review-findings.md` and `docs/superpowers/plans/2026-06-30-wait-time-data-api-review-findings.md`) covering `workers/scraper.py` and the backend wait-time/data-API code, with unit tests per fix and a final smoke test.

**Architecture:** No new subsystems. Each task patches one existing function in place, in the same file/module the finding was raised against. Tests follow each file's existing convention (`sys.path.insert` + direct module import + `unittest.mock.patch`).

**Tech Stack:** Python 3.11, pytest, `unittest.mock`, FastAPI `TestClient`, Supabase REST, Upstash Redis (`redis` client).

## Global Constraints
- Run all Python/pytest commands via `doppler run --` after `source /home/niki/Documents/workenv/pydev/bin/activate` (per project `CLAUDE.md`).
- No new npm packages. New Python dependency: `pytest==8.*` added to `workers/requirements.txt` only (backend already has it) — note in final summary.
- Severity schema, auth flow and existing route contracts are unchanged by this plan.
- Conventional commit per task (`fix:` prefix for bug fixes), one commit per task, never per-file.
- Decisions already settled (do not re-litigate during execution):
  - Finding 1 (scraper, failed insert): fix by filtering `facility_map` to drop facilities that failed to persist, **not** by chunking `insert_wait_times`.
  - Finding 3 (wait-time, ETag churn): **no code change** — accepted as intended behavior.
  - Findings 2 & 5 (wait-time, module-level env var crash in `db.py`/`wait_times.py`): **no code change** — fail-fast accepted, provisioning confirmed separately (GH Actions secrets, Task 11).
  - Finding 5 (scraper, shared Places helper extraction): **deferred**, not in this plan (explicitly low-priority "if/when prioritized").

---

## Part A — `workers/scraper.py`

### Task 1: Toronto region check — bounding box instead of string match

**Files:**
- Modify: `workers/scraper.py:223-285` (`resolve_unmatched_facility`)
- Test: `workers/tests/test_scraper.py` (new file)
- Test: `workers/tests/__init__.py` (new, empty)

**Interfaces:**
- Produces: `scraper.TORONTO_BOUNDS: dict`, `scraper._in_toronto_bounds(lat: float, lng: float) -> bool`

- [ ] **Step 1: Create test scaffolding and write the failing tests**

`workers/tests/__init__.py`:
```python
```

`workers/tests/test_scraper.py`:
```python
import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import scraper


def _places_responses(address, lat, lng):
    search_resp = MagicMock(status_code=200)
    search_resp.raise_for_status = lambda: None
    search_resp.json = lambda: {"candidates": [{"place_id": "place-1"}]}

    details_resp = MagicMock(status_code=200)
    details_resp.raise_for_status = lambda: None
    details_resp.json = lambda: {
        "result": {
            "name": "Test Hospital",
            "formatted_address": address,
            "formatted_phone_number": "555-1234",
            "opening_hours": {"weekday_text": []},
            "business_status": "OPERATIONAL",
            "geometry": {"location": {"lat": lat, "lng": lng}},
        }
    }
    return [search_resp, details_resp]


class TestResolveUnmatchedFacility:
    @patch("scraper.requests.get")
    def test_inside_toronto_bounds_returns_facility(self, mock_get):
        mock_get.side_effect = _places_responses("123 Main St, Toronto, ON", lat=43.70, lng=-79.40)

        result = scraper.resolve_unmatched_facility("Test Hospital")

        assert result is not None
        assert result["lat"] == 43.70

    @patch("scraper.requests.get")
    def test_outside_toronto_bounds_returns_none(self, mock_get):
        mock_get.side_effect = _places_responses("123 Bank St, Ottawa, ON", lat=45.42, lng=-75.69)

        result = scraper.resolve_unmatched_facility("Ottawa General")

        assert result is None

    @patch("scraper.requests.get")
    def test_real_toronto_hospital_without_literal_toronto_in_address_matches(self, mock_get):
        # Regression for finding #3: real prod row "the Scarborough Hospital -
        # Grace Campus" has no literal "toronto" substring in its address.
        mock_get.side_effect = _places_responses(
            "3030 birchmount rd. scarborough on m1w 3w3", lat=43.80, lng=-79.31
        )

        result = scraper.resolve_unmatched_facility("the Scarborough Hospital - Grace Campus")

        assert result is not None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/niki/Documents/saas/medicoordai && doppler run -- pytest workers/tests/test_scraper.py -v`
Expected: `test_outside_toronto_bounds_returns_none` FAILS (current code returns a facility because `address.lower()` happens to not contain "toronto" — wait, actually current behavior: current code returns `None` only when `"toronto" not in address.lower()`, so "Ottawa, ON" correctly returns None today). The test that should currently FAIL is `test_real_toronto_hospital_without_literal_toronto_in_address_matches`, since `"3030 birchmount rd. scarborough on m1w 3w3"` contains no "toronto" substring and current code wrongly returns `None`.

- [ ] **Step 3: Replace the string match with a bounding-box check**

In `workers/scraper.py`, add near the other module constants (after `FUZZY_THRESHOLD` at line 58):
```python
# Amalgamated City of Toronto bounding box — covers all six former
# municipalities (incl. Scarborough, North York, Etobicoke). Real prod
# addresses (e.g. "...scarborough on m1w 3w3") never contain the literal
# word "toronto", so this replaces a substring match with geography.
TORONTO_BOUNDS = {"min_lat": 43.58, "max_lat": 43.86, "min_lng": -79.64, "max_lng": -79.12}


def _in_toronto_bounds(lat: float, lng: float) -> bool:
    return (
        TORONTO_BOUNDS["min_lat"] <= lat <= TORONTO_BOUNDS["max_lat"]
        and TORONTO_BOUNDS["min_lng"] <= lng <= TORONTO_BOUNDS["max_lng"]
    )
```

In `resolve_unmatched_facility` (around line 265-271), replace:
```python
    address = details.get("formatted_address", "")
    if "toronto" not in address.lower():
        return None  # outside the routing region — not a real "no match"

    location = details.get("geometry", {}).get("location", {})
    if "lat" not in location or "lng" not in location:
        return None
```
with:
```python
    address = details.get("formatted_address", "")

    location = details.get("geometry", {}).get("location", {})
    if "lat" not in location or "lng" not in location:
        return None
    if not _in_toronto_bounds(location["lat"], location["lng"]):
        return None  # outside the routing region — not a real "no match"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `doppler run -- pytest workers/tests/test_scraper.py -v`
Expected: all 3 tests in `TestResolveUnmatchedFacility` PASS

- [ ] **Step 5: Commit**

```bash
git add workers/scraper.py workers/tests/__init__.py workers/tests/test_scraper.py
git commit -m "fix: use geographic bounding box for Toronto region check in scraper"
```

---

### Task 2: Idempotency — reuse existing facility by `google_place_id` across runs

**Files:**
- Modify: `workers/scraper.py:288-409` (`build_facility_map`, new `fetch_existing_place_ids`)
- Test: `workers/tests/test_scraper.py`

**Interfaces:**
- Consumes: `scraper.resolve_unmatched_facility` (Task 1), `scraper.insert_new_facilities` (current signature, returns `None` until Task 4)
- Produces: `scraper.fetch_existing_place_ids(url: str, headers: dict) -> dict[str, str]`; `build_facility_map`'s `place_id_to_facility_id` is now pre-seeded from this function instead of starting empty.

- [ ] **Step 1: Write the failing tests**

Append to `workers/tests/test_scraper.py`:
```python
class TestFetchExistingPlaceIds:
    @patch("scraper.requests.get")
    def test_returns_place_id_to_facility_id_map(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200)
        mock_get.return_value.raise_for_status = lambda: None
        mock_get.return_value.json = lambda: [
            {"id": "fac-1", "google_place_id": "place-1"},
            {"id": "fac-2", "google_place_id": "place-2"},
        ]

        result = scraper.fetch_existing_place_ids("https://x.supabase.co", {})

        assert result == {"place-1": "fac-1", "place-2": "fac-2"}


class TestBuildFacilityMapIdempotency:
    @patch("scraper.insert_new_facilities", return_value=set())
    @patch("scraper.resolve_unmatched_facility")
    @patch("scraper.fetch_existing_place_ids", return_value={"place-99": "existing-fac-id"})
    @patch("scraper.fuzz_process.extractOne", return_value=None)
    def test_reuses_existing_facility_instead_of_recreating(
        self, mock_extract, mock_fetch_existing, mock_resolve, mock_insert
    ):
        mock_resolve.return_value = {
            "facility_name": "New Name", "category": "hospital",
            "source_facility_type": "general", "accepted_severity": ["emergent"],
            "address": "x", "lat": 1.0, "lng": 1.0, "phone": None,
            "google_place_id": "place-99", "business_status": "OPERATIONAL",
            "weekday_hours": "[]",
        }
        redis_client = MagicMock()
        redis_client.smembers.return_value = set()

        result = scraper.build_facility_map(
            {"clean name": {"official_name": "Clean Name"}}, {}, {},
            "https://x.supabase.co", {}, redis_client,
        )

        assert result["clean name"] == "existing-fac-id"
        mock_insert.assert_called_once_with("https://x.supabase.co", {}, [])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `doppler run -- pytest workers/tests/test_scraper.py -v`
Expected: `test_returns_place_id_to_facility_id_map` FAILS with `AttributeError: module 'scraper' has no attribute 'fetch_existing_place_ids'`; `test_reuses_existing_facility_instead_of_recreating` FAILS (signature mismatch — `build_facility_map` doesn't yet take a `redis_client` param).

- [ ] **Step 3: Add `fetch_existing_place_ids` and thread `redis_client` through `build_facility_map`**

In `workers/scraper.py`, add after `fetch_db_facilities` (after line 134):
```python
def fetch_existing_place_ids(url: str, headers: dict) -> dict[str, str]:
    """
    Returns {google_place_id: facility_id} for every facility that already
    has one. Pre-seeds build_facility_map's dedup map so a name that
    resolves to an already-created facility in a later run (facilities_clean
    won't show it for up to ~7 days post-dbt-rebuild) reuses the existing
    row instead of violating facilities_name_lat_lng_unique or creating a
    silent duplicate.
    """
    endpoint = f"{url}/rest/v1/facilities?select=id,google_place_id&google_place_id=not.is.null"
    r = requests.get(endpoint, headers=headers, timeout=10)
    r.raise_for_status()
    return {row["google_place_id"]: row["id"] for row in r.json()}
```

Change `build_facility_map`'s signature (line 352-358) from:
```python
def build_facility_map(
    erstat_data: dict[str, dict],
    hlwiw_data: dict[str, dict],
    db_corpus: dict[str, str],  # {clean_db_name: uuid}
    url: str,
    headers: dict,
) -> dict[str, str]:
```
to:
```python
def build_facility_map(
    erstat_data: dict[str, dict],
    hlwiw_data: dict[str, dict],
    db_corpus: dict[str, str],  # {clean_db_name: uuid}
    url: str,
    headers: dict,
    redis_client: redis.Redis,
) -> dict[str, str]:
```

Change line 370 from:
```python
    place_id_to_facility_id: dict[str, str] = {}
```
to:
```python
    place_id_to_facility_id: dict[str, str] = fetch_existing_place_ids(url, headers)
```

Update the `main()` call site (line 572) from:
```python
    facility_map = build_facility_map(erstat_data, hlwiw_data, db_corpus, SUPABASE_URL, SUPABASE_HEADERS)
```
to:
```python
    facility_map = build_facility_map(erstat_data, hlwiw_data, db_corpus, SUPABASE_URL, SUPABASE_HEADERS, redis_client)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `doppler run -- pytest workers/tests/test_scraper.py -v`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add workers/scraper.py workers/tests/test_scraper.py
git commit -m "fix: reuse existing facility by google_place_id instead of recreating across scraper runs"
```

---

### Task 3: Negative-cache unresolved/out-of-region names in Redis

**Files:**
- Modify: `workers/scraper.py` (`build_facility_map`)
- Test: `workers/tests/test_scraper.py`

**Interfaces:**
- Consumes: `redis_client` param added in Task 2
- Produces: `scraper.NEGATIVE_CACHE_KEY: str`

- [ ] **Step 1: Write the failing tests**

Append to `workers/tests/test_scraper.py`:
```python
class TestNegativeCache:
    @patch("scraper.insert_new_facilities", return_value=set())
    @patch("scraper.resolve_unmatched_facility")
    @patch("scraper.fetch_existing_place_ids", return_value={})
    @patch("scraper.fuzz_process.extractOne", return_value=None)
    def test_skips_resolve_call_for_previously_unresolved_name(
        self, mock_extract, mock_fetch_existing, mock_resolve, mock_insert
    ):
        redis_client = MagicMock()
        redis_client.smembers.return_value = {"Clean Name"}

        result = scraper.build_facility_map(
            {"clean name": {"official_name": "Clean Name"}}, {}, {},
            "https://x.supabase.co", {}, redis_client,
        )

        mock_resolve.assert_not_called()
        assert "clean name" not in result

    @patch("scraper.insert_new_facilities", return_value=set())
    @patch("scraper.resolve_unmatched_facility", return_value=None)
    @patch("scraper.fetch_existing_place_ids", return_value={})
    @patch("scraper.fuzz_process.extractOne", return_value=None)
    def test_adds_to_negative_cache_on_resolve_failure(
        self, mock_extract, mock_fetch_existing, mock_resolve, mock_insert
    ):
        redis_client = MagicMock()
        redis_client.smembers.return_value = set()

        scraper.build_facility_map(
            {"clean name": {"official_name": "Clean Name"}}, {}, {},
            "https://x.supabase.co", {}, redis_client,
        )

        redis_client.sadd.assert_called_once_with(scraper.NEGATIVE_CACHE_KEY, "Clean Name")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `doppler run -- pytest workers/tests/test_scraper.py -v`
Expected: both new tests FAIL — `mock_resolve` is currently always called (no cache check), and `redis_client.sadd` is never called.

- [ ] **Step 3: Add the negative cache**

In `workers/scraper.py`, add near `REDIS_HASH_KEY` (line 57):
```python
# ponytail: no TTL — scraped hospital names are stable, and a stale
# negative entry just costs one re-resolve if the API result changes.
# Clear manually (SREM) if a name needs to be re-checked sooner.
NEGATIVE_CACHE_KEY = "scraper:unresolved_places"
```

In `build_facility_map`, after the `place_id_to_facility_id` init (line 370-372ish), add:
```python
    cached_unresolved = redis_client.smembers(NEGATIVE_CACHE_KEY)
```

Change the loop body (lines 372-398) — replace:
```python
    for clean in all_scraped_names:
        result = fuzz_process.extractOne(clean, corpus_keys, score_cutoff=FUZZY_THRESHOLD)
        if result:
            best_key, score, *_ = result
            facility_map[clean] = db_corpus[best_key]
            continue

        official = (
            erstat_data.get(clean, {}).get("official_name")
            or hlwiw_data.get(clean, {}).get("hlwiw_name")
            or clean
        )
        created = resolve_unmatched_facility(official)
        if created is None:
            unmatched.append(official)
            continue
```
with:
```python
    for clean in all_scraped_names:
        result = fuzz_process.extractOne(clean, corpus_keys, score_cutoff=FUZZY_THRESHOLD)
        if result:
            best_key, score, *_ = result
            facility_map[clean] = db_corpus[best_key]
            continue

        official = (
            erstat_data.get(clean, {}).get("official_name")
            or hlwiw_data.get(clean, {}).get("hlwiw_name")
            or clean
        )
        if official in cached_unresolved:
            unmatched.append(official)
            continue

        created = resolve_unmatched_facility(official)
        if created is None:
            unmatched.append(official)
            redis_client.sadd(NEGATIVE_CACHE_KEY, official)
            continue
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `doppler run -- pytest workers/tests/test_scraper.py -v`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add workers/scraper.py workers/tests/test_scraper.py
git commit -m "fix: negative-cache unresolved scraper names to avoid re-querying Google Places every run"
```

---

### Task 4: Drop orphan facility_id on failed insert + accurate matched count

**Files:**
- Modify: `workers/scraper.py:288-409` (`insert_new_facilities`, `build_facility_map`)
- Test: `workers/tests/test_scraper.py`

**Interfaces:**
- Produces: `insert_new_facilities(url, headers, records) -> set[str]` (was `-> None`)

- [ ] **Step 1: Write the failing tests**

Append to `workers/tests/test_scraper.py`:
```python
import logging

_RECORD = {
    "facility_id": "f1", "facility_name": "A", "category": "hospital",
    "source_facility_type": "general", "accepted_severity": ["emergent"],
    "address": "123 St", "lat": 1.0, "lng": 2.0, "phone": "555",
    "google_place_id": "p1", "business_status": "OPERATIONAL", "weekday_hours": "[]",
}


class TestInsertNewFacilitiesReturnsSucceededIds:
    @patch("scraper.requests.post")
    def test_returns_facility_ids_on_full_success(self, mock_post):
        ok = MagicMock(status_code=201)
        ok.raise_for_status = lambda: None
        mock_post.side_effect = [ok, ok]

        result = scraper.insert_new_facilities("https://x.supabase.co", {}, [_RECORD])

        assert result == {"f1"}

    @patch("scraper.requests.post")
    def test_returns_empty_set_when_facilities_insert_fails(self, mock_post):
        mock_post.side_effect = scraper.requests.RequestException("boom")

        result = scraper.insert_new_facilities("https://x.supabase.co", {}, [_RECORD])

        assert result == set()

    @patch("scraper.requests.post")
    def test_returns_facility_ids_even_if_clean_insert_fails(self, mock_post):
        ok = MagicMock(status_code=201)
        ok.raise_for_status = lambda: None
        mock_post.side_effect = [ok, scraper.requests.RequestException("clean failed")]

        result = scraper.insert_new_facilities("https://x.supabase.co", {}, [_RECORD])

        assert result == {"f1"}


class TestBuildFacilityMapDropsFailedInserts:
    @patch("scraper.insert_new_facilities")
    @patch("scraper.resolve_unmatched_facility")
    @patch("scraper.fetch_existing_place_ids", return_value={})
    @patch("scraper.fuzz_process.extractOne", return_value=None)
    def test_drops_facility_map_entries_for_facilities_that_failed_to_persist(
        self, mock_extract, mock_fetch_existing, mock_resolve, mock_insert
    ):
        mock_resolve.return_value = {
            "facility_name": "New Hospital", "category": "hospital",
            "source_facility_type": "general", "accepted_severity": ["emergent"],
            "address": "x", "lat": 43.7, "lng": -79.4, "phone": None,
            "google_place_id": "place-1", "business_status": "OPERATIONAL", "weekday_hours": "[]",
        }
        mock_insert.return_value = set()  # facilities insert failed
        redis_client = MagicMock()
        redis_client.smembers.return_value = set()

        result = scraper.build_facility_map(
            {"new hospital": {"official_name": "New Hospital"}}, {}, {},
            "https://x.supabase.co", {}, redis_client,
        )

        assert "new hospital" not in result

    @patch("scraper.insert_new_facilities", return_value=set())
    @patch("scraper.resolve_unmatched_facility", return_value=None)
    @patch("scraper.fetch_existing_place_ids", return_value={})
    def test_matched_count_excludes_within_run_dedup_hits(
        self, mock_fetch_existing, mock_resolve, mock_insert, caplog
    ):
        db_corpus = {"existing hospital": "fac-existing"}
        redis_client = MagicMock()
        redis_client.smembers.return_value = set()

        with patch("scraper.fuzz_process.extractOne", return_value=("existing hospital", 90, 0)), \
             caplog.at_level(logging.INFO, logger="scraper"):
            result = scraper.build_facility_map(
                {"existing hospital": {"official_name": "Existing Hospital"}}, {}, db_corpus,
                "https://x.supabase.co", {}, redis_client,
            )

        assert result == {"existing hospital": "fac-existing"}
        assert "1 matched, 0 newly created, 0 unmatched" in caplog.text
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `doppler run -- pytest workers/tests/test_scraper.py -v`
Expected: all `TestInsertNewFacilitiesReturnsSucceededIds` tests FAIL (`insert_new_facilities` returns `None`); `test_drops_facility_map_entries_for_facilities_that_failed_to_persist` FAILS (`"new hospital"` is still in the result); `test_matched_count_excludes_within_run_dedup_hits` FAILS (current log subtraction `len(facility_map) - len(new_facilities)` gives 0 matched, not 1, when there's 1 new + 1 matched — verify by inspecting current log text mismatch).

- [ ] **Step 3: Implement**

Replace `insert_new_facilities` (lines 288-347) with:
```python
def insert_new_facilities(url: str, headers: dict, records: list[dict]) -> set[str]:
    """
    Persists newly-discovered Toronto hospitals into both `facilities` and
    `facilities_clean` so future scraper runs match them directly via the
    normal fuzzy-match corpus instead of re-resolving every time.

    Returns the set of facility_ids whose `facilities` row was actually
    persisted. wait_times.facility_id has an FK to facilities(id) (not
    facilities_clean), so that row alone is what callers need to know
    succeeded before publishing wait times for it.
    """
    if not records:
        return set()
    now = datetime.now(timezone.utc).isoformat()

    def _common(r: dict) -> dict:
        return dict(
            category=r["category"],
            source_facility_type=r["source_facility_type"],
            accepted_severity=r["accepted_severity"],
            address=r["address"],
            lat=r["lat"],
            lng=r["lng"],
            phone=r["phone"],
            google_place_id=r["google_place_id"],
            weekday_hours=r["weekday_hours"],
            last_enriched_at=now,
        )

    facilities_rows = [{
        "id": r["facility_id"],
        "name": r["facility_name"],
        **_common(r),
        "business_status": r["business_status"],
        "source": "manual",
    } for r in records]

    try:
        resp = requests.post(f"{url}/rest/v1/facilities", headers=headers, json=facilities_rows, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as e:
        log.error("Insert into facilities failed, skipping facilities_clean too: %s", e)
        return set()

    succeeded_ids = {r["facility_id"] for r in records}

    clean_rows = [{
        "facility_id": r["facility_id"],
        "facility_name": r["facility_name"],
        **_common(r),
        "business_status": (r["business_status"] or "").upper(),
        "is_operational": (r["business_status"] or "").upper() == "OPERATIONAL",
        "dbt_run_at": now,
    } for r in records]

    try:
        resp = requests.post(f"{url}/rest/v1/facilities_clean", headers=headers, json=clean_rows, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as e:
        log.error("Insert into facilities_clean failed (facilities row still created): %s", e)
        return succeeded_ids

    log.info("Created %d new Toronto facilities from unmatched scraped names", len(records))
    return succeeded_ids
```

Replace the tail of `build_facility_map` (from `insert_new_facilities(url, headers, new_facilities)` at line 400 through the end at line 409) with:
```python
    matched = len(facility_map) - len(new_facilities)

    succeeded_ids = insert_new_facilities(url, headers, new_facilities)
    failed_ids = {f["facility_id"] for f in new_facilities} - succeeded_ids
    if failed_ids:
        facility_map = {k: v for k, v in facility_map.items() if v not in failed_ids}
        log.warning("Dropped %d scraped name(s) mapped to facilities that failed to persist", len(failed_ids))

    log.info(
        "Mapping: %d matched, %d newly created, %d unmatched (threshold=%d)",
        matched, len(succeeded_ids), len(unmatched), FUZZY_THRESHOLD,
    )
    for name in unmatched:
        log.warning("No DB match for scraped hospital: '%s'", name)

    return facility_map
```

Note: `matched` must be computed from `facility_map`/`new_facilities` *before* `insert_new_facilities` runs (it's computed the same way as today — by subtraction — but the within-run-dedup case (Task 2/3) means `new_facilities` only grows on genuinely new creations, never on a within-run or cross-run place_id hit, so the existing subtraction is already correct *given* Tasks 2-3 are in place; no further change needed there). The bug this task fixes is the *post-insert-failure* count (`len(new_facilities)` no longer matched `succeeded_ids`), which `len(succeeded_ids)` now reports correctly.

- [ ] **Step 4: Run tests to verify they pass**

Run: `doppler run -- pytest workers/tests/test_scraper.py -v`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add workers/scraper.py workers/tests/test_scraper.py
git commit -m "fix: drop orphan facility_id on failed insert and report accurate matched count"
```

---

### Task 5: De-duplicate `facilities_rows`/`clean_rows` field building

**Status:** Already done as part of Task 4's `insert_new_facilities` rewrite (the `_common()` helper). This task only adds the regression test confirming the refactor didn't change the actual payload shape.

**Files:**
- Test: `workers/tests/test_scraper.py`

- [ ] **Step 1: Write and run the payload-shape test**

Append to `workers/tests/test_scraper.py`:
```python
class TestInsertNewFacilitiesPayloadShape:
    @patch("scraper.requests.post")
    def test_facilities_and_clean_rows_share_common_fields(self, mock_post):
        ok = MagicMock(status_code=201)
        ok.raise_for_status = lambda: None
        mock_post.side_effect = [ok, ok]

        scraper.insert_new_facilities("https://x.supabase.co", {}, [_RECORD])

        facilities_payload = mock_post.call_args_list[0].kwargs["json"][0]
        clean_payload = mock_post.call_args_list[1].kwargs["json"][0]

        assert facilities_payload["id"] == "f1"
        assert facilities_payload["name"] == "A"
        assert facilities_payload["lat"] == 1.0
        assert facilities_payload["source"] == "manual"
        assert clean_payload["facility_id"] == "f1"
        assert clean_payload["facility_name"] == "A"
        assert clean_payload["is_operational"] is True
        assert clean_payload["business_status"] == "OPERATIONAL"
```

Run: `doppler run -- pytest workers/tests/test_scraper.py -v`
Expected: PASS (this test validates Task 4's `_common()` refactor — if it fails, Task 4's implementation has a field bug)

- [ ] **Step 2: Commit**

```bash
git add workers/tests/test_scraper.py
git commit -m "test: cover insert_new_facilities shared-field payload shape"
```

---

## Part B — Backend wait-time / data API

### Task 6: `get_wait_minutes_map` — degrade to `{}` on double-failure, match scraper's Redis write-back shape

**Files:**
- Create: `migrations/012_latest_wait_times_rpc_add_fields.sql`
- Modify: `backend/services/wait_times.py`
- Test: `backend/tests/test_wait_times.py`

**Interfaces:**
- Produces: `latest_wait_times()` RPC now also returns `raw_wait`, `source`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_wait_times.py`:
```python
class TestGetWaitMinutesMapDoubleFailure:
    @patch("services.wait_times.supabase_rpc", side_effect=Exception("supabase down"))
    @patch("services.wait_times.redis_client")
    def test_redis_and_supabase_both_down_returns_empty_map(self, mock_redis, mock_rpc):
        mock_redis.hgetall.return_value = {}

        result = get_wait_minutes_map()  # must not raise

        assert result == {}


class TestGetWaitMinutesMapWritebackShape:
    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_fallback_writeback_includes_raw_wait_and_source(self, mock_redis, mock_rpc):
        mock_redis.hgetall.return_value = {}
        mock_rpc.return_value = [
            {"facility_id": "fac-1", "wait_minutes": 20, "raw_wait": "20 min", "source": "erstat", "recorded_at": "2026-06-30T00:00:00Z"},
        ]

        get_wait_minutes_map()

        args, _ = mock_redis.hset.call_args
        payload = json.loads(args[2])
        assert payload["raw_wait"] == "20 min"
        assert payload["source"] == "erstat"
        assert payload["updated_at"] == "2026-06-30T00:00:00Z"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/niki/Documents/saas/medicoordai && doppler run -- pytest backend/tests/test_wait_times.py -v`
Expected: `test_redis_and_supabase_both_down_returns_empty_map` FAILS (raises `Exception`, doesn't return `{}`); `test_fallback_writeback_includes_raw_wait_and_source` FAILS (`KeyError`/`None` — current write-back only writes `wait_minutes`)

- [ ] **Step 3: Add migration extending the RPC**

`migrations/012_latest_wait_times_rpc_add_fields.sql`:
```sql
-- Extends latest_wait_times() to also return raw_wait/source so the
-- backend's cache-aside fallback can write back the same Redis hash
-- shape workers/scraper.py writes (previously only wait_minutes), per
-- 2026-06-30 review finding #6.
CREATE OR REPLACE FUNCTION latest_wait_times()
RETURNS TABLE (
  facility_id  uuid,
  wait_minutes integer,
  raw_wait     text,
  source       text,
  recorded_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (facility_id)
    facility_id,
    wait_minutes,
    raw_wait,
    source,
    recorded_at
  FROM wait_times
  ORDER BY facility_id, recorded_at DESC;
$$;
```
Run this in the Supabase SQL Editor against the project's `preview` database (same manual-apply convention as the other files in `migrations/`).

- [ ] **Step 4: Update `get_wait_minutes_map`**

Replace `backend/services/wait_times.py:16-41` with:
```python
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `doppler run -- pytest backend/tests/test_wait_times.py -v`
Expected: all tests PASS (including the 5 pre-existing ones — `test_redis_empty_falls_back_to_supabase_rpc` and `test_fallback_writes_back_to_redis` use RPC rows without `raw_wait`/`source` keys, which `.get()` handles as `None`)

- [ ] **Step 6: Commit**

```bash
git add migrations/012_latest_wait_times_rpc_add_fields.sql backend/services/wait_times.py backend/tests/test_wait_times.py
git commit -m "fix: degrade to empty wait map on double-failure, match scraper Redis write-back shape"
```

---

### Task 7: `apply_wait_filter` must not mutate the shared facility cache

**Files:**
- Modify: `backend/services/facilities.py:45-63`
- Test: `backend/tests/test_facilities.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_facilities.py`, inside `class TestApplyWaitFilter`:
```python
    def test_does_not_mutate_original_records(self):
        original = [{"id": "a"}]

        apply_wait_filter(original, "id", None, {"a": 10})

        assert "wait_minutes" not in original[0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `doppler run -- pytest backend/tests/test_facilities.py -v -k test_does_not_mutate_original_records`
Expected: FAIL (`AssertionError` — current code mutates `r["wait_minutes"]` in place on the same dict objects)

- [ ] **Step 3: Build fresh dicts instead of mutating**

Replace `backend/services/facilities.py:45-63`:
```python
def apply_wait_filter(
    records: list[dict],
    id_key: str,
    max_wait_minutes: int | None,
    wait_map: dict[str, int | None],
) -> list[dict]:
    """
    Returns new records annotated with wait_minutes from wait_map (never
    mutates the input — callers may hold the same dict objects in a
    shared cache). When max_wait_minutes is set, drops records whose
    wait_minutes exceeds it — records with no wait data (None) always
    pass, same convention as the open_24h/open_weekends hours filters.
    """
    annotated = [{**r, "wait_minutes": wait_map.get(r[id_key])} for r in records]

    if max_wait_minutes is None:
        return annotated

    return [r for r in annotated if r["wait_minutes"] is None or r["wait_minutes"] <= max_wait_minutes]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `doppler run -- pytest backend/tests/test_facilities.py -v`
Expected: all `TestApplyWaitFilter` tests PASS (6 pre-existing + 1 new)

- [ ] **Step 5: Commit**

```bash
git add backend/services/facilities.py backend/tests/test_facilities.py
git commit -m "fix: apply_wait_filter no longer mutates the shared facility cache in place"
```

---

### Task 8: `auth.py` — distinguish invalid-token (401) from auth-service-unavailable (503)

**Files:**
- Modify: `backend/services/auth.py`
- Test: `backend/tests/test_auth_service.py`

- [ ] **Step 1: Write the failing tests**

Replace `backend/tests/test_auth_service.py:31-35` (`test_request_failure_raises_401`) and append new tests, so the full file's `TestVerifyToken` class becomes:
```python
import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import requests
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

    @patch("services.auth.supabase_auth_get_user")
    def test_supabase_401_raises_401(self, mock_get_user):
        resp = MagicMock(status_code=401)
        mock_get_user.side_effect = requests.HTTPError(response=resp)

        with pytest.raises(HTTPException) as exc_info:
            verify_token("bad-token")
        assert exc_info.value.status_code == 401

    @patch("services.auth.supabase_auth_get_user")
    def test_supabase_500_raises_503(self, mock_get_user):
        resp = MagicMock(status_code=500)
        mock_get_user.side_effect = requests.HTTPError(response=resp)

        with pytest.raises(HTTPException) as exc_info:
            verify_token("token")
        assert exc_info.value.status_code == 503

    @patch("services.auth.supabase_auth_get_user")
    def test_network_failure_raises_503(self, mock_get_user):
        mock_get_user.side_effect = requests.exceptions.ConnectionError("network error")

        with pytest.raises(HTTPException) as exc_info:
            verify_token("token")
        assert exc_info.value.status_code == 503
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `doppler run -- pytest backend/tests/test_auth_service.py -v`
Expected: `test_supabase_500_raises_503` and `test_network_failure_raises_503` FAIL (current code raises 401 for every exception type)

- [ ] **Step 3: Branch on response status**

Replace `backend/services/auth.py`:
```python
import types
import requests
from fastapi import HTTPException

from db import supabase_auth_get_user


def verify_token(token: str) -> object:
    """
    Verify a Supabase JWT and return a user object exposing .id and .email.
    Raises HTTPException 401 if Supabase says the token is invalid/expired,
    or 503 if Supabase itself is unreachable/erroring (distinct failure
    modes — a 503 means "try again," a 401 means "log in again").
    """
    try:
        data = supabase_auth_get_user(token)
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 503
        if status == 401:
            raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
        raise HTTPException(status_code=503, detail="Auth service unavailable") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=503, detail="Auth service unavailable") from exc

    if not data.get("id"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return types.SimpleNamespace(id=data["id"], email=data.get("email"))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `doppler run -- pytest backend/tests/test_auth_service.py -v`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/auth.py backend/tests/test_auth_service.py
git commit -m "fix: distinguish invalid-token 401 from auth-service-unavailable 503"
```

---

### Task 9: Pin `redis` in `backend/requirements.txt`

**Files:**
- Modify: `backend/requirements.txt:10`

No test cycle — single-line config pin, consistent with the file's dominant convention (`fastapi==0.111.*`).

- [ ] **Step 1: Pin the version**

Change `backend/requirements.txt:10` from:
```
redis
```
to:
```
redis==5.*
```

- [ ] **Step 2: Reinstall and confirm no breakage**

Run: `doppler run -- pip install -r backend/requirements.txt`
Expected: installs cleanly (already-installed `redis` package satisfies `5.*` per the scraper's own `workers/requirements.txt` pin of `redis==5.0.8`)

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: pin redis dependency in backend requirements"
```

---

### Task 10: Test-quality fixes — real ASGI test for `/facilities/nearby`, correct Redis exception type

**Files:**
- Modify: `backend/tests/test_facilities_routes.py`
- Modify: `backend/tests/test_wait_times.py`

- [ ] **Step 1: Write the failing ASGI test**

Append to `backend/tests/test_facilities_routes.py`:
```python
from fastapi.testclient import TestClient


class TestFacilitiesNearbyAsgiStack:
    def test_valid_rpc_response_passes_response_model_validation(self):
        fake_rows = [{
            "facility_id": "11111111-1111-1111-1111-111111111111",
            "facility_name": "Test Hospital",
            "category": "hospital",
            "address": "123 Main St",
            "phone": None,
            "is_operational": True,
            "distance_m": 100,
            "eta_walk_min": 20,
            "eta_transit_min": 10,
            "eta_drive_min": 5,
        }]
        with patch("main.supabase_rpc", return_value=fake_rows), \
             patch("main.get_wait_minutes_map", return_value={}):
            with TestClient(main.app) as client:
                resp = client.get("/facilities/nearby", params={"lat": 43.6, "lng": -79.4})

        assert resp.status_code == 200
        body = resp.json()
        assert body[0]["facility_id"] == "11111111-1111-1111-1111-111111111111"
        assert body[0]["wait_minutes"] is None
```

- [ ] **Step 2: Run test to verify it fails or passes for the right reason**

Run: `doppler run -- pytest backend/tests/test_facilities_routes.py -v -k test_valid_rpc_response_passes_response_model_validation`
Expected: PASS today (current implementation is correct on the happy path — this test exists to catch *future* response-model drift the direct-call unit tests in the same file structurally can't catch, per finding #7a). Confirm it fails if you temporarily rename `eta_walk_min` to `eta_walk_minutes` in `fake_rows` (manual sanity check, not committed).

- [ ] **Step 3: Fix the wrong exception type in the Redis-failure test**

In `backend/tests/test_wait_times.py`, add `import redis` near the top (after `from unittest.mock import patch, MagicMock`), and change `test_redis_connection_error_falls_back_to_supabase_rpc` (lines 36-46) from:
```python
    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_redis_connection_error_falls_back_to_supabase_rpc(self, mock_redis, mock_rpc):
        mock_redis.hgetall.side_effect = ConnectionError("redis down")
```
to:
```python
    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_redis_connection_error_falls_back_to_supabase_rpc(self, mock_redis, mock_rpc):
        mock_redis.hgetall.side_effect = redis.exceptions.ConnectionError("redis down")
```

- [ ] **Step 4: Run both test files to confirm everything still passes**

Run: `doppler run -- pytest backend/tests/test_facilities_routes.py backend/tests/test_wait_times.py -v`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_facilities_routes.py backend/tests/test_wait_times.py
git commit -m "test: add ASGI-level /facilities/nearby coverage, use real redis exception type"
```

---

### Task 11: CI workflow — wire Supabase/Redis env vars into the backend job

**Files:**
- Modify: `.github/workflows/ci.yml:38-71`

**Note:** This only updates the workflow to *reference* the secrets. The secret **values** must be added by a human in GitHub repo settings (Settings → Secrets and variables → Actions) — this plan/session has no access to do that. Flag this explicitly in the final summary.

- [ ] **Step 1: Add the `env:` block to the backend job**

In `.github/workflows/ci.yml`, change the `backend:` job's `Run backend tests` step (lines 70-71) from:
```yaml
      - name: Run backend tests
        run: pytest tests/ -v
```
to:
```yaml
      - name: Run backend tests
        run: pytest tests/ -v
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          UPSTASH_REDIS_URL: ${{ secrets.UPSTASH_REDIS_URL }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: wire Supabase/Redis secrets into backend test job env"
```

(CI will still fail on the next push until the three secrets are actually created in GitHub repo settings — that's the human action item, not something this commit can fix.)

---

## Part C — Final Verification

### Task 12: Full test suite + smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run: `cd /home/niki/Documents/saas/medicoordai && doppler run -- pytest backend/tests/ -v`
Expected: all tests PASS (95 pre-existing + ~13 new from Tasks 6-8, 10)

- [ ] **Step 2: Run the full worker test suite**

Run: `doppler run -- pytest workers/tests/ -v`
Expected: all tests PASS (new file from Tasks 1-5, ~14 tests)

- [ ] **Step 3: Import-check the scraper module standalone**

Run: `doppler run -- python -c "import sys; sys.path.insert(0, 'workers'); import scraper; print('scraper imports cleanly')"`
Expected: prints `scraper imports cleanly`, no exceptions

(The scraper itself is **not** run live against production Supabase/Redis/Google Places as part of this verification — that would write real data and burn Google API quota outside of Railway's actual cron schedule. Behavioral correctness is covered by Task 1-5's unit tests; the import check above only confirms no syntax/import regression.)

- [ ] **Step 4: Smoke test the backend's `/facilities` and `/facilities/nearby` routes**

Start the backend:
```bash
cd /home/niki/Documents/saas/medicoordai && source /home/niki/Documents/workenv/pydev/bin/activate && doppler run -- uvicorn backend.main:app --port 8000 &
sleep 3
```

Then:
```bash
curl -s http://localhost:8000/health | python -m json.tool
curl -s "http://localhost:8000/facilities?max_wait_minutes=30" | python -m json.tool | head -30
curl -s "http://localhost:8000/facilities/nearby?lat=43.6426&lng=-79.3871&max_wait_minutes=30" | python -m json.tool | head -30
```
Expected: `/health` returns `{"status": "ok", ...}`; both facilities endpoints return 200 with a JSON array (not a 500) even though local Redis/Supabase fallback behavior may degrade to empty wait data — this is exactly Task 6/7's fix being exercised live.

Stop the server:
```bash
kill %1
```

- [ ] **Step 5: Report results**

Summarize pass/fail counts and any deviations from this plan in the final task-completion message — do not mark the plan done until all four verification steps above are green.

---

## After execution: final review

Once all 12 tasks are committed, run `/code-review` (high effort) against the full diff produced by this plan to confirm every CONFIRMED/PLAUSIBLE finding was actually addressed and no new issues were introduced. This is a manual step performed after plan execution, not part of any task above.
