# Design: Deep-rewrite of `/for-engineers` case studies

## Goal

The three case studies on `/for-engineers` currently read like light technical marketing copy, and — more importantly — describe a more advanced architecture than what's actually implemented (PostGIS/OSRM instead of Haversine, a distributed Redis cluster instead of an in-process cache, a Graph RAG knowledge graph instead of the real two-pass LLM tool-orchestration triage). Rewrite all three to be genuine engineering-blog-depth posts (Yelp Engineering Blog as style reference) that are **grounded in the real, current implementation**, with roadmap items honestly labeled as not-yet-shipped.

## Non-goals

- No new runtime dependencies (diagrams are static SVG assets, not a client-side rendering library).
- No fabricated metrics. None of the three systems have real production benchmarks; keep the existing "METRIC PENDING" convention for what hasn't been measured yet.
- No changes to `ForEngineersPage.tsx` structure (index cards already render from `summary`/`tags`/`readTimeMinutes` — no schema-breaking changes needed there).
- Not implementing the Graph RAG / ICD-10-CA knowledge graph itself — that's a separate, in-flight piece of work landing later this week. This pass only rewrites the case study content and (once KG ships) it can be revisited.

## Style reference (Yelp Engineering Blog)

Cross-checked 3 posts (`beyond-menu-tree`, `zero-downtime-upgrade-yelp-cassandra-upgrade-story`, `back-testing-engine-ad-budget-allocation`). Common pattern:
- Problem-first hook (no dramatic cold open), then background/context.
- Explicit "alternatives considered" — what was tried/rejected and why, in concrete terms.
- Implementation deep dive with real code/config snippets and specific tool names.
- Dedicated "challenges / lessons learned" section — candid about surprises.
- Caveats/limitations section — intellectual honesty about what the approach doesn't solve.
- First-person-plural, collaborative team voice throughout ("we built," "we realized").
- 2000-3200 words for Yelp's infra-scale posts; our posts are single-service case studies, so target 1200-1800 words each.

## Data schema changes

File: `webapp/src/data/caseStudies.ts`

Add to the `CaseStudy` interface (additive, `code` stays for back-compat but unused going forward):

```ts
export interface NamedSection {
  title: string
  body: string
}

export interface DiagramImage {
  src: string
  alt: string
  caption: string
}

export interface CaseStudy {
  // ...existing fields unchanged...
  background?: string
  alternativesConsidered?: NamedSection[]
  codeSamples?: CodeSample[]
  lessonsLearned?: NamedSection[]
  diagramImage?: DiagramImage
}
```

`result` keeps its current shape and "METRIC PENDING — <what it would measure>" convention.

## Content plan (grounded facts to write from)

### Case study 1 — reframed: "Two-Pass Tool Orchestration for Symptom Triage"
Real source: `backend/services/llm_agent.py`, `backend/llm/tools.py`.
- Pass 1: LLM calls `triage_response` tool (forced once `TRIAGE_MAX_FOLLOWUPS` turns reached) to classify severity — enum `routine|moderate|urgent|emergent` — with internal reasoning, no facility knowledge.
- Emergency (`severity == "emergent"`) and the turn-limit ceiling both bypass the `TRIAGE_MIN_TURNS` gate; everything else is suppressed as a followup below that gate.
- Pass 2 is deterministic Python: `find_nearest_facilities()` runs from cache, and the *real* facility name/address/distance is injected into a grounding system message before the LLM writes the patient-facing reply — the tool description explicitly says "Never invent or guess facility names."
- Provider swap (Groq default / Anthropic) via `LLM_PROVIDER` env var, deferred import so unused SDKs don't error.
- Stateless design: full history replayed every call, trimmed to `TRIAGE_CONTEXT_WINDOW`.
- What's next: Graph RAG grounding over a Canadian ICD-10-CA knowledge graph, in active development, landing this week — call out explicitly as not-yet-shipped, not as a shipped feature.

### Case study 2 — reframed: "Haversine Proximity + Severity-Gated Eligibility"
Real source: `backend/services/proximity.py`, `backend/cache.py`.
- `find_nearest_facilities(lat, lng, severity, top_n)`: filters facilities by `severity in accepted_severity`, ranks by Haversine great-circle distance, returns top N (`TRIAGE_TOP_N_FACILITIES`, default 3).
- Facilities come from an in-process cache (`cache.py`) — a module-level dict with a SHA-256 ETag over the sorted-key JSON serialization, not a database spatial query.
- Code's own comment: "full list is returned to frontend so Task 010 can later re-rank by Geoapify ETA without any backend change" — the composite-ETA/PostGIS/OSRM path is a documented future task, not built.
- Alternatives considered section: why Haversine now vs. PostGIS spatial index up front (simplicity, no infra dependency, small facility count doesn't need sub-ms spatial indexing yet).
- What's next: PostGIS `ST_DWithin` spatial filter + OSRM travel-time + Redis queue-depth composite scoring (Task 010).

### Case study 3 — reframed: "Two-Tier Facility State: In-Process Cache + Redis Wait Times"
Real source: `backend/cache.py`, `backend/services/wait_times.py`, `workers/scraper.py`.
- `get_wait_minutes_map()`: cache-aside read — Redis hash `wait_times:current` first (written every ~15 min by the Railway cron `workers/scraper.py`), falls back to Supabase RPC `latest_wait_times` on Redis error/cold-start, best-effort repopulates Redis from the fallback via a pipeline write, degrades to `{}` (never raises) if both fail — same "missing data always passes filters" convention as the hours filters.
- Facility records themselves (not wait times) live in the in-process `cache.py` dict — code's own comment says this "works for single-node sandbox simulation but doesn't survive horizontal scaling or process restarts."
- `workers/scraper.py` scrapes multiple external ER wait-time sources (howlongwilliwait, erstat), fuzzy-matches/dedupes against the facilities table, writes back to Redis.
- What's next: Redis Cluster with AOF persistence for the facility-state cache, a durable event bus for decision replay, in-flight routing-decision buffering, and the priority-queue gating that Sandbox Mode currently only visualizes on the frontend — none of that is live backend logic today.

## Diagrams

One real architecture diagram per case study, built with the `excalidraw-diagram` skill, exported as SVG to `webapp/src/assets/case-studies/<slug>.svg`, referenced via the new `diagramImage` field. The existing icon-based `diagramSteps` list stays as a compact "flow at a glance" summary underneath/alongside the diagram — no removal, additive only.

## Component changes

`webapp/src/pages/EngineeringCaseStudyPage.tsx`:
- Render `background` (if present) before "The Problem."
- Render `alternativesConsidered` as a new section between Approach and System Flow.
- Render `diagramImage` (if present) in the System Flow section, above the existing `diagramSteps` grid.
- Render `codeSamples` (array) in place of the single `code` block — loop instead of single render.
- Render `lessonsLearned` as a new section between System Flow and Tradeoff.

`webapp/src/pages/ForEngineersPage.tsx`: no structural changes. `readTimeMinutes` values get bumped to reflect the longer content.

`webapp/src/utils/caseStudyContent.ts`: no changes needed — existing helpers (`filterCaseStudies`, `splitWithEmphasis`, `formatPublishedDate`) work unmodified against the extended schema.

## Open questions
None outstanding — all resolved during brainstorming (accuracy approach, case-study-1 timing, schema extension vs. reuse, diagram scope).
