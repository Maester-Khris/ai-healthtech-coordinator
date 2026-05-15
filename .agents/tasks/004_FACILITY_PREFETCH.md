# Task: Facilities Prefetch — In-Memory Cache, ETag, Map Integration

**ID:** 004
**Scope:** `backend`, `frontend`
**Tests required:** no

---

## Context

The map currently renders from static `baseData.ts`. This task replaces that with
real data fetched from the backend `/facilities` endpoint.

Performance constraints:
- Fetch fires on app mount — not on user interaction, not inside the map component
- A loading spinner shows on the map until the fetch resolves
- Backend serves from an in-memory cache loaded once at startup — Supabase is not
  queried on every request
- ETag header prevents redundant data transfer on subsequent fetches when data
  has not changed
- Render free tier cold starts will bypass the cache (process restarted) — the
  spinner is therefore load-bearing, not decorative

---


## Backend changes

### In-memory cache (`backend/cache.py`) — create

Module-level cache holding the facility list and its ETag.
Loaded once at startup. Never written to after that in this phase.

```python
import hashlib
import json
from typing import Any

_cache: dict[str, Any] = {
    "facilities": None,   # list[dict] | None
    "etag": None,         # str | None
}

def get_cached_facilities() -> tuple[list[dict] | None, str | None]:
    return _cache["facilities"], _cache["etag"]

def set_cached_facilities(data: list[dict]) -> str:
    """Store data and compute + store ETag. Returns the new ETag."""
    serialized = json.dumps(data, sort_keys=True, default=str)
    etag = f'"{hashlib.sha256(serialized.encode()).hexdigest()[:32]}"'
    _cache["facilities"] = data
    _cache["etag"] = etag
    return etag
```

ETag format follows RFC 7232 — wrapped in double quotes as a strong ETag.

### Startup cache warm-up (`backend/main.py`) — modify

Use FastAPI lifespan to load facilities from Supabase once at startup:

```python
from contextlib import asynccontextmanager
from backend.cache import set_cached_facilities
from backend.services.facilities import get_all_facilities

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm cache on startup
    try:
        data = get_all_facilities()
        set_cached_facilities(data)
        print(f"Cache warm: {len(data)} facilities loaded")
    except Exception as exc:
        print(f"WARN: Cache warm failed — {exc}. First request will hit Supabase.")
    yield
    # Shutdown: nothing to clean up

app = FastAPI(lifespan=lifespan, ...)
```

A failed warm-up is non-fatal — the endpoint falls back to a live Supabase query
and caches the result on first request.

### `GET /facilities` — modify (`backend/main.py` or router)

Updated endpoint with ETag support:

```python
from fastapi import Request
from fastapi.responses import Response, JSONResponse
from backend.cache import get_cached_facilities, set_cached_facilities
from backend.services.facilities import get_all_facilities
from backend.models import Facility

@app.get("/facilities")
async def facilities(
    request: Request,
    category: str | None = None,
    severity: str | None = None,
):
    cached_data, cached_etag = get_cached_facilities()

    # Cache miss: fetch from Supabase and populate cache
    if cached_data is None:
        raw = get_all_facilities(category=None, severity=None)
        cached_etag = set_cached_facilities(raw)
        cached_data = raw

    # Apply filters in memory (cache holds unfiltered full list)
    data = cached_data
    if category:
        data = [r for r in data if r["category"] == category]
    if severity:
        data = [r for r in data if severity in r.get("accepted_severity", [])]

    # ETag check — compute filtered ETag for conditional response
    import hashlib, json
    filtered_etag = f'"{hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()[:32]}"'

    client_etag = request.headers.get("If-None-Match", "")
    if client_etag == filtered_etag:
        return Response(status_code=304)

    return JSONResponse(
        content=data,
        headers={"ETag": filtered_etag, "Cache-Control": "no-cache"},
    )
```

Key details:
- Cache stores the full unfiltered list — filters are applied in memory per request
- ETag is computed from the filtered response so category/severity-specific
  requests get their own ETag
- `Cache-Control: no-cache` tells the client to always revalidate — the ETag
  handles whether a full response is needed
- 304 has no body — `Response(status_code=304)` not `JSONResponse`

---

## Frontend changes

### Environment variable

`VITE_API_BASE_URL` must be read from Doppler. Add to `.env.example`:

```bash
# Already present from task 001 — confirm it exists, do not duplicate
VITE_API_BASE_URL=http://localhost:8000
```

In Doppler: confirm `VITE_API_BASE_URL` exists for the frontend config.
The `apiClient.ts` already reads this — no code change needed if task 001 is complete.

### `useFacilities` hook (`webapp/src/hooks/useFacilities.ts`) — create

Top-level hook. Fires on mount. Stores ETag for conditional subsequent fetches.

```typescript
import { useState, useEffect, useRef } from "react"
import { Facility } from "../../shared/types"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

interface UseFacilitiesResult {
  facilities: Facility[]
  loading: boolean
  error: string | null
}

export function useFacilities(): UseFacilitiesResult {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const etagRef                     = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchFacilities() {
      try {
        const headers: Record<string, string> = {}
        if (etagRef.current) {
          headers["If-None-Match"] = etagRef.current
        }

        const res = await fetch(`${BASE_URL}/facilities`, { headers })

        if (res.status === 304) {
          // Data unchanged — keep existing state, just stop loading
          setLoading(false)
          return
        }

        if (!res.ok) {
          throw new Error(`Failed to load facilities (${res.status})`)
        }

        const etag = res.headers.get("ETag")
        if (etag) etagRef.current = etag

        const data: Facility[] = await res.json()
        if (!cancelled) {
          setFacilities(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchFacilities()
    return () => { cancelled = true }
  }, [])

  return { facilities, loading, error }
}
```

