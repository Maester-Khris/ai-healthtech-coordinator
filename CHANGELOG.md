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
- Frontend: `supabaseClient.ts` — browser Supabase client (anon key, VITE\_ prefix)
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

## [Sprint 7 — Active] · Profile Onboarding + Chat Foundation

**Started — 2026-05-17 · branch: `feat/profile-chat`**

### Scope

**Task 007 — Profile + Onboarding (frontend + migrations)**

- `migrations/` folder at repo root: `001_profile.sql`, `002_sessions.sql`, `003_messages.sql`
- Profile table: `user_id`, `getting_started_done`, `location_preference`, `emergency_contact_name`, `emergency_contact_phone`
- Supabase trigger: auto-create profile row on `auth.users` insert (`security definer`)
- Backfill SQL for existing users
- RLS: profile readable/updatable by owner only; sessions and messages service-role only
- `useProfile` hook — reads profile from Supabase directly (client-side RLS)
- `GettingStartedModal` — blocking onboarding modal on first login, location preference + emergency contact
- Chat panel shell: "New conversation" button, past conversations dropdown (stubbed), disabled state when unauthenticated

**Task 008 — Chat Backend + Frontend Integration**

- Backend: `cache_chat.py` — per-user in-memory cache (writer-updates-cache pattern)
- Backend: `services/chat.py` — session creation, message write, past conversations fetch, cursor pagination
- Backend: `routers/chat.py` — all chat endpoints with auth middleware and request ID logging
  - `GET /chat/sessions` — ETag-based, returns 5 sessions × 20 messages
  - `POST /chat/sessions` — creates session, title = first 50 chars of message
  - `POST /chat/message` — writes user + assistant messages (stub: first 50 chars)
  - `GET /chat/sessions/:id/messages?before_id=` — cursor pagination for older messages
- Frontend: `useConversations` hook — silent prefetch on login, ETag, send, create, load older
- Frontend: chat panel fully wired — optimistic updates, real past conversations, session creation on first send
- LLM deferred — assistant response is a stub (first 50 chars of user message + `...`)

---

## [Sprint 8 — Active] · Triage MVP — Working Product to Production

**Started — 2026-05-20 · branch: `feat/triage-mvp`**

### Priority rationale

Production app still shows the hackathon simulator. A working triage feature
deployed to production takes precedence over AI engineering depth.
Advanced LLM patterns (prompt evaluation, caching, embeddings, MCP) are
deferred to Sprint 9 and will improve a working system, not a stub.

### Definition of done

A logged-in user can describe symptoms in the chat panel, receive a severity
classification and facility recommendation, see a route on the map, and get
contextual next-action buttons — all deployed and working on `main`.

### Task 009 — LLM + Routing (backend, condensed)

Single endpoint handles the full triage loop in one request.

**LLM call (Groq primary, Anthropic fallback):**

- Provider selected via `LLM_PROVIDER` env var — implement both clients behind shared interface
- System prompt: triage assistant persona with explicit severity classification instruction
- Structured output: LLM returns JSON `{ severity, reasoning, response }` via tool call or forced JSON mode
- Conversation context: last 10 messages from session passed as context window
- Temperature: 0.2 (low — triage must be consistent and deterministic)
- Graceful fallback: LLM failure returns safe user-facing error, never raw exception

**Parallel tool execution (asyncio.gather):**

- Tool 1a: LLM call → severity + conversational response (above)
- Tool 1b: lat/lng already in request payload (browser sent with message)
- Both fire simultaneously — Tool 2 waits on both results

**Chained tool execution:**

- Tool 2: Geoapify RouteMatrix → facilities filtered by `accepted_severity`,
  nearest selected, travel time + distance returned
- New service: `backend/services/routing.py`

**Extended request/response:**

```
Request:  { session_id, content, lat?, lng? }
Response: { user_message, assistant_message, triage? }
triage:   { severity, facility, travelMinutes, distanceKm }
          — present only when lat/lng provided and routing succeeded
```

