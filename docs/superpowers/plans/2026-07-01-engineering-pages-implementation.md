# Engineering Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/for-engineers` index page and add a new `/for-engineers/:slug` case-study detail page, per `design_document_engineering.md` (source mockups: `artifacts/eng-index.png`, `artifacts/eng-case-study.png`).

**Architecture:** Extract the current inline `SECTIONS` array in `ForEngineersPage.tsx` into a shared, augmented `CaseStudy[]` data module. Rebuild the index page as a filter-rail + preview-card feed. Add a brand-new detail page component that renders the full article (problem/approach/code/system-flow/tradeoff/pending-result) per case study, plus one new route. No backend, no CMS — everything is static, code-authored content.

**Tech Stack:** React 19 (RC), React Router v6, TypeScript (strict), Tailwind CSS v4, `@phosphor-icons/react`

## Global Constraints

- No new npm packages. All icons used (`Broadcast`, `UserCircle`, `MagnifyingGlass`, `CaretRight`, `Compass`, `Database`, `Robot`, `ShieldCheck`, `ClockCounterClockwise`, `CalendarBlank`, `PenNib`, `Clock`, `GithubLogo`, `FileText`, `ShareNetwork`, `ThumbsUp`, `ArrowLeft`, `ArrowRight`) are confirmed present in the installed `@phosphor-icons/react` version.
- TypeScript strict mode — no `any`, all props interfaces defined.
- **Route correction:** `design_document_engineering.md` refers to `/for-engineer`. The actual registered route (and current page) is `/for-engineers` (plural) — see `webapp/src/App.tsx:150`. This plan uses `/for-engineers` and `/for-engineers/:slug` throughout. Flag this doc discrepancy in the task summary; do not silently edit the design doc.
- Design tokens (copy verbatim): bg `#061219`, surface `#0A1D27/80`, border `#1C4659`, accent mint `#48F6C1`, accent blue `#00D2FF`, danger/pink `#FF7B93`, text primary `#E2F1F5`, text muted `#85A4B1`, text dim `#7AA0B0`. Font shell class already in use: `font-static`.
- **No automated frontend test framework is wired up.** Two existing files (`webapp/src/utils/hoursUtils.test.ts`, `webapp/src/hooks/useAnchor.test.ts`) import `vitest`, but `vitest` is not in `webapp/package.json` and is not installed — this is a pre-existing gap, out of scope for this plan. Do **not** add `vitest` as a new dependency here. Verification for every task is `tsc -b` + manual browser smoke test, matching the precedent in `docs/superpowers/plans/2026-06-25-audience-pages.md`.
- **Stat/metrics decision (confirmed with product owner):** none of the three systems have measured production metrics — the current copy explicitly says `METRIC PENDING`. Do not invent numbers to match the mockup's `99.8% / 0.85ms / 0.02%` stat row. Keep the existing "Pending" badge treatment instead (see Task 4).
- **Placeholder destinations:** `Architecture Roadmap`, `API Docs`, `View Roadmap`, `Github`, `Documentation`, `Subscribe`, `Share Repo`, `Helpful` have no real destination or backend in Phase 1 scope. Render them as inert, styled elements (not `<Link>`/`<button>`, no dead self-links) with `title="Coming soon"` — never a link that points back to the same page it's on.
- **Diagram deviation:** `design_document_engineering.md` §4.C.6 specs a static architecture-diagram image embed (`diagram: { src, caption }`). No such image assets exist for these 3 systems, and generating fabricated schematic images was rejected as a path (same reasoning as the stats decision above — don't ship generated-looking "real" artifacts). This plan instead reuses the existing 4-step icon-flow grid (`diagramSteps`, already implemented and working in the current `ForEngineersPage.tsx`) under a "System Flow" heading. The `CaseStudy` type has no `diagram` field.
- **Responsive simplification:** the design doc's §7 calls for sidebars collapsing behind a disclosure/accordion trigger below `lg`. This plan instead just stacks the sidebar above the main content (`flex-col` → `lg:flex-row`) — same end state (no side-by-side cramping on small screens), less UI to build. Upgrade to a real collapse/accordion only if user feedback asks for it.
- Commit style: conventional commits, no co-author, one commit per task.
- Type-check: `cd webapp && tsc -b` (not `tsc --noEmit`).
- Dev server: `cd webapp && doppler run -- npm run dev`.

---

## File Map

| Action | File | Responsibility |
|--------|------|-----------------|
| Create | `webapp/src/data/caseStudies.ts` | `CaseStudy` type + the 3 authored case-study entries |
| Create | `webapp/src/utils/caseStudyContent.ts` | Pure helpers: `filterCaseStudies`, `splitWithEmphasis`, `formatPublishedDate` |
| Modify | `webapp/src/pages/ForEngineersPage.tsx` | Full rebuild — index page per design doc §3 |
| Create | `webapp/src/pages/EngineeringCaseStudyPage.tsx` | New detail page per design doc §4 |
| Modify | `webapp/src/App.tsx` | Add import + route for the new detail page |

---

## Task 1: Case Study Data Model

Extract and augment the case-study content that currently lives inline in `ForEngineersPage.tsx` into a typed, shared data module both pages will import.

**Files:**
- Create: `webapp/src/data/caseStudies.ts`

**Interfaces:**
- Consumes: `TreeStructure`, `Compass`, `ChartLineUp` from `@phosphor-icons/react` (icon components, carried over from the current `SECTIONS` array)
- Produces: `export interface CaseStudy { ... }`, `export type NavSection = ...`, `export const CASE_STUDIES: CaseStudy[]` — consumed by Task 2, 3, and 4

---

- [ ] **Step 1: Create the data module**

Create `webapp/src/data/caseStudies.ts`:

```ts
import type { ElementType } from 'react'
import { TreeStructure, Compass, ChartLineUp } from '@phosphor-icons/react'

export interface DiagramStep {
  title: string
  desc: string
  icon: string
}

export interface ProblemHighlight {
  heading: string
  body: string
  accent: 'danger' | 'info'
}

export interface CodeSample {
  filename: string
  language: string
  content: string
}

export type NavSection = 'architecture' | 'infrastructure' | 'ai-models' | 'security' | 'change-logs'
export type CaseStudyAccent = 'mint' | 'blue'

export interface CaseStudy {
  slug: string
  navSection: NavSection
  category: string
  accent: CaseStudyAccent
  icon: ElementType
  tags: string[]
  title: string
  readTimeMinutes: number
  publishedDate: string
  author: string
  summary: string
  problem: string
  problemHighlights: ProblemHighlight[]
  approach: string
  approachEmphasis: [string, string]
  code?: CodeSample
  diagramSteps: DiagramStep[]
  tradeoff: string
  result: string
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: 'graph-rag-canadian-medical-kg',
    navSection: 'ai-models',
    category: 'LLM Symptom Understanding',
    accent: 'mint',
    icon: TreeStructure,
    tags: ['#AI-Agents', '#KnowledgeGraphs', '#LLMs'],
    title: 'Graph RAG with Canadian Medical KG',
    readTimeMinutes: 5,
    publishedDate: '2026-05-10',
    author: 'MediCoord Core Platform Team',
    summary:
      "Grounding LLM reasoning in structured diagnostic datasets (ICD-10-CA) to eliminate hallucination in clinical interpretations. We implemented a medical knowledge graph to constrain output space to grounded clinical relationships.",
    problem:
      "LLMs produce confident but wrong clinical relationships from lay language. 'My child won't eat and keeps shaking' maps to over a dozen conditions — with radically different severity and facility requirements. Prompt-only LLMs have no mechanism to prefer the clinically correct interpretation.",
    problemHighlights: [
      {
        heading: 'Ambiguous Mapping',
        body: "A single lay-language complaint like \"my child won't eat and keeps shaking\" maps to over a dozen conditions with radically different severity and facility requirements.",
        accent: 'danger',
      },
      {
        heading: 'No Preference Mechanism',
        body: 'Prompt-only LLMs have no structural way to prefer the clinically correct interpretation over a plausible-sounding wrong one.',
        accent: 'info',
      },
    ],
    approach:
      "We built a medical knowledge graph sourced from Canadian diagnostic datasets (ICD-10-CA). A preprocessing step extracts clinical entities from user input and injects them as structured context before the LLM prompt: [Symptom: Tachypnea] + [Patient: Pediatric] + [Risk: Dehydration]. The LLM reasons over a structured representation of the complaint, not raw text. This constrains the output space to grounded clinical relationships and eliminates the most common hallucination failure modes.",
    approachEmphasis: ['grounded clinical relationships', 'eliminates the most common hallucination failure modes'],
    diagramSteps: [
      { title: 'Natural Language Ingest', desc: 'Lay-language symptom input parsed from chat interfaces.', icon: 'ti ti-message-chatbot' },
      { title: 'Clinical Entity Extractor', desc: 'Extracts key symptoms, risks, and age groupings.', icon: 'ti ti-braces' },
      { title: 'KG Diagnostic Query', desc: 'Queries ICD-10-CA Knowledge Graph to map exact clinical entities.', icon: 'ti ti-git-fork' },
      { title: 'LLM Agent Triage', desc: 'Multi-turn agent reasons over context and triggers follow-up.', icon: 'ti ti-brain' },
    ],
    tradeoff:
      "The KG is a knowledge snapshot with a maintenance cost. Rare conditions and unusual symptom presentations still fall through to LLM base priors. The extraction step adds ~80–120ms latency per query. Grounding reduces misclassification frequency — it doesn't reduce it to zero.",
    result:
      'METRIC PENDING — % reduction in routing misclassification vs. baseline LLM without KG grounding, measured against Canadian ED triage benchmark dataset',
  },
  {
    slug: 'postgis-spatial-index-composite-eta',
    navSection: 'architecture',
    category: 'Proximity Search',
    accent: 'blue',
    icon: Compass,
    tags: ['#Geospatial', '#Routing', '#Postgres'],
    title: 'PostGIS Spatial Index + Composite ETA Scoring',
    readTimeMinutes: 8,
    publishedDate: '2026-05-17',
    author: 'MediCoord Core Platform Team',
    summary:
      'Solving the multi-modal routing challenge by combining sub-millisecond PostGIS spatial queries with real-time queue depth and drive-time API data for accurate triage windows.',
    problem:
      "Straight-line distance is the wrong metric for patient routing. A clinic 1.5 km away with a 60-minute queue means 65 minutes to care. A hospital 4 km away with an 8-minute drive and a 15-minute wait means 23 minutes. Nearest-neighbor routing loses to composite ETA routing by 42 minutes on this example — and the gap widens under load.",
    problemHighlights: [
      {
        heading: 'Distance Fallacy',
        body: 'A clinic 1.5 km away with a 60-minute queue means 65 minutes to care — nearest-neighbor routing picks it anyway.',
        accent: 'danger',
      },
      {
        heading: 'Widening Gap Under Load',
        body: 'Nearest-neighbor routing loses to composite ETA routing by 42 minutes on this example, and the gap widens as facility queues grow.',
        accent: 'info',
      },
    ],
    approach:
      "Facility coordinates are indexed with a PostGIS spatial index on the PostgreSQL facilities table. For each routing request, a spatial query returns candidate facilities within radius, pre-filtered by severity-gated capability tier (emergent cases never enter the candidate set of urgent care clinics). Each candidate is scored: ETA = road_travel_time (OSRM API) + queue_depth (Redis load tracker). The facility with the lowest composite ETA wins. The GIS index makes the spatial filter sub-millisecond even across thousands of facilities.",
    approachEmphasis: ['severity-gated capability tier', 'sub-millisecond even across thousands of facilities'],
    code: {
      filename: 'facility_query.sql',
      language: 'sql',
      content: `-- PostGIS candidate query (simplified)
SELECT id, name, capability_tier,
  ST_Distance(geog, ST_MakePoint($lon, $lat)::geography) AS dist_m
FROM facilities
WHERE ST_DWithin(geog, ST_MakePoint($lon, $lat)::geography, $radius_m)
  AND capability_tier >= $min_tier
ORDER BY dist_m
LIMIT 10;

-- Composite score in application layer
score = osrm_travel_minutes + redis_queue_depth_minutes`,
    },
    diagramSteps: [
      { title: 'Location Ingest', desc: 'Retrieves user GPS coordinates and target capability tier.', icon: 'ti ti-map-pin' },
      { title: 'PostGIS Filter', desc: 'Performs quick spatial query on Indexed Postgres database.', icon: 'ti ti-database' },
      { title: 'Multi-Modal OSRM', desc: 'Computes path geometry and travel time (Car/Bike/Bus).', icon: 'ti ti-clock' },
      { title: 'Composite Scoring', desc: 'Ranks candidates: ETA = Road Travel Time + Redis Queue Depth.', icon: 'ti ti-calculator' },
    ],
    tradeoff:
      'PostGIS adds infrastructure complexity over a pure in-memory geo index. More critically: in Phase 1, queue depth is modeled from facility type and time-of-day heuristics — not live facility data feeds. The routing math is correct; the queue input is an approximation. Live feed integration is the next defensibility moat.',
    result:
      'METRIC PENDING — average minutes saved per routing decision vs. straight-line nearest-neighbor, across sandbox simulation runs',
  },
  {
    slug: 'distributed-redis-cache-facility-state',
    navSection: 'infrastructure',
    category: 'Realtime Load Tracker',
    accent: 'mint',
    icon: ChartLineUp,
    tags: ['#Performance', '#Caching', '#Redis'],
    title: 'Distributed Redis Cache for City-Wide Facility State',
    readTimeMinutes: 12,
    publishedDate: '2026-05-24',
    author: 'MediCoord Core Platform Team',
    summary:
      'Engineering a low-latency state engine to track inbound patient routing and avoid hospital bottlenecks. We utilized Redis ZSETs and atomic locks to prevent system-wide thundering herd problems.',
    problem:
      "Optimal single-patient routing is self-defeating at scale. Route 80 patients to the same best-scoring hospital and you've recreated the bottleneck. The system needs shared load state that captures not just current queue depth but routing decisions already in flight.",
    problemHighlights: [
      {
        heading: 'Concurrency Failure',
        body: "Route 80 patients to the same best-scoring hospital and you've recreated the bottleneck the system was built to solve.",
        accent: 'danger',
      },
      {
        heading: 'No Shared State',
        body: 'The system needs shared load state that captures not just current queue depth but routing decisions already in flight.',
        accent: 'info',
      },
    ],
    approach:
      "A Redis cache stores per-facility state: current queue depth, inbound routing decisions in flight (not yet reflected in the measured queue), and capability tier. Each routing decision reads projected state atomically (GET + pipeline write) and increments the in-flight count for the winning facility. The priority queue gates resolution order: emergent cases route first; urgent routes to the lowest composite ETA with matching capability; moderate and routine absorb remaining capacity across the full network — including clinics that emergent cases would never target. This is what Sandbox Mode visualizes in real time.",
    approachEmphasis: ['reads projected state atomically', 'emergent cases route first'],
    diagramSteps: [
      { title: 'Concurrent Inflow', desc: 'Multiple patient routing requests sent concurrently.', icon: 'ti ti-users' },
      { title: 'Atomic Pipeline Lock', desc: 'Increments in-flight buffer atomically to hold place.', icon: 'ti ti-lock' },
      { title: 'Redis ZSET Tracking', desc: 'Scores and updates load tracking sorted sets in real-time.', icon: 'ti ti-list-numbers' },
      { title: 'Load Redistribution', desc: 'Pushes subsequent decisions to secondary capacity buffers.', icon: 'ti ti-adjustments-horizontal' },
    ],
    tradeoff:
      "Phase 1 runs the cache in-process at the app layer — no external Redis instance. This works for single-node sandbox simulation but doesn't survive horizontal scaling or process restarts. Production city-scale deployment requires Redis Cluster with AOF persistence and a durable event bus for decision replay. The sandbox models the coordination logic faithfully; it doesn't model distributed failure modes.",
    result:
      'METRIC PENDING — % improvement in facility utilization balance (std dev of queue depth across facilities) under simulated peak load, vs. non-load-aware routing baseline',
  },
]
```

- [ ] **Step 2: Type-check**

```bash
cd webapp && tsc -b
```

Expected: exits 0, no errors. (This file has no consumers yet, so this only validates the module compiles standalone — later tasks will fail to compile if imports drift.)

- [ ] **Step 3: Commit**

```bash
git add webapp/src/data/caseStudies.ts
git commit -m "feat(data): extract engineering case-study content into shared typed module"
```

---

## Task 2: Shared Content Helpers

Two small pure functions consumed by both pages: search/tag filtering for the index, and inline emphasis splitting + date formatting for the detail page.

**Files:**
- Create: `webapp/src/utils/caseStudyContent.ts`

**Interfaces:**
- Consumes: `CaseStudy` from `webapp/src/data/caseStudies.ts` (Task 1)
- Produces: `filterCaseStudies(list, query, activeTag)`, `splitWithEmphasis(text, emphasis)`, `formatPublishedDate(iso)` — consumed by Task 3 and Task 4

---

- [ ] **Step 1: Create the helpers module**

Create `webapp/src/utils/caseStudyContent.ts`:

```ts
import type { CaseStudy } from '../data/caseStudies'

export function filterCaseStudies(list: CaseStudy[], query: string, activeTag: string | null): CaseStudy[] {
  const q = query.trim().toLowerCase()
  return list.filter((cs) => {
    const matchesTag = !activeTag || cs.tags.includes(activeTag)
    if (!matchesTag) return false
    if (!q) return true
    return (
      cs.title.toLowerCase().includes(q) ||
      cs.summary.toLowerCase().includes(q) ||
      cs.category.toLowerCase().includes(q) ||
      cs.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  })
}

export interface EmphasisSegment {
  text: string
  weight: 'plain' | 'bold' | 'accent'
}

export function splitWithEmphasis(text: string, emphasis: [string, string]): EmphasisSegment[] {
  const [boldPhrase, accentPhrase] = emphasis
  let segments: EmphasisSegment[] = [{ text, weight: 'plain' }]

  const applySplit = (phrase: string, weight: 'bold' | 'accent') => {
    segments = segments.flatMap((segment) => {
      if (segment.weight !== 'plain' || !phrase) return [segment]
      const idx = segment.text.indexOf(phrase)
      if (idx === -1) return [segment]
      const before = segment.text.slice(0, idx)
      const after = segment.text.slice(idx + phrase.length)
      const result: EmphasisSegment[] = []
      if (before) result.push({ text: before, weight: 'plain' })
      result.push({ text: phrase, weight })
      if (after) result.push({ text: after, weight: 'plain' })
      return result
    })
  }

  applySplit(boldPhrase, 'bold')
  applySplit(accentPhrase, 'accent')

  return segments
}

export function formatPublishedDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
}
```

- [ ] **Step 2: Type-check**

```bash
cd webapp && tsc -b
```

Expected: exits 0, no errors.

- [ ] **Step 3: Manual sanity check**

No test runner is available for this repo (see Global Constraints). Verify the two non-trivial functions by hand before moving on — paste this into a scratch file or a browser console once Task 3 is wired up:

```ts
import { filterCaseStudies, splitWithEmphasis, formatPublishedDate } from './utils/caseStudyContent'
import { CASE_STUDIES } from './data/caseStudies'

console.log(filterCaseStudies(CASE_STUDIES, '', '#Redis').map((c) => c.slug))
// expect: ['distributed-redis-cache-facility-state']

console.log(filterCaseStudies(CASE_STUDIES, 'postgis', null).map((c) => c.slug))
// expect: ['postgis-spatial-index-composite-eta'] (matches on category text)

console.log(splitWithEmphasis('a grounded clinical relationships b', ['grounded clinical relationships', 'zzz']))
// expect: [{text:'a ',weight:'plain'},{text:'grounded clinical relationships',weight:'bold'},{text:' b',weight:'plain'}]

console.log(formatPublishedDate('2026-05-24'))
// expect: 'May 24, 2026'
```

Delete the scratch file after confirming; it is not part of the deliverable.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/utils/caseStudyContent.ts
git commit -m "feat(utils): add case-study filter, emphasis-split, and date-format helpers"
```

---

## Task 3: Rebuild `/for-engineers` Index Page

Replace the entire current `ForEngineersPage.tsx` (single long-scroll article page) with the filter-rail + preview-card index from design doc §3.

**Files:**
- Modify: `webapp/src/pages/ForEngineersPage.tsx` (full replacement)

**Interfaces:**
- Consumes: `CASE_STUDIES` from `webapp/src/data/caseStudies.ts`, `filterCaseStudies` from `webapp/src/utils/caseStudyContent.ts`
- Produces: rebuilt `/for-engineers` route; each preview card links to `/for-engineers/:slug` (consumed by Task 4)

---

- [ ] **Step 1: Replace ForEngineersPage.tsx with the index implementation**

Replace the entire contents of `webapp/src/pages/ForEngineersPage.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Broadcast, CaretRight, MagnifyingGlass, UserCircle } from '@phosphor-icons/react'
import { CASE_STUDIES } from '../data/caseStudies'
import { filterCaseStudies } from '../utils/caseStudyContent'

