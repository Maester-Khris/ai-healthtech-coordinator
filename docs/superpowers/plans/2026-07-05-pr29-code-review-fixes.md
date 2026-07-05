# PR #29 Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 9 confirmed findings from the `/code-review high` pass on PR #29 (`preview` → `main`, the Sprint 13/14/14a production promotion), without touching the security-clean areas already verified separately.

**Architecture:** Nine independent, single-purpose fixes across the FastAPI backend (`backend/`), the Railway cron worker (`workers/scraper.py`), and the React/TS frontend map panel (`webapp/src/components/map/`, `webapp/src/hooks/`). None of the fixes depend on each other — they can be implemented and committed in any order, though the order below groups by subsystem to minimize context-switching.

**Tech Stack:** FastAPI (Python 3.11, `requests`, `redis-py`, Starlette), pytest, React 19 + TypeScript (strict) + Vite, vitest (newly wired in this plan — see Task 1).

## Global Constraints

- Work happens directly on the current branch (`preview`) — do not create a new branch.
- **Every commit in this plan must be local only. Never run `git push`.** The user will review all commits before deciding what gets pushed.
- **One commit per task, and only one task per commit.** Do not combine two tasks into one commit, and do not split one task's fix + test into multiple commits. Each task's own "Commit" step is the only commit for that task.
- Commit messages: conventional commits (`fix:`, `test:`, `chore:`), matching the style already used in this repo's history (e.g. `fix: distinguish invalid-token 401 from auth-service-unavailable 503`).
- Never add an AI co-author trailer to any commit (repo rule, see `CLAUDE.md`).
- Python commands run via `doppler run -- <cmd>` per `CLAUDE.md` (backend/worker tests need `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_URL`, `GOOGLE_PLACES_KEY` present — Doppler supplies them). If Doppler isn't configured in the executing environment, fall back to exporting dummy values for the four env vars before running pytest (they're only read at import time, never actually called over the network in these unit tests).
- TypeScript: strict mode, no `any` (existing repo rule, `CLAUDE.md`).
- Severity schema (`routine | moderate | urgent | emergent`) is untouched by this plan — no task modifies it.

---

### Task 1: Wire vitest + fix the "Wait Time" filter dropdown (dead in production)

**Context:** `webapp/src/hooks/useAnchor.test.ts` and `webapp/src/utils/hoursUtils.test.ts` already import from `'vitest'`, but `vitest` is not in `webapp/package.json` and there is no `test` script — these existing test files currently cannot run at all. This task wires vitest first (needed for every frontend task in this plan), then fixes the dead "Wait Time" dropdown: `MapPanel.tsx`'s `waitTime` state changes the chip's label but is never read by the `displayedFacilities` filter, and `useProximitySearch` never sends it to the backend. Since every `Facility` object already carries a `wait_minutes` field (`shared/types.ts:45`, populated server-side by `apply_wait_filter` on **every** `/facilities` response, not just when `max_wait_minutes` is passed), the fix is entirely client-side — no backend or hook changes needed.

**Files:**
- Modify: `webapp/package.json` (add vitest devDependency + test script)
- Create: `webapp/src/utils/waitTimeUtils.ts`
- Create: `webapp/src/utils/waitTimeUtils.test.ts`
- Modify: `webapp/src/components/map/MapPanel.tsx:96-111` (the `displayedFacilities` useMemo)

