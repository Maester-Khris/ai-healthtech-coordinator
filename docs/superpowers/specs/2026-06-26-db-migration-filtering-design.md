# Sprint 14 — DB Migration + Filtering
**Date:** 2026-06-26  
**Branch:** `feat/advanced-filtering`  
**Status:** Approved for implementation

---

## Problem

The backend queries the old `facilities` table and returns 7 columns. The dbt-cleaned `facilities_clean` table (Sprint 12) has richer data — phone, business hours, operational status — none of which reaches the frontend. The facility popup shows hardcoded hours. Permanently closed facilities appear on the map.

---

## Scope

Two concerns delivered together in this sprint:

1. **DB migration** — switch backend to `facilities_clean`, expose new fields in the API response
2. **Popup enrichment + new filters** — frontend shows real hours and phone; two new additive toggle chips

Out of scope: search orchestrator (see `docs/search-orchestrator-design.md`), "open now" / time-based filters, ER wait times, Redis layer.

---

## Data Available in `facilities_clean`

Relevant new columns vs old `facilities` table:

| Column | Type | Use |
|---|---|---|
| `facility_id` | uuid | Aliased as `id` in API response |
| `facility_name` | text | Aliased as `name` in API response |
| `phone` | text \| null | Show in popup |
| `business_status` | text | `OPERATIONAL` \| `CLOSED_PERMANENTLY` — silent filter |
| `is_operational` | boolean | Silent always-on filter |
| `weekday_hours` | text (JSON array as text) | Hours display + two client-side filters |

Column aliasing (`facility_name as name`, `facility_id as id`) keeps the API contract stable — no frontend field renames required.

### `weekday_hours` data shape

Text array stored as JSON string, parsed at use:
```
["Monday: 8:30 AM - 7:00 PM", "Tuesday: 8:30 AM - 7:00 PM", ..., "Sunday: 8:30 AM - 7:00 PM"]
```
Variants observed: `"Open 24 hours"`, `"Closed"`, empty array `[]` (no Google data).

---

## Backend

### `services/facilities.py`

- Table: `facilities` → `facilities_clean`
- SELECT: `facility_id as id, facility_name as name, category, source_facility_type, accepted_severity, address, lat, lng, phone, business_status, weekday_hours`
- Always-on filter: `.eq("is_operational", True)` — permanently closed facilities are never returned
- Existing `category` and `severity` query-param filters are preserved unchanged
- Cache warm-up in `main.py` lifespan unchanged

### `models.py` — `Facility` Pydantic model

Add nullable fields:
- `phone: str | None = None`
- `business_status: str | None = None`
- `weekday_hours: list[str] | None = None`

### `main.py`

No changes.

---

## Shared Types

### `shared/types.ts` — `Facility` interface

Add three optional nullable fields:
```typescript
phone?:           string | null
business_status?: string | null
weekday_hours?:   string[] | null
```

`name` and `id?` stay unchanged — aliased at DB layer.

---

## Frontend

### New utility: `webapp/src/utils/hoursUtils.ts`

Two pure functions, no external dependencies:

```typescript
// true = confirmed 24h, false = confirmed not, null = unknown (empty/missing array)
export function isOpen24h(weekday_hours: string[] | null | undefined): boolean | null

// true = confirmed open weekends, false = confirmed not, null = unknown
export function isOpenWeekends(weekday_hours: string[] | null | undefined): boolean | null
```

**`isOpen24h` logic:** If array is empty/null → `null`. All present entries contain the substring `"Open 24 hours"` → `true`. Otherwise `false`. (Some facilities return fewer than 7 entries — only present entries are checked.)

**`isOpenWeekends` logic:** If array is empty/null → `null`. Saturday and Sunday entries exist and neither contains `"Closed"` → `true`. Otherwise `false`.

**Filter behaviour when result is `null` (unknown hours):**  
Facilities with no hours data always pass any active hours filter — shown in popup with "Hours unavailable" label. They are never hidden solely due to missing data.

### `UnifiedFacilityPopup.tsx`

Replace hardcoded hours string with real data. New rows (only rendered when data present):

- **Phone** — if `phone` is non-null, show as a `tel:` link
- **Hours** — if `weekday_hours` is non-empty, show today's hours entry (day matched by `new Date().getDay()`); if empty/null, show "Hours unavailable"

No layout restructuring — same card, additional rows below address.

### Filter state — two additive toggle chips

**State location:** `MapPanel.tsx` — new `Set<HoursFilter>` state alongside existing category state.

**Type (added to `categories.ts`):**
```typescript
export type HoursFilter = "open_24h" | "open_weekends"
```

**Application:** Facility passes the combined filter if:
1. Category filter matches (existing logic, untouched)
2. All active `HoursFilter` chips pass — using `isOpen24h` / `isOpenWeekends`, with `null` always passing

**UI:** Row of 2 small toggle pills rendered below the existing `CategoryFilterDropdown`. Labels: "Open 24/7", "Open weekends". Active state = filled; inactive = outlined. Same visual palette as existing map controls. Touch-friendly tap target.

**`CategoryFilterDropdown`, `FILTER_OPTIONS`, `categories.ts` existing content:** Untouched.

---

## Smoke Test

Run after starting the local backend:

```bash
source /home/niki/Documents/workenv/pydev/bin/activate
doppler run -- uvicorn backend.main:app --reload &
sleep 3
curl -s http://localhost:8000/facilities | python3 -c "
import json, sys
data = json.load(sys.stdin)
closed = [f for f in data if f.get('business_status') == 'CLOSED_PERMANENTLY']
no_phone_key = [f for f in data if 'phone' not in f]
no_hours_key = [f for f in data if 'weekday_hours' not in f]
no_id = [f for f in data if 'id' not in f]
assert not closed, f'closed facilities leaked: {len(closed)}'
assert not no_phone_key, 'phone field missing from response'
assert not no_hours_key, 'weekday_hours field missing from response'
assert not no_id, 'id field missing from response'
sample = data[0]
print(f'PASS — {len(data)} facilities')
print(f'  sample name: {sample[\"name\"]}')
print(f'  phone: {sample.get(\"phone\")}')
print(f'  business_status: {sample.get(\"business_status\")}')
print(f'  weekday_hours[0]: {(sample.get(\"weekday_hours\") or [\"(empty)\"])[0]}')
"
kill %1 2>/dev/null
```

Expected: all assertions pass, sample output shows real phone and hours data.

---

## What Is Not Built Here

| Item | Reason |
|---|---|
| "Open now" filter | Requires timezone-aware time parsing + DST — deferred |
| "Open after 5PM / 9AM" filter | Same complexity — deferred |
| Search orchestrator (Layer 0–3) | Separate design doc, future sprint |
| ER wait times / Redis layer | Sprint 12 carry-over, separate track |
| `source_facility_type` filter | Low user value at this stage |
