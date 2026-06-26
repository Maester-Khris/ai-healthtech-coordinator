# MediCoord AI — Search Orchestrator Design
**Version:** 1.0  
**Status:** Approved for implementation  
**Scope:** Unified facility search system across 4 data residency layers

---

## 1. Problem Statement

MediCoord's search must aggregate facility data that lives in fundamentally different places, refreshes at different rates, and requires different access patterns. A naive sequential approach (filter → query → enrich) compounds latency at every step. A naive parallel approach without a clear contract produces incoherent results when layers partially fail.

The orchestrator solves this by:
- Defining one canonical entry schema and one canonical output schema that never change regardless of which layers contribute
- Running non-dependent layers in parallel
- Making every layer independently optional and gracefully degradable
- Designing the filter pipeline so new data sources extend it without restructuring it

---

## 2. Data Residency Map

Each data attribute lives in exactly one layer. This is the source of truth for where queries go and who owns invalidation.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 0 — In-memory / Client bundle                                     │
│ Owner: Frontend                          Refresh: App init + daily CDN  │
│                                                                         │
│  facility_id, name, type, address, phone, coordinates (display),        │
│  services_offered[], accessibility_features[], languages_spoken[],      │
│  insurance_accepted[], ownership_type                                   │
│                                                                         │
│  Filter cost: 0ms (synchronous, in-memory Set/Map operations)           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 1 — Supabase DB (facility_clean table)                            │
│ Owner: Backend API              Refresh: Admin pipeline / manual        │
│                                                                         │
│  coordinates (PostGIS geography), capacity, is_operational,             │
│  weekday_hours (JSONB), weekend_hours (JSONB), created_at, updated_at  │
│                                                                         │
│  Filter cost: ~80–200ms (PostGIS ST_DWithin + index scan)               │
│  Access: Backend only (service key, never exposed to client)            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 2 — Upstash Redis                                                 │
│ Owner: Backend API              Refresh: Background job (TTL: 5–10 min) │
│                                                                         │
│  current_load (int), wait_minutes (int), is_open_now (bool),            │
│  last_updated (timestamp)                                               │
│                                                                         │
│  Filter cost: ~5–20ms (Redis MGET on N keys, Upstash REST)              │
│  Access: Backend only (Upstash token, never exposed to client)          │
│  Fallback: Supabase DB read on Redis miss                               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 3 — Computed at query time                                        │
│ Owner: Backend API              Refresh: Per request                    │
│                                                                         │
│  distance_m (PostGIS), eta_minutes (distance / mode_speed),             │
│  combined_score (ranking formula)                                       │
│                                                                         │
│  Filter cost: 0ms additional (computed inside Layer 1 SQL query)        │
│  Note: eta_minutes uses speed constants until routing API is wired      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Canonical Schemas

### 3.1 SearchQuery — single entry point

One object, always. Each layer reads only the fields it needs and ignores the rest. Adding a new filter means adding a new optional field — no structural changes.

```typescript
interface SearchQuery {
  // ── Context (required) ───────────────────────────────────────────────
  location: {
    lat: number
    lng: number
  }
  transportMode: 'walk' | 'transit' | 'drive'    // affects ETA + search radius

  // ── Layer 0 filters — static, resolved client-side ───────────────────
  types?: FacilityType[]                          // 'hospital' | 'clinic' | 'pharmacy' | ...
  services?: string[]                             // e.g. ['emergency', 'pediatrics']
  languages?: string[]                            // e.g. ['fr', 'ar']
  accessibility?: AccessibilityFeature[]          // e.g. ['wheelchair', 'sign_language']
  insuranceAccepted?: string[]                    // e.g. ['OHIP', 'private']
  // → EXTENSIBILITY HOOK: any new static attribute adds here as optional field

  // ── Layer 1 filters — requires backend DB query ───────────────────────
  radiusKm?: number                               // default: derived from transportMode
  isOperational?: boolean                         // default: true
  // isOpenNow computed from weekday_hours JSONB — DEFERRED (see §7)

  // ── Layer 2 filters — applied post-enrichment ────────────────────────
  maxWaitMinutes?: number
  maxLoad?: number                                // 0–100 occupancy percentage
  // → EXTENSIBILITY HOOK: any new live attribute filter adds here

  // ── Output control ────────────────────────────────────────────────────
  limit?: number                                  // default: 10
  rankBy?: 'distance' | 'wait_time' | 'combined' // default: 'combined'
}
```