**Interfaces:**
- Produces: `meetsWaitTimeFilter(waitTime: string, waitMinutes: number | null | undefined): boolean`, exported from `webapp/src/utils/waitTimeUtils.ts`. `waitTime` is one of `'all' | '> 10 min' | '> 25 min' | '30 min+'` (the exact string values already used by `MapPanel.tsx`'s dropdown, `MapPanel.tsx:422-427`).

- [ ] **Step 1: Install vitest and add the test script**

```bash
cd /home/niki/Documents/saas/medicoordai/webapp && npm install --save-dev vitest
```

Then edit `webapp/package.json`'s `"scripts"` block to add a `test` entry:

```json
  "scripts": {
    "dev": "vite",
    "doppler-dev": "doppler setup --project medicoord --config dev_personal --no-interactive && doppler run -- vite --host",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "lint": "eslint .",
    "preview": "vite preview"
  },
```

- [ ] **Step 2: Verify vitest can already run the two pre-existing test files**

Run: `cd /home/niki/Documents/saas/medicoordai/webapp && npm run test`
Expected: PASS — `hoursUtils.test.ts` (9 tests) and `useAnchor.test.ts` (4 tests) all pass. This confirms vitest is correctly wired before writing any new tests.

- [ ] **Step 3: Write the failing test**

Create `webapp/src/utils/waitTimeUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { meetsWaitTimeFilter } from './waitTimeUtils'

describe('meetsWaitTimeFilter', () => {
  it('passes everything when waitTime is all', () => {
    expect(meetsWaitTimeFilter('all', null)).toBe(true)
    expect(meetsWaitTimeFilter('all', undefined)).toBe(true)
    expect(meetsWaitTimeFilter('all', 5)).toBe(true)
  })

  it('excludes facilities with no wait data once a threshold is active', () => {
    expect(meetsWaitTimeFilter('> 10 min', null)).toBe(false)
    expect(meetsWaitTimeFilter('> 10 min', undefined)).toBe(false)
  })

  it('excludes facilities below the threshold', () => {
    expect(meetsWaitTimeFilter('> 10 min', 5)).toBe(false)
    expect(meetsWaitTimeFilter('> 25 min', 24)).toBe(false)
    expect(meetsWaitTimeFilter('30 min+', 29)).toBe(false)
  })

  it('includes facilities at or above the threshold', () => {
    expect(meetsWaitTimeFilter('> 10 min', 10)).toBe(true)
    expect(meetsWaitTimeFilter('> 25 min', 30)).toBe(true)
    expect(meetsWaitTimeFilter('30 min+', 30)).toBe(true)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd /home/niki/Documents/saas/medicoordai/webapp && npx vitest run waitTimeUtils`
Expected: FAIL with "Failed to resolve import './waitTimeUtils'" (the module doesn't exist yet)

- [ ] **Step 5: Write minimal implementation**

Create `webapp/src/utils/waitTimeUtils.ts`:

```typescript
const WAIT_TIME_THRESHOLDS: Record<string, number> = {
  '> 10 min': 10,
  '> 25 min': 25,
  '30 min+':  30,
}

export function meetsWaitTimeFilter(waitTime: string, waitMinutes: number | null | undefined): boolean {
  if (waitTime === 'all') return true
  const threshold = WAIT_TIME_THRESHOLDS[waitTime]
  if (threshold === undefined) return true
  return waitMinutes != null && waitMinutes >= threshold
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /home/niki/Documents/saas/medicoordai/webapp && npx vitest run waitTimeUtils`
Expected: PASS (4 tests)

- [ ] **Step 7: Wire the filter into MapPanel.tsx**

In `webapp/src/components/map/MapPanel.tsx`, add the import near the other utils import (after line 20, `import { isOpen24h, isOpenWeekends } from '../../utils/hoursUtils'`):

```typescript
import { meetsWaitTimeFilter } from '../../utils/waitTimeUtils'
```

Then replace the `displayedFacilities` useMemo (currently `MapPanel.tsx:96-111`):

```typescript
  const displayedFacilities = useMemo(() => {
    // When proximity results have loaded, they are already category-filtered by the DB.
    // When proximity is not active, apply category filter here on the full list.
    const proximityActive = proximity !== 'all' && !proximityLoading && proximityResults.length > 0

    const list = proximityActive
      ? facilities.filter(f => f.id != null && distanceMap.has(f.id))
      : facilities.filter(f => categoryFilter === 'all' || f.category === categoryFilter)

    // Hours and wait-time filters always applied on the frontend (RPC has no hours column,
    // and wait_minutes is already annotated on every facility regardless of proximity mode)
    return list.filter(f => {
      if (open24h      && isOpen24h(f.weekday_hours)      === false) return false
      if (openWeekends && isOpenWeekends(f.weekday_hours) === false) return false
      if (!meetsWaitTimeFilter(waitTime, f.wait_minutes)) return false
      return true
    })
  }, [facilities, proximity, proximityLoading, proximityResults, distanceMap, categoryFilter, open24h, openWeekends, waitTime])
```

(The only changes: the new `meetsWaitTimeFilter` check inside the filter callback, and `waitTime` added to the dependency array.)

- [ ] **Step 8: Run the frontend test suite and typecheck**

Run: `cd /home/niki/Documents/saas/medicoordai/webapp && npm run test && npx tsc -b`
Expected: PASS — all vitest tests pass, `tsc -b` reports no errors.

- [ ] **Step 9: Commit**

```bash
cd /home/niki/Documents/saas/medicoordai && git add webapp/package.json webapp/package-lock.json webapp/src/utils/waitTimeUtils.ts webapp/src/utils/waitTimeUtils.test.ts webapp/src/components/map/MapPanel.tsx
git commit -m "fix(map): wire vitest and fix dead Wait Time filter dropdown"
```

---

### Task 2: Fix the "Open Now" toggle (dead in production)

**Context:** `MapPanel.tsx`'s `openNow` state (`MapPanel.tsx:52`, toggled at `MapPanel.tsx:305`) changes the chip's color but is never read anywhere in `displayedFacilities`'s filter — toggling it excludes zero facilities. `weekday_hours` entries look like `"Monday: 8:00 AM - 5:00 PM"`, `"Monday: Open 24 hours"`, or `"Monday: Closed"` (see `hoursUtils.ts` and its test fixtures) — Google Places format, already Unicode-normalized upstream (narrow no-break spaces/en-dashes stripped to plain spaces/hyphens before storage).

**Files:**
- Modify: `webapp/src/utils/hoursUtils.ts` (add `isOpenNow`)
- Modify: `webapp/src/utils/hoursUtils.test.ts` (add tests for `isOpenNow`)
- Modify: `webapp/src/components/map/MapPanel.tsx` (read `openNow` in the filter)

**Interfaces:**
- Produces: `isOpenNow(weekday_hours: string[] | null | undefined, now?: Date): boolean | null` in `webapp/src/utils/hoursUtils.ts`, following the exact same null-when-unknown convention as `isOpen24h`/`isOpenWeekends` in the same file. The optional `now` parameter (defaults to `new Date()`) exists purely so tests can pass a fixed instant.

- [ ] **Step 1: Write the failing tests**

Append to `webapp/src/utils/hoursUtils.test.ts` (after the existing `isOpenWeekends` describe block):

```typescript
// ── isOpenNow ────────────────────────────────────────────────────────────────

describe('isOpenNow', () => {
  it('null input → null',      () => expect(isOpenNow(null)).toBeNull())
  it('undefined input → null', () => expect(isOpenNow(undefined)).toBeNull())
  it('empty array → null',     () => expect(isOpenNow([])).toBeNull())

  it('no entry for today → null', () => {
    const monday10am = new Date('2026-07-06T10:00:00') // a Monday
    expect(isOpenNow(['Tuesday: 8:00 AM - 5:00 PM'], monday10am)).toBeNull()
  })

  it('today closed → false', () => {
    const monday10am = new Date('2026-07-06T10:00:00')
    expect(isOpenNow(['Monday: Closed'], monday10am)).toBe(false)
  })

  it('today open 24 hours → true', () => {
    const monday3am = new Date('2026-07-06T03:00:00')
    expect(isOpenNow(['Monday: Open 24 hours'], monday3am)).toBe(true)
  })

  it('within same-day range → true', () => {
    const monday10am = new Date('2026-07-06T10:00:00')
    expect(isOpenNow(['Monday: 8:00 AM - 5:00 PM'], monday10am)).toBe(true)
  })

  it('before same-day range opens → false', () => {
    const monday6am = new Date('2026-07-06T06:00:00')
    expect(isOpenNow(['Monday: 8:00 AM - 5:00 PM'], monday6am)).toBe(false)
  })

  it('after same-day range closes → false', () => {
    const monday7pm = new Date('2026-07-06T19:00:00')
    expect(isOpenNow(['Monday: 8:00 AM - 5:00 PM'], monday7pm)).toBe(false)
  })

  it('overnight range, now after midnight before close → true', () => {
    const monday1am = new Date('2026-07-06T01:00:00')
    expect(isOpenNow(['Monday: 10:00 PM - 2:00 AM'], monday1am)).toBe(true)
  })

  it('overnight range, now in the afternoon → false', () => {
    const monday3pm = new Date('2026-07-06T15:00:00')
    expect(isOpenNow(['Monday: 10:00 PM - 2:00 AM'], monday3pm)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/niki/Documents/saas/medicoordai/webapp && npx vitest run hoursUtils`
Expected: FAIL — `isOpenNow is not a function` / import error

- [ ] **Step 3: Write minimal implementation**

Replace `webapp/src/utils/hoursUtils.ts` entirely with:

```typescript
export function isOpen24h(weekday_hours: string[] | null | undefined): boolean | null {
  if (!weekday_hours || weekday_hours.length === 0) return null
  return weekday_hours.every(h => h.includes('Open 24 hours'))
}

export function isOpenWeekends(weekday_hours: string[] | null | undefined): boolean | null {
  if (!weekday_hours || weekday_hours.length === 0) return null
  const sat = weekday_hours.find(h => h.startsWith('Saturday:'))
  const sun = weekday_hours.find(h => h.startsWith('Sunday:'))
  if (!sat && !sun) return null
  return (sat ? !sat.includes('Closed') : false) || (sun ? !sun.includes('Closed') : false)
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function parseClockTimeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

export function isOpenNow(weekday_hours: string[] | null | undefined, now: Date = new Date()): boolean | null {
  if (!weekday_hours || weekday_hours.length === 0) return null

  const todayName = DAY_NAMES[now.getDay()]
  const todayEntry = weekday_hours.find(h => h.startsWith(`${todayName}:`))
  if (!todayEntry) return null

  const rest = todayEntry.slice(todayName.length + 1).trim()
  if (rest.includes('Closed')) return false
  if (rest.includes('Open 24 hours')) return true

  const [openStr, closeStr] = rest.split(' - ').map(s => s.trim())
  if (!openStr || !closeStr) return null

  const openMin = parseClockTimeToMinutes(openStr)
  const closeMin = parseClockTimeToMinutes(closeStr)
  if (openMin === null || closeMin === null) return null

  const nowMin = now.getHours() * 60 + now.getMinutes()

  if (closeMin > openMin) {
    return nowMin >= openMin && nowMin < closeMin
  }
  // Overnight range (e.g. "10:00 PM - 2:00 AM") — closes after midnight
  return nowMin >= openMin || nowMin < closeMin
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/niki/Documents/saas/medicoordai/webapp && npx vitest run hoursUtils`
Expected: PASS (all `isOpen24h`/`isOpenWeekends`/`isOpenNow` tests)

- [ ] **Step 5: Wire `openNow` into MapPanel.tsx's filter**

In `webapp/src/components/map/MapPanel.tsx`, update the import on line 20:

```typescript
import { isOpen24h, isOpenWeekends, isOpenNow } from '../../utils/hoursUtils'
```

Then update the `displayedFacilities` filter body (this is the same block Task 1 already touched — add the `openNow` check alongside the `waitTime` one):

```typescript
    return list.filter(f => {
      if (openNow      && isOpenNow(f.weekday_hours)      === false) return false
      if (open24h      && isOpen24h(f.weekday_hours)      === false) return false
      if (openWeekends && isOpenWeekends(f.weekday_hours) === false) return false
      if (!meetsWaitTimeFilter(waitTime, f.wait_minutes)) return false
      return true
    })
  }, [facilities, proximity, proximityLoading, proximityResults, distanceMap, categoryFilter, openNow, open24h, openWeekends, waitTime])
```

(Adds the `openNow` check and adds `openNow` to the dependency array.)

- [ ] **Step 6: Run the frontend test suite and typecheck**

Run: `cd /home/niki/Documents/saas/medicoordai/webapp && npm run test && npx tsc -b`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /home/niki/Documents/saas/medicoordai && git add webapp/src/utils/hoursUtils.ts webapp/src/utils/hoursUtils.test.ts webapp/src/components/map/MapPanel.tsx
git commit -m "fix(map): implement isOpenNow and wire dead Open Now filter toggle"
```

---

### Task 3: Stop permanently blacklisting dedup-reused facilities in the scraper's negative cache

**Context:** `workers/scraper.py`'s `build_facility_map` has two branches that call `redis_client.sadd(NEGATIVE_CACHE_KEY, cache_key)`: one for names Google Places genuinely can't resolve (correct — they're really gone), and one for the "dedup-reused" case, where a name fuzzy-fails against `facilities_clean` but Google Places resolves it to a `place_id` that already belongs to an existing facility (this happens because `facilities_clean` lags the `facilities` table by up to ~7 days post-dbt-rebuild, per the existing code comment on `fetch_existing_place_ids`). Blacklisting the dedup-reused case is wrong: it stops that name from ever being re-attempted, so if `facilities_clean` never picks up this particular name variant (the same fuzzy-match miss that required dedup in the first place), that facility's wait time silently stops updating in every future run — forever. There is an existing test, `TestBuildFacilityMapIdempotency.test_reuses_existing_facility_instead_of_recreating` (`workers/tests/test_scraper.py:112-132`), that currently **asserts the buggy behavior** (`redis_client.sadd.assert_called_once_with(...)`) — this task corrects that assertion as part of the fix.

**Files:**
- Modify: `workers/scraper.py` (remove one line in `build_facility_map`)
- Modify: `workers/tests/test_scraper.py` (correct the existing test's assertion)

- [ ] **Step 1: Update the existing test to assert the correct behavior**

In `workers/tests/test_scraper.py`, replace the body of `TestBuildFacilityMapIdempotency.test_reuses_existing_facility_instead_of_recreating` (currently lines 112-132):

```python
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
        # Dedup-reused names must NOT be blacklisted: facilities_clean can lag
        # the facilities table by up to ~7 days post-dbt-rebuild, so this name
        # needs to keep being re-attempted every run until the corpus catches
        # up — blacklisting it here would silently stop this facility's wait
        # time from ever updating again.
        redis_client.sadd.assert_not_called()
```

(Only the final assertion changes, from `assert_called_once_with(scraper.NEGATIVE_CACHE_KEY, "clean name")` to `assert_not_called()`, plus the explanatory comment.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/niki/Documents/saas/medicoordai/workers && doppler run -- pytest tests/test_scraper.py::TestBuildFacilityMapIdempotency -v`
Expected: FAIL — `redis_client.sadd` was in fact called once (current buggy code)

- [ ] **Step 3: Fix the implementation**

In `workers/scraper.py`, inside `build_facility_map`, find the dedup-reused branch:

```python
        place_id = created["google_place_id"]
        if place_id in place_id_to_facility_id:
            facility_map[clean] = place_id_to_facility_id[place_id]
            redis_client.sadd(NEGATIVE_CACHE_KEY, cache_key)
            dedup_reused += 1
            continue
```

Replace it with:

```python
        place_id = created["google_place_id"]
        if place_id in place_id_to_facility_id:
            # Dedup-reused: this name resolves to an existing facility via
            # Places, but facilities_clean hasn't caught up yet (dbt lag).
            # Do NOT blacklist — keep retrying every run so this facility's
            # wait time doesn't silently stop updating if facilities_clean
            # never picks up this specific name variant.
            facility_map[clean] = place_id_to_facility_id[place_id]
            dedup_reused += 1
            continue
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/niki/Documents/saas/medicoordai/workers && doppler run -- pytest tests/test_scraper.py -v`
Expected: PASS (all tests in the file, not just `TestBuildFacilityMapIdempotency` — confirms this change doesn't regress `TestNegativeCache`'s other three tests, which cover the genuinely-unresolvable and transient-error branches that must keep blacklisting/not-blacklisting exactly as before)

- [ ] **Step 5: Commit**

```bash
cd /home/niki/Documents/saas/medicoordai && git add workers/scraper.py workers/tests/test_scraper.py
git commit -m "fix(scraper): stop permanently blacklisting dedup-reused facility names"
```

---

### Task 4: Normalize Unicode in `weekday_hours` for scraper-created facilities

**Context:** `workers/repopulate_facilities_clean.py` has a `_normalize_hours` helper (lines 113-120) that strips Google Places' typographic Unicode (narrow no-break space ` `, thin space ` `, en dash `–`) before storing `weekday_hours`. `workers/scraper.py`'s `resolve_unmatched_facility` independently reimplements the same Places lookup but skips this step — `weekday_hours: json.dumps(details.get("opening_hours", {}).get("weekday_text", []))` at the end of that function stores the raw Google text. `repopulate_facilities_clean.py` is a local-only, gitignored recovery script (not deployed to Railway), so the fix cannot import it — the normalization must be duplicated directly in `scraper.py`.

**Files:**
- Modify: `workers/scraper.py` (add `_normalize_hours`, use it in `resolve_unmatched_facility`)
- Modify: `workers/tests/test_scraper.py` (add `import json`, add a regression test)

- [ ] **Step 1: Write the failing test**

In `workers/tests/test_scraper.py`, add `import json` to the top of the file (after the existing `import logging` on line 1):

```python
import json
import logging
import os
import sys
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import scraper
```

Then add a new test method to `TestResolveUnmatchedFacility` (after `test_network_error_raises_transient_lookup_error`, around what is currently line 75):

```python
    @patch("scraper.requests.get")
    def test_normalizes_typographic_unicode_in_weekday_hours(self, mock_get):
        search_resp = MagicMock(status_code=200)
        search_resp.raise_for_status = lambda: None
        search_resp.json = lambda: {"candidates": [{"place_id": "place-1"}]}

        details_resp = MagicMock(status_code=200)
        details_resp.raise_for_status = lambda: None
        details_resp.json = lambda: {
            "result": {
                "name": "Test Hospital",
                "formatted_address": "123 Main St, Toronto, ON",
                "formatted_phone_number": "555-1234",
                "opening_hours": {"weekday_text": ["Monday: 9:00 AM – 5:00 PM"]},
                "business_status": "OPERATIONAL",
                "geometry": {"location": {"lat": 43.70, "lng": -79.40}},
            }
        }
        mock_get.side_effect = [search_resp, details_resp]

        result = scraper.resolve_unmatched_facility("Test Hospital")

        assert result is not None
        hours = json.loads(result["weekday_hours"])
        assert hours == ["Monday: 9:00 AM - 5:00 PM"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/niki/Documents/saas/medicoordai/workers && doppler run -- pytest tests/test_scraper.py::TestResolveUnmatchedFacility::test_normalizes_typographic_unicode_in_weekday_hours -v`
Expected: FAIL — `assert ['Monday: 9:00 AM – 5:00 PM'] == ['Monday: 9:00 AM - 5:00 PM']`

- [ ] **Step 3: Write minimal implementation**

In `workers/scraper.py`, add a `_normalize_hours` function. Place it near `clean_hospital_name` (in the "Name normalisation" section, after that function):

```python
def _normalize_hours(entries: list[str]) -> list[str]:
    """Strip Google Places API typographic Unicode before storage (mirrors
    workers/repopulate_facilities_clean.py's normalization so weekday_hours
    is consistent regardless of which script created the facility)."""
    return [
        s.replace(' ', ' ')   # narrow no-break space
         .replace(' ', ' ')   # thin space
         .replace('–', '-')   # en dash
        for s in entries
    ]
```

Then in `resolve_unmatched_facility`, find the return statement's `weekday_hours` line:

```python
        "weekday_hours": json.dumps(details.get("opening_hours", {}).get("weekday_text", [])),
```

Replace it with:

```python
        "weekday_hours": json.dumps(_normalize_hours(details.get("opening_hours", {}).get("weekday_text", []))),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/niki/Documents/saas/medicoordai/workers && doppler run -- pytest tests/test_scraper.py -v`
Expected: PASS (full file — confirms `import json` addition didn't break anything else)

- [ ] **Step 5: Commit**

```bash
cd /home/niki/Documents/saas/medicoordai && git add workers/scraper.py workers/tests/test_scraper.py
git commit -m "fix(scraper): normalize weekday_hours Unicode for scraper-created facilities"
```

---

### Task 5: Handle malformed GoTrue auth responses instead of raising an unhandled 500

**Context:** `backend/services/auth.py`'s `verify_token` catches `requests.HTTPError`/`requests.RequestException` around the Supabase GoTrue call, but the line after that try/except block, `if not data.get("id"):`, runs unguarded — if GoTrue ever returns HTTP 200 with a body that isn't a dict (e.g. a list, or `null`), `.get` raises `AttributeError`, which isn't caught here, and `backend/middleware/auth.py`'s `dispatch` only catches `HTTPException` (`middleware/auth.py:29`) — so the `AttributeError` propagates as a raw, unhandled 500 instead of the existing 401 "invalid token" path.

**Files:**
- Modify: `backend/services/auth.py:25`
- Modify: `backend/tests/test_auth_service.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_auth_service.py`'s `TestVerifyToken` class (after `test_response_missing_id_raises_401`, currently ending at line 30):

```python
    @patch("services.auth.supabase_auth_get_user")
    def test_non_dict_response_raises_401(self, mock_get_user):
        mock_get_user.return_value = ["unexpected", "list", "response"]

        with pytest.raises(HTTPException) as exc_info:
            verify_token("weird-token")
        assert exc_info.value.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/niki/Documents/saas/medicoordai/backend && doppler run -- pytest tests/test_auth_service.py::TestVerifyToken::test_non_dict_response_raises_401 -v`
Expected: FAIL with `AttributeError: 'list' object has no attribute 'get'` (not the expected `HTTPException`)

- [ ] **Step 3: Write minimal implementation**

In `backend/services/auth.py`, replace:

```python
    if not data.get("id"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

with:

```python
    if not isinstance(data, dict) or not data.get("id"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/niki/Documents/saas/medicoordai/backend && doppler run -- pytest tests/test_auth_service.py -v`
Expected: PASS (full file)

- [ ] **Step 5: Commit**

```bash
cd /home/niki/Documents/saas/medicoordai && git add backend/services/auth.py backend/tests/test_auth_service.py
git commit -m "fix(auth): treat non-dict GoTrue response as invalid token instead of crashing"
```

---

### Task 6: Make wait-time Redis-hash parsing resilient to one malformed entry

**Context:** `backend/services/wait_times.py`'s `get_wait_minutes_map` parses the Redis hash via a single dict comprehension: `{fid: json.loads(v).get("wait_minutes") for fid, v in raw.items()}`. Comprehensions evaluate eagerly, so if any single facility's stored value is malformed (not valid JSON), the whole comprehension raises, the surrounding `except Exception` catches it, and the function falls back to the Supabase RPC for the **entire** request — discarding every other facility's perfectly good wait-time data for one bad entry.

**Files:**
- Modify: `backend/services/wait_times.py:16-33`
- Modify: `backend/tests/test_wait_times.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_wait_times.py`'s `TestGetWaitMinutesMap` class (after `test_redis_hit_returns_parsed_wait_minutes`, currently ending at line 23):

```python
    @patch("services.wait_times.redis_client")
    def test_one_malformed_entry_does_not_discard_others(self, mock_redis):
        mock_redis.hgetall.return_value = {
            "fac-1": json.dumps({"wait_minutes": 12, "source": "erstat"}),
            "fac-2": "not-valid-json{{{",
            "fac-3": json.dumps({"wait_minutes": 40, "source": "hlwiw"}),
        }

        result = get_wait_minutes_map()

        assert result == {"fac-1": 12, "fac-3": 40}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/niki/Documents/saas/medicoordai/backend && doppler run -- pytest tests/test_wait_times.py::TestGetWaitMinutesMap::test_one_malformed_entry_does_not_discard_others -v`
Expected: FAIL — result falls back to `{}` (or whatever the Supabase mock isn't even set up to return, likely erroring), not `{"fac-1": 12, "fac-3": 40}`

- [ ] **Step 3: Write minimal implementation**

Replace `get_wait_minutes_map` in `backend/services/wait_times.py` (currently lines 16-56) entirely:

```python
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
        return wait_map

    try:
        rows = supabase_rpc("latest_wait_times", {})
    except Exception:
        logger.warning("wait_times_fallback_failed_returning_empty")
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

    return wait_map
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/niki/Documents/saas/medicoordai/backend && doppler run -- pytest tests/test_wait_times.py -v`
Expected: PASS (full file — confirms the cold-start/double-failure/writeback-shape tests in the other classes in this file are unaffected)

- [ ] **Step 5: Commit**

```bash
cd /home/niki/Documents/saas/medicoordai && git add backend/services/wait_times.py backend/tests/test_wait_times.py
git commit -m "fix(wait-times): parse Redis hash entries independently, don't discard good data on one bad entry"
```

---

### Task 7: Stop a transient Supabase failure from blocking the scraper's Redis publish

**Context:** `workers/scraper.py`'s `main()` calls `insert_wait_times(...)` before `update_redis(...)`, with no exception handling around either call. `insert_wait_times` calls `r.raise_for_status()` on the Supabase POST — a transient Supabase error (e.g. a 503) raises `requests.HTTPError`, which propagates out of `main()` uncaught and crashes the process before `update_redis` ever runs, even though the Redis write has no dependency on the Supabase insert succeeding (the `records` list is already fully built in memory).

**Files:**
- Modify: `workers/scraper.py` (the `main()` function's publish step)
- Modify: `workers/tests/test_scraper.py` (new `TestMain` class)

- [ ] **Step 1: Write the failing test**

Add a new class to `workers/tests/test_scraper.py` (at the end of the file, after `TestInsertNewFacilitiesPayloadShape`):

```python
class TestMainPublishIsolation:
    @patch("scraper.update_redis")
    @patch("scraper.insert_wait_times", side_effect=scraper.requests.HTTPError("supabase 503"))
    @patch("scraper.consolidate", return_value=[{"facility_id": "f1", "wait_minutes": 10}])
    @patch("scraper.build_facility_map", return_value={"clean": "f1"})
    @patch("scraper.scrape_howlongwilliwait", return_value={"clean": {"wait_minutes": 10, "raw_wait": "10 min"}})
    @patch("scraper.scrape_erstat", return_value={})
    @patch("scraper.fetch_db_facilities", return_value={"clean": "f1"})
    @patch("scraper.redis.from_url")
    def test_supabase_insert_failure_does_not_prevent_redis_update(
        self, mock_from_url, mock_fetch_db, mock_erstat, mock_hlwiw,
        mock_build_map, mock_consolidate, mock_insert, mock_update_redis,
    ):
        mock_redis_client = MagicMock()
        mock_from_url.return_value = mock_redis_client

        scraper.main()  # must not raise, despite insert_wait_times raising

        mock_update_redis.assert_called_once_with(mock_redis_client, [{"facility_id": "f1", "wait_minutes": 10}])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/niki/Documents/saas/medicoordai/workers && doppler run -- pytest tests/test_scraper.py::TestMainPublishIsolation -v`
Expected: FAIL — `scraper.main()` raises `requests.HTTPError` instead of completing, so `update_redis` is never called

- [ ] **Step 3: Write minimal implementation**

In `workers/scraper.py`'s `main()`, find:

```python
    # 5. Publish
    insert_wait_times(SUPABASE_URL, SUPABASE_HEADERS, records)
    update_redis(redis_client, records)
```

Replace it with:

```python
    # 5. Publish — Redis and Supabase are independent sinks; a failure in
    # one must not prevent the other from receiving already-scraped data.
    try:
        insert_wait_times(SUPABASE_URL, SUPABASE_HEADERS, records)
    except requests.RequestException as e:
        log.error("Supabase insert failed, continuing to Redis publish: %s", e)

    update_redis(redis_client, records)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/niki/Documents/saas/medicoordai/workers && doppler run -- pytest tests/test_scraper.py -v`
Expected: PASS (full file)

- [ ] **Step 5: Commit**

```bash
cd /home/niki/Documents/saas/medicoordai && git add workers/scraper.py workers/tests/test_scraper.py
git commit -m "fix(scraper): isolate Supabase insert failure from Redis publish in main()"
```

---

### Task 8: Offload blocking Redis/HTTP calls in async route handlers to a threadpool

**Context:** `backend/main.py`'s `facilities()` and `facilities_nearby()` are `async def` FastAPI route handlers that call blocking synchronous I/O directly: `get_wait_minutes_map()` (which does a blocking `redis-py` `hgetall` and, on its fallback path, a blocking `requests.post`) and, in `facilities_nearby`, `supabase_rpc(...)` (also blocking `requests.post`). Neither call is awaited or offloaded — each blocks the single asyncio event loop for its full duration, serializing every other concurrent request on that worker. `starlette.concurrency.run_in_threadpool` (already a transitive FastAPI/Starlette dependency — no new package needed) offloads a sync callable to a thread and returns an awaitable.

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_facilities_routes.py`

**Interfaces:**
- Consumes: `starlette.concurrency.run_in_threadpool(func, *args, **kwargs) -> Awaitable[Any]` (Starlette built-in).

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_facilities_routes.py`, a new class at the end of the file:

```python
class TestFacilitiesRouteUsesThreadpool:
    async def _run_inline(self, fn, *args, **kwargs):
        return fn(*args, **kwargs)

    def test_wait_minutes_map_call_is_offloaded_to_threadpool(self):
        fake_data = [{"id": "a", "category": "hospital", "accepted_severity": ["urgent"]}]
        with patch("main.get_cached_facilities", return_value=(fake_data, None)), \
             patch("main.get_wait_minutes_map", return_value={"a": 10}) as mock_get_wait, \
             patch("main.run_in_threadpool", side_effect=self._run_inline) as mock_threadpool:
            request = type("FakeRequest", (), {"headers": {}})()
            asyncio.run(main.facilities(request))

        mock_threadpool.assert_any_call(mock_get_wait)

    def test_nearby_rpc_call_is_offloaded_to_threadpool(self):
        fake_rows = [{"facility_id": "a", "distance_m": 100}]
        with patch("main.supabase_rpc", return_value=fake_rows) as mock_rpc, \
             patch("main.get_wait_minutes_map", return_value={"a": 10}), \
             patch("main.run_in_threadpool", side_effect=self._run_inline) as mock_threadpool:
            asyncio.run(main.facilities_nearby(lat=43.6, lng=-79.4))

        mock_threadpool.assert_any_call(
            mock_rpc,
            "nearby_facilities",
            {
                "user_lat": 43.6, "user_lng": -79.4, "radius_m": 5000,
                "facility_types": None, "result_limit": 50,
            },
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/niki/Documents/saas/medicoordai/backend && doppler run -- pytest tests/test_facilities_routes.py::TestFacilitiesRouteUsesThreadpool -v`
Expected: FAIL — `AttributeError: <module 'main'> does not have the attribute 'run_in_threadpool'` (not imported yet)

- [ ] **Step 3: Write minimal implementation**

In `backend/main.py`, add the import (near the other FastAPI imports, after line 9's `from prometheus_client import ...`):

```python
from starlette.concurrency import run_in_threadpool
```

Then update `facilities()` (currently `main.py:105`):

```python
    wait_map = get_wait_minutes_map()
```

to:

```python
    wait_map = await run_in_threadpool(get_wait_minutes_map)
```

And update `facilities_nearby()` (currently `main.py:127-142`) — replace the whole function body:

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
        data = await run_in_threadpool(
            supabase_rpc,
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

    wait_map = await run_in_threadpool(get_wait_minutes_map)
    return apply_wait_filter(data, "facility_id", max_wait_minutes, wait_map)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/niki/Documents/saas/medicoordai/backend && doppler run -- pytest tests/test_facilities_routes.py -v`
Expected: PASS (full file — confirms the pre-existing `TestFacilitiesRoute`, `TestFacilitiesNearbyRoute`, and `TestFacilitiesNearbyAsgiStack` classes still pass unchanged, since `run_in_threadpool` just proxies to the already-mocked functions)

- [ ] **Step 5: Commit**

```bash
cd /home/niki/Documents/saas/medicoordai && git add backend/main.py backend/tests/test_facilities_routes.py
git commit -m "fix(api): offload blocking Redis/Supabase calls to threadpool in async route handlers"
```

---

### Task 9: Deduplicate the proximity-radius option list between MapPanel and useProximitySearch

**Context:** `webapp/src/hooks/useProximitySearch.ts`'s `RADIUS_MAP` includes a `'50 km'` entry that no dropdown option in `MapPanel.tsx` ever selects (the dropdown only offers `'all' | '10 km' | '25 km' | '50+ km'`), and the two lists are kept in sync only by a code comment. This is a static-data extraction with no logic change, so per the "no test needed for trivial one-liners" rule, no new test is added — the existing `TestFacilitiesNearbyRoute`/ASGI tests and a manual click-through cover the actual behavior.

**Files:**
- Create: `webapp/src/components/map/config/proximity.ts`
- Modify: `webapp/src/hooks/useProximitySearch.ts`
- Modify: `webapp/src/components/map/MapPanel.tsx`

**Interfaces:**
- Produces: `PROXIMITY_OPTIONS: { value: string; label: string; radiusM: number }[]`, exported from `webapp/src/components/map/config/proximity.ts`.

- [ ] **Step 1: Create the shared constant**

Create `webapp/src/components/map/config/proximity.ts`:

```typescript
export interface ProximityOption {
  value:   string
  label:   string
  radiusM: number
}

export const PROXIMITY_OPTIONS: ProximityOption[] = [
  { value: '10 km',  label: '10 km',  radiusM: 10000 },
  { value: '25 km',  label: '25 km',  radiusM: 25000 },
  { value: '50+ km', label: '50+ km', radiusM: 50000 },
]
```

- [ ] **Step 2: Use it in useProximitySearch.ts**

In `webapp/src/hooks/useProximitySearch.ts`, replace the top of the file (currently lines 1-12):

```typescript
import { useState, useEffect } from 'react'
import type { NearbyFacility, UserAnchor } from '../../../shared/types'
import { PROXIMITY_OPTIONS } from '../components/map/config/proximity'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
```

Then replace the `radiusM` lookup (currently `const radiusM = RADIUS_MAP[proximity]`, line 29):

```typescript
  const radiusM = PROXIMITY_OPTIONS.find(opt => opt.value === proximity)?.radiusM
```

- [ ] **Step 3: Use it in MapPanel.tsx's dropdown**

In `webapp/src/components/map/MapPanel.tsx`, add the import (near the other config imports, after line 13's `import { type CategoryFilter, FILTER_OPTIONS } from './config/categories'`):

```typescript
import { PROXIMITY_OPTIONS } from './config/proximity'
```

Then replace the hardcoded dropdown option array (currently `MapPanel.tsx:504-508`):

```typescript
                  {[
                    { value: 'all', label: 'All distances' },
                    { value: '10 km', label: '10 km' },
                    { value: '25 km', label: '25 km' },
                    { value: '50+ km', label: '50+ km' },
                  ].map(opt => (
```

with:

```typescript
                  {[
                    { value: 'all', label: 'All distances' },
                    ...PROXIMITY_OPTIONS,
                  ].map(opt => (
```

- [ ] **Step 4: Run typecheck**

Run: `cd /home/niki/Documents/saas/medicoordai/webapp && npx tsc -b`
Expected: PASS (no type errors)

- [ ] **Step 5: Run the full frontend test suite**

Run: `cd /home/niki/Documents/saas/medicoordai/webapp && npm run test`
Expected: PASS (confirms nothing in Tasks 1/2 regressed)

- [ ] **Step 6: Commit**

```bash
cd /home/niki/Documents/saas/medicoordai && git add webapp/src/components/map/config/proximity.ts webapp/src/hooks/useProximitySearch.ts webapp/src/components/map/MapPanel.tsx
git commit -m "chore(map): deduplicate proximity radius options into a shared constant"
```

---

## Final verification (after all 9 tasks)

- [ ] Run the full backend suite: `cd /home/niki/Documents/saas/medicoordai/backend && doppler run -- pytest -v`
- [ ] Run the full worker suite: `cd /home/niki/Documents/saas/medicoordai/workers && doppler run -- pytest -v`
- [ ] Run the full frontend suite + typecheck: `cd /home/niki/Documents/saas/medicoordai/webapp && npm run test && npx tsc -b`
- [ ] `git log --oneline -9` shows exactly 9 new commits, one per task, none pushed (`git status` shows the branch ahead of `origin/preview` by 9 commits, working tree clean)
- [ ] Do **not** push and do **not** merge PR #29 — hand back to the user for final review first
