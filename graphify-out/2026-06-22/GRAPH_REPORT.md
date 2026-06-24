# Graph Report - medicoordai  (2026-06-22)

## Corpus Check
- 199 files · ~144,101 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1189 nodes · 1838 edges · 106 communities (89 shown, 17 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 172 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cf5014ea`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_LLM Client Abstraction|LLM Client Abstraction]]
- [[_COMMUNITY_Map Components & Types|Map Components & Types]]
- [[_COMMUNITY_Mobile Chat & Triage UI|Mobile Chat & Triage UI]]
- [[_COMMUNITY_Backend Middleware & Notifications|Backend Middleware & Notifications]]
- [[_COMMUNITY_Readme & UI Design Docs|Readme & UI Design Docs]]
- [[_COMMUNITY_Webapp Dependencies|Webapp Dependencies]]
- [[_COMMUNITY_Design System & Sandbox Plans|Design System & Sandbox Plans]]
- [[_COMMUNITY_Data Pipeline Infra|Data Pipeline Infra]]
- [[_COMMUNITY_Simulation & Priority Queue|Simulation & Priority Queue]]
- [[_COMMUNITY_Chat Endpoint Tests|Chat Endpoint Tests]]
- [[_COMMUNITY_Push Notification Plan & Audit|Push Notification Plan & Audit]]
- [[_COMMUNITY_PWA Hooks & API Client|PWA Hooks & API Client]]
- [[_COMMUNITY_App TSConfig Compiler Options|App TSConfig Compiler Options]]
- [[_COMMUNITY_Sandbox Page Components|Sandbox Page Components]]
- [[_COMMUNITY_Web Navbar & Onboarding|Web Navbar & Onboarding]]
- [[_COMMUNITY_Design System Sprint Reports|Design System Sprint Reports]]
- [[_COMMUNITY_Chat Cache & Tests|Chat Cache & Tests]]
- [[_COMMUNITY_Node TSConfig Compiler Options|Node TSConfig Compiler Options]]
- [[_COMMUNITY_Backend Pydantic Models|Backend Pydantic Models]]
- [[_COMMUNITY_Auth Modal & Mobile Layout|Auth Modal & Mobile Layout]]
- [[_COMMUNITY_CICD & Project Docs|CI/CD & Project Docs]]
- [[_COMMUNITY_Places Enricher Lambda|Places Enricher Lambda]]
- [[_COMMUNITY_Audit Report Findings|Audit Report Findings]]
- [[_COMMUNITY_API Contract Docs|API Contract Docs]]
- [[_COMMUNITY_Auth Context & Supabase Client|Auth Context & Supabase Client]]
- [[_COMMUNITY_Changelog Sprints|Changelog Sprints]]
- [[_COMMUNITY_Root TSConfig Options|Root TSConfig Options]]
- [[_COMMUNITY_Backend DB & Chat Service|Backend DB & Chat Service]]
- [[_COMMUNITY_Chat Router Endpoints|Chat Router Endpoints]]
- [[_COMMUNITY_Permission Modals|Permission Modals]]
- [[_COMMUNITY_Auth Integration Task Docs|Auth Integration Task Docs]]
- [[_COMMUNITY_LLM Provider Abstraction Task|LLM Provider Abstraction Task]]
- [[_COMMUNITY_Profile & Chat Task Docs|Profile & Chat Task Docs]]
- [[_COMMUNITY_ER Wait Scraper Lambda|ER Wait Scraper Lambda]]
- [[_COMMUNITY_PWA Install Modal Variants|PWA Install Modal Variants]]
- [[_COMMUNITY_LLM Triage Task Docs|LLM Triage Task Docs]]
- [[_COMMUNITY_dbt Runner Lambda|dbt Runner Lambda]]
- [[_COMMUNITY_ER Wait Processor Lambda|ER Wait Processor Lambda]]
- [[_COMMUNITY_Places Processor Lambda|Places Processor Lambda]]
- [[_COMMUNITY_Backend Skeleton Task Docs|Backend Skeleton Task Docs]]
- [[_COMMUNITY_Push Notification Task Docs|Push Notification Task Docs]]
- [[_COMMUNITY_Backend Requirements Deps|Backend Requirements Deps]]
- [[_COMMUNITY_PWA Manifest Config|PWA Manifest Config]]
- [[_COMMUNITY_Observability Task Docs|Observability Task Docs]]
- [[_COMMUNITY_Home UI Refactor Task Docs|Home UI Refactor Task Docs]]
- [[_COMMUNITY_Map Icon & Loading Task Docs|Map Icon & Loading Task Docs]]
- [[_COMMUNITY_Map Triage UI Task Docs|Map Triage UI Task Docs]]
- [[_COMMUNITY_Mobile Layout Task Docs|Mobile Layout Task Docs]]
- [[_COMMUNITY_Geolocation Hook & Test Page|Geolocation Hook & Test Page]]
- [[_COMMUNITY_Chat Serialization Tests|Chat Serialization Tests]]
- [[_COMMUNITY_SDD Progress & Tailwind Fix|SDD Progress & Tailwind Fix]]
- [[_COMMUNITY_Architecture Doc Topology|Architecture Doc Topology]]
- [[_COMMUNITY_Drawer Menu Icons|Drawer Menu Icons]]
- [[_COMMUNITY_Session Title Tests|Session Title Tests]]
- [[_COMMUNITY_Backend Facilities Service|Backend Facilities Service]]
- [[_COMMUNITY_Backend Health & Triage Docs|Backend Health & Triage Docs]]
- [[_COMMUNITY_Data Pipeline Changelog|Data Pipeline Changelog]]
- [[_COMMUNITY_Seed Script|Seed Script]]
- [[_COMMUNITY_Severity Schema ADR|Severity Schema ADR]]
- [[_COMMUNITY_Bottom Sheet Hook|Bottom Sheet Hook]]
- [[_COMMUNITY_Custom Map Icons|Custom Map Icons]]
- [[_COMMUNITY_DB Migrations Readme|DB Migrations Readme]]
- [[_COMMUNITY_Triage Function Backup A|Triage Function Backup A]]
- [[_COMMUNITY_Triage Function Backup B|Triage Function Backup B]]
- [[_COMMUNITY_App Screenshot Annotations|App Screenshot Annotations]]
- [[_COMMUNITY_Icons & OneSignal Note|Icons & OneSignal Note]]
- [[_COMMUNITY_Dataset Converter Util|Dataset Converter Util]]
- [[_COMMUNITY_Observability PII Masking|Observability PII Masking]]
- [[_COMMUNITY_Logo Brand Mark Images|Logo Brand Mark Images]]
- [[_COMMUNITY_Vercel Rewrites Config|Vercel Rewrites Config]]
- [[_COMMUNITY_LLM Provider Abstraction Note|LLM Provider Abstraction Note]]
- [[_COMMUNITY_TriageRequest API Type|TriageRequest API Type]]
- [[_COMMUNITY_dbt Project Readme|dbt Project Readme]]
- [[_COMMUNITY_dbt User Config|dbt User Config]]
- [[_COMMUNITY_Vite Logo Asset|Vite Logo Asset]]
- [[_COMMUNITY_Push Audit Gap 5|Push Audit Gap 5]]
- [[_COMMUNITY_Push Audit Gap 6|Push Audit Gap 6]]
- [[_COMMUNITY_Alert Endpoint Note|Alert Endpoint Note]]
- [[_COMMUNITY_InHouseScheduler Note|InHouseScheduler Note]]
- [[_COMMUNITY_Map Component Note|Map Component Note]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]

## God Nodes (most connected - your core abstractions)
1. `LLMAgent` - 27 edges
2. `compilerOptions` - 21 edges
3. `useAuth()` - 19 edges
4. `BaseLLMClient` - 18 edges
5. `compilerOptions` - 17 edges
6. `AnthropicClient` - 15 edges
7. `LLMMessage` - 15 edges
8. `GroqClient` - 15 edges
9. `MediCoord AI Changelog` - 15 edges
10. `MediCoord AI — Claude Code Project Context` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Upsert on (name, lat, lng) Composite Key` --semantically_similar_to--> `facilities_clean dbt model`  [INFERRED] [semantically similar]
  seed/README.md → pipeline/functions/dbt-runner/medicoord_dbt/models/schema.yml
- `webapp/src/index.css @theme tokens (Stratum/severity/sandbox)` --semantically_similar_to--> `Leaflet Map (CN Tower center, zoom 13)`  [INFERRED] [semantically similar]
  .superpowers/sdd/task-1-brief.md → .agents/tasks/002_HOME_UI_REFACTOR.md
- `Groq default provider choice` --semantically_similar_to--> `Sprint 8 priority rationale`  [INFERRED] [semantically similar]
  docs/002_LLM_ABSTRACTION.md → CHANGELOG.md
- `MediCoord AI Technical Audit Report` --conceptually_related_to--> `Hackathon Release — Toronto Tech Week 2025`  [INFERRED]
  docs/AUDIT.md → CHANGELOG.md
- `MediCoord AI Project` --semantically_similar_to--> `MediCoord AI Merged Design System`  [INFERRED] [semantically similar]
  readme.md → ui-design/DESIGN-SYSTEM.md

## Import Cycles
- 1-file cycle: `backend/main.py -> backend/main.py`
- 1-file cycle: `backend/tests/test_chat.py -> backend/tests/test_chat.py`

## Hyperedges (group relationships)
- **Task Execution Governance (AGENTS.md, template, execute-task)** — medicoordai_agents_md, medicoordai_planning_protocol, 000_template_task_template, medicoordai_git_branch_model [INFERRED 0.85]
- **Auth Flow: client Supabase auth to backend JWT verification** — 003_auth_integration_auth_context, 003_auth_integration_auth_service, 003_auth_integration_supabase_client, 003_auth_integration_api_client, 003_auth_integration_auth_middleware_py, 003_auth_integration_auth_service_py [EXTRACTED 0.95]
- **Home UI Refactor: App shell, Map panel, removed simulator** — 002_home_ui_refactor_app_tsx, 002_home_ui_refactor_map_panel, 002_home_ui_refactor_removed_components, 002_home_ui_refactor_leaflet_map [EXTRACTED 0.90]
- **LLM Triage Pipeline: provider abstraction, tools, proximity, agent facade** — 009_llm_triage_base_py, 009_llm_triage_groq_client, 009_llm_triage_anthropic_client, 009_llm_triage_tools_py, 009_llm_triage_proximity_py, 009_llm_triage_llm_agent_py [EXTRACTED 0.95]
- **Push notification install/permission flow across hooks and components** — 011_push_notification_use_pwa_install_hook, 011_push_notification_use_notification_permission_hook, 011_push_notification_pwa_install_modal, 011_push_notification_permission_prompt, 011_push_notification_test_notif_page [EXTRACTED 0.90]
- **Chat persistence: SQL migrations, cache, service, router, frontend hook** — 007_profile_onboarding_sessions_sql, 007_profile_onboarding_messages_sql, 008_chat_integration_cache_chat_py, 008_chat_integration_chat_service_py, 008_chat_integration_chat_router_py, 008_chat_integration_use_conversations_hook [EXTRACTED 0.95]
- **Phase 1 Triage Loop orchestration** —  [INFERRED 0.85]
- **Severity schema unification across layers** —  [INFERRED 0.85]
- **Pipeline Ingestion → Processor → dbt EventBridge Flow** — infra_template_yaml_placesenricher, infra_template_yaml_placesprocessor, infra_template_yaml_placesprocessorrule, infra_template_yaml_dbtrunner, infra_template_yaml_dbtrunnerrule, models_schema_yml_facilities_clean [EXTRACTED 1.00]
- **IAM Roles Implemented by Pipeline Lambda Functions** — infra_template_yaml_ingestionrole, infra_template_yaml_processorrole, infra_template_yaml_dbtrunnerrole, infra_template_yaml_placesenricher, infra_template_yaml_placesprocessor, infra_template_yaml_dbtrunner [EXTRACTED 1.00]
- **v2.0 Parallel Tool-Calling Triage Pipeline** — readme_anthropic_severity_classification_tool, readme_browser_geolocation_tool, readme_geoapify_routematrix_tool, readme_triage_post_endpoint, readme_v2_product_vision [EXTRACTED 1.00]

## Communities (106 total, 17 thin omitted)

### Community 0 - "LLM Client Abstraction"
Cohesion: 0.06
Nodes (34): ABC, LLMMessage, LLMResponse, ToolDefinition, LLMMessage, LLMResponse, ToolDefinition, BaseLLMClient (+26 more)

### Community 1 - "Map Components & Types"
Cohesion: 0.16
Nodes (10): CategoryFilterDropdown(), CategoryFilterDropdownProps, FacilityLegend(), UnifiedFacilityPopup(), UnifiedFacilityPopupProps, CATEGORY_STYLES, CategoryFilter, DEFAULT_STYLE (+2 more)

### Community 2 - "Mobile Chat & Triage UI"
Cohesion: 0.06
Nodes (34): GeolocationPermission, NextActionHandlers, useNextActions(), AiAssistantTab(), AiAssistantTabProps, AuthUser, GeoProps, ProfileProps (+26 more)

### Community 3 - "Backend Middleware & Notifications"
Cohesion: 0.19
Nodes (9): get_cached_facilities(), set_cached_facilities(), facilities(), lifespan(), metrics(), FastAPI, Request, Response (+1 more)

### Community 4 - "Readme & UI Design Docs"
Cohesion: 0.06
Nodes (44): Tool 1a: Claude Severity Classification, Tool 1b: Browser Geolocation API, triage_function_alternate.py (Deployed random-fallback classifier), triage_function_original.py (Broken Vertex AI integration), Dialogflow CX Dependency Dropped Decision, Gemini 2.5 Flash Symptom Extraction (Cloud Function), Geoapify Route Matrix Integration, Tool 2: Geoapify RouteMatrix Facility Selection (+36 more)

### Community 5 - "Webapp Dependencies"
Cohesion: 0.05
Nodes (40): dependencies, leaflet, @phosphor-icons/react, react, react-dom, react-icons, react-leaflet, react-responsive-carousel (+32 more)

### Community 6 - "Design System & Sandbox Plans"
Cohesion: 0.05
Nodes (70): Design System Foundation Implementation Plan, ui-design/DESIGN-SYSTEM.md, legacy push-notification CSS vars (--color-primary etc.), Tailwind v4 @theme tokens (Stratum/severity/sandbox), @utility composite typography/material classes, Landing Page + Legal Pages Design Spec, Compliance flag: PIPEDA-relevant, needs legal review, Cookie management approach: static disclosure, no consent banner (+62 more)

### Community 7 - "Data Pipeline Infra"
Cohesion: 0.08
Nodes (34): dbt-runner requirements.txt (boto3), er-wait-processor requirements.txt (boto3, supabase), er-wait-scraper requirements.txt (requests, boto3, beautifulsoup4, lxml), S3 Bucket EventBridge Notification Pattern, Raw Bucket 30-Day Lifecycle Expiry, MedicoordRawBucket (S3 raw ingestion bucket), DbtLayer (Lambda Layer: dbt-core, dbt-postgres, psycopg2), DbtRunner Lambda Function (+26 more)

### Community 8 - "Simulation & Priority Queue"
Cohesion: 0.08
Nodes (14): Entity, GetRouteMatrixParams, HealthProvider, LatLngTuple, Patient, Person, RouteData, RouteMatrixResponse (+6 more)

### Community 9 - "Chat Endpoint Tests"
Cohesion: 0.14
Nodes (9): FastAPI, TestClient, _clear_cache(), _FakeUser, _make_test_app(), Unit tests for chat logic, serialisation, cache, and endpoints. All Supabase cal, Client with no dependency override — real get_current_user runs., Reset module-level chat cache before and after every test. (+1 more)

### Community 10 - "Push Notification Plan & Audit"
Cohesion: 0.12
Nodes (14): DEFAULT_STATE, GEOAPIFY_KEY, ChatMessageResponse, ConversationsCache, FacilityCategory, Message, RouteResult, SendNotificationRequest (+6 more)

### Community 11 - "PWA Hooks & API Client"
Cohesion: 0.19
Nodes (12): PermissionState, UseNotificationPermissionResult, Window, BeforeInstallPromptEvent, detectiOSVersion(), detectPlatform(), isIosDevice(), usePWAInstall() (+4 more)

### Community 12 - "App TSConfig Compiler Options"
Cohesion: 0.08
Nodes (23): compilerOptions, allowImportingTsExtensions, baseUrl, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+15 more)

