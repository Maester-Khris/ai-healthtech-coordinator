# MediCoord AI — Technical Audit Report

**Date:** 2026-05-10 | **Branch:** main | **Auditor:** Claude Code

---

## Top-Level Structure

```
medicoordai/
├── webapp/                  ← React/Vite SPA (TypeScript + Tailwind)
│   └── src/
│       ├── App.tsx
│       ├── Menucomponents/
│       │   ├── Home.tsx           (Smart Routing tab)
│       │   ├── Inhousescheduler.tsx (In-house Scheduling tab)
│       │   ├── Map.tsx            (Predictive Analysis tab)
│       │   ├── subcomponent/
│       │   │   ├── MapPanel.tsx
│       │   │   ├── SimulationForm.tsx
│       │   │   └── backup.tsx     (empty)
│       │   └── utils/
│       │       ├── baseData.ts    (43 Toronto health providers)
│       │       ├── customIcon.tsx
│       │       ├── formatter.ts
│       │       ├── generator.ts
│       │       ├── geoapify.ts    (API client)
│       │       └── priorityQueue.ts
│       └── function.js            (scratch/proto file)
├── cloud_function/
│   ├── triage_function_original.py
│   ├── triage_function_alternate.py
│   └── cloud_function.rest
├── fine_tuning_training/
│   ├── symptom_severity.csv / .jsonl  (238 labeled examples)
│   ├── conversational_dataset.jsonl   (238 multi-turn examples)
│   ├── aibot_train.jsonl              (13 examples)
│   └── symptom_severity_combined.jsonl (1-line combined)
├── backup/                (4 older Python triage iterations)
├── utils/dataset_converter.py
└── readme.md              (scratch notes, not documentation)
```

---

## 1. Frontend Features

### 1.1 App Shell & Navigation

**Location:** `webapp/src/App.tsx`  
**What it does:** Three-route SPA using React Router v6. Header with logo, app title, and nav links to Smart Routing (`/`), In-house Scheduling (`/scheduling`), and Predictive Analysis (`/analytics`).  
**Status: Working**  
**Dependencies:** `react-router-dom`

---

### 1.2 Smart Routing Simulation

**Location:** `webapp/src/Menucomponents/Home.tsx`  
**What it does:** A configurable simulation engine that generates random patients distributed across Toronto's land area, calls the Geoapify Route Matrix API to compute driving time/distance from each patient to each of 43 health providers, and assigns patients to the nearest provider. Results are rendered live on a Leaflet map with colored severity markers and dashed polylines. Supports paced, wave-based patient generation with a countdown timer.  
**Status: Working** (contingent on the hardcoded Geoapify API key remaining valid)  
**Dependencies:** Geoapify Route Matrix API (key hardcoded in source), `react-leaflet`, `leaflet`, `@faker-js/faker`, `SimulationForm`, `MapPanel`, `PriorityQueue`

> **Note:** The Smart Routing logic selects the lowest-travel-time hospital but does not factor in provider capacity or current queue load — busyness is tracked in the `HealthProvider` struct but ignored in the assignment algorithm.

---

### 1.3 In-house Scheduler

**Location:** `webapp/src/Menucomponents/Inhousescheduler.tsx`  
**What it does:** Shows a grid of 6 hospital cards, each with a live scrollable patient queue sorted by severity (critical → severe → moderate → routine) and then by arrival time. Uses the same simulation engine and Geoapify routing call as Smart Routing but displays queue state per hospital rather than a map.  
**Status: Partial** — The queue is rendered by reading from a mutable `useRef` on each React re-render (triggered by `setPatient`). This works for demo purposes but is an anti-pattern: queue updates don't independently trigger re-renders, so the view can lag. The `setCount(prev => prev + 1)` call inside a `forEach` may batch incorrectly under concurrent rendering.  
**Dependencies:** Geoapify Route Matrix API, `PriorityQueue`, `SimulationForm`, `react-icons`

