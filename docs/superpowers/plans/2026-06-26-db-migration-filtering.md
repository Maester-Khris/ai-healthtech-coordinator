# DB Migration + Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the backend from `facilities` to `facilities_clean`, expose phone/hours/status in the API, and wire two new additive filter chips ("Open 24/7", "Open weekends") in the map UI — leaving all existing static filters untouched.

**Architecture:** Backend queries `facilities_clean`, always filters `is_operational=true` silently, aliases `facility_id→id` and `facility_name→name` to preserve the API contract. Frontend gains a pure hours-parsing utility; popup shows real data; two new toggle chips filter client-side using that utility, with null (unknown hours) always passing.

**Tech Stack:** Python 3.11 / FastAPI / Supabase-py · React 18 / TypeScript strict / Tailwind · `npx tsx` for utility tests (no framework installed)

## Global Constraints

- Always activate pydev before any Python command: `source /home/niki/Documents/workenv/pydev/bin/activate`
- Always inject env vars: `doppler run -- <command>`
- Never hardcode secrets
- TypeScript: strict mode, no `any`
- Commit style: conventional commits, no co-author trailer, one commit per task
- Never commit to `main` or `preview`
- Column aliasing keeps API field names as `name` and `id` — do NOT rename fields in `shared/types.ts`
- `weekday_hours` arrives from Supabase as a JSON string (text column); backend must parse it to `list[str]` before returning
- Existing `FILTER_OPTIONS`, `CategoryFilterDropdown`, `openNow`/`waitTime`/`proximity` states in MapPanel are untouched

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/services/facilities.py` | Modify | Switch table, add columns, is_operational filter, weekday_hours parsing |
| `backend/models.py` | Modify | Add nullable fields to Facility Pydantic model |
| `shared/types.ts` | Modify | Add `phone`, `business_status`, `weekday_hours` to Facility interface |
| `webapp/src/utils/hoursUtils.ts` | Create | `isOpen24h`, `isOpenWeekends` pure functions |
| `webapp/src/utils/hoursUtils.test.ts` | Create | Self-contained assertion tests, run with `npx tsx` |
| `webapp/src/components/map/components/UnifiedFacilityPopup.tsx` | Modify | Show real phone, today's hours, "Hours unavailable" fallback |
| `webapp/src/components/map/components/FacilityMarkerLayer.tsx` | Modify | Pass `phone` and `weekday_hours` props to popup |
| `webapp/src/components/map/MapPanel.tsx` | Modify | Two new filter states + extended displayedFacilities + two new chips |

---

### Task 1: Backend DB Migration + Shared Types Contract

**Files:**
- Modify: `backend/services/facilities.py`
- Modify: `backend/models.py`
- Modify: `shared/types.ts`

**Interfaces:**
- Produces: `GET /facilities` response now includes `phone: string|null`, `business_status: string`, `weekday_hours: string[]` on every facility; `is_operational=false` facilities never appear

---

- [ ] **Step 1: Update `backend/services/facilities.py`**

Replace the entire file content:

```python
import json as json_lib
import logging
from fastapi import HTTPException
from db import get_supabase_client

logger = logging.getLogger(__name__)


def get_all_facilities(
    category: str | None = None,
    severity: str | None = None,
) -> list[dict]:
    try:
        client = get_supabase_client()
        query = client.table("facilities_clean").select(
            "id:facility_id, name:facility_name, category, source_facility_type, "
            "accepted_severity, address, lat, lng, phone, business_status, weekday_hours"
        ).eq("is_operational", True)

        if category is not None:
            query = query.eq("category", category)
        if severity is not None:
            query = query.contains("accepted_severity", [severity])

        response = query.execute()

        # weekday_hours is a text column storing a JSON array string; parse it
        for f in response.data:
            wh = f.get("weekday_hours")
            if isinstance(wh, str):
                try:
                    f["weekday_hours"] = json_lib.loads(wh)
                except (ValueError, TypeError):
                    f["weekday_hours"] = []
            elif wh is None:
                f["weekday_hours"] = []

        return response.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error("supabase_query_failed", extra={"error_type": type(e).__name__})
        raise HTTPException(status_code=503, detail="Database unavailable")
