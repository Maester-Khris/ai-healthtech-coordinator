# MediCoord AI — Facility Seed Script

Reads the Statistics Canada **Open Database of Healthcare Facilities (ODHF) v1.1**
and upserts matching facilities into the Supabase `facilities` table.

## Data source
ODHF v1.1 — Statistics Canada (open licence).
File expected at: `seed/data/odhf_v1.1.csv` (latin-1 encoding).

## Setup
```bash
pip install -r seed/requirements.txt
```

## Run
```bash
doppler setup --project medicoord --config dev_personal --no-interactive && doppler run -- python -m run
```
Credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) are injected by Doppler at runtime.

## Re-run safety
Upserts on the composite key `(name, lat, lng)` — running the script multiple
times produces no duplicates.

## Filter decisions
- **Province:** Ontario only (`province == 'on'`)
- **Region:** `CSDname` contains `"toronto"` (case-insensitive)
- **Coordinates:** rows with missing or non-numeric lat/lng are skipped and logged
