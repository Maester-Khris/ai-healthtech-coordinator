# Proximity Filtering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing proximity radius dropdown in `MapPanel` to PostGIS-backed Supabase RPC results, with GPS and tap-to-pin anchor resolution, so filtering facilities by distance actually works.

**Architecture:** The frontend resolves a 3-tier anchor point (GPS > manual tap > CN Tower default), then calls Supabase `nearby_facilities` RPC directly via `supabase.rpc()`. MapPanel uses the results to filter displayed facilities and pass distance to popups. No backend route changes — the RPC is callable client-side via the existing Supabase JS client.

**Tech Stack:** React 18, TypeScript strict, `@supabase/supabase-js` (already installed), `react-leaflet` `useMapEvents` for tap handling, Leaflet `DivIcon` for the manual pin marker, Vitest for unit tests.

## Global Constraints

- TypeScript strict — no `any`, all props interfaces defined
- Type-check command: `cd webapp && npx tsc -b` (NOT `tsc --noEmit` — false negative in this repo; `webapp/tsconfig.json` uses project references)
- No new npm packages — `@supabase/supabase-js` and `react-leaflet` are already installed
- No new backend Python code — proximity queries go directly to Supabase from the frontend
- New shared types must be added to `shared/types.ts` before being used anywhere
- Supabase client: import `supabase` from `webapp/src/lib/supabaseClient.ts`
- Dev server: `doppler run -- npm run dev` (run from `webapp/` directory)
- Python virtualenv (not needed for this feature, but if running backend): `source /home/niki/Documents/workenv/pydev/bin/activate`
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`), one logical change per commit, no AI co-author trailers
- Active branch: `feat/advanced-filtering` — do not merge to `main` or `preview`
- Severity schema values: `routine | moderate | urgent | emergent` only

---

## Codebase Orientation

Key files to read before implementing any task:

| File | Role |
|---|---|
| `shared/types.ts` | All shared TS interfaces — add new types here first |
| `webapp/src/lib/supabaseClient.ts` | Exports `supabase` client (createClient) |
| `webapp/src/hooks/useGeolocation.ts` | GPS hook — exports `Coords`, `useGeolocation()` returning `{ coords, requesting, denied, permission, requestOnce, setCoords }` |
| `webapp/src/components/map/MapPanel.tsx` | ~640 lines — filter chips, geo, displayed facilities. `proximity` state already exists as a string (`'all' \| '10 km' \| '25 km' \| '50 km' \| '50 km+'`) but does nothing yet |
| `webapp/src/components/map/config/icons.ts` | Leaflet DivIcon exports: `cnTowerIcon`, `userIcon`, `getFacilityIcon` |
| `webapp/src/components/map/components/FacilityMarkerLayer.tsx` | Renders facility markers; calls `UnifiedFacilityPopup` — already has a `distanceKm` path in the triage branch |
| `webapp/src/components/map/components/UnifiedFacilityPopup.tsx` | Already accepts `distanceKm?: number` and renders "~X km away" when present |
| `migrations/009_facilities_add_geolocation.sql` | Adds `coordinates geography(POINT,4326)` column + GIST index to `facilities_clean` |
| `migrations/010_nearby_facilities_rpc.sql` | Defines `nearby_facilities` RPC — **NOTE: file starts with `_CREATE` (typo), must strip underscore before applying** |
| `docs/proximity-filtering-design.md` | Full design spec: anchor priority chain, RPC rationale, query design, perf notes |

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `shared/types.ts` | Modify | Add `AnchorSource`, `UserAnchor`, `NearbyFacility` |
| `backend/models.py` | Modify | Add `NearbyFacilityResult` Pydantic model |
| `backend/main.py` | Modify | Add `GET /facilities/nearby` route calling the RPC |
| `webapp/src/hooks/useAnchor.ts` | Create | Pure `resolveAnchor` + `useAnchor` hook |
| `webapp/src/hooks/useAnchor.test.ts` | Create | Vitest unit tests for `resolveAnchor` |
| `webapp/src/hooks/useProximitySearch.ts` | Create | `fetch` wrapper calling backend `/facilities/nearby` |
| `webapp/src/components/map/config/icons.ts` | Modify | Add `manualPinIcon` |
| `webapp/src/components/map/components/FacilityMarkerLayer.tsx` | Modify | Accept `distanceMap` prop, pass `distanceKm` to popup |
| `webapp/src/components/map/MapPanel.tsx` | Modify | Tap handler, anchor hook, proximity hook, filter chain, markers |

---

## Task 1: Verify and apply database migrations

**Files:** No code files — SQL only.

**Background:** Migration 009 adds the `coordinates geography(POINT,4326)` column and GIST index to `facilities_clean`. Migration 010 creates the `nearby_facilities` Postgres RPC function. The migrations may or may not already be applied. The file `migrations/010_nearby_facilities_rpc.sql` starts with `_CREATE` (a typo) — you must strip the leading underscore before running it.

- [ ] **Step 1: Check whether migration 009 has been applied**

Open the Supabase SQL Editor for this project and run:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'facilities_clean'
  AND column_name = 'coordinates';
```
If one row is returned → skip to Step 3. If no rows → proceed to Step 2.