**Sentry trace** on LLM call duration for latency monitoring.

### Task 010 — Map + Chat UI (frontend, condensed)

**Chat panel:**

- Tool-call progress trace while processing:
  "Analyzing symptoms…" → "Locating facilities…" → "Route calculated"
- Assistant message rendered with facility name, category, ETA when triage present
- Next-action buttons card below final assistant message:
  - `emergent`: "Call 911" (tel:911 link) + "Message emergency contact" (SMS composer)
  - `urgent`: "Message emergency contact" + "Get directions" (Google Maps deep link)
  - `moderate` / `routine`: "Get directions" + "Save this recommendation"
  - All user-initiated — no autonomous actions, legal note in code comments

**Map panel:**

- User location pin (blue dot + pulse) placed on triage response
- Dashed polyline from user pin to selected facility
- Selected facility marker enlarged and highlighted
- Route info pill: `{facilityName} · {travelMinutes} min`
- Map resets on "New conversation" click

### Production promotion (end of this sprint)

- Doppler prod config created from staging config
- Render production service created (separate from staging)
- Vercel production domain configured
- `preview` → `main` PR opened and merged

---

## [Sprint 9 — Planned] · AI Engineering Depth

**Not started. Depends on Sprint 8 shipping to production.**

### Planned — LLM engineering improvements on a working system

- **Prompt evaluation**: DeepEval integration, eval dataset from real triage sessions
- **Prompt caching**: Anthropic prompt caching on system prompt (reduces latency + cost)
- **Multi-shot prompting**: few-shot examples in system prompt for edge case handling
- **Temperature tuning**: A/B test temperature 0.1 vs 0.3 on classification accuracy
- **Stop sequences**: constrain structured output to prevent over-generation
- **Embedding with VoyageAI**: symptom similarity search for related past cases
- **Embedding caching**: cache computed embeddings to avoid redundant API calls
- **MCP client integration**: expose triage tools as MCP server for external agent access
- **Custom LLM tools/skills**: formalize `classify_severity` and `get_nearest_facility`
  as typed tool definitions reusable across providers
- **Workflow optimisation**: profile parallel vs sequential execution, reduce p95 latency
- **Agent behavior guidelines**: refine system prompt with explicit behavioral constraints,
  refusal patterns for out-of-scope medical advice, escalation triggers

---

## [Sprint 10 — Closed] · Sandbox v2 — Static Control Room Page

**2026-06-07 → 2026-06-11 · branch: `feat/sandbox-v2` · merged to `preview` via PR #19**

### Delivered

- `/sandbox` route — static three-panel desktop-only layout (`SimulationPanel`, `SandboxMap`, `InspectorPanel`), guarded below 1024px viewport width (`SandboxMobileGuard`)
- `SandboxHeader` — flask icon, "MediCoordAI · SANDBOX" badge, environment switcher (back to Production)
- `SandboxMap` — dark CartoDB DarkMatter tiles, category filter dropdown, facility markers from `useFacilities()` with hardcoded mock-facility/active-node fallback when live data is unavailable
- `SandboxSplashScreen` — terminal-style boot animation (6 steps, progress bar, skip-after-1s link, fade-out transition) shown on every `/sandbox` visit
- Nav links wired in both `WebNavBar` and the `Home` page footer
- `InspectorPanel` — chat tab (free-text input, keyword-based mock responses) and logs tab (hardcoded entries)
- Architecture matches the original plan: `SandboxPage` is the sole hook owner; all child components are presentational

### Deferred / not wired

- `SimulationPanel`'s System Shock toggles and playback (play/pause/stop, speed) controls are styled but not connected to any simulation engine (`TODO: wire simulation engine` in code)
- Chat tab is still a mock (keyword-matched canned responses), not a real backend integration
- No automated tests — verified via `tsc -b` only, per the original plan's explicit scope

