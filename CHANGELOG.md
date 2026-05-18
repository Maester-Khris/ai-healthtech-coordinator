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

## [Sprint 5 — Closed] · Observability + Alerting

**Completed — merged to `preview`. Telemetry partially verified; may revisit.**

### Delivered
- `prometheus-fastapi-instrumentator` instrumenting all FastAPI routes
- `python-json-logger` — structured JSON stdout, forwarded to Grafana Loki via Render Log Streams
- Sentry Python SDK — `SENTRY_DSN_BACKEND`, FastAPI + Starlette integrations, `capture_message` on startup
- `RequestIDMiddleware` — UUID per request injected into `request.state`, returned as `X-Request-ID` response header
- Protected `/metrics` endpoint via `METRICS_BEARER_TOKEN` bearer check
- Prometheus metrics push loop — daemon thread, 30s interval to Grafana remote write
- Sentry React SDK — `browserTracingIntegration`, `replayIntegration`, `ErrorBoundary`, `maskAllText: true`
- `X-Request-ID` correlation header forwarded from `apiClient.ts` to backend
- All observability env vars documented in `.env.example` and stored in Doppler

### Known issues / deferred
- Grafana metrics push: `'Response' object is not callable` — push handler bug, fix pending
- Sentry frontend: sessions received (200 OK confirmed) but zero performance transactions —
  `tracesSampleRate` and `withProfiler` fix applied on `test/telemetry`, not yet merged
- Grafana dashboard shows "No data" until metrics push bug is resolved
- `test/telemetry` branch retained for ongoing telemetry diagnostics, not merged

---

## [Sprint 6 — Closed] · Deployment Automation

**Completed — merged to `preview`.**

### Scope (revised from original plan)
- ~~Vercel preview alias~~ — already using Vercel branch-specific URLs added to Doppler `ALLOWED_ORIGINS`; stable alias not needed at this stage
- ~~Doppler CLI in CI~~ — `ALLOWED_ORIGINS` is managed manually in Doppler; no programmatic update needed right now
- ~~Keep-alive in GitHub Actions~~ — cron-job.org retained; works reliably, no migration value
- ~~IaC / Doppler Terraform~~ — deferred; no fit at current project stage

### What is actually being built
- GitHub Actions workflow: trigger Render deploy webhook on push to `preview`
  **only when files under `backend/` changed** (path filter via `dorny/paths-filter`)
- Vercel already handles frontend deploy automatically — no workflow needed
- `RENDER_DEPLOY_HOOK_MEDICOORD` stored as GitHub Actions repository secret
- Workflow file: `.github/workflows/deploy.yml` (update existing)

---

## [Sprint 7 — Closed] · Profile Onboarding + Chat Foundation

**Completed — 2026-05-17 · branch: `feat/profile-chat`**

### Delivered

**Task 007 — Profile + Onboarding (frontend + migrations)**
- `migrations/` folder at repo root: `001_profile.sql`, `002_sessions.sql`, `003_messages.sql`
- Profile table: `user_id`, `getting_started_done`, `location_preference`, `emergency_contact_name`, `emergency_contact_phone`
- Supabase trigger: auto-create profile row on `auth.users` insert (`security definer`)
- Backfill SQL for existing users
- RLS: profile readable/updatable by owner only; sessions and messages service-role only
- `useProfile` hook — reads profile from Supabase directly (client-side RLS)
- `GettingStartedModal` — blocking onboarding modal on first login, location preference + emergency contact; dismiss is session-only, Save marks `getting_started_done`
- Chat panel shell: "New conversation" button, past conversations dropdown, disabled state when unauthenticated

**Task 008 — Chat Backend + Frontend Integration**
- Backend: `cache_chat.py` — per-user in-memory cache (writer-updates-cache pattern)
- Backend: `services/chat.py` — session creation, message write, past conversations fetch, cursor pagination
- Backend: `routers/chat.py` — all chat endpoints with auth middleware and request ID logging
  - `GET /chat/sessions` — ETag-based, returns 5 sessions × 20 messages
  - `POST /chat/sessions` — creates session, title = first 50 chars of message
  - `POST /chat/message` — writes user + assistant messages (stub: first 50 chars + `...`)
  - `GET /chat/sessions/:id/messages?before_id=` — cursor pagination for older messages
  - `POST /chat/sessions/invalidate` — clears server-side cache on logout
- `shared/types.ts` — `Message`, `Session`, `ConversationsCache` added
- Frontend: `useConversations` hook — silent prefetch on login, ETag/304, send, create, load older; all ops update React cache inline
- Frontend: chat panel fully wired — optimistic user bubble, assistant reply appended, real past conversations dropdown with formatted dates, scroll-to-top loads older messages, Enter to send