### Community 13 - "Sandbox Page Components"
Cohesion: 0.11
Nodes (15): useFacilities(), UseFacilitiesResult, SandboxPage(), InspectorPanel(), LOG_COLORS, STATIC_LOGS, SandboxHeader(), SandboxMobileGuard() (+7 more)

### Community 14 - "Web Navbar & Onboarding"
Cohesion: 0.22
Nodes (12): buildTriageCandidates(), cnTowerPos, INACTIVE_TRIAGE, MapContext, MapContextValue, MapProvider(), MapFitBounds(), MapSizeGuard() (+4 more)

### Community 15 - "Design System Sprint Reports"
Cohesion: 0.11
Nodes (21): Sprint 13: UI / Product Reframe, Calculated skeuomorphism material design, ui-design/DESIGN-SYSTEM.md, webapp/src/index.css, shell-bezel utility, surface-card utility, surface-sandbox-card utility, Task 2: Composite typography and material utilities (+13 more)

### Community 16 - "Chat Cache & Tests"
Cohesion: 0.21
Nodes (9): append_message_to_cache(), append_session_to_cache(), get_user_cache(), invalidate_user_cache(), Called after every successful message write — keeps cache in sync., Called after a new session is created., Call on logout or auth failure to force a fresh fetch on next login., set_user_cache() (+1 more)