```

- [ ] **Step 2: Update `backend/models.py` — add nullable fields to `Facility`**

Find the `Facility` class (lines 20-31) and add three fields after `updated_at`:

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
```

- [ ] **Step 3: Update `shared/types.ts` — extend `Facility` interface**

Add three optional fields to the `Facility` interface (after `updated_at?`):

```typescript
export interface Facility {
  name:                 string;
  category:             FacilityCategory;
  source_facility_type: string;
  accepted_severity:    Severity[];
  address:              string;
  lat:                  number;
  lng:                  number;
  id?:                  string;
  source?:              string;
  created_at?:          string;
  updated_at?:          string;
  phone?:               string | null;
  business_status?:     string | null;
  weekday_hours?:       string[] | null;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/niki/Documents/saas/medicoordai/webapp
npm run build -- --noEmit 2>&1 | tail -5
# or
tsc -b 2>&1 | tail -10
```

Expected: no errors related to `Facility` type.

- [ ] **Step 5: Smoke-test the backend against real Supabase**

```bash
source /home/niki/Documents/workenv/pydev/bin/activate
cd /home/niki/Documents/saas/medicoordai
doppler run -- uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
sleep 4
curl -s http://localhost:8000/facilities | python3 -c "
import json, sys
data = json.load(sys.stdin)
closed = [f for f in data if f.get('business_status') == 'CLOSED_PERMANENTLY']
no_phone = [f for f in data if 'phone' not in f]
no_hours = [f for f in data if 'weekday_hours' not in f]
no_id    = [f for f in data if 'id' not in f]
no_name  = [f for f in data if 'name' not in f]
assert not closed,   f'FAIL: {len(closed)} closed facilities leaked'
assert not no_phone, f'FAIL: phone field missing from {len(no_phone)} records'
assert not no_hours, f'FAIL: weekday_hours field missing from {len(no_hours)} records'
assert not no_id,    f'FAIL: id field missing from {len(no_id)} records'
assert not no_name,  f'FAIL: name field missing from {len(no_name)} records'
sample = data[0]
assert isinstance(sample['weekday_hours'], list), f'FAIL: weekday_hours is not a list: {type(sample[\"weekday_hours\"])}'
print(f'PASS — {len(data)} facilities returned')
print(f'  name:           {sample[\"name\"]}')
print(f'  phone:          {sample.get(\"phone\")}')
print(f'  business_status:{sample.get(\"business_status\")}')
print(f'  weekday_hours:  {sample.get(\"weekday_hours\", [])[:1]}')
"
kill %1 2>/dev/null
```

Expected output: `PASS — N facilities returned` with real name, phone, hours printed.

- [ ] **Step 6: Commit**

```bash
git add backend/services/facilities.py backend/models.py shared/types.ts
git commit -m "feat: switch backend to facilities_clean, expose phone/hours/status"
```

---

### Task 2: Hours Utility (TDD)

**Files:**
- Create: `webapp/src/utils/hoursUtils.ts`
- Create: `webapp/src/utils/hoursUtils.test.ts`

**Interfaces:**
- Produces:
  - `isOpen24h(weekday_hours: string[] | null | undefined): boolean | null`
    - `null` = unknown (empty/missing array)
    - `true` = all present entries contain `"Open 24 hours"`
    - `false` = at least one entry does not contain `"Open 24 hours"`
  - `isOpenWeekends(weekday_hours: string[] | null | undefined): boolean | null`
    - `null` = unknown (no Saturday or Sunday entries found)
    - `true` = at least one weekend day entry is present and not `"Closed"`
    - `false` = all present weekend day entries contain `"Closed"`
- Consumed by: Task 4 (`MapPanel.tsx`)

---

- [ ] **Step 1: Create `webapp/src/utils/hoursUtils.test.ts`**

