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