---

## [Sprint 11 — Closed] · Push Notifications

**2026-06-07 → 2026-06-19 · branch: `feat/push-notifications` · merged to `preview` via PR #20 (initial), #22, #23 (completion)**

### Delivered — initial build (2026-06-07–12)

- PWA install gate — `PWAInstallModal` with iOS manual-steps, Android native-prompt, and desktop soft-gate variants
- OneSignal Web SDK v16 integration, `usePWAInstall` / `useNotificationPermission` hooks, platform-scoped player ID capture to localStorage
- `/notifications/send` backend endpoint proxying to the OneSignal REST API
- `/test-notif` manual trigger page

### Delivered — completion pass (2026-06-18–19, see `docs/superpowers/plans/2026-06-18-pwa-push-notifications-completion.md`)

- Fixed iOS Safari install never being proposed at all for non-Safari iOS browsers — added an "Open in Safari" guidance variant instead of silently showing nothing
- Unified two diverging platform-detection implementations (`detectPlatform` vs `detectPlatformLabel`) that could mislabel Chrome-on-iOS as `ios_safari`
- Fixed the install-modal dismiss flag being permanent with no expiry — now re-arms after 1 hour
- Fixed a real iOS bug found during live device testing: the code conflated "OS version too old" with "push APIs not yet exposed because the PWA isn't installed yet" (Apple only exposes `Notification`/`PushManager`/`serviceWorker` to installed iOS PWAs) — split into separate `isIosVersionSupported` and `isPushSupported` flags
- Fixed favicon MIME type and added a proper 512×512 manifest icon
- Added a "Test notifications" entry to the mobile drawer menu
- Discovered `npx tsc --noEmit` is a false-negative in this repo — `webapp/tsconfig.json` has `"files": []` with only `"references"`, so it checks an empty file set; must use `tsc -b` or `npm run build`

### Confirmed working end-to-end

Android Chrome, iOS Safari ≥16.4 (live-tested on a real iPhone 15 Pro, iOS 26.4 — install → permission grant → notification delivery all succeeded), desktop Chrome, and correct fallback guidance on unsupported browsers. OneSignal dashboard shows active registered users across platforms.

### Deferred

- A follow-on onboarding-flow feature (GPS preference + push opt-in as a 3rd step in `GettingStartedModal`, persisted to the `profile` table) was scoped but paused mid-design — picking up later, not yet a committed sprint

---

## [Sprint 12 — Closed] · Data Pipeline

**2026-06-10 → 2026-06-16 · branch: `feat/data-pipeline` · merged to `preview` via PR #21**

### Delivered

- AWS SAM infrastructure: dedicated S3 stack, EventBridge rules, IAM roles (`pipeline/infra/`)
- `places-enricher` Lambda — migrated from a static 11-facility list to a full DB fetch across all 404 facilities, with concurrent Google Places API calls via `ThreadPoolExecutor`
- `places-processor` Lambda — fixed a Supabase upsert SQL error (not-null constraint on `name`), added Unicode normalization for `weekday_hours` (U+202F, U+2009, U+2013) at source
- `dbt-runner` Lambda — in-process `dbtRunner`, multiprocessing patch, `facilities_clean` dbt model with 13 automated data quality tests (13/13 passing)
- `medi_db_health_check` Supabase RPC — dead tuples, long-running queries, deadlocks, called automatically after each dbt test run
- Migrations 004–008: facility place-info columns (phone, business_status, open_now, weekday_hours), `wait_times` table schema, `google_place_id` + `last_enriched_at` columns, and the health-check RPC (plus an `ORDER BY` alias bugfix)
- Full pipeline verified end-to-end in production as of 2026-06-16: enricher → S3 → processor → EventBridge → dbt runner

### Deferred