- [ ] **Step 2: Apply migration 009 (only if coordinates column is missing)**

Run the full content of `migrations/009_facilities_add_geolocation.sql` in the SQL Editor. The `UPDATE` populates `coordinates` from existing `lat`/`lng` columns — this may take a few seconds on ~400 rows.

- [ ] **Step 3: Check whether the nearby_facilities RPC exists**

```sql
SELECT proname FROM pg_proc WHERE proname = 'nearby_facilities';
```
If one row returned → skip to Step 5. If no rows → proceed to Step 4.

- [ ] **Step 4: Apply migration 010 (only if RPC is missing)**

Read `migrations/010_nearby_facilities_rpc.sql`. The first line reads `_CREATE OR REPLACE FUNCTION ...` — strip the leading `_` so it becomes `CREATE OR REPLACE FUNCTION ...`. Run the corrected SQL in the SQL Editor.

- [ ] **Step 5: Smoke test the RPC**

```sql
SELECT facility_name, distance_m
FROM nearby_facilities(43.6426, -79.3871, 3000, NULL, NULL, 5);
```
Expected: up to 5 rows with `facility_name` text and `distance_m` integer values (distances in metres from CN Tower). If 0 rows are returned, the `coordinates` column may not have been populated — re-run the `UPDATE` from migration 009 then retry.

No code commit needed for this task. Note in the PR description that migrations were verified/applied.

---

## Task 2: Add proximity types to shared/types.ts

**Files:**
- Modify: `shared/types.ts`

**Interfaces:**
- Produces: `AnchorSource`, `UserAnchor`, `NearbyFacility` — used in every subsequent task

- [ ] **Step 1: Read shared/types.ts**

Read `shared/types.ts` to find the correct insertion point. Insert the new block immediately after the closing `}` of the `Facility` interface, before `TriageRequest`.

- [ ] **Step 2: Insert the three new types**

```typescript
// ── Proximity ─────────────────────────────────────────────────────────────────

export type AnchorSource = 'gps' | 'manual_pin' | 'default'

export interface UserAnchor {
  lat:    number
  lng:    number
  source: AnchorSource
}

export interface NearbyFacility {
  facility_id:     string
  facility_name:   string
  category:        string
  address:         string
  phone:           string | null
  is_operational:  boolean
  distance_m:      number
  eta_walk_min:    number
  eta_transit_min: number
  eta_drive_min:   number
}
```

- [ ] **Step 3: Type-check**

```bash
cd webapp && npx tsc -b
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add shared/types.ts
git commit -m "feat: add AnchorSource, UserAnchor, NearbyFacility types"
```

---

## Task 3: Create useAnchor hook + unit test