### Community 17 - "Node TSConfig Compiler Options"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+10 more)

### Community 18 - "Backend Pydantic Models"
Cohesion: 0.20
Nodes (17): CreateSessionRequest, Facility, FacilityCandidate, FacilityCategory, MessageBase, PastConversationsResponse, SendMessageRequest, SessionBase (+9 more)

### Community 19 - "Auth Modal & Mobile Layout"
Cohesion: 0.06
Nodes (37): AuthContext, AuthContextValue, AuthNotification, AuthProvider(), AuthUser, authService, LoginModal(), LoginModalProps (+29 more)

### Community 20 - "CI/CD & Project Docs"
Cohesion: 0.18
Nodes (17): CI workflow (.github/workflows/ci.yml), .claude/.CLAUDE.md — Project Context, Sprint Lifecycle (/start-sprint, /execute-task, /end-sprint), Tech Stack (non-negotiable), Render deploy webhook (commented out), Deploy workflow (.github/workflows/deploy.yml), /end-sprint command, /execute-task command (+9 more)

### Community 21 - "Places Enricher Lambda"
Cohesion: 0.18
Nodes (16): build_record(), bulk_update_place_ids(), enrich_facility(), fetch_facilities_from_db(), fetch_place_details(), _get_db_conn(), lambda_handler(), _normalize_hours() (+8 more)

