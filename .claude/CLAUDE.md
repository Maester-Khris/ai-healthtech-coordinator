# MediCoord AI — Claude Code Project Context

## Project in One Sentence
A city-wide health coordination system where users describe symptoms in a chat interface and an AI agent routes them to the nearest appropriate facility on a live map.

## Repository Structure
```
medicoordai/
├── backend/          # FastAPI — triage API, LLM tool orchestration
├── webapp/           # React + Vite + TypeScript — chat + map UI
├── shared/           # Shared TypeScript types (severity schema, API contracts)
├── docs/             # Architecture, ADRs, API contract
├── .claude/          # This folder
└── .github/          # CI/CD workflows
```

## Tech Stack (non-negotiable, do not suggest alternatives)
- **Frontend:** React 18, Vite, TypeScript (strict), Tailwind CSS
- **Backend:** Python 3.11, FastAPI
- **AI:** Groq (primary, free tier) or Anthropic Claude — controlled via feature flag `LLM_PROVIDER`
- **Routing:** Geoapify Route Matrix API
- **Auth / DB:** Supabase — not in scope for current phase, do not scaffold yet
- **Env vars:** Doppler — all `run` commands must use `doppler run --`
- **Frontend deploy:** Vercel (preview on PR, production on main)
- **Backend deploy:** Render (web service + background worker if needed)

## Running Commands
Always inject environment variables via Doppler:
```bash
# Backend
doppler run -- uvicorn backend.main:app --reload

# Frontend
doppler run -- npm run dev

# Tests
doppler run -- pytest
doppler run -- npm run test
```
Never hardcode secrets. Never use a raw `.env` file in commands.

## Current Scope (Phase 1)
**In scope:** User ↔ chatbot interaction only.
- Symptom input → severity classification → facility routing → map response
- `/triage` endpoint and LLM tool orchestration

**Out of scope (do not implement or scaffold):**
- Supabase auth or database integration
- Emergency contact notifications
- Predictive analytics tab
- Admin dashboard

## Severity Schema — Single Source of Truth
Defined in `shared/types.ts`. The four valid values are:
```
routine | moderate | urgent | emergent
```
Never use: `critical`, `severe`, `high`, `low`, or any synonym. If you see these in existing code, flag it — do not silently fix it without noting it in your task summary.

## Code Conventions
- TypeScript: strict mode, no `any`, all props interfaces defined
- Python: type hints on all function signatures, Pydantic models for all request/response bodies
- New backend routes: matching type must exist in `shared/types.ts` first
- No new npm packages without noting it in the task summary
- No new Python dependencies without adding to `requirements.txt`

## Git Rules
- Never add Claude as a co-author on commits
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- Never commit directly to `main` or `preview` — both are protected
- Branch naming: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/` prefixes — always cut from `preview`
- One commit per logical change, not per file — all files belonging to the same
  task are staged and committed together in a single `git add <f1> <f2> ...` call.
  Never produce one commit per file.

## Before Big Tasks
For any task that spans more than one file or changes an API contract:
1. Write a short plan (what you'll change, what you won't touch, any open questions)
2. Wait for explicit approval before implementing
3. After implementing, summarize what changed and flag any deviations from the plan

## Key Files to Read First
- `docs/ARCHITECTURE.md` — system design and data flow
- `docs/API.md` — endpoint contracts and request/response shapes
- `shared/types.ts` — severity schema and shared interfaces
- `AGENTS.md` — behavioral rules for this repo