Note: `etagRef` uses `useRef` not `useState` — storing the ETag must not trigger
a re-render. The `cancelled` flag prevents state updates on unmounted components.

### Call site: `App.tsx` — modify

Call `useFacilities()` at the top level of `App.tsx` and pass results down:

```typescript
const { facilities, loading: facilitiesLoading, error: facilitiesError } = useFacilities()
```

Pass `facilities`, `facilitiesLoading` as props to the map panel component.
Do not call `useFacilities()` inside the map component itself — this would
cause a re-fetch every time the map remounts.

### Map panel component — modify

**Replace static `baseData.ts` markers** with the `facilities` prop.

Accept new props:
```typescript
interface MapPanelProps {
  facilities: Facility[]
  facilitiesLoading: boolean
}
```

**Loading spinner** — shown in the top-left of the map panel while
`facilitiesLoading` is true. Positioned absolute, above the map tiles,
below the zoom controls (z-index between them):

```tsx
{facilitiesLoading && (
  <div style={{
    position: "absolute",
    top: 52,       // below zoom controls
    left: 12,
    zIndex: 15,
    background: "rgba(255,255,255,0.88)",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    color: "#557",
    display: "flex",
    alignItems: "center",
    gap: 6,
  }}>
    <span style={{
      width: 12, height: 12, borderRadius: "50%",
      border: "2px solid #185FA5",
      borderTopColor: "transparent",
      display: "inline-block",
      animation: "spin 0.8s linear infinite",
    }} />
    Loading facilities…
  </div>
)}
```

Add the `@keyframes spin` to the global CSS file:
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**Facility markers** — render from the `facilities` prop using the Option B
cross SVG icon decided in the marker design session:

```typescript
const facilityIcon = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="28" height="28">
    <path fill="#E24B4A" d="M452.6,178.1h-96.1c-12.5,0-22.6-10.1-22.6-22.6V59.4
      c0-12.5-10.1-22.6-22.6-22.6H200.7c-12.5,0-22.6,10.1-22.6,22.6v96.1
      c0,12.5-10.1,22.6-22.6,22.6H59.4c-12.5,0-22.6,10.1-22.6,22.6v110.6
      c0,12.5,10.1,22.6,22.6,22.6h96.1c12.5,0,22.6,10.1,22.6,22.6v96.1
      c0,12.5,10.1,22.6,22.6,22.6h110.6c12.5,0,22.6-10.1,22.6-22.6v-96.1
      c0-12.5,10.1-22.6,22.6-22.6h96.1c12.5,0,22.6-10.1,22.6-22.6V200.7
      C475.2,188.2,465.1,178.1,452.6,178.1z"/>
  </svg>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
})
```

Each facility marker renders a Leaflet `Popup` on click with:
- Facility name (bold)
- Category (capitalized)
- Address
- Accepted severity levels as colored badges

**Remove all references to `baseData.ts`** from the map panel component.
If `baseData.ts` is not used anywhere else after this task, delete the file
and note it in the outcome summary.

**"43 FACILITIES ACTIVE" status pill** — replace the hardcoded number with
`{facilities.length} FACILITIES ACTIVE`. Show `—` while loading.

---

## Files changed summary

```
backend/
├── cache.py                     # create — in-memory cache module
└── main.py                      # modify — lifespan warm-up + ETag on /facilities

webapp/src/
├── hooks/
│   └── useFacilities.ts         # create — prefetch hook with ETag
├── App.tsx                      # modify — call useFacilities, pass props down
└── <MapPanel component>         # modify — accept props, spinner, real markers, popup

.env.example                     # confirm VITE_API_BASE_URL present (no duplicate)
```

---

## Commit

Single commit after all changes are complete and verified:

```bash
git add backend/cache.py \
        backend/main.py \
        webapp/src/hooks/useFacilities.ts \
        webapp/src/App.tsx \
        webapp/src/<MapPanel file> \
        webapp/src/index.css      # if spin keyframe added here

git commit -m "feat(facilities): prefetch from backend, in-memory cache, ETag, map markers from real data"
```

---

## Verification checklist

- [ ] `doppler run -- uvicorn backend.main:app --reload` logs "Cache warm: N facilities loaded" on startup
- [ ] `GET /facilities` returns 200 with `ETag` header on first request
- [ ] `GET /facilities` with matching `If-None-Match` returns 304 with empty body
- [ ] Map renders real facility markers from the API response (not baseData.ts)
- [ ] Loading spinner appears briefly on first load, disappears when data arrives
- [ ] Facility count pill shows real count from `facilities.length`
- [ ] Clicking a facility marker shows a popup with name, category, address
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No console errors in the browser

---

## Out of Scope

- Cache invalidation / TTL — data is static for now, manual restart clears cache
- Pagination — full list only
- Facility filtering UI on the frontend — task 005
- Auth on `/facilities` — stays public read
- Redis or persistent cache — Phase 2
- Geoapify routing — task 003 (backend) / later frontend task