### Community 22 - "Audit Report Findings"
Cohesion: 0.25
Nodes (15): App Shell & Navigation (App.tsx), MediCoord AI Technical Audit Report, Dialogflow CX Conversational Agent, Symptom Extraction (Gemini 2.5 Flash), geoapify.ts client, Hardcoded Geoapify API key, In-house Scheduler (Inhousescheduler.tsx), MapPanel.tsx (+7 more)

### Community 23 - "API Contract Docs"
Cohesion: 0.20
Nodes (14): shared/types.ts, backend/llm/tools.py, API Contract — MediCoord AI, backend/models.py, classify_severity tool, Facility interface, Geoapify RouteMatrix API, get_nearest_facility tool (+6 more)

### Community 24 - "Auth Context & Supabase Client"
Cohesion: 0.12
Nodes (16): Before Big Tasks, Code Conventions, Current Scope (Phase 1), Custom Commands, Environment variables, Git Rules, graphify, Key Files to Read First (+8 more)

### Community 25 - "Changelog Sprints"
Cohesion: 0.15
Nodes (14): MediCoord AI Changelog, Hackathon Release — Toronto Tech Week 2025, Sprint 10: Sandbox v2 — Static Control Room Page, iOS PWA push API exposure fix, Sprint 11: Push Notifications, Sprint 1: Home UI Refactor, Sprint 2: Backend v1.0, Sprint 3: Auth Integration (Supabase) (+6 more)

