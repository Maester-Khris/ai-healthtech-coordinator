# MediCoord AI — Changelog

All notable changes to this project are documented in this file.  
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
- Vertex AI fine-tuned endpoint (`8775805933163905024`) never successfully wired — 8 endpoint URL formats attempted, all failed; deployed function substitutes `random.choice()` for model inference
- Frontend and backend operate as fully isolated subsystems with no HTTP integration between them
- Severity schema mismatch: frontend uses `critical/severe/moderate/routine`; backend training data uses `routine/moderate/urgent/emergent`
- Geoapify API key hardcoded in client-side source (`geoapify.ts`) — exposed in any deployed build
- GCP project IDs and endpoint IDs visible in plaintext in source files
- No `requirements.txt` for the Python cloud function
- No Docker config, no CI/CD pipeline, no environment variable management
- `recharts`, `@turf/turf`, `@turf/helpers`, `react-slick`, `@material-tailwind/react`, `@heroicons/react` installed but never imported
- Dialogflow CX agent referenced in `readme.md` and webhook handler but agent definition not in repo
- "Predictive Analysis" tab is simulated Gaussian drift — no real model, historical data, or ML inference
- In-house scheduler queue reads from `useRef` on each render; can lag under concurrent React rendering
- `.busyness-color` CSS class defined as empty rule — crowd-level icon styling has no effect
- `mapMatrixToRoutes()` utility exported but never called (dead code)
- `backup.tsx` is an empty file; `function.js` is an unreferenced Haversine prototype

---

## [Unreleased — v2.0 Direction] — 2026 · Post-Hackathon SaaS Rebuild

Complete architectural overhaul. Moving from simulation demo to integrated AI-powered product.

### Planned — Breaking Changes
- **Severity schema unified** to `routine / moderate / urgent / emergent` across all layers (frontend, backend, AI, database)
- **Vertex AI fine-tuned classifier retired** — replaced by Claude (Anthropic API) structured tool output for symptom analysis and severity classification; eliminates the broken endpoint dependency
- **Simulation-first frontend replaced** by real user session flow: user inputs symptoms via chat, system responds with a real routing decision for that user

### Planned — New Architecture
- Vertical chat panel added to home page (left side); interactive Leaflet map retained (right side)
- Agentic tool-calling workflow replacing the simulation engine:
  - Tool 1a (parallel): Claude structured output → symptom parsing + severity classification
  - Tool 1b (parallel): Browser Geolocation API → user lat/lng with explicit consent prompt
  - Tool 2 (chained): Geoapify RouteMatrix → nearest appropriate facility given severity
  - Map response: user pin + route polyline + facility highlight drawn from real session data
  - Chat response: Claude explanation of recommendation with reasoning surfaced to user
  - Optional: user-initiated contact alert UI (not autonomous dispatch)
- Tool-call progress trace shown in chat UI during parallel execution ("Analyzing symptoms… Locating facilities… Calculating route…")
- Backend API layer introduced to mediate between frontend and AI/routing services
- Environment variable management introduced; all API keys removed from source

### Planned — Infrastructure
- `requirements.txt` added for Python services
- `.env` / secrets management for Geoapify key, Anthropic API key, GCP credentials
- Dead npm dependencies removed (`recharts` if unused, `@turf/turf`, `react-slick`, `@material-tailwind/react`, `@heroicons/react`)
- Docker configuration for backend service
- CI/CD pipeline (GitHub Actions) for lint, type-check, and deploy gating

### Planned — Deferred / Out of Scope for v2.0
- Autonomous 911 dispatch (legal/regulatory risk — replaced by user-initiated one-tap call UI)
- Dialogflow CX agent (replaced by direct Anthropic API agentic workflow)
- KMeans geographic clustering for underserved area analysis (remains on roadmap for v3)
- MLOps pipeline for model retraining and staging validation