```typescript
import assert from 'node:assert/strict'

// Inline the implementations to keep this self-contained for first run
function isOpen24h(weekday_hours: string[] | null | undefined): boolean | null {
  if (!weekday_hours || weekday_hours.length === 0) return null
  return weekday_hours.every(h => h.includes('Open 24 hours'))
}

function isOpenWeekends(weekday_hours: string[] | null | undefined): boolean | null {
  if (!weekday_hours || weekday_hours.length === 0) return null
  const sat = weekday_hours.find(h => h.startsWith('Saturday:'))
  const sun = weekday_hours.find(h => h.startsWith('Sunday:'))
  if (!sat && !sun) return null
  return (sat ? !sat.includes('Closed') : false) || (sun ? !sun.includes('Closed') : false)
}

// ── isOpen24h ────────────────────────────────────────────────────────────────

assert.equal(isOpen24h(null), null, 'null input → null')
assert.equal(isOpen24h(undefined), null, 'undefined input → null')
assert.equal(isOpen24h([]), null, 'empty array → null')

const allDay = [
  'Monday: Open 24 hours', 'Tuesday: Open 24 hours', 'Wednesday: Open 24 hours',
  'Thursday: Open 24 hours', 'Friday: Open 24 hours', 'Saturday: Open 24 hours',
  'Sunday: Open 24 hours',
]
assert.equal(isOpen24h(allDay), true, 'all 7 days 24h → true')
assert.equal(isOpen24h(['Monday: Open 24 hours']), true, 'single 24h entry → true')

const mixed = ['Monday: 8:00 AM - 5:00 PM', 'Tuesday: Open 24 hours']
assert.equal(isOpen24h(mixed), false, 'mixed hours → false')

const weekdays = ['Monday: 8:00 AM - 5:00 PM', 'Friday: 8:00 AM - 5:00 PM', 'Saturday: Closed', 'Sunday: Closed']
assert.equal(isOpen24h(weekdays), false, 'regular hours → false')

// ── isOpenWeekends ───────────────────────────────────────────────────────────

assert.equal(isOpenWeekends(null), null, 'null input → null')
assert.equal(isOpenWeekends([]), null, 'empty array → null')

const noWeekend = ['Monday: 8:00 AM - 5:00 PM', 'Friday: 8:00 AM - 5:00 PM']
assert.equal(isOpenWeekends(noWeekend), null, 'no weekend entries → null')

const bothOpen = [
  'Monday: 8:00 AM - 5:00 PM',
  'Saturday: 9:00 AM - 5:00 PM',
  'Sunday: 10:00 AM - 4:00 PM',
]
assert.equal(isOpenWeekends(bothOpen), true, 'both weekend days open → true')

const satOnly = ['Saturday: 9:00 AM - 5:00 PM']
assert.equal(isOpenWeekends(satOnly), true, 'only Saturday open → true')

const bothClosed = [
  'Monday: 8:00 AM - 5:00 PM',
  'Saturday: Closed',
  'Sunday: Closed',
]
assert.equal(isOpenWeekends(bothClosed), false, 'both weekend days closed → false')

const satOpenSunClosed = ['Saturday: 9:00 AM - 5:00 PM', 'Sunday: Closed']
assert.equal(isOpenWeekends(satOpenSunClosed), true, 'Sat open Sun closed → true (open on at least one)')

const open24hWeekend = ['Saturday: Open 24 hours', 'Sunday: Open 24 hours']
assert.equal(isOpenWeekends(open24hWeekend), true, '24h weekend entries → true')

console.log('All hoursUtils tests passed ✓')
```

- [ ] **Step 2: Run test — expect failure (function not defined)**

```bash
cd /home/niki/Documents/saas/medicoordai
npx tsx webapp/src/utils/hoursUtils.test.ts
```

Expected: `ReferenceError` or `AssertionError` — tests are currently running against inline stubs, so they should pass on first run. Confirm you see `All hoursUtils tests passed ✓`. If not, fix the inline logic before proceeding.