- ER wait-time ingestion (ERstat + howlongwilliwait.com) — Lambda scaffolding exists (`pipeline/functions/er-wait-scraper`, `er-wait-processor`) but the team decided to move this specific piece to a Railway background worker (cron + scraper + Supabase + Upstash cache update) instead of AWS Lambda, to avoid near-real-time cost overhead. The `wait_times` table schema (migration 005) already exists ahead of this.
- Redis/Upstash cache integration — deferred alongside the ER wait-time worker

---

## [Sprint 13 — Closed] · UI / Product Reframe

**2026-06-22 → 2026-06-25 · branch: `ui/redesign` · merged to `preview` via PR #27**

### Delivered

- Stratum/Aura design system tokens — color ramp, typography, spacing, severity palette
- Landing page at `/` presenting product value — animated hero, interactive search, feature sections
- Privacy policy, cookie management, and user data disclosure legal pages
- `/for-investors` and `/for-engineers` audience pages with system flow diagrams
- Plus Jakarta Sans font stack across all public pages
- Web app re-skin: map+chat shell, WebNavBar, LoginModal, GettingStartedModal, footer
- Mobile re-skin: top bar, Navigation Dock, map tab, AI assistant tab, DrawerMenu, BottomSheet
- New mobile component suite for redesigned mobile shell; 6 retired components deleted
- MobileNavBar replaced in SetupPage; breakpoint hook updated
- SEO meta tags, FAQ structured data, `llms.txt`
- Sandbox auth gate, `/sandbox` route mobile guard updated

---

## [Sprint 14 — Closed] · Backend Update — DB Migration + Filtering

**2026-06-26 → 2026-07-05 · branch: `feat/advanced-filtering` · merged to `preview` via PR #28**

### Completed

- DB migration: switched backend queries from `facilities` to `facilities_clean`
- Column aliases in SQL (`facility_id→id`, `facility_name→name`) keep API contract stable
- Silent `is_operational=true` filter — permanently closed facilities never returned
- `phone`, `business_status`, `weekday_hours` now included in `GET /facilities` response
- `weekday_hours` JSON-parsed on backend; frontend always receives `string[]`
- `shared/types.ts` `Facility` interface extended with `phone`, `business_status`, `weekday_hours`
- `hoursUtils.ts` — `isOpen24h` and `isOpenWeekends` pure functions with assertion tests
- Facility popup: real phone (tel: link) and today's hours; "Hours unavailable" when empty
- Map filter chips: "Open 24/7" and "Open weekends" — additive, wired to `hoursUtils`
- Facilities with unknown hours (empty `weekday_hours`) always pass active filters

### Completed — Proximity Search

- PostGIS `ST_DWithin` + `ST_Distance` on `facilities_clean`, `GET /facilities/nearby` endpoint accepting `lat`, `lng`, `radius_km`
- Tap/click on map places a location pin and triggers proximity search from that point (desktop + mobile), 3-tier anchor priority (`useAnchor`)
- Frontend renders distance-sorted results via `useProximitySearch`

### Completed — ER Wait Time Background Worker (carried over from Sprint 12)

- Railway worker built: cron scraping ERstat + howlongwilliwait.com, `wait_minutes` filter added to `/facilities` and `/facilities/nearby`
- Cache-aside read path: Redis first, Supabase RPC fallback
- Migrated off `supabase-py` to direct PostgREST/GoTrue REST calls across auth, chat, and facilities services (unscoped bonus — simplifies the wait-time RPC fallback path)
- Deployed to Railway as a native cron service (`workers/railway.toml`, `*/15 * * * *`), not an in-process APScheduler loop — `APScheduler`/`flask` deps commented out in `workers/requirements.txt` pending removal
- Verified end-to-end via production run log (2026-07-05T03:08Z): 380 facilities loaded, 234 hospitals scraped across both sources, 162 matched + 1 newly created, 26 rows inserted to `wait_times`, 58 fields updated in Redis — no errors, run completed cleanly

### Post-review fixes (applied 2026-07-01, same day as `/code-review high`)