### Community 26 - "Root TSConfig Options"
Cohesion: 0.14
Nodes (13): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, isolatedModules, jsx, module, moduleResolution, resolveJsonModule (+5 more)

### Community 27 - "Backend DB & Chat Service"
Cohesion: 0.21
Nodes (9): get_supabase_client(), Client, initSentry(), add_message(), create_session(), get_older_messages(), get_past_conversations(), Returns (sessions_list, messages_dict).     sessions_list: up to `session_limit` (+1 more)

### Community 28 - "Chat Router Endpoints"
Cohesion: 0.24
Nodes (12): Request, create_new_session(), invalidate_cache(), load_older_messages(), past_conversations(), Saves a user message, runs the LLM triage agent, saves the assistant response., Cursor-based pagination — returns messages older than `before_id`.     Always hi, Clears the server-side chat cache for the user — call on logout. (+4 more)

### Community 29 - "Permission Modals"
Cohesion: 0.23
Nodes (9): GpsPermissionModal(), GpsPermissionModalProps, useBreakpoint(), useConversations(), useNotificationPermission(), NotificationPermissionPrompt(), NotificationPermissionPromptProps, shouldShowPermissionPrompt() (+1 more)

### Community 30 - "Auth Integration Task Docs"
Cohesion: 0.29
Nodes (12): webapp/src/lib/apiClient.ts (Bearer token fetch wrapper), Auth Architecture (client-side Supabase Auth + backend JWT verify), webapp/src/auth/AuthContext.tsx, webapp/src/auth/authService.ts, webapp/src/components/auth/LoginModal.tsx, webapp/src/lib/supabaseClient.ts, Task 003: Auth Integration — UI Shell + Full Integration, webapp/src/components/auth/UserMenu.tsx (+4 more)

### Community 31 - "LLM Provider Abstraction Task"
Cohesion: 0.25
Nodes (11): ADR-003: LLM Provider Abstraction with Feature Flag, backend/llm/anthropic.py, backend/llm/groq.py, LLM_PROVIDER env var, Groq default provider choice, Backend surface (Render), backend/llm/client.py, Sprint 8 priority rationale (+3 more)

### Community 32 - "Profile & Chat Task Docs"
Cohesion: 0.27
Nodes (11): migrations/003_messages.sql, migrations/README.md, migrations/001_profile.sql, Row Level Security policies (profile_select_own, profile_update_own), migrations/002_sessions.sql, backend/cache_chat.py (per-user chat cache), backend/routers/chat.py, backend/services/chat.py (+3 more)