- [ ] **Step 3: Create `webapp/src/utils/hoursUtils.ts`**

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
```

- [ ] **Step 4: Update test file to import from the real module**

Replace the inline function definitions in `hoursUtils.test.ts` with imports:

```typescript
import assert from 'node:assert/strict'
import { isOpen24h, isOpenWeekends } from './hoursUtils'

// ── isOpen24h ────────────────────────────────────────────────────────────────
// ... (rest of test cases unchanged)
```

The full updated `webapp/src/utils/hoursUtils.test.ts`:

```typescript
import assert from 'node:assert/strict'
import { isOpen24h, isOpenWeekends } from './hoursUtils'

// ── isOpen24h ────────────────────────────────────────────────────────────────

assert.equal(isOpen24h(null), null, 'null input → null')
assert.equal(isOpen24h(undefined), null, 'undefined input → null')
assert.equal(isOpen24h([]), null, 'empty array → null')

const allDay = [
  'Monday: Open 24 hours', 'Tuesday: Open 24 hours', 'Wednesday: Open 24 hours',
  'Thursday: Open 24 hours', 'Friday: Open 24 hours', 'Saturday: Open 24 hours',
  'Sunday: Open 24 hours',
]
assert.equal(isOpen24h(allDay), true, 'all 7 days 24h → true')
assert.equal(isOpen24h(['Monday: Open 24 hours']), true, 'single 24h entry → true')

const mixed = ['Monday: 8:00 AM - 5:00 PM', 'Tuesday: Open 24 hours']
assert.equal(isOpen24h(mixed), false, 'mixed hours → false')

const weekdays = ['Monday: 8:00 AM - 5:00 PM', 'Friday: 8:00 AM - 5:00 PM', 'Saturday: Closed', 'Sunday: Closed']
assert.equal(isOpen24h(weekdays), false, 'regular hours → false')

// ── isOpenWeekends ───────────────────────────────────────────────────────────

assert.equal(isOpenWeekends(null), null, 'null input → null')
assert.equal(isOpenWeekends([]), null, 'empty array → null')

const noWeekend = ['Monday: 8:00 AM - 5:00 PM', 'Friday: 8:00 AM - 5:00 PM']
assert.equal(isOpenWeekends(noWeekend), null, 'no weekend entries → null')

const bothOpen = [
  'Monday: 8:00 AM - 5:00 PM',
  'Saturday: 9:00 AM - 5:00 PM',
  'Sunday: 10:00 AM - 4:00 PM',
]
assert.equal(isOpenWeekends(bothOpen), true, 'both weekend days open → true')

const satOnly = ['Saturday: 9:00 AM - 5:00 PM']
assert.equal(isOpenWeekends(satOnly), true, 'only Saturday open → true')

const bothClosed = [
  'Monday: 8:00 AM - 5:00 PM',
  'Saturday: Closed',
  'Sunday: Closed',
]
assert.equal(isOpenWeekends(bothClosed), false, 'both weekend days closed → false')

const satOpenSunClosed = ['Saturday: 9:00 AM - 5:00 PM', 'Sunday: Closed']
assert.equal(isOpenWeekends(satOpenSunClosed), true, 'Sat open Sun closed → true')

const open24hWeekend = ['Saturday: Open 24 hours', 'Sunday: Open 24 hours']
assert.equal(isOpenWeekends(open24hWeekend), true, '24h weekend entries → true')