**Files:**
- Create: `webapp/src/hooks/useAnchor.ts`
- Create: `webapp/src/hooks/useAnchor.test.ts`

**Interfaces:**
- Consumes: `UserAnchor` from `shared/types.ts`; `Coords` from `webapp/src/hooks/useGeolocation.ts`
- Produces:
  - `resolveAnchor(gps: Coords | null, manualPin: { lat: number; lng: number } | null): UserAnchor` — pure, exported, tested
  - `useAnchor(gps: Coords | null): { anchor: UserAnchor; manualPin: { lat: number; lng: number } | null; placePin: (lat: number, lng: number) => void; clearPin: () => void }`

**Priority:** `manualPin` wins over `gps`; `gps` wins over default (CN Tower 43.6426, −79.3871).

- [ ] **Step 1: Write the failing test**

Create `webapp/src/hooks/useAnchor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveAnchor } from './useAnchor'

const gps = { lat: 43.7, lng: -79.4 }
const pin = { lat: 43.8, lng: -79.5 }

describe('resolveAnchor', () => {
  it('returns default when no gps and no pin', () => {
    const r = resolveAnchor(null, null)
    expect(r.source).toBe('default')
    expect(r.lat).toBe(43.6426)
    expect(r.lng).toBe(-79.3871)
  })

  it('returns gps when gps available and no pin', () => {
    const r = resolveAnchor(gps, null)
    expect(r.source).toBe('gps')
    expect(r.lat).toBe(43.7)
  })

  it('manual_pin wins over gps', () => {
    const r = resolveAnchor(gps, pin)
    expect(r.source).toBe('manual_pin')
    expect(r.lat).toBe(43.8)
  })

  it('manual_pin works without gps', () => {
    const r = resolveAnchor(null, pin)
    expect(r.source).toBe('manual_pin')
    expect(r.lng).toBe(-79.5)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd webapp && npx vitest run src/hooks/useAnchor.test.ts
```
Expected: FAIL — `resolveAnchor` is not defined.

- [ ] **Step 3: Implement the hook**

Create `webapp/src/hooks/useAnchor.ts`:

```typescript
import { useState, useCallback } from 'react'
import type { UserAnchor } from '../../../shared/types'
import type { Coords } from './useGeolocation'

const CN_TOWER = { lat: 43.6426, lng: -79.3871 }

export function resolveAnchor(
  gps:       Coords | null,
  manualPin: { lat: number; lng: number } | null,
): UserAnchor {
  if (manualPin) return { ...manualPin, source: 'manual_pin' }
  if (gps)       return { lat: gps.lat, lng: gps.lng, source: 'gps' }
  return { ...CN_TOWER, source: 'default' }
}

export function useAnchor(gps: Coords | null) {
  const [manualPin, setManualPin] = useState<{ lat: number; lng: number } | null>(null)

  const placePin = useCallback((lat: number, lng: number) => {
    setManualPin({ lat, lng })
  }, [])

  const clearPin = useCallback(() => {
    setManualPin(null)
  }, [])

  return { anchor: resolveAnchor(gps, manualPin), manualPin, placePin, clearPin }
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd webapp && npx vitest run src/hooks/useAnchor.test.ts
```
Expected: PASS — 4 tests.

- [ ] **Step 5: Type-check**

```bash
cd webapp && npx tsc -b
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add webapp/src/hooks/useAnchor.ts webapp/src/hooks/useAnchor.test.ts
git commit -m "feat: add useAnchor hook with 3-tier anchor priority resolution"
```

---

## Task 4: Backend route + frontend hook for proximity search

**Project constraint:** All calls to external services (Supabase, Groq, etc.) go through the FastAPI backend. The frontend never calls Supabase directly except for auth. This task therefore has two parts: a new backend endpoint, then a frontend hook that calls it.

---