### Community 33 - "ER Wait Scraper Lambda"
Cohesion: 0.25
Nodes (10): lambda_handler(), parse_erstat(), parse_hlwiw(), parse_wait_to_minutes(), Normalise wait time strings to integer minutes.     Handles formats: '2h 4m', '4, Fetch HTML and dispatch to correct parser., Parse ERstat Toronto page.     Hospital entries render as anchor tags containing, Parse howlongwilliwait.com.     Page renders hospital rows with name and wait ti (+2 more)

### Community 34 - "PWA Install Modal Variants"
Cohesion: 0.22
Nodes (6): InstallState, Platform, primaryButtonStyle, PWAInstallModal(), PWAInstallModalProps, secondaryButtonStyle

### Community 35 - "LLM Triage Task Docs"
Cohesion: 0.29
Nodes (10): backend/llm/anthropic_client.py (AnthropicClient), backend/llm/base.py (BaseLLMClient, LLMMessage, ToolDefinition), backend/llm/groq_client.py (GroqClient), backend/services/llm_agent.py (LLMAgent facade), backend/llm/prompts.py (TRIAGE_SYSTEM_PROMPT), backend/services/proximity.py (find_nearest_facilities, haversine_km), backend/tests/llm/test_triage_tools.py, backend/llm/tools.py (TRIAGE_RESPONSE tool) (+2 more)

### Community 36 - "dbt Runner Lambda"
Cohesion: 0.27
Nodes (9): lambda_handler(), _parse_results(), _patch_multiprocessing_for_lambda(), Parse dbt run_results.json.     Works for both `dbt run` (status: success/error), Call medi_db_health_check() PostgreSQL RPC via PostgREST.     The SQL function r, Lambda's sandbox blocks sem_open() so POSIX semaphore creation always fails., Invoke dbt in-process using the dbtRunner API (dbt-core >= 1.5).     Avoids subp, _run_db_health_checks() (+1 more)

### Community 37 - "ER Wait Processor Lambda"
Cohesion: 0.33
Nodes (9): fuzzy_match_facility(), get_supabase_headers(), lambda_handler(), load_facilities(), publish_completion(), Resolve facility UUIDs via fuzzy match, upsert to wait_times.     Conflict targe, Fetch hospital-category facilities only — cached per cold start.     Filters ser, Match scraped hospital name to Supabase facility.     Three passes — decreasing (+1 more)

### Community 38 - "Places Processor Lambda"
Cohesion: 0.36
Nodes (9): _headers(), lambda_handler(), patch_batch(), patch_facility(), publish_completion(), UPDATE-only PATCH — touches only business columns.     last_enriched_at is set f, Patch one batch. Returns (success_count, failures)., read_s3_payload() (+1 more)

### Community 39 - "Backend Skeleton Task Docs"
Cohesion: 0.25
Nodes (9): Task Template (000_TEMPLATE.md), backend/db.py (Supabase client factory), backend/models.py (Pydantic Facility models), shared/types.ts (Facility mirror), Task 001: FastAPI Backend Base Endpoints, backend/middleware/auth.py (get_current_user, AuthMiddleware), backend/services/auth.py (verify_token), GET /me endpoint (auth smoke test) (+1 more)

### Community 40 - "Push Notification Task Docs"
Cohesion: 0.22
Nodes (9): iOS 16.4+ push support constraint, OneSignal Web Push SDK v16, webapp/src/components/pwa/NotificationPermissionPrompt.tsx, webapp/src/components/pwa/PWAInstallModal.tsx, Push install/permission state machine, Task: Push Notification Infrastructure (PWA + OneSignal), webapp/src/pages/TestNotifPage.tsx (/test-notif), webapp/src/hooks/useNotificationPermission.ts (+1 more)

### Community 41 - "Backend Requirements Deps"
Cohesion: 0.28
Nodes (9): Sprint 5: Observability + Alerting, backend/requirements.txt, fastapi==0.111.*, prometheus-fastapi-instrumentator==7.*, pydantic==2.*, python-json-logger==2.*, sentry-sdk[fastapi]==2.*, supabase==2.* (+1 more)

### Community 42 - "PWA Manifest Config"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 43 - "Observability Task Docs"
Cohesion: 0.29
Nodes (8): backend/main.py (FastAPI app), init_logging() (structured JSON logging), GET /metrics (Bearer-protected), init_metrics() Prometheus push loop, backend/observability.py, RequestIDMiddleware, init_sentry() (backend Sentry init), Task 005: Observability — Backend + Frontend

