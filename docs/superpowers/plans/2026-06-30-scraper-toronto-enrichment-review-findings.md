# Scraper Toronto-Enrichment Review Findings — Backlog

**Date:** 2026-06-30
**Source:** code-review (high effort, 8-angle + verify) on the uncommitted `workers/scraper.py` diff that added Google-Places-based auto-creation of unmatched hospitals (commit `f8bf7a9` / working tree at review time).
**Status:** Logged for later — not designed or implemented yet. Do not start fixing without re-confirming the approach first (these are bug reports, not approved fix specs).

Excluded from this log per explicit direction: the "writes directly into the dbt-managed `facilities_clean` table" finding (ignore — dbt rebuild behavior is acceptable as-is) and the "new `GOOGLE_PLACES_KEY` env var crashes worker if unset" finding (not a concern — Doppler provisions it).

---

## 1. A failed facility insert silently kills wait-time publishing for the entire run — CONFIRMED
**Location:** `workers/scraper.py`, `build_facility_map` (~line 394-400) + `insert_new_facilities` (~line 288-347)

`facility_id = uuid.uuid4()` is written into `facility_map` *before* `insert_new_facilities()` runs. That function swallows `requests.RequestException` (logs, returns — never raises). If the POST to `/facilities` fails for any new facility, the orphan `facility_id` still reaches `consolidate()` → `insert_wait_times()`, which does one unchunked POST for all records. The FK (`wait_times.facility_id → facilities(id)`) rejects the whole batch — every facility's wait time is dropped for that run, not just the broken one. Triggers on a single ordinary run (no retry/overlap needed).

**Direction (not designed yet):** either have `insert_new_facilities` return which records actually succeeded and filter `facility_map`/`new_facilities` accordingly before they reach `consolidate()`, or make `insert_wait_times` resilient to per-record FK failures (chunked/individual inserts) instead of one all-or-nothing batch.

---

## 2. No idempotency check before creating facilities — cross-run duplicates are likely — CONFIRMED
**Location:** `workers/scraper.py`, `insert_new_facilities` (~line 298-345) + `build_facility_map` loop (~line 372-398)

`facilities_clean` is a dbt-managed table rebuilt on a ~7-day schedule by unrelated Lambdas — confirmed via `pipeline/functions/dbt-runner/medicoord_dbt/models/facilities_clean.sql` and `pipeline/infra/template.yaml`. A facility created in run N won't appear in `db_corpus` (sourced from `facilities_clean`) for up to ~7 days. The same unmatched name re-resolves via Google Places next run and either silently double-creates (no unique constraint on `google_place_id`) or hits the `facilities (name, lat, lng)` unique constraint and fails loudly — caught, logged, and the whole `new_facilities` batch for that call is dropped.

**Direction (not designed yet):** check for an existing `facilities` row by `google_place_id` before generating a new UUID and inserting, not just the in-run `place_id_to_facility_id` dict.

---

## 3. The Toronto region check is wrong on this project's own data, today — CONFIRMED
**Location:** `workers/scraper.py:266`

`if "toronto" not in address.lower(): return None`. Verified against `artifacts/facility_clean_schema.md`'s real sample rows: "the Scarborough Hospital - Grace Campus", "Scarborough Health Network - Centenary Hospital", and "North York General Hospital - Branson Division" are real, already-operational Toronto hospitals whose addresses never contain the literal word "toronto". This check silently rejects them as out-of-region forever.

**Direction (not designed yet):** geographic check (bounding box or PostGIS) using the `lat`/`lng` already available in the same function, instead of a string match — also relevant since the project roadmap is "Toronto today, national tomorrow" (`docs/proximity-filtering-design.md`).

---

## 4. Serial, uncached Google Places calls — latency and quota risk on every run — CONFIRMED
**Location:** `workers/scraper.py`, `build_facility_map` loop (~line 372-398)

No concurrency, no negative-cache. Each unmatched name costs 2 sequential blocking calls (≤10s timeout each). `artifacts/facility_clean_schema.md` documents that most scraped names are ON-region (non-Toronto) and won't match the Toronto-centered DB — meaning most unmatched names are permanently unresolvable (see finding 3) and pay this cost on every 15-minute run, forever, with no backoff.

**Direction (not designed yet):** negative-cache names that fail the region check (or fail to resolve) so they're not re-queried every run; consider concurrency if the unmatched count is consistently large.

---

## 5. Duplicates the existing Places-enrichment pipeline rather than reusing it — PLAUSIBLE
**Location:** `workers/scraper.py:223-285` vs `pipeline/functions/places-enricher/handler.py`

Different enough purposes (refresh-existing vs. discover-new) that "bypass" overstates it, but the duplication is real and self-acknowledged (the new code's docstring says it "mirrors" `places-enricher`). A shared Places search+details helper was a missed opportunity; the two paths have already diverged (e.g. no hours-text normalization in the new code).

**Direction (not designed yet):** extract a shared Places search+details helper both call sites can use, if/when this is prioritized.

---

## 6. Misleading "matched" count in the run summary log — CONFIRMED
**Location:** `workers/scraper.py:402-407`

`len(facility_map) - len(new_facilities)` double-counts as "matched" any name that resolves to a `place_id` already created earlier in the same run (within-run dedup path adds to `facility_map` but not `new_facilities`). Inflates the apparent fuzzy-match rate during on-call/cost review of Google Places usage.

**Direction (not designed yet):** track a `matched` counter directly in the loop instead of deriving it by subtraction.

---

## 7. `facilities_rows`/`clean_rows` hand-duplicate ~11 fields — CONFIRMED
**Location:** `workers/scraper.py`, `insert_new_facilities` (~line 298-345)

Two list comprehensions build near-identical dicts from the same `records`, field by field, with no shared builder. A future field addition (e.g. a new Places attribute) risks editing only one and silently desyncing `facilities` from `facilities_clean`.

**Direction (not designed yet):** build one base dict per record with the shared fields, then spread/extend for the two table-specific shapes.