console.log('All hoursUtils tests passed ✓')
```

- [ ] **Step 5: Run tests against real module — expect pass**

```bash
cd /home/niki/Documents/saas/medicoordai
npx tsx webapp/src/utils/hoursUtils.test.ts
```

Expected: `All hoursUtils tests passed ✓`

- [ ] **Step 6: Verify TypeScript**

```bash
cd /home/niki/Documents/saas/medicoordai/webapp
tsc -b 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/utils/hoursUtils.ts webapp/src/utils/hoursUtils.test.ts
git commit -m "feat: add isOpen24h and isOpenWeekends hours utility"
```

---

### Task 3: Popup Enrichment

**Files:**
- Modify: `webapp/src/components/map/components/UnifiedFacilityPopup.tsx`
- Modify: `webapp/src/components/map/components/FacilityMarkerLayer.tsx`

**Interfaces:**
- Consumes: `Facility.phone?: string | null`, `Facility.weekday_hours?: string[] | null` (from Task 1)
- `UnifiedFacilityPopup` new props: `phone?: string | null`, `weekday_hours?: string[] | null`

---

- [ ] **Step 1: Replace `UnifiedFacilityPopup.tsx`**

```tsx
import { CATEGORY_STYLES, DEFAULT_STYLE } from '../config/categories'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface UnifiedFacilityPopupProps {
  name:           string
  category:       string
  address:        string
  phone?:         string | null
  weekday_hours?: string[] | null
  distanceKm?:    number
}