### Community 44 - "Home UI Refactor Task Docs"
Cohesion: 0.29
Nodes (8): webapp/src/App.tsx (tab router removed), Dead npm packages removed (recharts, turf, slick, material-tailwind, heroicons), webapp/src/Menucomponents/Home.tsx, Removed simulation components (Inhousescheduler, Map, SimulationForm), Task 002: Home UI Refactor — Static SPA Layout, Sentry.ErrorBoundary in App.tsx, webapp/src/components/onboarding/GettingStartedModal.tsx, webapp/src/pages/SetupPage.tsx (/setup route)

### Community 45 - "Map Icon & Loading Task Docs"
Cohesion: 0.25
Nodes (8): webapp/src/Menucomponents/utils/baseData.ts, webapp/src/Menucomponents/utils/customIcon.tsx, MapPanel.tsx (static facility markers), Facility marker SVG icon (cross, Option B), Map loading spinner (cold-start load-bearing), H badge facility marker with pulse ring, Facility hover tooltip (name, type, category), Task: UI Polish Pass — Triage Display (4 changes)

### Community 46 - "Map Triage UI Task Docs"
Cohesion: 0.25
Nodes (8): webapp/src/components/chat/ChatPanel.tsx (shell), Task 007: Profile + Onboarding — SQL Migrations + Frontend Shell, Single recommended-only route line, webapp/src/components/triage/TriageCard.tsx (v2 redesign), Next-action buttons legal note (user-initiated only), webapp/src/components/triage/ToolCallProgress.tsx, webapp/src/components/triage/TriageCard.tsx (v1), webapp/src/hooks/useNextActions.ts

### Community 47 - "Mobile Layout Task Docs"
Cohesion: 0.25
Nodes (8): webapp/src/components/mobile/AiAssistantTab.tsx, webapp/src/components/mobile/BottomSheet.tsx, 768px breakpoint mobile/desktop split strategy, webapp/src/components/mobile/MapTab.tsx, webapp/src/components/mobile/MobileLayout.tsx, Task: Mobile Responsive UI — Small Screen Experience, webapp/src/hooks/useBottomSheet.ts (drag gesture), webapp/src/hooks/useBreakpoint.ts

### Community 48 - "Geolocation Hook & Test Page"
Cohesion: 0.14
Nodes (11): cnTowerIcon, getFacilityIcon(), userIcon, CategoryFilter, DARK_CATEGORY, FILTER_OPTIONS, LEGEND_ITEMS, MOCK_ACTIVE_NODES (+3 more)

### Community 49 - "Chat Serialization Tests"
Cohesion: 0.39
Nodes (3): Recursively convert datetime objects to ISO strings for JSONResponse., _ser(), TestSer

### Community 50 - "SDD Progress & Tailwind Fix"
Cohesion: 0.38
Nodes (7): Leaflet Map (CN Tower center, zoom 13), webapp/src/index.css @theme tokens (Stratum/severity/sandbox), Subagent-Driven Development Progress — Design System Foundation, Radius token naming collision fix (stratum- prefix), Tailwind v4 @theme tree-shaking behavior, Task 1 Brief: Font loading + base @theme tokens, Task 1 Report: Font loading + base @theme tokens

### Community 51 - "Architecture Doc Topology"
Cohesion: 0.29
Nodes (7): Architecture — MediCoord AI, Background Worker (Render), Deployment Topology, Doppler env var management, Frontend surface (Vercel), Phase 2 (Deferred), Toronto Facility Dataset

### Community 52 - "Drawer Menu Icons"
Cohesion: 0.15
Nodes (12): send_notification(), SendNotificationRequest, _FakeUser, Tests for POST /notifications/send — proxies to OneSignal REST API. OneSignal HT, Returns notification_id when OneSignal responds 200., Returns 502 when OneSignal returns an error., Returns 422 when player_id is missing., Returns 502 when the HTTP call to OneSignal raises. (+4 more)

### Community 54 - "Backend Facilities Service"
Cohesion: 0.47
Nodes (6): GET /facilities endpoint, backend/services/facilities.py, Supabase facilities table schema, backend/cache.py (in-memory facility cache), FastAPI lifespan cache warm-up, Task 004: Facilities Prefetch — Cache, ETag, Map Integration

### Community 55 - "Backend Health & Triage Docs"
Cohesion: 0.33
Nodes (6): GET /health endpoint, Task 008 (LLM doc): LLM Triage Agent — Symptom Classification + Facility Tool, Geoapify RouteMatrix ETA re-ranking, Task 010 (doc id 009): Triage UI — Map Route Display + Chat Triage Result, webapp/src/hooks/useTriageState.ts, LLM_PROVIDER Feature Flag

### Community 56 - "Data Pipeline Changelog"
Cohesion: 0.40
Nodes (6): ER wait-time ingestion moved to Railway worker, facilities_clean dbt model, Sprint 12: Data Pipeline, Sprint 14: Backend Update — DB Migration + Filtering, Sprint 14 ER worker low priority rationale, wait_times table