const ACCENT_STYLES = {
  mint: {
    iconBg: 'bg-[#48F6C1]/10',
    iconBorder: 'border-[#48F6C1]/20',
    iconColor: 'text-[#48F6C1]',
    labelColor: 'text-[#48F6C1]',
    tagBg: 'bg-[#48F6C1]/10',
    tagBorder: 'border-[#48F6C1]/20',
    tagText: 'text-[#48F6C1]',
  },
  blue: {
    iconBg: 'bg-[#00D2FF]/10',
    iconBorder: 'border-[#00D2FF]/20',
    iconColor: 'text-[#00D2FF]',
    labelColor: 'text-[#00D2FF]',
    tagBg: 'bg-[#00D2FF]/10',
    tagBorder: 'border-[#00D2FF]/20',
    tagText: 'text-[#00D2FF]',
  },
} as const

const PRIMARY_TAGS = CASE_STUDIES.map((cs) => cs.tags[0])

export default function ForEngineersPage() {
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const visibleCaseStudies = useMemo(
    () => filterCaseStudies(CASE_STUDIES, query, activeTag),
    [query, activeTag]
  )

  return (
    <div className="bg-[#061219] min-h-screen flex flex-col font-static text-[#E2F1F5] overflow-x-hidden">

      {/* Top utility header */}
      <header className="w-full border-b border-[#1C4659]/80 bg-[#061219]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#1C4659]/50 flex-none shadow-sm">
              <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
            </div>
            <span className="text-base font-bold text-white">Dispatch HQ</span>
          </div>
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="w-8 h-8 rounded-full border border-[#1C4659]/60 text-[#7AA0B0] flex items-center justify-center"
            >
              <Broadcast className="w-4 h-4" />
            </div>
            <UserCircle className="w-8 h-8 text-[#7AA0B0]" aria-hidden="true" />
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 flex flex-col lg:flex-row gap-8">

        {/* Left filter rail */}
        <aside className="lg:w-[280px] flex-none flex flex-col gap-6">
          <div className="border border-[#1C4659]/50 bg-[#0A1D27]/80 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-bold text-white">Technical Index</h2>
              <p className="text-xs text-[#85A4B1] leading-relaxed">
                Exploring the architecture of automated clinical coordination.
              </p>
            </div>

            <label className="flex items-center gap-2 px-3 h-10 rounded-lg border border-[#1C4659]/60 bg-[#061219]/60 text-[#7AA0B0] focus-within:border-[#48F6C1]/40">
              <MagnifyingGlass className="w-4 h-4 flex-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search technical case studies"
                className="bg-transparent text-xs text-[#E2F1F5] placeholder:text-[#7AA0B0] outline-none w-full"
              />
            </label>

            <nav className="flex flex-col gap-1" aria-label="Filter by tag">
              {PRIMARY_TAGS.map((tag) => {
                const isActive = activeTag === tag
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTag(isActive ? null : tag)}
                    aria-pressed={isActive}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                      isActive
                        ? 'bg-[#132A37] border border-[#1C4659] text-white'
                        : 'border border-transparent text-[#85A4B1] hover:text-white hover:border-[#1C4659]/60'
                    }`}
                  >
                    {tag}
                    <CaretRight className="w-3 h-3" />
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="border border-[#1C4659]/50 bg-[#0A1D27]/60 rounded-2xl p-5 flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold text-[#7AA0B0] uppercase tracking-widest">Status</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#48F6C1]" />
              <span className="text-sm font-bold text-white">{CASE_STUDIES.length} Live Systems</span>
            </div>
          </div>
        </aside>

        {/* Right article feed */}
        <main className="flex-1 flex flex-col gap-8 min-w-0">

          <div className="border border-[#1C4659]/60 bg-gradient-to-r from-[#0A1D27] to-[#0A1D27]/40 rounded-xl px-5 py-3">
            <span className="text-[10px] font-mono font-bold text-[#7AA0B0] uppercase tracking-[0.2em]">
              System Architecture Deep-Dives
            </span>
          </div>

          <div className="flex flex-col gap-5">
            <div className="inline-flex items-center self-start gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#48F6C1]/10 text-[#48F6C1] border border-[#48F6C1]/20 tracking-wider uppercase">
              Engineering Blog
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
              How it works under the hood
            </h1>
            <p className="text-[#85A4B1] text-base leading-relaxed max-w-2xl">
              Three system deep-dives. Each one follows the same structure: what broke, how we approached it, what we traded away, and what we'll measure.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {visibleCaseStudies.map((cs) => {
              const Icon = cs.icon
              const accent = ACCENT_STYLES[cs.accent]
              return (
                <article key={cs.slug} className="border border-[#1C4659]/50 bg-[#0A1D27]/80 rounded-2xl p-8 flex flex-col gap-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${accent.iconBg} ${accent.iconBorder} border ${accent.iconColor} flex items-center justify-center flex-none`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-mono font-bold ${accent.labelColor} uppercase tracking-widest`}>
                        {cs.category}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-[#7AA0B0] whitespace-nowrap">{cs.readTimeMinutes} MIN READ</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {cs.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono border ${accent.tagBg} ${accent.tagBorder} ${accent.tagText}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <h2 className="text-2xl font-extrabold text-white">{cs.title}</h2>
                  <p className="text-sm text-[#85A4B1] leading-relaxed">{cs.summary}</p>

                  <Link
                    to={`/for-engineers/${cs.slug}`}
                    className="self-start inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white border border-[#1C4659]/60 rounded-xl hover:border-[#48F6C1]/50 hover:text-[#48F6C1] transition-colors"
                  >
                    Read Case Study
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </article>
              )
            })}

            {visibleCaseStudies.length === 0 && (
              <div className="border border-dashed border-[#1C4659]/60 rounded-2xl p-8 text-center text-sm text-[#7AA0B0]">
                No case studies match this search or filter.
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-[#132A37]/80 bg-[#061219]/50 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#7AA0B0]">
          <span>© 2026 MediCoord AI · Patient Routing Platform. All rights reserved.</span>
          <div className="flex items-center gap-5">
            <span className="text-[#4C6572] cursor-default" title="Coming soon">Architecture Roadmap</span>
            <span className="text-[#4C6572] cursor-default" title="Coming soon">API Docs</span>
            <Link to="/" className="hover:text-white transition-colors">Back to Overview</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd webapp && tsc -b
```

Expected: exits 0, no errors.

- [ ] **Step 3: Visual verify in browser**

```bash
cd webapp && doppler run -- npm run dev
```

Navigate to `http://localhost:5173/for-engineers`. Verify:
- Sticky header: logo + "Dispatch HQ" wordmark left, broadcast icon + avatar icon right
- Left rail: "Technical Index" heading + description, search input, 3 tag filter rows (`#AI-Agents`, `#Geospatial`, `#Performance`), status card showing "3 Live Systems"
- Clicking a tag filter row toggles its active (filled) state and filters the card list to only that system; clicking it again clears the filter
- Typing in the search box (e.g. "redis") filters to the matching case study live
- Right feed: banner strip, "Engineering Blog" pill, H1, subhead, 3 preview cards each with icon+category+read-time, tag chips, title, summary, "Read Case Study" button
- Clicking "Read Case Study" navigates to `/for-engineers/<slug>` (will 404-redirect back to `/for-engineers` until Task 4 lands — expected at this point)
- Footer: copyright, dimmed non-clickable "Architecture Roadmap" / "API Docs", working "Back to Overview" link to `/`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/pages/ForEngineersPage.tsx
git commit -m "feat(pages): rebuild /for-engineers as filter-rail case-study index"
```

---

## Task 4: New `/for-engineers/:slug` Case Study Detail Page

Add the page type that doesn't exist yet, and wire its route.

**Files:**
- Create: `webapp/src/pages/EngineeringCaseStudyPage.tsx`
- Modify: `webapp/src/App.tsx`

**Interfaces:**
- Consumes: `CASE_STUDIES` from `webapp/src/data/caseStudies.ts`, `splitWithEmphasis` + `formatPublishedDate` from `webapp/src/utils/caseStudyContent.ts`
- Produces: route `/for-engineers/:slug`

---

- [ ] **Step 1: Create EngineeringCaseStudyPage.tsx**

Create `webapp/src/pages/EngineeringCaseStudyPage.tsx`:

```tsx
import type { ElementType, ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarBlank,
  ClockCounterClockwise,
  Clock,
  Compass,
  Database,
  FileText,
  GithubLogo,
  PenNib,
  Robot,
  ShareNetwork,
  ShieldCheck,
  ThumbsUp,
} from '@phosphor-icons/react'
import { CASE_STUDIES, type NavSection } from '../data/caseStudies'
import { formatPublishedDate, splitWithEmphasis } from '../utils/caseStudyContent'

const ACCENT_HEX: Record<'mint' | 'blue', string> = {
  mint: '#48F6C1',
  blue: '#00D2FF',
}

const NAV_ITEMS: { id: NavSection; label: string; icon: ElementType }[] = [
  { id: 'architecture', label: 'Architecture', icon: Compass },
  { id: 'infrastructure', label: 'Infrastructure', icon: Database },
  { id: 'ai-models', label: 'AI Models', icon: Robot },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'change-logs', label: 'Change Logs', icon: ClockCounterClockwise },
]

function SectionHeading({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-1 h-6 rounded-full flex-none" style={{ backgroundColor: color }} />
      <h2 className="text-xl font-extrabold text-white">{children}</h2>
    </div>
  )
}

export default function EngineeringCaseStudyPage() {
  const { slug } = useParams<{ slug: string }>()
  const caseStudy = CASE_STUDIES.find((cs) => cs.slug === slug)

  if (!caseStudy) {
    return <Navigate to="/for-engineers" replace />
  }

  const accentHex = ACCENT_HEX[caseStudy.accent]

  return (
    <div className="bg-[#061219] min-h-screen flex flex-col font-static text-[#E2F1F5] overflow-x-hidden">

      {/* Top utility header */}
      <header className="w-full border-b border-[#1C4659]/80 bg-[#061219]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-base font-bold text-white">MediCoord AI Engineering</span>
          <div className="flex items-center gap-5">
            <Link to="/for-engineers" className="text-xs text-[#7AA0B0] hover:text-white transition-colors">
              Back to Overview
            </Link>
            <span
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#061219] bg-[#48F6C1]/50 cursor-default"
              title="Coming soon"
            >
              Subscribe
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 flex flex-col lg:flex-row gap-10">

        {/* Left section nav */}
        <aside className="lg:w-[240px] flex-none flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-white">Technical Index</h2>
            <span className="text-xs text-[#7AA0B0]">MediCoord Core</span>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Documentation sections">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = item.id === caseStudy.navSection
              return (
                <span
                  key={item.id}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                    isActive ? 'bg-[#132A37] border border-[#1C4659] text-white font-bold' : 'text-[#85A4B1]'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-none" />
                  {item.label}
                </span>
              )
            })}
          </nav>

          <div className="border-t border-[#1C4659]/50 pt-5 flex flex-col gap-4">
            <span
              className="w-full text-center px-4 py-2.5 rounded-xl border border-[#1C4659]/60 text-sm font-bold text-[#4C6572] cursor-default"
              title="Coming soon"
            >
              View Roadmap
            </span>
            <div className="flex flex-col gap-2 text-xs text-[#7AA0B0]">
              <span className="flex items-center gap-2 cursor-default" title="Coming soon">
                <GithubLogo className="w-4 h-4" /> Github
              </span>
              <span className="flex items-center gap-2 cursor-default" title="Coming soon">
                <FileText className="w-4 h-4" /> Documentation
              </span>
            </div>
          </div>
        </aside>

        {/* Main article column */}
        <main className="flex-1 max-w-3xl flex flex-col gap-10 min-w-0">

          <Link
            to="/for-engineers"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#00D2FF] uppercase tracking-wider hover:text-[#48F6C1] transition-colors self-start"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Technical Index
          </Link>

          <div className="flex flex-col gap-4">
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight">
              {caseStudy.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#7AA0B0]">
              <span className="flex items-center gap-1.5">
                <CalendarBlank className="w-3.5 h-3.5" />
                Published: {formatPublishedDate(caseStudy.publishedDate)}
              </span>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1.5">
                <PenNib className="w-3.5 h-3.5" />
                Written by {caseStudy.author}
              </span>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {caseStudy.readTimeMinutes} Min Read
              </span>
            </div>
          </div>

          <div className="border-l-4 border-[#48F6C1] bg-[#0A1D27]/80 rounded-r-xl p-5 flex flex-col gap-2">
            <h2 className="text-sm font-bold text-white">Architectural Overview</h2>
            <p className="text-sm text-[#85A4B1] leading-relaxed">{caseStudy.summary}</p>
          </div>

          <section className="flex flex-col gap-4 border-t border-[#132A37]/80 pt-10">
            <SectionHeading color="#FF7B93">The Problem</SectionHeading>
            <p className="text-sm text-[#85A4B1] leading-relaxed">{caseStudy.problem}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {caseStudy.problemHighlights.map((h) => (
                <div
                  key={h.heading}
                  className={`border rounded-xl p-4 flex flex-col gap-1.5 ${
                    h.accent === 'danger' ? 'border-[#FF7B93]/30' : 'border-[#00D2FF]/30'
                  }`}
                >
                  <span className={`text-xs font-bold ${h.accent === 'danger' ? 'text-[#FF7B93]' : 'text-[#00D2FF]'}`}>
                    {h.heading}
                  </span>
                  <p className="text-xs text-[#85A4B1] leading-relaxed">{h.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4 border-t border-[#132A37]/80 pt-10">
            <SectionHeading color={accentHex}>The Architecture Strategy</SectionHeading>
            <p className="text-sm text-[#E2F1F5] leading-relaxed">
              {splitWithEmphasis(caseStudy.approach, caseStudy.approachEmphasis).map((seg, i) => {
                if (seg.weight === 'bold') {
                  return (
                    <strong key={i} className="text-white font-bold">
                      {seg.text}
                    </strong>
                  )
                }
                if (seg.weight === 'accent') {
                  return (
                    <span key={i} className="text-[#00D2FF]">
                      {seg.text}
                    </span>
                  )
                }
                return <span key={i}>{seg.text}</span>
              })}
            </p>

            {caseStudy.code && (
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#7AA0B0]">
                  {caseStudy.code.language.toUpperCase()} Sample
                </span>
                <div className="border border-[#1C4659]/60 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#0D1B23] border-b border-[#1C4659]/60">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF7B93]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#48F6C1]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#00D2FF]" />
                    </div>
                    <span className="text-[11px] font-mono text-[#7AA0B0]">{caseStudy.code.filename}</span>
                  </div>
                  <pre className="bg-[#061219]/80 p-4 text-xs font-mono text-[#48F6C1] overflow-x-auto leading-relaxed">
                    <code>{caseStudy.code.content}</code>
                  </pre>
                </div>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3 border-t border-[#132A37]/80 pt-10">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#7AA0B0]">System Flow</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {caseStudy.diagramSteps.map((step, idx) => (
                <div key={step.title} className="relative flex flex-col gap-2 p-4 bg-[#0A1D27]/60 border border-[#1C4659]/40 rounded-xl">
                  <div className="absolute top-3 right-3 text-xs font-mono font-bold text-[#7AA0B0]/40">0{idx + 1}</div>
                  <div className="text-[20px]" style={{ color: accentHex }}>
                    <i className={step.icon} />
                  </div>
                  <div className="text-xs font-bold text-white mt-1">{step.title}</div>
                  <div className="text-[11px] text-[#85A4B1] leading-relaxed mt-0.5">{step.desc}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3 border-t border-[#132A37]/80 pt-10">
            <span className="text-[10px] font-mono font-bold text-[#7AA0B0] uppercase tracking-widest">Tradeoff</span>
            <div className="border border-[#1C4659]/50 bg-[#0A1D27]/60 rounded-xl p-4">
              <p className="text-sm text-[#85A4B1] leading-relaxed">{caseStudy.tradeoff}</p>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold text-[#00D2FF] uppercase tracking-widest">Result</span>
            <div className="border border-dashed border-[#00D2FF]/30 bg-[#00D2FF]/5 rounded-xl p-4 flex items-start gap-3">
              <span className="flex-none mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/20 uppercase tracking-wider whitespace-nowrap">
                Pending
              </span>
              <p className="text-xs text-[#7AA0B0] leading-relaxed italic">{caseStudy.result}</p>
            </div>
          </section>

        </main>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-[#132A37]/80 bg-[#061219]/50 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#7AA0B0]">
          <span>© 2026 MediCoord Engineering. Internal Distribution Only.</span>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5 cursor-default" title="Coming soon">
              <ShareNetwork className="w-4 h-4" /> Share Repo
            </span>
            <span className="flex items-center gap-1.5 cursor-default" title="Coming soon">
              <ThumbsUp className="w-4 h-4" /> Helpful
            </span>
          </div>
        </div>
      </footer>

    </div>
  )
}
```

- [ ] **Step 2: Register the route in App.tsx**

In `webapp/src/App.tsx`, add the import after the existing `ForEngineersPage` import (line 14):

```tsx
import ForEngineersPage from './pages/ForEngineersPage'
import EngineeringCaseStudyPage from './pages/EngineeringCaseStudyPage'
```

Inside the `<Routes>` block, add immediately after the `/for-engineers` route (line 150), before the catch-all `*` route:

```tsx
<Route path="/for-engineers" element={<ForEngineersPage />} />
<Route path="/for-engineers/:slug" element={<EngineeringCaseStudyPage />} />
```

- [ ] **Step 3: Type-check**

```bash
cd webapp && tsc -b
```

Expected: exits 0, no errors.

- [ ] **Step 4: Visual verify in browser**

With dev server running (`cd webapp && doppler run -- npm run dev`), check each of the 3 slugs directly and via navigation:

- `http://localhost:5173/for-engineers/graph-rag-canadian-medical-kg`
- `http://localhost:5173/for-engineers/postgis-spatial-index-composite-eta`
- `http://localhost:5173/for-engineers/distributed-redis-cache-facility-state`

Verify for each:
- Header: "MediCoord AI Engineering" wordmark, "Back to Overview" link (→ `/for-engineers`), dimmed non-clickable "Subscribe"
- Left nav: "Technical Index" / "MediCoord Core", 5 static section rows, exactly one highlighted (matches the case study's `navSection` — `distributed-redis-cache-facility-state` should highlight **Infrastructure**), dimmed "View Roadmap" / "Github" / "Documentation"
- Breadcrumb "← Back to Technical Index" navigates to `/for-engineers`
- H1 + meta row (calendar/pen/clock icons, correctly formatted date e.g. "May 24, 2026")
- Mint-left-border "Architectural Overview" callout with the summary text
- "The Problem" section: pink accent bar, paragraph, 2 highlight cards (pink-bordered + blue-bordered)
- "The Architecture Strategy" section: accent-colored bar, paragraph with one bold phrase and one blue phrase visible inline
- For `postgis-spatial-index-composite-eta` only: SQL code block with 3 colored dots + `facility_query.sql` filename tab, horizontally scrollable if needed
- "System Flow" 4-card grid renders with numbered badges and tabler icons
- "Tradeoff" bordered box
- "Result" section shows the dashed blue box with a "Pending" badge — no invented numeric stats anywhere
- Footer: copyright + dimmed "Share Repo" / "Helpful"

Also verify: navigating to a bogus slug (`http://localhost:5173/for-engineers/does-not-exist`) redirects to `/for-engineers`.

Also verify responsively (resize below `1024px`): sidebars stack above/below the main content instead of sitting beside it (no overlap, no horizontal scroll on the page itself — only the code block scrolls).

- [ ] **Step 5: Commit**

```bash
git add webapp/src/pages/EngineeringCaseStudyPage.tsx webapp/src/App.tsx
git commit -m "feat(pages): add /for-engineers/:slug case-study detail page"
```