### Task 4a — Backend: GET /facilities/nearby

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: `get_supabase_client()` from `backend/db.py` (uses `SUPABASE_SERVICE_ROLE_KEY`)
- Produces: `GET /facilities/nearby?lat=<float>&lng=<float>&radius_m=<int>&category=<str>` → `list[NearbyFacilityResult]`
- No auth required (same as `/facilities`)

**Endpoint contract:**

```
GET /facilities/nearby?lat=43.6426&lng=-79.3871&radius_m=10000&category=hospital

Query params:
  lat      float   required  WGS84 latitude of anchor point
  lng      float   required  WGS84 longitude of anchor point
  radius_m int     optional  search radius in metres, default 5000; DB hard-caps at 50000
  category string  optional  hospital | ambulatory | residential
                             forwarded as facility_types=[category] to the RPC so the
                             50-result cap applies per-category, not across all types

Response 200: JSON array of NearbyFacilityResult objects, ordered by distance_m ASC
Response 500: { "detail": "proximity search failed: <message>" }
```

**Why push category to the DB:** The `nearby_facilities` RPC already accepts `facility_types text[] DEFAULT NULL` and applies `WHERE f.category = ANY(facility_types)` before `LIMIT 50`. Passing category here means the cap is per-category — selecting "Hospital + 10km" cannot silently drop hospitals because ambulatory facilities filled the top-50 slots. The RPC `migrations/010_nearby_facilities_rpc.sql` needs no changes; `facility_types` is already wired.

- [ ] **Step 1: Read backend/models.py**

Read `backend/models.py` to find the last defined Pydantic model. Insert `NearbyFacilityResult` after it.

- [ ] **Step 2: Add Pydantic model to backend/models.py**

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
```

- [ ] **Step 3: Add the route to backend/main.py**

Read `backend/main.py` to find the `/facilities` route (around line 82). Add `/facilities/nearby` immediately after it — before the next unrelated route.

Add this import to `backend/main.py` if not already present:
```python
from db import get_supabase_client
from models import NearbyFacilityResult
```

Add the route:
```python
@app.get("/facilities/nearby")
async def facilities_nearby(
    lat:      float,
    lng:      float,
    radius_m: int = 5000,
    category: str | None = None,
) -> list[NearbyFacilityResult]:
    try:
        client = get_supabase_client()
        response = client.rpc(
            "nearby_facilities",
            {
                "user_lat":        lat,
                "user_lng":        lng,
                "radius_m":        min(radius_m, 50000),
                "facility_types":  [category] if category else None,
                "result_limit":    50,
            },
        ).execute()
        return response.data or []
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"proximity search failed: {exc}") from exc
```

Also confirm `HTTPException` is already imported from `fastapi` in `main.py`; add it to the import if missing:
```python
from fastapi import FastAPI, Depends, Request, HTTPException
```

- [ ] **Step 4: Smoke test the endpoint**

```bash
source /home/niki/Documents/workenv/pydev/bin/activate
doppler run -- uvicorn backend.main:app --reload
```

In another terminal:
```bash
curl "http://localhost:8000/facilities/nearby?lat=43.6426&lng=-79.3871&radius_m=3000&category=hospital" | python3 -m json.tool | head -40
```
Expected: a JSON array with at least one object containing `facility_id`, `distance_m`, `eta_walk_min`, etc.

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/main.py
git commit -m "feat: add GET /facilities/nearby endpoint backed by PostGIS RPC"
```

---

### Task 4b — Frontend: useProximitySearch hook

**Files:**
- Create: `webapp/src/hooks/useProximitySearch.ts`

**Interfaces:**
- Consumes: `UserAnchor`, `NearbyFacility` from `shared/types.ts`; `VITE_API_BASE_URL` env var (same pattern as `useFacilities`)
- Produces: `useProximitySearch(anchor: UserAnchor, proximity: string): { results: NearbyFacility[]; loading: boolean; error: string | null }`
- Behavior: when `proximity === 'all'`, returns empty results immediately (no fetch). Otherwise calls `GET /facilities/nearby` on the backend. Re-fires when anchor coords, anchor source, or radius changes.