### Community 57 - "Seed Script"
Cohesion: 0.60
Nodes (5): build_address(), clean(), main(), Seed script: upserts ODHF v1.1 healthcare facilities into Supabase. Run via: dop, transform()

### Community 58 - "Severity Schema ADR"
Cohesion: 0.50
Nodes (5): ADR-001: Unified Severity Schema, Old frontend schema (critical|severe|moderate|routine), Unified severity schema (routine|moderate|urgent|emergent), Severity schema mismatch (frontend vs backend), Fine-tuned Severity Classifier (Vertex AI)

### Community 59 - "Bottom Sheet Hook"
Cohesion: 0.40
Nodes (3): SheetState, UseBottomSheetOptions, UseBottomSheetReturn

### Community 60 - "Custom Map Icons"
Cohesion: 0.40
Nodes (3): CNTowerIcon, HospitalIcon, peopleIcon

### Community 61 - "DB Migrations Readme"
Cohesion: 0.50
Nodes (4): 001_profile.sql Migration, 002_sessions.sql Migration, 003_messages.sql Migration, Database Migrations Process

### Community 64 - "App Screenshot Annotations"
Cohesion: 0.67
Nodes (3): AI Health Assistant Chat Panel, Enable Health Alerts Notification Permission Modal, MediCoordAI Map View Screenshot

### Community 65 - "Icons & OneSignal Note"
Cohesion: 0.67
Nodes (3): Tabler Icons Incumbent Decision, OneSignal Web SDK Initialization, webapp/README.md Live Endpoint Notes

### Community 100 - "Community 100"
Cohesion: 0.31
Nodes (4): LLMAgent.respond is called and its response is used as assistant content., When LLMAgent returns turn_type=triage, response includes triage object., When LLMAgent raises, endpoint returns 200 with safe error message., TestSendMessage

### Community 101 - "Community 101"
Cohesion: 0.24
Nodes (8): init_logging(), init_metrics(), init_observability(), init_sentry(), Request, RequestIDMiddleware, BaseHTTPMiddleware, Instrumentator

### Community 102 - "Community 102"
Cohesion: 0.31
Nodes (5): LegalPageLayout(), LegalPageLayoutProps, CookiesPage(), DataDisclosurePage(), PrivacyPage()

### Community 103 - "Community 103"
Cohesion: 0.32
Nodes (5): Request, AuthMiddleware, get_current_user(), Verify a Supabase JWT and return the user object.     Raises HTTPException 401 i, verify_token()

### Community 104 - "Community 104"
Cohesion: 0.60
Nodes (4): FacilityMarkerLayer(), FacilityMarkerLayerProps, Facility, FacilityCandidate

### Community 105 - "Community 105"
Cohesion: 0.70
Nodes (3): useMapContext(), useOsrmRoute(), OsrmRouteLayer()

## Ambiguous Edges - Review These
- `webapp/src/lib/apiClient.ts (Bearer token fetch wrapper)` → `webapp/src/hooks/useFacilities.ts`  [AMBIGUOUS]
  .agents/tasks/004_FACILITY_PREFETCH.md · relation: calls
- `Tabler Icons Incumbent Decision` → `OneSignal Web SDK Initialization`  [AMBIGUOUS]
  ui-design/DESIGN-SYSTEM.md · relation: shares_data_with

## Knowledge Gaps
- **300 isolated node(s):** `Project in One Sentence`, `Repository Structure`, `Tech Stack (non-negotiable, do not suggest alternatives)`, `Python virtualenv`, `Environment variables` (+295 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `webapp/src/lib/apiClient.ts (Bearer token fetch wrapper)` and `webapp/src/hooks/useFacilities.ts`?**
  _Edge tagged AMBIGUOUS (relation: calls) - confidence is low._
- **What is the exact relationship between `Tabler Icons Incumbent Decision` and `OneSignal Web SDK Initialization`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **Why does `get_supabase_client()` connect `Backend DB & Chat Service` to `Backend Middleware & Notifications`, `Community 103`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `LLMAgent` connect `LLM Client Abstraction` to `Backend Pydantic Models`, `Chat Router Endpoints`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `LLMAgent` (e.g. with `Request` and `Response`) actually correct?**
  _`LLMAgent` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `BaseLLMClient` (e.g. with `LLMMessage` and `LLMResponse`) actually correct?**
  _`BaseLLMClient` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Project in One Sentence`, `Repository Structure`, `Tech Stack (non-negotiable, do not suggest alternatives)` to the rest of the system?**
  _380 weakly-connected nodes found - possible documentation gaps or missing edges._