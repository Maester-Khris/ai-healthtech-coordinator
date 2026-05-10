# Task: FastAPI Backend Skeleton

**ID:** 001  
**Scope:** `backend`  
**Branch:** `feat/backend-skeleton`  
**Tests required:** no

---

## Context
The hackathon build had no real backend — the cloud function was broken and never connected
to the frontend. v2.0 introduces a FastAPI backend as the sole intermediary between the
frontend and all external services (LLM, Geoapify). This task sets up the skeleton only —
no business logic yet.

## Acceptance Criteria
- [ ] `backend/main.py` with FastAPI app, CORS configured for Vercel origins, and `GET /health` returning `{ status: "ok", llmProvider: "<LLM_PROVIDER value>" }`
- [ ] `backend/models.py` with Pydantic models mirroring `shared/types.ts` — `Severity`, `Facility`, `TriageRequest`, `TriageResult`, `ToolTrace`
- [ ] `backend/llm/client.py` with abstract LLM client interface and `get_llm_client()` factory reading `LLM_PROVIDER` env var
- [ ] `backend/llm/groq.py` stub — class defined, methods raise `NotImplementedError`
- [ ] `backend/llm/anthropic.py` stub — same
- [ ] `backend/llm/tools.py` with `classify_severity` and `get_nearest_facility` tool definitions as plain dicts
- [ ] `requirements.txt` with pinned versions: `fastapi`, `uvicorn`, `pydantic`, `python-dotenv`, `groq`, `anthropic`, `httpx`
- [ ] `LLM_PROVIDER` and `GEOAPIFY_API_KEY` added to `.env.example`
- [ ] App runs locally: `doppler run -- uvicorn backend.main:app --reload`
- [ ] TypeScript in `shared/types.ts` already exists and matches `backend/models.py`

## Out of Scope
- Actual LLM calls — stubs only
- `/triage` endpoint — that is task 002
- Geoapify integration — that is task 003
- Supabase, auth, database — not in Phase 1

## Notes for Implementation
- Read `docs/ARCHITECTURE.md` (LLM abstraction section) and `docs/API.md` (types reference) before writing any code
- CORS allowed origins should be read from an env var `ALLOWED_ORIGINS` (comma-separated), not hardcoded
- `shared/types.ts` must exist before `backend/models.py` is written — if it doesn't exist, create it first and flag this in the outcome summary