---

### 1.4 MapPanel (shared component)

**Location:** `webapp/src/Menucomponents/subcomponent/MapPanel.tsx`  
**What it does:** Reusable Leaflet map component used by both Home and Map. Renders a CN Tower landmark, hospital pins with crowd-level popups (0–3 person icons), patient markers colored by severity, and dashed polylines to their assigned provider. Shows a loading spinner overlay while routes are being fetched.  
**Status: Working**  
**Dependencies:** `react-leaflet`, `leaflet`, `react-icons`, custom icon builders

> **Note:** The `.busyness-color` CSS class referenced for the crowd-level icons is defined in `webapp/src/App.css` as an empty rule (`{}`), so the colored crowd icons have no actual styling effect.

---

### 1.5 SimulationForm (shared component)

**Location:** `webapp/src/Menucomponents/subcomponent/SimulationForm.tsx`  
**What it does:** Control panel widget used by both the Smart Routing and In-house Scheduling pages. Allows configuration of simulation duration (minutes), maximum wave interval (seconds), and total patient count. Shows time-remaining and patient-count progress bars during a run.  
**Status: Working**  
**Dependencies:** none external

---

### 1.6 Predictive Analysis (Map.tsx)

**Location:** `webapp/src/Menucomponents/Map.tsx`  
**What it does:** On mount, generates 8 random patients for January then produces 5 more monthly cohorts by applying a small Gaussian position drift (≈1 km per month) to simulate population shift over 6 months. Makes 6 sequential Geoapify route matrix calls. Displays 6 small monthly map panels plus one large Jan–Jun aggregate map.  
**Status: Working** (the page functions correctly as a demo visualization)  
**Dependencies:** Geoapify Route Matrix API (6 API calls on each page load), `MapPanel`, same Toronto provider dataset

> **Note:** Despite being labeled "Predictive Analysis" in the nav, this feature is entirely simulated — there is no real predictive model, historical data, or ML inference involved. The "trend" is manufactured Gaussian drift. The `recharts` charting library is in `package.json` but never imported; no actual analytics charts exist.

---

## 2. Backend / API Features

### 2.1 Triage Cloud Function (Original)

**Location:** `cloud_function/triage_function_original.py`  
**What it does:** A GCP Cloud Function that accepts POST requests (from Dialogflow CX or direct HTTP). Extracts up to 5 structured symptoms from free-text using Gemini 2.5 Flash with JSON mode, passes them to a fine-tuned Vertex AI classification endpoint to get severity + confidence, saves the result to Firestore under the `patients` collection, and returns a Dialogflow CX webhook response.  
**Status: Broken** — The `SEVERITY_ENDPOINT` constant has 8 commented-out attempts to find the correct URL format for the Vertex AI endpoint (`8775805933163905024`). The prediction call format (`mime_type`/`content` keys) also differs from the training data schema (`text_input`/`output_label`). There is no `requirements.txt` in the repo.  
**Dependencies:** GCP project `crypto-sphere-464015-e4` / `506101299280`, Vertex AI endpoint `8775805933163905024`, Firestore (`patients` collection), Gemini 2.5 Flash, `functions_framework`, env var `GOOGLE_CLOUD_PROJECT`

---

### 2.2 Triage Cloud Function (Alternate / Deployed)

**Location:** `cloud_function/triage_function_alternate.py`  
**What it does:** Identical to the original except the Vertex AI severity model call is replaced by `random.choice(["routine", "moderate", "urgent", "emergent"])` with a randomly generated confidence float. Symptom extraction via Gemini and Firestore write are still present. This is the version that appears to be deployed to Cloud Run at `https://ai-bot-function-506101299280.us-central1.run.app`.  
**Status: Partial** — The function runs and produces plausible-looking responses, but the severity classification is entirely random, not model-driven. This is a demo fallback, not a real triage system.  
**Dependencies:** Same GCP project, Firestore, Gemini 2.5 Flash; Vertex AI endpoint dependency removed

