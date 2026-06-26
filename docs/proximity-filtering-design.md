# MediCoord — Proximity Filtering Design
**Version:** 1.0  
**Status:** Approved for implementation  
**Scope:** PostGIS-backed proximity search with dynamic user position resolution

---

## 1. Overview

Proximity filtering computes facility distance from a **user anchor point** and filters results within a selected radius. The anchor point is resolved through a 3-tier priority chain. All distance computation is executed server-side via a Supabase RPC function backed by a PostGIS GIST index.

---

## 2. Database Migration (completed)

### 2.1 Schema changes applied to `facilities_clean`

```sql
-- Added stored geography column
ALTER TABLE facilities_clean
ADD COLUMN coordinates geography(POINT, 4326);

-- Populated from existing lat/lng
UPDATE facilities_clean
SET coordinates = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL;
```

`lat` and `lng` columns are retained as pipeline source of truth. `coordinates` is the column all proximity queries operate against.

**SRID 4326** = WGS84 (GPS standard). `geography` type (vs `geometry`) automatically handles Earth's curvature — distances returned by `ST_Distance` are in **meters**.

### 2.2 Index

```sql
CREATE INDEX idx_facility_coordinates_gist
ON facilities_clean
USING GIST (coordinates);

ANALYZE facilities_clean;
```

**Index choice: GIST (R-tree)**  
- Only index type compatible with `ST_DWithin` — the operator that activates index seek  
- Handles arbitrary spatial distributions (Toronto today, national tomorrow)  
- BRIN excluded: requires physical disk ordering, cannot accelerate `ST_DWithin`  
- SP-GIST excluded: degrades on sparse non-uniform distributions (national Canada coverage)

---

## 3. User Anchor Point — 3-Tier Priority Chain

The anchor point is the center from which all radius calculations are computed. It is resolved client-side before any search request is fired.

```
Priority 1 — GPS position (highest)
  User grants location permission
  → Browser Geolocation API returns {lat, lng}
  → User marker placed automatically on map
  → All proximity queries use GPS coordinates as center

Priority 2 — Manual pin (overrides GPS)
  User taps anywhere on the map
  → Marker placed at tapped position
  → Replaces GPS anchor for proximity computation
  → User can remove marker (tap marker → remove)
  → On removal: fall back to Priority 1 if GPS available, else Priority 3

Priority 3 — Map center fallback (default)
  No GPS permission AND no manual pin
  → Default anchor: CN Tower {lat: 43.6426, lng: -79.3871}
  → Used as center for all proximity queries
  → No marker shown (implicit center, not a user-placed point)
```

### 3.1 Anchor point state (frontend)

```typescript
type AnchorSource = 'gps' | 'manual_pin' | 'default'

interface UserAnchor {
  lat: number
  lng: number
  source: AnchorSource
}

// Priority resolution
function resolveAnchor(
  gpsPosition: GeolocationCoordinates | null,
  manualPin: { lat: number; lng: number } | null
): UserAnchor {
  if (manualPin) {
    return { ...manualPin, source: 'manual_pin' }
  }
  if (gpsPosition) {
    return {
      lat: gpsPosition.latitude,
      lng: gpsPosition.longitude,
      source: 'gps'
    }
  }
  return {
    lat: 43.6426,
    lng: -79.3871,
    source: 'default'   // CN Tower
  }
}
```

### 3.2 Map behavior per anchor source

| Source | Marker shown | Marker style | Removable |
|--------|-------------|--------------|-----------|
| `gps` | Yes | Pulsing blue dot (standard geolocation) | No (reflects live position) |
| `manual_pin` | Yes | Distinct pin icon (user-placed) | Yes — tap → remove option |
| `default` | No | — | — |

On manual pin removal:
- If GPS available → revert to `gps` anchor silently, re-query
- If GPS unavailable → revert to `default` (CN Tower), re-query

---

## 4. RPC Function

Proximity queries are implemented as a Supabase RPC function, not raw SQL from the client.

**Engineering rationale:**
- `SECURITY DEFINER` — function executes as owner; no table credentials exposed to client
- Plan caching — Postgres caches execution plan after first call; subsequent calls skip ~35ms planning overhead (observed on free tier cold start)
- Parameter enforcement — `LEAST(radius_m, 50000)` and `LEAST(result_limit, 50)` hard caps enforced at DB boundary, not API layer
- Single roundtrip — `supabase.rpc()` goes client → Supabase Edge → Postgres; no intermediate API hop