- Auth middleware no longer swallows non-401 failures (e.g. Supabase outage) as anonymous — re-raises as the original status
- Scraper distinguishes transient lookup failures from permanent non-matches — no more permanent blacklisting on a flaky request
- Place-id dedup reuse now also written to the negative cache, negative-cache keys normalized, dedup-reuse counted separately from fuzzy matches in logs
- Wait-time Redis writeback batched into a pipeline instead of one round-trip per facility
- Stray leading underscore in `migrations/010_nearby_facilities_rpc.sql` fixed (was causing `/facilities/nearby` 400s in production)

### Post-review fixes (applied 2026-07-05, from `/code-review high` + security review on PR #29)

- Security review: no HIGH/MEDIUM vulnerabilities found — clean
- Map "Wait Time" filter dropdown was fully wired in the UI but never filtered anything; now filters via `meetsWaitTimeFilter` against each facility's already-annotated `wait_minutes`
- Map "Open Now" toggle was likewise inert; added `isOpenNow` (with overnight-range handling) and wired it into the facility filter
- Scraper no longer permanently blacklists a scraped name the first time it dedup-resolves to an existing facility via Google Places — that was silently stopping wait-time updates for that facility forever once `facilities_clean` lag masked the fuzzy match
- Scraper's `resolve_unmatched_facility` now normalizes typographic Unicode in `weekday_hours` (matches `repopulate_facilities_clean.py`'s existing normalization), so scraper-created facilities don't get garbled hours strings
- `verify_token` no longer crashes with an unhandled `AttributeError` on a non-dict GoTrue response — now treated as an invalid token (401)
- `get_wait_minutes_map` parses each Redis hash entry independently — one malformed value no longer discards every other facility's good wait-time data for the request
- Scraper's Supabase wait-time insert failure no longer prevents the independent Redis publish step from running
- `/facilities` and `/facilities/nearby` now offload their blocking Redis/Supabase calls to a threadpool (`run_in_threadpool`) instead of blocking the async event loop
- Deduplicated the proximity radius option list (`MapPanel.tsx` dropdown vs. `useProximitySearch`'s `RADIUS_MAP`) into a single shared `PROXIMITY_OPTIONS` constant, removing a dead unreachable `'50 km'` entry
- Frontend test runner (`vitest`) properly wired for the first time — `webapp/package.json` had no `test` script or `vitest` dependency despite `hoursUtils.test.ts`/`useAnchor.test.ts` already existing and unrunnable
- Full plan: `docs/superpowers/plans/2026-07-05-pr29-code-review-fixes.md`

### Remaining before this branch merges to `preview`

- [x] Add CI repo secrets for the backend test job: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_URL`
- [x] Apply `migrations/012_latest_wait_times_rpc_add_fields.sql` in the Supabase SQL editor (adds `raw_wait`, `source` to the `latest_wait_times()` RPC)
- [x] Merge `feat/advanced-filtering` → `preview` (PR #28)
- [x] Deploy the ER wait-time worker to Railway, verify end-to-end (cron → scrape → upsert → cache invalidate → frontend read)

### Deferred

- Wait-time worker optimization: `resolve_unmatched_facility` calls Google Places sequentially for every unmatched scraped name (~22s for 57 names in the verification run) — parallelize with `ThreadPoolExecutor`, same pattern the pipeline's `places-enricher` Lambda already uses (Sprint 12), if the unmatched count grows enough to crowd the 15-min cron interval

### Production promotion

- PR #29 open: `preview` → `main`, covers Sprint 13 (UI/product reframe), Sprint 14 (this sprint), and Sprint 14a (case-study rewrite) — awaiting final human review before merge

---

## [Sprint 14a — Closed] · `/for-engineers` Case Study Rewrite

**2026-07-01 → 2026-07-02 · branch: `feat/advanced-filtering` (same branch as Sprint 14, unrelated scope)**

### Delivered

- Design spec written for a grounded rewrite of the `/for-engineers` case studies (`docs/superpowers/plans/2026-07-02-engineering-case-study-rewrite.md`)
- Engineering case-study content extracted into a shared typed module, decoupled from page components
- `CaseStudy` schema extended; all 3 case studies rewritten to be grounded in real code (not illustrative/placeholder copy)
- Case-study filter, emphasis-split, and date-format helper utilities added
- `/for-engineers` rebuilt as a filter-rail case-study index page
- `/for-engineers/:slug` case-study detail page added
- Hand-drawn Excalidraw-style diagrams added for all 3 case studies
- `/for-engineers` navbar aligned with `/for-investors` page style

### Notes

- Content is static (no Supabase table) — deliberate decision, revisit only past ~15–20 entries or if a non-engineer editor workflow is needed
- Not yet merged to `preview` — rides along with the rest of `feat/advanced-filtering`

---

## [Sprint 15 — Planned] · Graph RAG (Knowledge Graph)

**Next priority this week, after Sprint 14 merges to `preview`.**

Sequencing: finish the two Sprint 14 infra steps above (CI secrets, Supabase RPC update) →
merge `feat/advanced-filtering` → `preview` → start Graph RAG work from `preview`.

Scope not yet detailed — pick up from `project_kg_intent` context: KG is for grounding LLM
follow-up questions and symptom understanding (conversational NLU), not diagnosis; Canadian
sources preferred.

---

## [Sprint 16 — Closed] · Onboarding Flow Consolidation

**2026-07-07 → 2026-07-09 · branch: `feat/onboarding-consolidation`**

### Scope

Desktop (`GettingStartedModal`) and mobile (`SetupPage`) previously duplicated the same
location + emergency contact form with diverging code and inconsistent trigger behavior
(mobile onboarding wasn't auto-shown on first login). GPS and push permission handling
also lived as separate, unrelated app-wide popups with no persisted state. This sprint
unified both platforms onto one shared step flow (Location → Push → Emergency Contact →
Medical Profile), added `push_enabled`, `auto_alert_opt_in`, and medical fields
(`allergies`, `conditions`, `blood_type`, `medical_chat_opt_in`) to `profile`, wired
opted-in medical info into the triage chat context server-side, and updated the privacy
pages to disclose the new data collection. Automated emergency-contact alert sending is
explicitly deferred to a follow-up spec (opt-in is captured now, sending is not built).
Migration `013_profile_onboarding_extensions.sql` applied 2026-07-09.

### Post-review fixes (applied 2026-07-09, from `/code-review high` on the workflow-integration diff)

10 findings, all CONFIRMED. Fixes: `remove_device` now scopes deletion to the caller's own
OneSignal subscriptions (was an unscoped IDOR); removed the duplicate `OnboardingOverlay` trigger
in `Home.tsx`; `SetupPage`/`OnboardingWizard` now navigate away after a successful finish instead of
stalling on the last step; onboarding text fields no longer trim mid-keystroke (trim moved to submit
time); swallowed profile-fetch exception in `chat.py` now logged; `ProfilePage`'s optimistic device
removal now rolls back and surfaces an error on failure; re-added the GPS-clear-on-signout effect to
`Home.tsx`; OneSignal calls in `notifications.py` offloaded to a threadpool; deduplicated the
triplicated `email → display name` helper into `webapp/src/lib/formatDisplayName.ts`.
Full findings: `docs/superpowers/reviews/2026-07-09-onboarding-flow-consolidation-review.md`.

### Post-review fixes, round 2 (applied 2026-07-09, from a second `/code-review high` re-review)

10 more findings, all verified (6 via dedicated verifier agents, 4 self-verified). Two CRITICAL:
patient-supplied `allergies`/`conditions` were concatenated raw into the trusted LLM system
prompt with no isolation — a prompt-injection path that could suppress correct emergency
classification; now wrapped in explicit `<patient_provided_medical_context>` delimiters with an
instruction to treat the content as inert data. Separately, `useProfile()` has no shared state
across component instances, so the desktop non-dismissible onboarding overlay never dismissed
itself after a successful submit — `useProfile` gained a `refetch()`, threaded through
`OnboardingOverlay`'s new `onComplete` prop. Also fixed: `ProfilePage`'s Save button could submit
blank/default state if clicked before the initial profile fetch resolved; `chat.py`'s per-message
profile fetch still wasn't offloaded to a threadpool; `useNotificationPermission` now subscribes to
the Permissions API so granted-state stays in sync across hook instances instead of going stale;
`ProfilePage`'s device-list effect keyed on the `user` object reference (refetched on every token
refresh) instead of `user?.id`; extracted shared `_onesignal_credentials()`/`_onesignal_request()`
helpers and added real Pydantic response models to `notifications.py`; deduplicated the
trim-or-null and AI-assistant-opt-in-copy logic that had drifted into two/three copies.

### End-to-end validation (2026-07-09, Playwright against local dev servers + disposable Supabase test accounts)

Full desktop and mobile onboarding → profile → chat journeys driven live. Confirmed: the desktop
overlay-dismissal fix (completed wizard correctly hands off to the next popup instead of sticking);
the mobile `/setup` → `/app` redirect; mid-keystroke trimming is gone (multi-word input survives
keystroke-by-keystroke typing); all onboarding fields round-trip correctly through Supabase into
`ProfilePage`; the profile save flow persists edits; the chat/triage flow completes cleanly with the
medical-context fetch and prompt-injection guard both in place, no backend exceptions. Found and
fixed one additional bug live: the desktop `UserMenu`'s "My profile" link still pointed at `/setup`
instead of `/profile`, sending a fully-onboarded user back through the entire wizard — missed by both
review passes since `UserMenu.tsx` wasn't touched by the sprint's diff.

---

## [Sprint 17 — Closed] · System Evaluation — Production Metrics for Case Studies

**Started — 2026-07-09 · branch: `feat/system-evaluation`**

### Priority rationale

Flagged high priority in the Week (06) plan: the 3 published `/for-engineers` case
studies read as marketing copy without real numbers behind them. This ties directly
into Content Pipeline Post B (GraphRAG deep-dive), which needs real evaluated metrics
to be credible to recruiters/investors.

### Scope

Pull live production metrics for each of the 3 case studies and publish them into the
case-study copy, replacing any illustrative/placeholder numbers:

- `two-pass-tool-orchestration-symptom-triage` — triage latency (Pass 1 tool call +
  Pass 2 grounded response), tool-call success rate
- `haversine-proximity-severity-gated-eligibility` — facility count, eligible-facility
  filter rate, ranking latency
- `two-tier-facility-state-cache-redis-wait-times` — cache hit rate, Redis wait-time
  row count, Supabase-fallback rate

No real production traffic exists yet, so numbers come from simulated load against
`preview` (never `main`), not live users: JMeter for the stateless routing/cache case
studies (2 and 3), a Python script for the stateful multi-turn triage conversations
(case study 1) feeding a separate offline DeepEval pass. Two-phase per case study —
(A) instrumentation/logging ships and runs first, (B) evaluation + publish happens
once a collection window has real data — not one combined diff.

Transparency requirement: each published update states not just the metric but the
methodology/protocol behind it (what was measured, how, sample size, environment,
date) — same honesty standard the case studies already hold for `METRIC PENDING`.
Numbers measured under simulated `preview` load must say so, not imply live prod
traffic.

### Process

```
Phase A — Instrumentation        Verify                Phase B — Run          Publish
  build + deploy logging/    →   smoke-test on   →   execute full simulated → human review →
  counters/shadow-calls to       preview: manual      load (JMeter for CS 2   caseStudies.ts
  preview per case study         requests + check     & 3, Python+DeepEval    result +
                                  Grafana/Loki/         for CS 1) through a     methodology,
                                  Sentry land the        collection window,     replace
                                  right values before     compute metrics        METRIC PENDING
                                  trusting any data
```

1. **Phase A — Instrumentation**: ship the logging/counters/shadow-calls per case study
   (design/plan below, one per case study), deploy to `preview`.
2. **Verify**: before trusting any data the instrumentation produces, confirm it's
   actually correct — small-batch manual requests against `preview`, inspect the
   existing Grafana/Loki/Sentry stack (Sprint 5) to confirm counters and log fields
   land with the right values, and a minimal unit test per new branch (the 3-way
   Redis/Supabase/failure path, the facility-fact regex check) so a broken branch fails
   loudly instead of silently producing wrong numbers later.
3. **Phase B — Run**: once instrumentation is verified, execute the full simulated
   load (JMeter for case studies 2 and 3, Python + offline DeepEval pass for case
   study 1) against `preview`, let it run through a collection window, gather metric
   values and methodology notes (sample size, environment, date).
4. **Publish**: human review of the numbers and methodology, then update
   `caseStudies.ts` — replace `METRIC PENDING` with the reviewed result and the new
   methodology block, update the "Pending" badge in `EngineeringCaseStudyPage.tsx`.

### Out of scope

- New case studies or new content sections
- Sprint 9's prompt evaluation (DeepEval) — separate, still Planned

### Delivered

**Closed — 2026-07-14.**

- Case study 1 (`two-pass-tool-orchestration-symptom-triage`): two independent evaluation tracks, published as Track A / Track B — an online deterministic groundedness check (0 hallucinated facilities / 106 checks / 100%) and an offline DeepEval Faithfulness LLM-as-judge pass (0.956 mean score, 96.6% pass rate, 89 facility-grounded responses). Deviates from the originally scoped metric (triage latency + tool-call success rate, never measured) in favor of groundedness/faithfulness — the more direct measure of this case study's own stated risk (hallucinated facilities), a conscious pivot made during Phase B, not silent drift.
- Case study 2 (`haversine-proximity-severity-gated-eligibility`): 1.21 km average routing error across 30 shadow-call samples, measured via the new `routing_shadow_error_km` Prometheus summary metric.
- Case study 3 (`two-tier-facility-state-cache-redis-wait-times`): 100% cache hit rate across 300 wait-time reads under a sustained read burst.
- Load generation for Phase B ended up as a `concurrent.futures.ThreadPoolExecutor`-based Python script (`backend/scripts/routing_shadow_eval/`, `backend/scripts/cache_load_eval/`), not JMeter as originally planned — JMeter wasn't installed when Phase A's Verify stage needed a quick multi-request batch, and the ad hoc thread-based approach that unblocked Verify was kept and formalized for Phase B rather than introducing a new tool, since the actual need (request-volume for sample diversity against a free-tier backend) doesn't call for a dedicated load-testing tool's concurrency/throughput reporting.
- Task 5's real-backend verify run surfaced and fixed a genuine bug: `wait_times_cache_outcome_total`'s `supabase_fallback`/`total_failure` labels are absent from `/metrics` entirely until first incremented (a Prometheus Counter quirk), which crashed the CS3 load script's stat computation on a backend that had only ever served `redis_hit` — fixed to treat an absent label as a legitimate zero.
- Eval backend for this closeout ran on Railway (`medicoordai-staging-production.up.railway.app`), not Render as originally scoped — infra choice made mid-sprint, no impact on methodology.
- Sprint 9's separate prompt-evaluation DeepEval work (premature-classification rate) remains out of scope, as originally stated.

---

## [Deferred — v2.1+] · Core Product Features

**These are the next product milestones after Sprint 5 and 6 close.**

### Triage Chat Loop

- Covered in Sprint 8 (MVP) and Sprint 9 (AI engineering depth)

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