---

### 2.3 Geoapify Route Matrix API Client

**Location:** `webapp/src/Menucomponents/utils/geoapify.ts`  
**What it does:** Thin client wrapper around the Geoapify `/v1/routematrix` endpoint. Accepts sources/targets as lat-lon pairs and returns an N×M matrix of travel time and distance values.  
**Status: Working**  
**Dependencies:** Geoapify API key `38d52e39400d4a988407942232a566a6` — **hardcoded as a plaintext string in client-side source code**, making it publicly visible in any deployed build.

---

## 3. AI / ML Features

### 3.1 Symptom Extraction (Gemini 2.5 Flash)

**Location:** `cloud_function/triage_function_original.py:88–103` (same in alternate)  
**What it does:** Uses `GenerativeModel("gemini-2.5-flash")` with `response_mime_type: "application/json"` to extract up to 5 medical symptoms from a patient's free-text message.  
**Status: Working** (within the cloud function, given valid GCP credentials and Vertex AI access)  
**Dependencies:** GCP Vertex AI, `vertexai` Python SDK, `GOOGLE_CLOUD_PROJECT` env var

---

### 3.2 Fine-tuned Severity Classifier (Vertex AI)

**Location:** Endpoint `8775805933163905024` in GCP project `506101299280`, us-central1; training data in `fine_tuning_training/`  
**What it does:** A Gemini model fine-tuned on 238 labeled symptom descriptions to classify severity into `routine / moderate / urgent / emergent`. Training data exists in multiple formats: `symptom_severity.jsonl` (`text_input`/`output_label` keys), `conversational_dataset.jsonl` (multi-turn format), and `symptom_severity_combined.jsonl` (single merged record).  
**Status: Broken** — Despite the model apparently being trained and deployed (an endpoint ID exists), the cloud function code never successfully called it — evidenced by 8 commented-out endpoint URL attempts and the ultimate fallback to random classification.  
**Dependencies:** GCP Vertex AI (endpoint `8775805933163905024`), fine-tuning datasets in `fine_tuning_training/`

> **Note:** There is a label schema mismatch between layers: the frontend uses `critical/severe/moderate/routine`; the backend training data and cloud function use `routine/moderate/urgent/emergent`. These are different four-class schemas. The two halves of the system never actually talk to each other.

---

### 3.3 Dialogflow CX Conversational Agent

**Location:** Referenced in `readme.md` and cloud function webhook handler only  
**What it does:** The cloud function is designed as a Dialogflow CX webhook. The readme describes a `collect_symptoms` intent with a `Start Page → Route → Webhook → Parameter evaluation` flow.  
**Status: Scaffolded/Stub** — The CX agent definition, flow configuration, intents, and pages are not in the repository. Only the webhook handler code exists.  
**Dependencies:** Google Dialogflow CX (external service, configuration not in repo), deployed Cloud Run URL

---

### 3.4 Patient Priority Queue Algorithm

**Location:** `webapp/src/Menucomponents/utils/priorityQueue.ts`  
**What it does:** A hand-rolled binary min-heap that sorts patients by severity rank (`critical=0 < severe=1 < moderate=2 < routine=3`) and then by arrival timestamp within the same severity tier. Implements enqueue, dequeue, peek, clear, and `toSortedArray()`.  
**Status: Working**  
**Dependencies:** none

---

## 4. Infrastructure & Config