**Fixes applied post-implementation**
- `_ser()` helper in `routers/chat.py` — recursively converts datetime objects to ISO strings before `JSONResponse`; applied to all four chat endpoints
- `invalidate_user_cache()` in `cache_chat.py` — clears stale cache on logout to prevent 304 hits on re-login with fresh session
- `authService.ts` `signOut` — calls `/chat/sessions/invalidate` before `supabase.auth.signOut()`; errors caught and ignored so logout always proceeds
- Chat message list anchored to bottom via `flex flex-col justify-end min-h-full` inner wrapper

**LLM deferred** — assistant response remains a stub (first 50 chars of user message + `...`)

---

## [Sprint 8 — Active] · LLM Integration — Triage Agent

**Started — 2026-05-17 · branch: `feat/llm-triage`**

### User Stories

As a user I can type how I feel in the chat panel and receive:
- A severity classification of my symptoms
- A recommendation for the nearest appropriate facility
- A route drawn on the map between my location and the facility
- An ETA for the journey
- A set of contextual next-action buttons (call 911, message emergency contact)
  shown at the end of the triage flow

### Task 009 — LLM Agent: Symptom Classification + Chat Response

Replace the stub assistant response with a real LLM call.

- LLM provider abstraction already scaffolded — implement Groq client (`backend/llm/groq.py`) and Anthropic fallback (`backend/llm/anthropic.py`) behind `LLM_PROVIDER` feature flag
- System prompt: triage assistant persona, instructs model to extract symptoms, classify severity, and respond conversationally in plain language
- Conversation context: pass last N messages from session as context window for multi-turn coherence
- `POST /chat/message` updated: user message → LLM → structured + conversational response
- Severity returned as structured field alongside the natural language response
- Sentry trace added to LLM call for latency monitoring
- Graceful fallback: if LLM call fails, return a safe error message (never expose raw exception to user)

### Task 010 — Tool Integration: Geolocation + Facility Routing

Parallel tool-calling workflow triggered after severity is classified.

- Tool 1a (parallel): severity classification result from Task 009
- Tool 1b (parallel): geolocation — browser sends `lat/lng` with the message payload (user already consented in onboarding modal)
- Tool 2 (chained): Geoapify RouteMatrix — query nearest facilities filtered by `accepted_severity`, return closest with travel time and distance
- Backend: `services/routing.py` — wraps Geoapify RouteMatrix API call, filters by severity, returns `{ facility, travelMinutes, distanceKm, routeCoords }`
- `POST /chat/message` request payload extended: `{ session_id, content, lat?, lng? }` — coordinates optional (user may deny location)
- Response extended: `{ user_message, assistant_message, triage? }` where `triage` contains `{ severity, facility, travelMinutes, distanceKm }` when coordinates were provided
- Tool-call progress trace: backend logs each tool step with `request_id` for Grafana/Sentry correlation

### Task 011 — UI: Map Route + Triage Result Display

Dynamic map and chat updates after triage response received.

- On triage response received: place user location pin on map (blue dot, pulse animation)
- Draw polyline from user pin to selected facility (dashed blue line, same visual language as original hackathon build)
- Selected facility marker highlighted (enlarged, different fill color)
- Route info pill shown on map: `{facilityName} · {travelMinutes} min`
- Chat panel: assistant message includes facility name, category, and ETA in plain language
- Tool-call progress trace shown in chat during processing:
  - "Analyzing symptoms…" (LLM call in progress)
  - "Locating nearby facilities…" (RouteMatrix in progress)
  - "Route calculated" (complete)
- Map resets to default state on "New conversation" button click

### Task 012 — Workflow Completion: Next-Action Buttons

Contextual action buttons shown at the end of a completed triage flow.

- Shown only when triage is complete (severity + facility + route all resolved)
- Displayed as a card below the assistant's final message in the chat panel
- Button set depends on severity:
  - `emergent`: "Call 911" (tel: link, user-initiated) + "Message emergency contact" (if contact saved in profile)
  - `urgent`: "Message emergency contact" + "Get directions" (opens Google Maps with the route)
  - `moderate` / `routine`: "Get directions" + "Save this recommendation"
- None of these trigger autonomous actions — every button requires a user tap
- "Message emergency contact": opens native SMS composer pre-filled with a message template (no server-side sending)
- "Call 911": opens native phone dialer pre-filled with 911 (no automatic dialing)
- Legal note preserved in code comments: all emergency actions are user-initiated, never autonomous

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