export function UnifiedFacilityPopup({ name, category, address, phone, weekday_hours, distanceKm }: UnifiedFacilityPopupProps) {
  const style = CATEGORY_STYLES[category] ?? DEFAULT_STYLE

  const today = DAYS[new Date().getDay()]
  const todayEntry = weekday_hours?.find(h => h.startsWith(`${today}:`))
  const todayHours = todayEntry ? todayEntry.replace(`${today}: `, '') : null
  const hasHoursData = weekday_hours && weekday_hours.length > 0

  return (
    <div style={{ minWidth: 160, fontFamily: 'var(--font-sans)' }}>
      <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#3D3A35' }}>
        {name}
      </p>
      <span style={{
        display: 'inline-block',
        background: style.color,
        color: 'white',
        fontSize: 10,
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: 4,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {style.label}
      </span>
      <p style={{ fontSize: 11, color: '#7A756D', marginBottom: distanceKm != null ? 2 : 0 }}>
        {address}
      </p>
      {distanceKm != null && (
        <p style={{ fontSize: 11, color: '#7A756D' }}>~{distanceKm} km away</p>
      )}
      <div style={{ borderTop: '1px solid #DCD6CC', paddingTop: 6, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="ti ti-clock" style={{ fontSize: 11, color: '#8C8273' }} />
          <span style={{ fontSize: 10, color: '#7A756D', fontWeight: 500 }}>
            {hasHoursData
              ? (todayHours ?? 'Hours unavailable for today')
              : 'Hours unavailable'}
          </span>
        </div>
        {phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="ti ti-phone" style={{ fontSize: 11, color: '#8C8273' }} />
            <a
              href={`tel:${phone}`}
              style={{ fontSize: 10, color: '#7A756D', fontWeight: 500, textDecoration: 'none' }}
            >
              {phone}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `FacilityMarkerLayer.tsx` — pass new props to popup**

In the non-triage branch (lines 62–77), update the `<UnifiedFacilityPopup>` call to pass `phone` and `weekday_hours`. The triage branch passes `FacilityCandidate` objects which don't have these fields — leave that branch untouched.

Updated non-triage `<Popup>` block (replace lines 69–74):

```tsx
<Popup>
  <UnifiedFacilityPopup
    name={facility.name}
    category={facility.category}
    address={facility.address}
    phone={facility.phone}
    weekday_hours={facility.weekday_hours}
  />
</Popup>
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /home/niki/Documents/saas/medicoordai/webapp
tsc -b 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/map/components/UnifiedFacilityPopup.tsx \
        webapp/src/components/map/components/FacilityMarkerLayer.tsx
git commit -m "feat: show real hours and phone in facility popup"
```

---

### Task 4: Filter Chips Wired

**Files:**
- Modify: `webapp/src/components/map/MapPanel.tsx`

**Interfaces:**
- Consumes: `isOpen24h`, `isOpenWeekends` from `webapp/src/utils/hoursUtils` (Task 2)
- Consumes: `Facility.weekday_hours` from shared types (Task 1)
- Does NOT modify: `openNow`, `waitTime`, `proximity` states or their UI buttons — those remain static placeholders

---

- [ ] **Step 1: Add import for hours utility at the top of `MapPanel.tsx`**

After the existing imports, add:

```tsx
import { isOpen24h, isOpenWeekends } from '../../utils/hoursUtils'
```

- [ ] **Step 2: Add two new filter states in `MapPanel` function body**

After the existing `const [proximity, setProximity] = useState<string>('all')` line (currently line 50), add:

```tsx
const [open24h, setOpen24h]           = useState(false)
const [openWeekends, setOpenWeekends] = useState(false)
```

- [ ] **Step 3: Extend `displayedFacilities` to apply hours filters**

Replace the current `displayedFacilities` computation (lines 82–84):

```tsx
// current:
const displayedFacilities = categoryFilter === "all"
  ? facilities
  : facilities.filter(f => f.category === categoryFilter)
```

With:

```tsx
const displayedFacilities = facilities
  .filter(f => categoryFilter === "all" || f.category === categoryFilter)
  .filter(f => {
    // null (unknown hours) always passes — shows with "Hours unavailable" in popup
    if (open24h    && isOpen24h(f.weekday_hours)    === false) return false
    if (openWeekends && isOpenWeekends(f.weekday_hours) === false) return false
    return true
  })
```

- [ ] **Step 4: Add two new filter chip buttons to the sub-filter row in JSX**

In the JSX, find the `{/* Static/Interactive Sub-filters */}` div (the row containing the "Open Now", "Wait Time", and "Proximity" buttons). Add two new buttons immediately after the existing "Open Now" button and before the "Wait Time" dropdown. Both buttons follow the exact same style pattern as the existing "Open Now" button:

```tsx
{/* Open 24/7 toggle */}
<button
  onClick={() => setOpen24h(!open24h)}
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 12px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.02em',
    border: `1px solid ${open24h ? '#48F6C1' : 'rgba(28,70,89,0.5)'}`,
    background: open24h ? 'rgba(72,246,193,0.15)' : 'rgba(6,18,25,0.82)',
    color: open24h ? '#48F6C1' : '#7AA0B0',
    cursor: 'pointer',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: 'all 0.15s ease',
  }}
>
  <i className="ti ti-sun" style={{ fontSize: 12 }} />
  Open 24/7
</button>

{/* Open weekends toggle */}
<button
  onClick={() => setOpenWeekends(!openWeekends)}
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 12px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.02em',
    border: `1px solid ${openWeekends ? '#48F6C1' : 'rgba(28,70,89,0.5)'}`,
    background: openWeekends ? 'rgba(72,246,193,0.15)' : 'rgba(6,18,25,0.82)',
    color: openWeekends ? '#48F6C1' : '#7AA0B0',
    cursor: 'pointer',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: 'all 0.15s ease',
  }}
>
  <i className="ti ti-calendar-week" style={{ fontSize: 12 }} />
  Open weekends
</button>
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /home/niki/Documents/saas/medicoordai/webapp
tsc -b 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 6: Run dev server and verify manually**

```bash
cd /home/niki/Documents/saas/medicoordai
doppler run -- npm run dev --prefix webapp
```

Open `http://localhost:5173`. Verify:
1. Map loads with facilities (no permanently closed ones)
2. Clicking a marker shows popup with real phone and today's hours (or "Hours unavailable")
3. "Open 24/7" chip appears in sub-filter row, toggles active/inactive style
4. "Open weekends" chip appears, toggles active/inactive style
5. Activating "Open 24/7" reduces the visible marker count (hospitals show "Open 24 hours", many ambulatory clinics don't)
6. Activating both chips together further reduces markers (additive AND)
7. "Open Now", "Wait Time", "Proximity" buttons are visually unchanged and still non-functional

- [ ] **Step 7: Commit**

```bash
git add webapp/src/components/map/MapPanel.tsx
git commit -m "feat: wire Open 24/7 and Open weekends filter chips"
```