**Transport-to-radius defaults** (overridable):

| Mode | Default radius | Speed constant |
|------|---------------|----------------|
| walk | 2 km | 1.4 m/s |
| transit | 8 km | 6.0 m/s |
| drive | 15 km | 11.0 m/s |

---

### 3.2 SearchResult — single output shape

The output schema is always the same regardless of which layers contributed. Fields from layers that didn't resolve are `null`, never absent. The client always knows what to expect.

```typescript
interface FacilityResult {
  // ── Identity ─────────────────────────────────────────────────────────
  id: string
  name: string
  type: FacilityType
  address: string
  phone: string | null

  // ── Static attributes (Layer 0) ───────────────────────────────────────
  services: string[]
  languages: string[]
  accessibility: AccessibilityFeature[]
  insuranceAccepted: string[]

  // ── Proximity (Layers 1 + 3) ──────────────────────────────────────────
  distanceM: number
  etaMinutes: number
  transportMode: TransportMode

  // ── Operational (Layer 1) ─────────────────────────────────────────────
  isOperational: boolean
  isOpenNow: boolean | null           // null = not yet computed (deferred)

  // ── Live data (Layer 2) ───────────────────────────────────────────────
  waitMinutes: number | null          // null = Redis miss + DB miss
  currentLoad: number | null          // 0–100, null = unknown
  liveDataFreshness: 'fresh' | 'stale' | 'unavailable'

  // ── Ranking ───────────────────────────────────────────────────────────
  score: number                       // combined ranking score
  scoreBreakdown: {
    distanceScore: number
    waitScore: number
    loadScore: number
  }
}

interface SearchResponse {
  results: FacilityResult[]
  meta: {
    total: number
    layers: {
      static: 'hit' | 'skipped'
      proximity: 'hit' | 'error' | 'skipped'
      availability: 'hit' | 'partial' | 'miss' | 'skipped'
    }
    latencyMs: {
      staticFilter: number
      backendQuery: number
      redisEnrich: number
      total: number
    }
    query: SearchQuery                // echo for debugging + cache key generation
  }
}
```

---

## 4. Orchestrator Execution Flow

```
Frontend
  │
  │  POST /api/facilities/search  { SearchQuery }
  │
  ▼
Backend API (search orchestrator)
  │
  ├─► [STEP 1] Validate + normalize query
  │     • apply transport-mode radius defaults
  │     • clamp limit (max 50)
  │     • start latency timer
  │
  ├─► [STEP 2] Resolve candidate IDs from static filter hints
  │     • Frontend sends optional candidateIds[] computed locally
  │     • If absent: backend queries all facilities in radius (no pre-filter)
  │     • If present: backend scopes PostGIS query to candidateIds (faster)
  │
  ├─► [STEP 3] Parallel execution
  │     │
  │     ├──── Layer 1: PostGIS proximity query ─────────────────────────┐
  │     │      ST_DWithin + ST_Distance + ETA computation               │
  │     │      Filters: isOperational, candidateIds, radius             │
  │     │      Returns: [{id, distanceM, etaMinutes, isOperational}]    │
  │     │                                                               │
  │     └──── Layer 2: Redis MGET (fire immediately, resolve async) ───►│
  │            Keys: facility:live:{id} for all candidateIds            │
  │            Fallback on miss: Supabase SELECT for missing ids        │
  │            Returns: [{id, waitMinutes, currentLoad, isOpenNow}]     │
  │                                                                     │
  ▼                                                                     │
  [STEP 4] Merge results ◄──────────────────────────────────────────────┘
  │  Join on facility_id
  │  Annotate liveDataFreshness based on Redis TTL age
  │  Static attributes merged from Layer 0 data (passed in candidateIds payload
  │  or fetched from a lightweight static endpoint)
  │
  ├─► [STEP 5] Post-enrichment filters
  │     • maxWaitMinutes (requires Layer 2 resolved)
  │     • maxLoad (requires Layer 2 resolved)
  │     • Layer 2 filters applied here ONLY — not before enrichment
  │
  ├─► [STEP 6] Rank
  │     combined_score = α×(1/distanceM) + β×(1/waitMinutes) + γ×(1/currentLoad)
  │     α, β, γ weights: tunable per rankBy preference
  │     Null live data: treated as median value for ranking (not penalized)
  │
  └─► [STEP 7] Return SearchResponse
        Attach meta.layers and meta.latencyMs for observability
```

