# Task: FastAPI Backend — Base Endpoints

**ID:** 001
**Scope:** `backend`, `shared`
**Branch:** `feat/backend-api`
**Tests required:** no

---

## Context

The hackathon build had no real backend. v2.0 introduces a FastAPI app as the sole
intermediary between the frontend and all external services (Supabase, LLM, Geoapify).

This task delivers the base layer only: server info, health check, and a facility list
endpoint backed by real Supabase data. No LLM calls, no triage logic, no routing.

---

## Acceptance Criteria

- [x] `backend/main.py` — FastAPI app with CORS, three endpoints (see below)
- [x] `backend/models.py` — Pydantic models mirroring both the Supabase schema and `shared/types.ts`
- [x] `backend/services/facilities.py` — Supabase query function using service role key
- [x] `backend/db.py` — Supabase client factory (reads env vars, raises if missing)
- [x] `backend/requirements.txt` — all required packages with pinned major versions
- [x] `.env.example` updated with all env vars introduced in this task
- [x] `shared/types.ts` — created if it does not exist, must mirror `backend/models.py` exactly
- [ ] App starts locally without errors: `doppler run -- uvicorn backend.main:app --reload`
- [ ] `GET /health` returns 200 with correct body
- [ ] `GET /facilities` returns a non-empty JSON array when Supabase is seeded

---

## Endpoints

### GET `/`
Server info. No auth required.

Response `200`:
```json
{
  "service": "MediCoord AI API",
  "version": "0.1.0",
  "status": "running"
}
```

### GET `/health`
Liveness check. Used by Render to confirm the service is running.

Response `200`:
```json
{
  "status": "ok",
  "llmProvider": "groq"
}
```
`llmProvider` reads from `LLM_PROVIDER` env var. Default to `"groq"` if not set.

### GET `/facilities`
Returns all facilities from Supabase. No pagination for now — full list.

Query params (all optional):
- `category` — filter by `hospital | ambulatory | residential`
- `severity` — filter where `accepted_severity` array contains this value

Response `200`:
```json
[
  {
    "id": "uuid",
    "name": "Toronto General Hospital",
    "category": "hospital",
    "source_facility_type": "general",
    "accepted_severity": ["emergent", "urgent", "moderate", "routine"],
    "address": "200 Elizabeth St, Toronto, ON M5G 2C4",
    "lat": 43.6590,
    "lng": -79.3887,
    "source": "odhf"
  }
]
```

Response `503` if Supabase is unreachable:
```json
{ "detail": "Database unavailable" }
```

---

## Supabase Schema to Mirror

```sql
facilities (
  id                   uuid        -- primary key
  name                 text        -- not null
  category             text        -- 'hospital' | 'ambulatory' | 'residential'
  source_facility_type text        -- raw ODHF type, lowercased
  accepted_severity    text[]      -- e.g. ['emergent','urgent','moderate','routine']
  address              text
  lat                  float8
  lng                  float8
  source               text        -- default 'odhf'
  created_at           timestamptz
  updated_at           timestamptz
)
```

---

## File Structure to Produce

```
backend/
├── main.py                  # FastAPI app, CORS, route registration
├── models.py                # Pydantic models: Facility, FacilityCategory, Severity
├── db.py                    # Supabase client factory
├── requirements.txt
└── services/
    └── facilities.py        # get_all_facilities(category, severity) -> list[Facility]

shared/
└── types.ts                 # TypeScript mirror of backend/models.py — create if missing
```

---

## Pydantic Models (`backend/models.py`)

```python
from enum import Enum
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

class Severity(str, Enum):
    routine  = "routine"
    moderate = "moderate"
    urgent   = "urgent"
    emergent = "emergent"

class FacilityCategory(str, Enum):
    hospital    = "hospital"
    ambulatory  = "ambulatory"
    residential = "residential"

class Facility(BaseModel):
    id:                   UUID
    name:                 str
    category:             FacilityCategory
    source_facility_type: str
    accepted_severity:    list[Severity]
    address:              str
    lat:                  float
    lng:                  float
    source:               str
    created_at:           datetime | None = None
    updated_at:           datetime | None = None
```

`shared/types.ts` must mirror this exactly:

```typescript
export type Severity         = "routine" | "moderate" | "urgent" | "emergent";
export type FacilityCategory = "hospital" | "ambulatory" | "residential";

export interface Facility {
  id:                   string;
  name:                 string;
  category:             FacilityCategory;
  source_facility_type: string;
  accepted_severity:    Severity[];
  address:              string;
  lat:                  number;
  lng:                  number;
  source:               string;
  created_at?:          string;
  updated_at?:          string;
}
```

---

## Supabase Client (`backend/db.py`)

- Read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `os.environ`
- Raise `RuntimeError` with a clear message if either is missing
- Expose a single `get_supabase_client()` function — no module-level client instantiation
- Services import `get_supabase_client()` and call it per request (supabase-py is stateless)

---

## Facilities Service (`backend/services/facilities.py`)

```python
def get_all_facilities(
    category: str | None = None,
    severity: str | None = None,
) -> list[dict]:
```

- Query `facilities` table via supabase-py
- If `category` provided: `.eq("category", category)`
- If `severity` provided: `.contains("accepted_severity", [severity])`
- On exception: log the error, raise `HTTPException(503, "Database unavailable")`
- Return raw dicts — `main.py` validates into `list[Facility]`

---

## CORS (`backend/main.py`)

```python
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
```

Strip whitespace from each origin. Add `CORSMiddleware` with:
- `allow_origins=ALLOWED_ORIGINS`
- `allow_methods=["GET", "POST"]`
- `allow_headers=["Content-Type", "Authorization"]`

---

## Environment Variables

Add to `.env.example` (no values — Doppler supplies at runtime):

```bash
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# LLM provider feature flag
LLM_PROVIDER=groq                  # groq | anthropic

# CORS — comma-separated list of allowed frontend origins
ALLOWED_ORIGINS=http://localhost:5173
```

---

## requirements.txt

```
fastapi==0.111.*
uvicorn[standard]==0.29.*
pydantic==2.*
supabase==2.*
python-dotenv          # imported but not used for loading — Doppler handles env
```

---

## Out of Scope

- LLM calls of any kind — `LLM_PROVIDER` is read for `/health` only
- `/triage` endpoint — task 002
- Geoapify integration — task 003
- Auth middleware or JWT validation — Phase 2
- Pagination on `/facilities` — Phase 2
- Background workers — Phase 2

---

## Notes

- Do not instantiate the Supabase client at module level — call `get_supabase_client()`
  inside each service function to avoid cold-start failures if env vars are missing
- `shared/types.ts` is the frontend contract — if it doesn't exist, create it first
  and flag "shared/types.ts created" in the outcome summary
- All env vars must be in `.env.example` before any code references them
- Run `doppler run -- uvicorn backend.main:app --reload` to verify startup before committing