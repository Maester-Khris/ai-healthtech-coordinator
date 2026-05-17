# MediCoord AI — Changelog

All notable changes to this project are documented in this file.  
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [v2.0-preview] — 2026-05 · Active development on `preview` branch

### Completed — Sprint 1: Home UI Refactor

- Replaced three-tab hackathon simulation with a static SPA home page
- 70/30 split layout: Leaflet map (left) + chat panel (right)
- Minimal header: MediCoord AI logo, left-aligned nav, Sign in / Get started buttons
- Leaflet map centered on CN Tower (lat 43.6426, lng -79.3871), zoom 13, OpenStreetMap tiles
- CN Tower rendered as a distinct blue landmark marker with pulse ring
- Health facility markers using Option B cross SVG icon (red, 28px, crisp at all densities)
- Static chat panel: avatar, "How are you feeling?" empty state, three suggestion chips, sticky input
- Removed: simulator engine, wave logic, tab navigation, all three hackathon tab components
- Removed: dead npm packages (`recharts`, `@turf/turf`, `@turf/helpers`, `react-slick`, `@material-tailwind/react`, `@heroicons/react`)
- Auth modal z-index fixed above map overlays (position: fixed, z-40)
- UserMenu refactored to avatar initial circle + dropdown (email + sign out)

### Completed — Sprint 2: Backend v1.0

- FastAPI backend scaffolded with CORS, lifespan startup, and structured routing
- Pydantic models: `Severity`, `FacilityCategory`, `Facility` mirroring Supabase schema
- `GET /` — server info endpoint
- `GET /health` — liveness check with `llmProvider` from env var
- `GET /facilities` — full facility list with optional `?category` and `?severity` filters
- In-memory cache (`cache.py`) loaded at startup via FastAPI lifespan — Supabase queried once per process
- ETag support on `/facilities`: SHA-256 of filtered response, RFC 7232 strong ETag format
- 304 Not Modified returned on matching `If-None-Match` header
- Relative imports throughout (`from .services.x`) for Render deployment compatibility
- Start command: `python -m uvicorn main:app --host 0.0.0.0 --port 8000`
- Supabase facilities table seeded with 393 Toronto-region ODHF v1.1 records
- Three facility categories mapped: `hospital`, `ambulatory`, `residential`
- `accepted_severity` array populated per category for triage routing
- Data source: Statistics Canada Open Database of Healthcare Facilities (ODHF) v1.1

### Completed — Sprint 3: Auth Integration (Supabase)