---

## 5. Frontend Responsibility: Static Pre-filter

The frontend maintains a lightweight in-memory index built from a static manifest (fetched once at app init from CDN or `/api/facilities/static`).

```typescript
// Built once, stored in app state
const staticIndex = new Map<string, FacilityStaticRecord>()

function computeCandidateIds(query: SearchQuery): string[] {
  return [...staticIndex.values()]
    .filter(f => {
      if (query.types?.length && !query.types.includes(f.type)) return false
      if (query.services?.length && !query.services.some(s => f.services.includes(s))) return false
      if (query.languages?.length && !query.languages.some(l => f.languages.includes(l))) return false
      if (query.accessibility?.length && !query.accessibility.every(a => f.accessibility.includes(a))) return false
      if (query.insuranceAccepted?.length && !query.insuranceAccepted.some(i => f.insuranceAccepted.includes(i))) return false
      return true
    })
    .map(f => f.id)
}
```

The `candidateIds[]` array is included in the POST body alongside the SearchQuery. This is a **hint**, not a contract — the backend verifies proximity independently and may include or exclude IDs.

**Why this matters for latency:** If a user filters to "hospitals only" and there are 8 hospitals in the static index vs 200 total facilities, the PostGIS query scans 8 rows instead of 200. No extra roundtrip — the filter travels with the search request.

---

## 6. Backend: Proximity Query (Layer 1)

```sql
SELECT
  f.id,
  f.name,
  f.type,
  f.address,
  f.phone,
  f.is_operational,
  ST_Distance(
    f.coordinates::geography,
    ST_MakePoint($lng, $lat)::geography
  )::int AS distance_m,
  ROUND(
    ST_Distance(
      f.coordinates::geography,
      ST_MakePoint($lng, $lat)::geography
    ) / $mode_speed_mps / 60
  )::int AS eta_minutes
FROM facility_clean f
WHERE
  ($candidate_ids IS NULL OR f.id = ANY($candidate_ids))
  AND f.is_operational = true
  AND ST_DWithin(
    f.coordinates::geography,
    ST_MakePoint($lng, $lat)::geography,
    $radius_m
  )
ORDER BY distance_m ASC
LIMIT $limit;
```

**Required index on `facility_clean`:**
```sql
CREATE INDEX idx_facility_coordinates
ON facility_clean USING GIST (coordinates);
```

---

## 7. Backend: Availability Layer (Layer 2)

### Redis key schema
```
facility:live:{facility_id}
Value (JSON string):
{
  "waitMinutes": 12,
  "currentLoad": 67,
  "isOpenNow": true,
  "updatedAt": "2026-06-26T14:32:00Z"
}
TTL: 600s (10 min)
```

### Read strategy (MGET + fallback)

```typescript
async function fetchAvailabilityLayer(ids: string[]): Promise<AvailabilityMap> {
  const keys = ids.map(id => `facility:live:${id}`)
  const redisResults = await redis.mget(...keys)  // Upstash REST batch

  const availabilityMap: AvailabilityMap = {}
  const missedIds: string[] = []

  ids.forEach((id, i) => {
    if (redisResults[i]) {
      const data = JSON.parse(redisResults[i])
      availabilityMap[id] = { ...data, freshness: 'fresh' }
    } else {
      missedIds.push(id)
    }
  })

  // Supabase fallback for cache misses
  if (missedIds.length > 0) {
    const dbResults = await supabase
      .from('facility_live_snapshot')       // materialized or updated by background job
      .select('id, wait_minutes, current_load, is_open_now, updated_at')
      .in('id', missedIds)

    dbResults.data?.forEach(row => {
      availabilityMap[row.id] = {
        waitMinutes: row.wait_minutes,
        currentLoad: row.current_load,
        isOpenNow: row.is_open_now,
        updatedAt: row.updated_at,
        freshness: 'stale'               // DB data = stale vs Redis
      }
    })
  }

  // Remaining misses: return null with 'unavailable' marker
  ids.forEach(id => {
    if (!availabilityMap[id]) {
      availabilityMap[id] = {
        waitMinutes: null,
        currentLoad: null,
        isOpenNow: null,
        freshness: 'unavailable'
      }
    }
  })

  return availabilityMap
}
```