**Radius mapping (matches the dropdown options already in MapPanel):**

| Dropdown value | radius_m sent to backend |
|---|---|
| `'10 km'`  | 10000 |
| `'25 km'`  | 25000 |
| `'50 km'`  | 50000 |
| `'50 km+'` | 50000 (DB also hard-caps at 50km) |

- [ ] **Step 1: Create the hook**

Create `webapp/src/hooks/useProximitySearch.ts`:

```typescript
import { useState, useEffect } from 'react'
import type { NearbyFacility, UserAnchor } from '../../../shared/types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const RADIUS_MAP: Record<string, number> = {
  '10 km':  10000,
  '25 km':  25000,
  '50 km':  50000,
  '50 km+': 50000,
}

interface UseProximitySearchResult {
  results: NearbyFacility[]
  loading: boolean
  error:   string | null
}

export function useProximitySearch(
  anchor:         UserAnchor,
  proximity:      string,
  categoryFilter: string,   // 'all' | 'hospital' | 'ambulatory' | 'residential'
): UseProximitySearchResult {
  const [results, setResults] = useState<NearbyFacility[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const radiusM = RADIUS_MAP[proximity]

  useEffect(() => {
    if (radiusM === undefined) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      lat:      String(anchor.lat),
      lng:      String(anchor.lng),
      radius_m: String(radiusM),
    })
    if (categoryFilter !== 'all') params.set('category', categoryFilter)

    const url = `${BASE_URL}/facilities/nearby?${params.toString()}`

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Proximity search failed (${res.status})`)
        return res.json() as Promise<NearbyFacility[]>
      })
      .then(data => {
        if (!cancelled) {
          setResults(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setResults([])
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [anchor.lat, anchor.lng, anchor.source, radiusM, categoryFilter])
  // anchor.source: re-query when anchor type changes (GPS → pin at same coords = different intent)
  // categoryFilter: re-query when category chip changes so the DB pre-filters per category

  return { results, loading, error }
}
```

- [ ] **Step 2: Type-check**

```bash
cd webapp && npx tsc -b
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/hooks/useProximitySearch.ts
git commit -m "feat: add useProximitySearch hook — calls backend /facilities/nearby"
```

---

## Task 5: Add manualPinIcon to icons.ts

**Files:**
- Modify: `webapp/src/components/map/config/icons.ts`

**Interfaces:**
- Produces: `manualPinIcon` — orange teardrop DivIcon; used in Task 7

**Visual spec:** Distinct from the GPS `userIcon` (teal dot). Orange teardrop with white center circle. The colour `#F97316` (Tailwind orange-500) reads clearly on both light and dark map tiles.

- [ ] **Step 1: Add the icon**

Open `webapp/src/components/map/config/icons.ts`. Insert after the closing `}` of the `userIcon` declaration:

```typescript
export const manualPinIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.268 21.732 0 14 0z" fill="#F97316"/>
    <circle cx="14" cy="14" r="5.5" fill="white"/>
  </svg>`,
  iconSize:     [28, 36],
  iconAnchor:   [14, 36],
  popupAnchor:  [0, -38],
})
```

- [ ] **Step 2: Type-check**

```bash
cd webapp && npx tsc -b
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/map/config/icons.ts
git commit -m "feat: add manualPinIcon (orange teardrop) for tap-to-pin anchor"
```

---

## Task 6: Add distanceMap prop to FacilityMarkerLayer

**Files:**
- Modify: `webapp/src/components/map/components/FacilityMarkerLayer.tsx`

**Background:** `FacilityMarkerLayer` already renders `UnifiedFacilityPopup` in two branches (triage active / not active). The triage branch already passes `distanceKm={facility.distanceKm}`. The non-triage branch does not. `UnifiedFacilityPopup` already accepts `distanceKm?: number` and renders "~X km away" when it's present — no popup changes needed.

**Interfaces:**
- Consumes: existing `FacilityMarkerLayerProps`, `UnifiedFacilityPopup`
- Produces: `FacilityMarkerLayerProps` extended with optional `distanceMap?: Map<string, number>` (facilityId → distance in km)

- [ ] **Step 1: Add distanceMap to the props interface**

In `FacilityMarkerLayer.tsx`, change the interface from:

```typescript
interface FacilityMarkerLayerProps {
  displayedFacilities: Facility[]
  triageCandidates:    FacilityCandidate[]
  pinnedIdRef:         MutableRefObject<string | null>
}
```

to:

```typescript
interface FacilityMarkerLayerProps {
  displayedFacilities: Facility[]
  triageCandidates:    FacilityCandidate[]
  pinnedIdRef:         MutableRefObject<string | null>
  distanceMap?:        Map<string, number>
}
```

- [ ] **Step 2: Destructure distanceMap in the function signature**

Change:

```typescript
export function FacilityMarkerLayer({ displayedFacilities, triageCandidates, pinnedIdRef }: FacilityMarkerLayerProps) {
```

to:

```typescript
export function FacilityMarkerLayer({ displayedFacilities, triageCandidates, pinnedIdRef, distanceMap }: FacilityMarkerLayerProps) {
```

- [ ] **Step 3: Pass distanceKm to the non-triage popup**

In the non-triage `return` block, find `<UnifiedFacilityPopup name={...} ... />` (around line 70) and add the `distanceKm` prop:

```tsx
<UnifiedFacilityPopup
  name={facility.name}
  category={facility.category}
  address={facility.address}
  phone={facility.phone}
  weekday_hours={facility.weekday_hours}
  distanceKm={facility.id ? distanceMap?.get(facility.id) : undefined}
/>
```

- [ ] **Step 4: Type-check**

```bash
cd webapp && npx tsc -b
```
Expected: no errors. `distanceMap` is optional — MapPanel not yet passing it, so no breakage.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/map/components/FacilityMarkerLayer.tsx
git commit -m "feat: pass distanceKm to facility popup via distanceMap prop"
```

---

## Task 7: Wire MapPanel — tap-to-pin, proximity filtering, anchor marker, distance display

**Files:**
- Modify: `webapp/src/components/map/MapPanel.tsx`

**Read this file in full before starting.** It is ~640 lines. Note:
- The imports block at the top
- Where `const geo = useGeolocation()` is declared (around line 47)
- Where `const [proximity, setProximity] = useState<string>('all')` is declared
- The `displayedFacilities` filter chain (two chained `.filter()` calls around line 85)
- Inside `<MapProvider>`: location of `<MapFitBounds />`, `<MapSizeGuard />`, user location `<Marker>`, `<FacilityMarkerLayer />`
- The proximity dropdown button's label text: `proximity === 'all' ? 'Proximity: All' : \`Dist: ${proximity}\``

**What this task adds:**
1. A `MapClickHandler` sub-component (uses `useMapEvents` — must live inside `<MapContainer>`)
2. `useAnchor` hook wired to `geo.coords`
3. `useProximitySearch` hook wired to anchor + proximity state
4. `distanceMap` derived from proximity results
5. Updated `displayedFacilities` that proximity-filters when active
6. Manual pin `Marker` inside `<MapProvider>` with "Remove pin" popup
7. `distanceMap` passed to `FacilityMarkerLayer`
8. Loading label on proximity chip

**Interfaces:**
- Consumes: `useAnchor` from `hooks/useAnchor.ts`, `useProximitySearch` from `hooks/useProximitySearch.ts`, `manualPinIcon` from `config/icons.ts`, `useMapEvents` + `Popup` from `react-leaflet`, `useMemo` from `react`

- [ ] **Step 1: Add imports**

Add to the existing imports block in `MapPanel.tsx`. Do not duplicate `useState`, `useRef`, `useEffect` — they are already imported.

```typescript
import { useMemo } from 'react'
import { useMapEvents, Popup } from 'react-leaflet'
import { useAnchor } from '../../hooks/useAnchor'
import { useProximitySearch } from '../../hooks/useProximitySearch'
import { manualPinIcon } from './config/icons'
```

- [ ] **Step 2: Add anchor and proximity hooks inside MapPanel**

Immediately after `const geo = useGeolocation()`, add:

```typescript
const { anchor, manualPin, placePin, clearPin } = useAnchor(geo.coords)
const { results: proximityResults, loading: proximityLoading } = useProximitySearch(anchor, proximity, categoryFilter)
// categoryFilter passed so the backend pre-filters by category before the 50-result cap

const distanceMap = useMemo<Map<string, number>>(
  () => new Map(proximityResults.map(r => [r.facility_id, r.distance_m / 1000])),
  [proximityResults],
)
```

- [ ] **Step 3: Replace displayedFacilities with proximity-aware version**

Find the existing two-step filter chain:

```typescript
const displayedFacilities = facilities
  .filter(f => categoryFilter === "all" || f.category === categoryFilter)
  .filter(f => {
    if (open24h    && isOpen24h(f.weekday_hours)    === false) return false
    if (openWeekends && isOpenWeekends(f.weekday_hours) === false) return false
    return true
  })
```

Replace it with a `useMemo` version:

```typescript
const displayedFacilities = useMemo(() => {
  // When proximity results have loaded, they are already category-filtered by the DB.
  // When proximity is not active, apply category filter here on the full list.
  const proximityActive = proximity !== 'all' && !proximityLoading && proximityResults.length > 0

  const list = proximityActive
    ? facilities.filter(f => f.id != null && distanceMap.has(f.id))
    : facilities.filter(f => categoryFilter === 'all' || f.category === categoryFilter)

  // Hours filters always applied on the frontend (RPC has no hours column)
  return list.filter(f => {
    if (open24h      && isOpen24h(f.weekday_hours)      === false) return false
    if (openWeekends && isOpenWeekends(f.weekday_hours) === false) return false
    return true
  })
}, [facilities, proximity, proximityLoading, proximityResults, distanceMap, categoryFilter, open24h, openWeekends])
```

- [ ] **Step 4: Add MapClickHandler sub-component**

Add this function at the bottom of the file, alongside the existing `FocusUserButton` sub-component:

```typescript
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng),
  })
  return null
}
```

- [ ] **Step 5: Add MapClickHandler and manual pin Marker inside MapProvider**

Inside `<MapProvider>`, immediately after `<MapSizeGuard sizeVersion={sizeVersion} />`, add:

```tsx
<MapClickHandler onMapClick={placePin} />
{manualPin && (
  <Marker position={[manualPin.lat, manualPin.lng]} icon={manualPinIcon}>
    <Popup>
      <div style={{ textAlign: 'center', padding: '4px 0' }}>
        <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 6px', color: '#3D3A35' }}>
          Search from here
        </p>
        <button
          onClick={clearPin}
          style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 4,
            border: '1px solid #F97316',
            background: 'transparent',
            color: '#F97316',
            cursor: 'pointer',
          }}
        >
          Remove pin
        </button>
      </div>
    </Popup>
  </Marker>
)}
```

- [ ] **Step 6: Pass distanceMap to FacilityMarkerLayer**

Find the `<FacilityMarkerLayer ... />` JSX and add the new prop:

```tsx
<FacilityMarkerLayer
  displayedFacilities={displayedFacilities}
  triageCandidates={triageCandidates}
  pinnedIdRef={pinnedIdRef}
  distanceMap={distanceMap}
/>
```

- [ ] **Step 7: Update proximity chip label to show loading state**

Find the proximity dropdown button's label text (the ternary inside the button):

```tsx
{proximity === 'all' ? 'Proximity: All' : `Dist: ${proximity}`}
```

Replace with:

```tsx
{proximityLoading
  ? 'Searching…'
  : proximity === 'all'
    ? 'Proximity: All'
    : `Dist: ${proximity}`}
```

- [ ] **Step 8: Type-check**

```bash
cd webapp && npx tsc -b
```
Expected: no errors.

- [ ] **Step 9: Smoke test in the browser**

```bash
cd webapp && doppler run -- npm run dev
```

Open http://localhost:5173/app and verify:

1. **Default anchor (no GPS):** Open proximity dropdown → select "10 km" → markers reduce to CN Tower area. Chip label shows "Searching…" briefly then "Dist: 10 km". Facility count pill updates.
2. **GPS anchor:** Click the focus button (bottom-right crosshair) to grant location. Select "25 km" → RPC fires from your GPS position.
3. **Tap-to-pin:** Tap anywhere on the map → orange teardrop pin appears at tapped point → proximity re-queries from that point.
4. **Remove pin:** Click the orange pin → popup shows "Remove pin" button → clicking it removes the pin and reverts to GPS or default anchor.
5. **Distance in popup:** In proximity mode, click a facility marker → popup shows "~X.XX km away" line under the address.
6. **Reset:** Select "All distances" → all facilities shown, distance lines disappear from popups.
7. **Category filter stacks:** With proximity active, toggle a category chip → only nearby facilities of that category shown.

- [ ] **Step 10: Commit**

```bash
git add webapp/src/components/map/MapPanel.tsx
git commit -m "feat: wire proximity dropdown to PostGIS RPC with tap-to-pin anchor"
```

---

## Self-Review

### Spec coverage

| Requirement (from design doc + changelog) | Task |
|---|---|
| `coordinates geography(POINT,4326)` column + GIST index on `facilities_clean` | Task 1 — verify migration 009 |
| `nearby_facilities` RPC with `ST_DWithin` + `ST_Distance`, GIST-indexed | Task 1 — verify migration 010 |
| 3-tier anchor: GPS > manual_pin > default (CN Tower) | Task 3 — `useAnchor` |
| `AnchorSource`, `UserAnchor`, `NearbyFacility` types | Task 2 |
| Backend `GET /facilities/nearby` calls Supabase RPC (service role) | Task 4a — backend route |
| Frontend hook calls backend (no direct Supabase from frontend) | Task 4b — `useProximitySearch` |
| Manual pin marker (orange, distinct from GPS dot) | Task 5 + Task 7 |
| Remove pin via popup | Task 7 Step 5 |
| Proximity dropdown wired to RPC results | Task 7 Steps 2–3 |
| Category pushed to DB via `facility_types` — cap applies per-category | Tasks 4a + 4b |
| Frontend category filter skipped when proximity active (DB already filtered) | Task 7 Step 3 |
| Hours filters (`open24h`, `openWeekends`) always applied frontend-only | Task 7 Step 3 |
| Distance shown in facility popup | Task 6 + Task 7 Step 6 |
| "Searching…" label during load | Task 7 Step 7 |
| GPS position continues working as anchor | Task 3 (`useAnchor` uses `geo.coords`) |

### Known edge cases (accepted for this sprint)

- **0 results after load:** When a radius returns no facilities (empty `proximityResults` after loading completes), `displayedFacilities` falls back to the full list. This is an acceptable "nothing nearby" fallback for MVP. A "No facilities in range" message can be added later.
- **`openNow` chip:** Already renders in MapPanel but does nothing — `isOpenNow` utility doesn't exist. Not in scope for this task.
- **Wait Time dropdown:** Renders but is not wired — ER wait-times are a Sprint 12 carry-over. Not in scope.
- **Mobile `MobileLayout`:** This plan scopes to the desktop `MapPanel` path (`webapp/src/components/map/MapPanel.tsx`). The mobile layout (`webapp/src/components/mobile/MobileLayout.tsx`) has separate map rendering; proximity for mobile is a follow-on.
- **ETA display:** RPC returns `eta_walk_min`, `eta_transit_min`, `eta_drive_min` but the popup only shows distance. These fields are available in `NearbyFacility` and can be added to `UnifiedFacilityPopup` without any schema changes.