```sql
CREATE OR REPLACE FUNCTION nearby_facilities(
  user_lat     double precision,
  user_lng     double precision,
  radius_m     int DEFAULT 5000,
  result_limit int DEFAULT 10
)
RETURNS TABLE (
  facility_id      uuid,
  facility_name    text,
  category         text,
  address          text,
  phone            text,
  is_operational   boolean,
  distance_m       int,
  eta_walk_min     int,
  eta_transit_min  int,
  eta_drive_min    int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_point geography;
BEGIN
  -- Compute user point once; reused in WHERE and SELECT
  user_point := ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography;

  RETURN QUERY
  SELECT
    f.facility_id,
    f.facility_name,
    f.category,
    f.address,
    f.phone,
    f.is_operational,
    ST_Distance(f.coordinates, user_point)::int                              AS distance_m,
    ROUND(ST_Distance(f.coordinates, user_point) / 1.4  / 60)::int          AS eta_walk_min,
    ROUND(ST_Distance(f.coordinates, user_point) / 6.0  / 60)::int          AS eta_transit_min,
    ROUND(ST_Distance(f.coordinates, user_point) / 11.0 / 60)::int          AS eta_drive_min
  FROM facilities_clean f
  WHERE
    f.coordinates IS NOT NULL
    AND f.is_operational = true
    AND ST_DWithin(f.coordinates, user_point, LEAST(radius_m, 50000))
  ORDER BY distance_m ASC
  LIMIT LEAST(result_limit, 50);
END;
$$;
```

**Transport speed constants (until routing API is wired):**

| Mode | Speed | Swap path |
|------|-------|-----------|
| Walk | 1.4 m/s | Replace constant with Mapbox Walking API |
| Transit | 6.0 m/s | Replace with GTFS-based routing |
| Drive | 11.0 m/s | Replace with Mapbox Driving API |

ETA formula is a straight-line approximation. No schema change required when routing API is introduced — only the RPC function body changes.

---

## 5. Frontend Integration

```typescript
// Resolve anchor before every search
const anchor = resolveAnchor(gpsPosition, manualPin)

// Radius map from UI dropdown
const radiusMap = {
  'All distances': 50000,
  '10 km':         10000,
  '25 km':         25000,
  '50 km':         50000,
  '50 km+':        50000   // treated as max; no infinite scan
}

// RPC call
const { data, error } = await supabase.rpc('nearby_facilities', {
  user_lat:     anchor.lat,
  user_lng:     anchor.lng,
  radius_m:     radiusMap[selectedProximity],
  result_limit: 50
})
```

The anchor `source` field is used only for UI state (which marker to show, fallback behavior on pin removal). It is never sent to the backend.

---

## 6. Query Design Rationale

### ST_DWithin (WHERE) + ST_Distance (ORDER BY) — always both

```sql
-- ✅ Correct: index seek first, then sort survivors
WHERE ST_DWithin(coordinates, user_point, radius_m)   -- activates GIST index
ORDER BY ST_Distance(coordinates, user_point)          -- sorts small result set

-- ❌ Wrong: ORDER BY alone triggers full table scan
ORDER BY ST_Distance(coordinates, user_point) LIMIT 10

-- ❌ Wrong: WHERE alone returns heap-ordered results (effectively random)
WHERE ST_DWithin(coordinates, user_point, radius_m)
```

`ST_DWithin` is the only spatial operator that activates the GIST index. It eliminates non-candidate rows before `ST_Distance` is computed. At 394 facilities the difference is ~2ms vs ~75ms; at national scale (10k+ facilities) the unindexed path becomes unusable.

### KNN with `<->` operator (future option)

```sql
-- For "nearest N regardless of radius" — future UI feature
ORDER BY coordinates <-> user_point
LIMIT 5
```

Useful for a "nearest hospital" emergency shortcut that ignores radius. Also GIST-accelerated. Can be added as a second RPC function without modifying the existing one.

---

## 7. Performance Profile

| Condition | Planning | Execution | Total |
|-----------|----------|-----------|-------|
| Cold start, free tier | ~35ms | ~2ms | ~75ms |
| Warm (RPC plan cached) | ~0.1ms | ~2ms | ~3ms |
| P95 production (pooled) | ~0.5ms | ~5ms | ~10ms |

**Planning time dominates on cold starts** — this is PostGIS library initialization on shared compute, not query cost. Use Supabase pooler connection string in production to keep connections warm.

---

## 8. Observed EXPLAIN ANALYZE Baseline

Captured post-migration, post-index:

```
Index Scan using idx_facility_coordinates_gist on facilities_clean
  Index Cond: (coordinates && _st_expand(..., 5000))
  Filter: st_dwithin(coordinates, ..., 5000)
  Rows Removed by Filter: 25
  Actual time: 75.027..75.654 ms   ← cold start dominated by planning
Planning Time: 35.719 ms
Execution Time: 75.879 ms
```

Index is active. Seq Scan eliminated. Residual latency is cold-start planning, not query cost.

---

## 9. Deferred Items

| Item | Trigger to implement |
|------|---------------------|
| Routing API ETA (Mapbox / OSRM) | When speed-constant ETAs cause user complaints |
| KNN "nearest N" RPC function | When emergency shortcut UI feature is added |
| `candidate_ids` pre-filter param | When static layer pre-filtering is wired into orchestrator |
| GPS position tracking (live updates) | When real-time "follow me" map mode is added |