### Why backend-only for Redis

| Concern | Frontend call | Backend call |
|---------|--------------|--------------|
| Credential exposure | Upstash token in client bundle | Token in env var only |
| Fallback to Supabase on miss | Requires second client request | Single server-side logic |
| Rate limiting / abuse | Unprotected | Behind API auth |
| Redis→DB fallback logic | Duplicated in client | Single implementation |
| Latency | 1 hop (client→Upstash) | 1 hop (server→Upstash) — same network |

The latency argument for frontend-direct access does not hold: Upstash REST from a Vercel/Railway server in the same region is equivalent to or faster than browser→Upstash because it avoids TLS negotiation overhead from heterogeneous client networks.

---

## 8. Ranking Formula

```typescript
function computeScore(result: MergedResult, rankBy: RankBy): number {
  const WEIGHTS = {
    distance: { α: 0.6, β: 0.2, γ: 0.2 },
    wait_time: { α: 0.2, β: 0.6, γ: 0.2 },
    combined:  { α: 0.4, β: 0.35, γ: 0.25 },
  }[rankBy]

  // Normalize each dimension to 0–1 (higher = better)
  const distanceScore = 1 / (1 + result.distanceM / 1000)       // decay over km
  const waitScore     = result.waitMinutes != null
    ? 1 / (1 + result.waitMinutes / 15)                          // decay over 15-min increments
    : 0.5                                                        // median assumption on null
  const loadScore     = result.currentLoad != null
    ? 1 - (result.currentLoad / 100)
    : 0.5

  return (
    WEIGHTS.α * distanceScore +
    WEIGHTS.β * waitScore +
    WEIGHTS.γ * loadScore
  )
}
```

---

## 9. Latency Budget

| Step | Target | Notes |
|------|--------|-------|
| Static filter (client) | < 5ms | In-memory, synchronous |
| POST to backend | < 20ms | Local network / same region |
| PostGIS query | < 100ms | With GIST index, ~200 candidates |
| Redis MGET | < 20ms | Upstash REST, batch |
| Supabase fallback (if miss) | < 80ms | Only partial set |
| Merge + rank | < 5ms | In-memory |
| **Total P95** | **< 200ms** | Redis warm path |
| **Total P95** | **< 350ms** | With partial DB fallback |

---

## 10. Extensibility Contract

New data source (e.g. Google Maps ratings, MOH external feed):

1. Add fields to `SearchQuery` (optional, typed)
2. Add fields to `FacilityResult` (nullable)
3. Add a new layer function `fetchLayer4(...)`
4. Wire into Step 3 parallel block
5. Add to `meta.layers` for observability

**Nothing else changes.** The entry schema, output schema, merge step, and ranking step are all additive by design.

New static filter attribute (e.g. `servicesProvided`, `hasParking`):

1. Add to static manifest (CDN payload)
2. Add field to `FacilityStaticRecord` type
3. Add one filter clause to `computeCandidateIds()`
4. Add optional field to `SearchQuery`

Zero backend changes required.

---

## 11. Deferred Items

| Item | Reason deferred | Extensibility path |
|------|-----------------|--------------------|
| `isOpenNow` from `weekday_hours` JSONB | Complex timezone + DST logic | Layer 1 filter when implemented; query already returns hours JSONB |
| Routing API for real ETA | Cost + complexity | Swap speed constant in Layer 3 computation; no schema change |
| Real-time websocket load push | Redis polling sufficient for v1 | Redis TTL reduced + SSE endpoint added; no orchestrator change |
| `servicesProvided` filter | Static data not yet normalized | Layer 0 field + client filter; no backend change |
| Pagination / cursor | Not needed for radius-bounded results | Add `cursor` to SearchQuery + `nextCursor` to SearchResponse |

---

## 12. Summary Decision Log

| Decision | Rationale |
|----------|-----------|
| Proximity query on backend | PostGIS on Supabase, service key never exposed to client |
| Redis query on backend | Fallback logic (Redis→DB) is server-side; Upstash token stays in env |
| Static filter on frontend | Zero latency, reduces backend scan surface |
| candidateIds as hint not contract | Backend is authoritative on proximity; client pre-filter is an optimization |
| Null live data = median for ranking | Avoids penalizing facilities with unavailable data, preserves ranking stability |
| One SearchQuery / one SearchResponse always | Extensibility without breaking changes; every consumer has stable types |