| Area | Status | Notes |
|---|---|---|
| **Docker** | None | No `Dockerfile` or `docker-compose.yml` exists anywhere in the repo |
| **CI/CD** | None | No `.github/workflows/`, no Cloud Build config, no deploy scripts |
| **Environment variables** | Absent / Hardcoded | Geoapify API key hardcoded in `geoapify.ts`; GCP project ID hardcoded as fallback default in both Python files |
| **Python deps** | Absent | No `requirements.txt` anywhere; cloud function imports are undeclared |
| **Vite config** | Minimal | Near-default config; a commented-out `loadEnv` block suggests env-based config was considered but removed |
| **GCP Project** | `crypto-sphere-464015-e4` / `506101299280` | Project IDs and endpoint IDs visible in plaintext in source |
| **Firestore** | Partial | Cloud function writes to `patients` collection; no schema definition, security rules, or indexes in repo |
| **Cloud Run** | Partial | URL `https://ai-bot-function-506101299280.us-central1.run.app` in REST test file; alternate (randomized) function appears deployed |
| **Notification sound** | Unused | `public/sounds/notify.wav` exists but is never referenced in any component |
| **Unused npm deps** | Dead weight | `@turf/turf`, `@turf/helpers`, `recharts`, `react-slick`, `slick-carousel`, `react-responsive-carousel`, `@material-tailwind/react`, `@heroicons/react` installed but never imported |

---

## 5. Unfinished / Commented-Out Features

| Item | Location | Notes |
|---|---|---|
| **Haversine straight-line routing** | `webapp/src/Menucomponents/function.js` | Early prototype using client-side Haversine distance. Fully replaced by the Geoapify API but kept as a scratch file; not part of the module graph |
| **`mapMatrixToRoutes()` utility** | `webapp/src/Menucomponents/utils/geoapify.ts:31–56` | Exported but called nowhere — both Home.tsx and Map.tsx inline equivalent logic. Dead code |
| **`peopleIcon` export** | `webapp/src/Menucomponents/utils/customIcon.tsx` | Exported but unused; per-severity icons are built inline via `buildDivIcon()` in MapPanel |
| **Static hardcoded card layout** | `webapp/src/Menucomponents/Inhousescheduler.tsx:204–230` | Commented-out alternative UI with `PersonSimpleCircle` and 12 static placeholder patients |
| **Dataset converter script** | `utils/dataset_converter.py` | First section fully commented out; second section is a one-time data prep script, not a runtime component |
| **`backup.tsx`** | `webapp/src/Menucomponents/subcomponent/backup.tsx` | Empty file (1 line) |
| **Charts on Predictive Analysis** | `package.json` (`recharts`) | Analytics tab shows maps only; no charts, no statistical output, no trend lines |
| **Geographic analysis (Turf.js)** | `package.json` (`@turf/turf`, `@turf/helpers`) | No spatial analysis (clustering, service deserts, coverage polygons) implemented; likely planned for Predictive Analysis |
| **Vertex AI endpoint URL** | `cloud_function/triage_function_original.py:21–27` | 8 consecutive commented-out attempts at the correct endpoint URL format; integration never stabilized |
| **Dialogflow CX agent definition** | Referenced in `readme.md` only | No CX flow/intent/page YAML or export is in the repo |

---

## Executive Summary

MediCoord AI is a frontend-heavy hackathon prototype that is partially functional as a demo but is nowhere near production-ready. The React frontend — three tabs covering Smart Routing, In-house Scheduling, and a "Predictive Analysis" view — is genuinely functional: it connects to the Geoapify routing API, renders live Leaflet maps, and simulates patient triage queues in the browser. However, the AI backbone that was meant to differentiate the product is broken or bypassed: the fine-tuned Vertex AI severity classifier was never successfully wired into the cloud function (evidenced by eight failed endpoint URL attempts), and the deployed version silently substitutes `random.choice()` for real model inference. The frontend and backend exist as completely isolated subsystems with no integration between them, and their severity classification schemas are incompatible. There is no Docker config, no CI/CD, no environment variable management (API keys are hardcoded in client-side code in plain sight), and no `requirements.txt` for the Python service. Roughly a third of the npm dependencies are installed but never imported. The codebase reads as a collection of parallel exploration tracks — some abandoned mid-way, some replaced by stubs — that were not consolidated before the demo.