- Supabase Auth wired on both frontend and backend
- Frontend: `AuthContext.tsx` with `onAuthStateChange` listener for persistent session
- Frontend: `authService.ts` with email/password and Google OAuth via `supabase-js`
- Frontend: `LoginModal.tsx` — centered modal with Sign in / Sign up tabs
- Frontend: `UserMenu.tsx` — avatar circle + dropdown with email and sign out
- Frontend: `apiClient.ts` — fetch wrapper attaching Bearer token to every request
- Frontend: `supabaseClient.ts` — browser Supabase client (anon key, VITE_ prefix)
- Backend: `AuthMiddleware` — extracts `user_id` from Bearer token into `request.state`
- Backend: `get_current_user` dependency — hard auth gate for protected routes
- Backend: `services/auth.py` — `verify_token()` using Supabase `auth.get_user()`
- Backend: `GET /me` — protected smoke-test endpoint returning authenticated user info
- Doppler: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` added as frontend vars
  (intentional duplicates of backend vars — Vite requires `VITE_` prefix)

### Completed — Sprint 4: Facilities Prefetch + Map Integration

- `useFacilities` hook — fires on `App.tsx` mount, not inside map component
- ETag stored in `useRef` — subsequent fetches send `If-None-Match`, receive 304 on cache hit
- Map renders real facility markers from API response — `baseData.ts` removed
- Loading spinner shown top-left of map panel until fetch resolves
- Facility count pill updated to `{facilities.length} FACILITIES ACTIVE` (dynamic)
- Facility marker popup on click: name, category, address, accepted severity badges
- `VITE_API_BASE_URL` read from Doppler env, no hardcoded URLs

### Completed — Infrastructure

- Deployment: Vercel (frontend, auto-deploy on `preview` branch commit)
- Deployment: Render free tier (backend, auto-deploy on `preview` branch)
- Secrets: Doppler managing all env vars for frontend and backend
- Keep-alive: cron-job.org pinging `/health` every 10 minutes (Render free tier spin-down prevention)
- Supabase: RLS enabled on `facilities` table, public read policy, service role write only
- Severity schema unified to `routine | moderate | urgent | emergent` across all layers
- All API keys removed from source — no hardcoded secrets anywhere in codebase
- `shared/types.ts` created as single source of truth for TypeScript + Pydantic mirror

---

## [Next — Sprint 5] · Observability + Alerting

**Started — 2026-05-15 · branch: `feat/observability`**

### Planned
- Backend metrics via `prometheus-fastapi-instrumentator` — CPU, memory, request rate, p95 latency
- Structured JSON logging via `python-json-logger` forwarded to Grafana Loki
- Sentry Python SDK — error tracking, stack traces, issue grouping
- Grafana Cloud free tier — dashboards for request rate, error rate, latency, uptime
- Alerting rules: error rate > 5%, p95 latency > 2s, service down
- Sentry React SDK — Web Vitals (LCP, FID, CLS), page load time, transaction tracing
- Source maps uploaded to Sentry on Vercel build
- Custom Sentry transaction for triage chat flow (when implemented)

---

## [Next — Sprint 6] · Deployment Automation

**Not started. Depends on Sprint 5 completing cleanly on `preview`.**

### Planned
- Vercel preview alias on stable subdomain (`preview.medicoord.yourdomain.com`)
  eliminates per-PR URL changes in Doppler
- Render auto-deploy confirmed enabled per service
- GitHub Actions workflow: Vercel deploy hook → update Doppler → trigger Render redeploy
- Doppler CLI in CI for programmatic config updates (no manual dashboard visits)
- Keep-alive workflow consolidated into GitHub Actions (replaces cron-job.org)
- IaC: Doppler Terraform provider for config-as-code

---

## [Deferred — v2.1+] · Core Product Features

**These are the next product milestones after Sprint 5 and 6 close.**

### Triage Chat Loop (core feature — highest priority after infra)
- User symptom input → LLM severity classification (Groq primary, Claude fallback)
- Parallel tool execution: severity classification + geolocation in one round-trip
- Geoapify RouteMatrix integration: nearest facility filtered by `accepted_severity`
- Map response: user pin + route polyline + facility highlight
- Chat response: plain-language recommendation with reasoning
- Tool-call progress trace in chat UI ("Analyzing symptoms… Locating facilities…")
- LLM provider feature flag: `LLM_PROVIDER=groq | anthropic`

### Auth + Session
- Password reset / forgot password flow
- Email verification enforcement
- Protected frontend routes (React Router guards)
- Persistent session history in Supabase

### Production Promotion (`preview` → `main`)
- Doppler prod config environment created
- Render production service created (separate from staging)
- Vercel production domain configured
- All base infrastructure verified on `preview` before any merge to `main`

---

## [Deferred — v3+]

- KMeans geographic clustering for underserved area identification
- In-house scheduling view rebuilt with real queue data
- Emergency contact alert UI (user-initiated, not autonomous)
- Predictive analytics with real historical data
- MLOps pipeline for model retraining
- Role-based access control

---

## [Hackathon Release] — 2025-05 · Toronto Tech Week 2025

Initial demo build. Submitted as a working proof-of-concept.

### Added
- React/Vite SPA with three-tab navigation: Smart Routing, In-house Scheduling, Predictive Analysis
- Toronto health provider dataset (43 facilities) with coordinates and metadata
- Geoapify Route Matrix API integration for real driving-time routing from patient to provider
- Smart Routing simulation: wave-based random patient generation, nearest-facility assignment, live Leaflet map with severity-colored markers and dashed polylines
- In-house Scheduling view: per-hospital patient queue cards sorted by severity tier then arrival time
- Custom binary min-heap priority queue (`priorityQueue.ts`) for in-house triage ordering
- Predictive Analysis tab: 6-month simulated cohort drift displayed as monthly mini-maps plus aggregate map
- Shared `MapPanel` and `SimulationForm` components used across all three tabs
- GCP Cloud Function (Python) with Gemini 2.5 Flash symptom extraction from free-text (JSON mode)
- Fine-tuned Gemini severity classifier trained on 238 labeled symptom records via Vertex AI
- Simulator control panel: configurable duration, wave interval, and patient count with progress bars
- CN Tower landmark pin as map center reference

### Known Issues at Submission
- Vertex AI fine-tuned endpoint (`8775805933163905024`) never successfully wired — deployed function substitutes `random.choice()` for model inference
- Frontend and backend operate as fully isolated subsystems with no HTTP integration
- Severity schema mismatch across layers
- Geoapify API key hardcoded in client-side source
- No `requirements.txt`, no Docker config, no CI/CD, no environment variable management
- Dead npm packages and unused code throughout