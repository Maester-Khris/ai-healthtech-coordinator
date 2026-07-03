import type { ElementType } from 'react'
import { TreeStructure, Compass, ChartLineUp } from '@phosphor-icons/react'
import twoPassTriageDiagram from '../assets/case-studies/two-pass-tool-orchestration-symptom-triage.svg'
import haversineProximityDiagram from '../assets/case-studies/haversine-proximity-severity-gated-eligibility.svg'
import twoTierCacheDiagram from '../assets/case-studies/two-tier-facility-state-cache-redis-wait-times.svg'

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

export interface NamedSection {
  title: string
  body: string
}

export interface DiagramImage {
  src: string
  alt: string
  caption: string
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
  background?: string
  problem: string
  problemHighlights: ProblemHighlight[]
  alternativesConsidered?: NamedSection[]
  approach: string
  approachEmphasis: [string, string]
  code?: CodeSample
  codeSamples?: CodeSample[]
  diagramSteps: DiagramStep[]
  diagramImage?: DiagramImage
  lessonsLearned?: NamedSection[]
  tradeoff: string
  result: string
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: 'two-pass-tool-orchestration-symptom-triage',
    navSection: 'ai-models',
    category: 'LLM Symptom Understanding',
    accent: 'mint',
    icon: TreeStructure,
    tags: ['#AI-Agents', '#LLMTools', '#Groq'],
    title: 'Two-Pass Tool Orchestration for Symptom Triage',
    readTimeMinutes: 7,
    publishedDate: '2026-05-10',
    author: 'MediCoord Core Platform Team',
    summary:
      "Splitting LLM symptom triage into two forced passes — a tool-only severity classification, then a deterministic facility lookup, then a grounded response — so the model can never invent a facility name or commit to a severity before it has enough information.",
    background:
      "MediCoord's chat interface routes patients to the nearest appropriate facility based on a short symptom conversation. The riskiest part of that pipeline isn't the routing — it's the classification. A large language model asked to output severity directly, in one shot, will produce a confident, well-formatted answer whether or not it actually has enough information. We split triage into two passes so the model's linguistic fluency and Python's determinism each do the job they're actually good at.",
    problem:
      "Two failure modes show up when you let a single LLM call do both classification and response generation. First, models are trained to be helpful, which means they'll often generate a plausible-sounding facility name and address instead of admitting they don't have one — there's no reliable way to catch that after the fact once it's already in a patient-facing sentence. Second, models are eager: given three words of symptom description, an unconstrained model will confidently commit to a severity level rather than asking a clarifying question first. Both failure modes are worse than a slow response — a wrong facility name sends a patient to the wrong door, and a premature classification is either a false alarm or a missed one.",
    problemHighlights: [
      {
        heading: 'Hallucinated Facilities',
        body: 'A model asked to write "the nearest facility is X" in the same breath as reasoning about symptoms has no way to guarantee X is a real place — it is optimizing for a plausible sentence, not a grounded fact.',
        accent: 'danger',
      },
      {
        heading: 'Premature Classification',
        body: 'Nothing stops a one-shot model from committing to a severity level on the first message, before it has asked about duration, associated symptoms, or history.',
        accent: 'info',
      },
    ],
    alternativesConsidered: [
      {
        title: 'Single-pass classify-and-respond',
        body: "The simplest design is one LLM call that both classifies severity and writes the response in the same completion. We prototyped this first — it's faster (one round trip) and simpler to implement. It broke exactly the way you'd expect: the model would generate specific-sounding facility names that didn't exist in our data, and there was no clean place to intercept and correct a hallucinated fact inside an already-generated sentence.",
      },
      {
        title: 'Structured output / JSON mode instead of tool calling',
        body: "We considered constraining the single-pass response with a JSON schema instead of splitting into two calls. That solves the format problem but not the grounding problem — a well-formed JSON object can still contain an invented facility name. Tool calling forced us to physically remove the facility field from what the model is allowed to write in pass one, which JSON mode alone doesn't do.",
      },
    ],
    approach:
      "triage_response is the only tool the model can call in Pass 1, and its schema forces a severity enum (routine, moderate, urgent, emergent) plus a short internal reasoning string and an information_sufficient boolean — no patient-facing text, no facility name, nothing the model could invent. A minimum-turns gate suppresses that tool call as a followup question unless the model has already seen enough of the conversation — unless severity comes back 'emergent' or the conversation has hit a hard turn ceiling, both of which bypass the gate, because refusing to route an emergency to force more questions is its own failure mode. Once severity is classified, Pass 2 is deterministic: a plain Python function looks up the nearest eligible facility from the in-process cache, no LLM involved, and returns a real facility record. That record is injected into a second grounding message before asking the model to write the two-to-four sentence patient-facing reply. The model never gets a chance to invent a name because by the time it's writing prose, the name is already a fact in its context, not a decision it's making.",
    approachEmphasis: ['no patient-facing text, no facility name, nothing the model could invent', 'The model never gets a chance to invent a name'],
    codeSamples: [
      {
        filename: 'tools.py',
        language: 'python',
        content: `TRIAGE_RESPONSE = ToolDefinition(
    name="triage_response",
    description=(
        "Call this when you have sufficient information to classify the "
        "patient's symptom severity. Do NOT include a patient-facing "
        "response — the conversational response is generated separately "
        "after the nearest facility is identified from the system's data. "
        "Never invent or guess facility names."
    ),
    parameters={
        "severity": {
            "type": "string",
            "enum": ["routine", "moderate", "urgent", "emergent"],
        },
        "reasoning": {"type": "string"},
        "information_sufficient": {"type": "boolean"},
    },
    required=["severity", "reasoning", "information_sufficient"],
)`,
      },
      {
        filename: 'llm_agent.py',
        language: 'python',
        content: `if facility:
    facility_fact = (
        f"The nearest appropriate facility is: {facility['name']} "
        f"at {facility['address']}, approximately "
        f"{facility['distanceKm']} km away. Use this exact facility "
        f"name in your response — do not modify or replace it."
    )
else:
    facility_fact = (
        "No location data is available. Do not mention any specific "
        "facility. Advise the patient to call 211 or search online "
        "for nearby care."
    )`,
      },
    ],
    diagramSteps: [
      { title: 'User Message In', desc: 'Chat turn appended to trimmed conversation history (last TRIAGE_CONTEXT_WINDOW messages).', icon: 'ti ti-message-chatbot' },
      { title: 'Pass 1: Forced Tool Call', desc: 'LLM emits triage_response — severity, reasoning, information_sufficient. No facility data yet.', icon: 'ti ti-braces' },
      { title: 'Deterministic Facility Lookup', desc: 'Python calls find_nearest_facilities() against the in-process cache — no LLM involved.', icon: 'ti ti-git-fork' },
      { title: 'Pass 2: Grounded Response', desc: 'Real facility name injected into a system message; LLM writes the patient-facing reply.', icon: 'ti ti-brain' },
    ],
    diagramImage: {
      src: twoPassTriageDiagram,
      alt: 'Diagram of the two-pass triage flow: a forced tool call classifies severity, Python looks up the nearest facility deterministically, then a grounded second pass writes the patient-facing response',
      caption: 'FIG 1.1: TWO-PASS TRIAGE PIPELINE',
    },
    lessonsLearned: [
      {
        title: "finish_reason isn't the signal to trust",
        body: 'The Groq/Llama models we use will sometimes return both a text completion and a tool_calls array in the same response. Early logic branched on finish_reason and occasionally dropped a valid tool call. The fix was to treat a non-empty tool_calls list as authoritative regardless of finish_reason.',
      },
      {
        title: 'Emergency cases need their own bypass',
        body: "The minimum-turns gate was originally unconditional. That meant a first message like 'chest pain, can't breathe' would get a clarifying question instead of an immediate route. We added an explicit bypass: an emergent classification skips the gate no matter how early in the conversation it fires.",
      },
    ],
    tradeoff:
      "Two passes mean two LLM round trips instead of one, adding latency to every triage decision — acceptable for a chat interface, less so if this were a high-throughput batch job. The min-turns gate is also a blunt instrument: it counts user turns, not information content, so a chatty user who says a lot in one message still waits, and a terse user who needs more prompting can still get force-classified at the turn ceiling with information_sufficient: false. What's next: a knowledge-graph grounding step sourced from Canadian diagnostic data is in active development this week, aimed at the classification step itself — today's two-pass design is the orchestration layer that step will plug into, not a replacement for it.",
    result:
      'METRIC PENDING — hallucinated-facility rate and premature-classification rate, before vs. after the two-pass split, once we have logged triage sessions to measure against',
  },
  {
    slug: 'haversine-proximity-severity-gated-eligibility',
    navSection: 'architecture',
    category: 'Proximity Search',
    accent: 'blue',
    icon: Compass,
    tags: ['#Geospatial', '#Routing', '#Python'],
    title: 'Haversine Proximity + Severity-Gated Eligibility',
    readTimeMinutes: 7,
    publishedDate: '2026-05-17',
    author: 'MediCoord Core Platform Team',
    summary:
      'Filtering facilities by severity eligibility before ranking by distance, using a plain Haversine calculation over an in-process cache — fast enough for the inline triage path, with the ranked candidate list already shaped for a future travel-time upgrade.',
    background:
      "Every triage decision needs to answer one question fast: which facilities, out of MediCoord's full facility directory, can actually take this patient right now? This filter runs on every request, so it needs to be correct and cheap before it needs to be clever.",
    problem:
      "A naive 'closest facility' query just sorts by distance. But distance alone can send a patient to a facility that's wrong for their condition — a routine-only clinic showing up ahead of a hospital that can actually treat an emergent case, or the reverse. Ranking has to happen after eligibility is decided, not before, and it has to run inside the latency budget of a chat response — no room for a slow query across the full facility table on every message.",
    problemHighlights: [
      {
        heading: 'Eligibility Before Ranking',
        body: "A facility 500m away that doesn't accept the patient's severity level isn't 'close' — it's not a candidate. Filtering has to run before distance sorting, not after.",
        accent: 'danger',
      },
      {
        heading: 'Latency Budget',
        body: 'Proximity search runs inline in the triage response path — it has to return in milliseconds, not seconds, or it becomes the slowest part of every chat turn.',
        accent: 'info',
      },
    ],
    alternativesConsidered: [
      {
        title: 'PostGIS spatial index (ST_DWithin / ST_Distance)',
        body: "This is the more scalable answer, and it's already scoped as a follow-up: the function returns its full ranked candidate list specifically so a future re-rank by real travel time can happen without any backend change. We didn't reach for PostGIS first because the facility count in a single-city directory is small enough that an in-memory linear scan is faster to ship and easier to reason about than standing up a spatial index, tuning it, and keeping it in sync with a Supabase table that already changes on its own schedule.",
      },
      {
        title: 'Precomputed distance matrix',
        body: "Precomputing distances from every facility to a grid of coordinates would make lookups near-instant, but the input isn't a grid point — it's wherever the patient happens to be standing, at whatever precision their device reports. Precomputing against irregular real-world GPS input means either snapping to a grid, which adds error exactly where distance accuracy matters most, or recomputing anyway, which defeats the purpose.",
      },
    ],
    approach:
      "find_nearest_facilities() does two things in a fixed order: filter, then sort. It reads the full facility list from an in-process cache — populated ahead of time from Supabase, not queried per-request — keeps only facilities where the requested severity appears in that facility's accepted_severity array, then ranks the survivors by Haversine great-circle distance, the standard spherical-law-of-cosines formula, with no external geo library. The top N (defaulting to 3, tunable by environment variable) go back to the caller, with the nearest becoming the recommended facility and the rest returned as alternatives. Distance is computed at request time, not pre-materialized, because the input point — the patient's current GPS coordinates — is different on every call; there's nothing to precompute.",
    approachEmphasis: ['filter, then sort', 'nothing to precompute'],
    codeSamples: [
      {
        filename: 'proximity.py',
        language: 'python',
        content: `def haversine_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lng2 - lng1)
    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def find_nearest_facilities(lat, lng, severity, top_n=None) -> list[dict] | None:
    facilities, _ = get_cached_facilities()
    if facilities is None:
        return None

    eligible = [f for f in facilities if severity in f.get("accepted_severity", [])]
    if not eligible:
        return []

    ranked = sorted(
        [{**f, "distanceKm": round(haversine_km(lat, lng, f["lat"], f["lng"]), 2)} for f in eligible],
        key=lambda x: x["distanceKm"],
    )
    return ranked[:top_n or TOP_N_DEFAULT]`,
      },
    ],
    diagramSteps: [
      { title: 'Location + Severity In', desc: 'Patient GPS coordinates and classified severity from Pass 1 of triage.', icon: 'ti ti-map-pin' },
      { title: 'In-Process Cache Read', desc: 'Full facility list read from the app-layer cache — no per-request database query.', icon: 'ti ti-database' },
      { title: 'Severity Eligibility Filter', desc: 'Keep only facilities where accepted_severity includes the requested level.', icon: 'ti ti-filter' },
      { title: 'Haversine Ranking', desc: 'Sort eligible facilities by great-circle distance; return top N with distanceKm attached.', icon: 'ti ti-calculator' },
    ],
    diagramImage: {
      src: haversineProximityDiagram,
      alt: 'Diagram of the proximity pipeline: read the in-process facility cache, filter by severity eligibility, then rank survivors by Haversine distance',
      caption: 'FIG 2.1: PROXIMITY FILTER-THEN-RANK PIPELINE',
    },
    lessonsLearned: [
      {
        title: 'The cache can legitimately be empty',
        body: "find_nearest_facilities() returns None — not an empty list — when the facilities cache itself hasn't been populated yet, a real state during cold start or a Supabase outage. Early logic conflated that with 'zero facilities match this severity', which returns an empty list. Callers need to check for None explicitly: 'we don't have data yet' is not the same message to a patient as 'no facility currently accepts this severity.'",
      },
      {
        title: 'top_n is not the same as eligible count',
        body: "The result cap limits how many results come back, not how many exist. A severity with only one eligible facility in the whole directory correctly returns a list of one — the function doesn't pad or backfill with ineligible facilities to hit the cap.",
      },
    ],
    tradeoff:
      "Haversine gives straight-line distance, and straight-line distance is a known approximation of how long it actually takes to get somewhere — a facility 1.5km away across a highway can be slower to reach than one 4km away with a direct route. That gap is real and we're not hiding it: it's exactly the gap the roadmap item below closes. In the meantime, the eligibility filter — can this facility even take this patient — is correct today; only the ranking within the eligible set is an approximation. What's next: the function already returns its full ranked candidate list to the frontend for this reason — a composite score combining real travel time from a routing API with live queue depth can replace the Haversine sort without changing this function's contract, once that data exists.",
    result:
      'METRIC PENDING — average minutes of routing error (Haversine distance vs. actual travel time) once real trip data is available to compare against',
  },
  {
    slug: 'two-tier-facility-state-cache-redis-wait-times',
    navSection: 'infrastructure',
    category: 'Realtime Load Tracker',
    accent: 'mint',
    icon: ChartLineUp,
    tags: ['#Caching', '#Redis', '#Resilience'],
    title: 'Two-Tier Facility State: In-Process Cache + Redis Wait Times',
    readTimeMinutes: 8,
    publishedDate: '2026-05-24',
    author: 'MediCoord Core Platform Team',
    summary:
      'Splitting facility state into two tiers that match their actual freshness and failure requirements: an in-process ETag cache for the rarely-changing facility directory, and a Redis cache-aside chain with a Supabase fallback for wait times that change every scrape cycle.',
    background:
      'Two very different pieces of facility data feed every triage decision: the facility directory itself (name, address, accepted severities — changes rarely) and current ER wait times (changes every scrape cycle). They have different freshness requirements, different failure tolerances, and — in the current implementation — genuinely different storage.',
    problem:
      "Wait-time data goes stale fast and comes from unreliable external sources — a scheduled worker scrapes multiple public ER-wait sites every ~15 minutes, and any one of those sources, or Redis itself, can be down at read time. A routing decision can't just fail because a third-party wait-time site timed out; it has to degrade to something reasonable. Meanwhile the facility directory needs to survive being read on every single triage request without a database round trip each time — but a plain in-process cache doesn't survive a redeploy or a second server instance, which is a real limitation, not a hypothetical one.",
    problemHighlights: [
      {
        heading: 'External Sources Fail Silently',
        body: 'Wait-time scrapers hit third-party sites that can go down, change their markup, or return stale numbers with no warning — the read path has to assume any single source can fail on any given request.',
        accent: 'danger',
      },
      {
        heading: "In-Process Cache Doesn't Scale Out",
        body: "The facility directory cache lives in a single Python process's memory. It's fast, but it's also gone on restart and invisible to a second server instance — there's no cross-process consistency today.",
        accent: 'info',
      },
    ],
    alternativesConsidered: [
      {
        title: 'One cache for everything, in Redis',
        body: "Putting the facility directory in Redis too, alongside wait times, would remove the single-process limitation immediately. We didn't do that yet because the facility directory changes at a completely different rate than wait times — it's edited by hand or by an admin process, not scraped every 15 minutes — and adding a network hop to read data on every single triage request for something that rarely changes is the wrong trade when a single-process deployment is what's actually running today.",
      },
      {
        title: 'Fail closed on scraper/Redis errors',
        body: 'The tempting alternative to degrading to an empty wait-time map is to raise and block the routing decision until wait data is available. We rejected that because a routing decision without wait-time data is still strictly better than no routing decision at all — the same reasoning already applied to the facility hours filters, extended here for consistency rather than inventing a new failure convention for this one data source.',
      },
    ],
    approach:
      "We split facility state into two tiers that match their actual freshness and failure requirements. The facility directory lives as a module-level dict, populated from a Supabase query and stamped with a SHA-256 ETag over its sorted-key JSON serialization — cheap to read on every request, and the ETag lets callers detect 'nothing changed' without re-fetching. Wait times go through a proper cache-aside chain: read the Redis hash first, since that's what the scraper writes every ~15 minutes; on a Redis error or an empty hash — cold start, before the first scrape has ever run — fall back to a Supabase RPC and best-effort repopulate Redis from that result via a pipeline write, so the next read doesn't have to hit Supabase again. If both Redis and the Supabase fallback fail, the function returns an empty map rather than raising — missing wait data is treated the same way missing hours data is treated elsewhere in the codebase: it always passes filters rather than blocking a routing decision.",
    approachEmphasis: ['cache-aside chain', 'always passes filters rather than blocking a routing decision'],
    codeSamples: [
      {
        filename: 'cache.py',
        language: 'python',
        content: `_cache: dict[str, Any] = {"facilities": None, "etag": None}

def get_cached_facilities() -> tuple[list[dict] | None, str | None]:
    return _cache["facilities"], _cache["etag"]

def set_cached_facilities(data: list[dict]) -> str:
    serialized = json.dumps(data, sort_keys=True, default=str)
    etag = f'"{hashlib.sha256(serialized.encode()).hexdigest()[:32]}"'
    _cache["facilities"] = data
    _cache["etag"] = etag
    return etag`,
      },
      {
        filename: 'wait_times.py',
        language: 'python',
        content: `def get_wait_minutes_map() -> dict[str, int | None]:
    try:
        raw = redis_client.hgetall(REDIS_HASH_KEY)
        if raw:
            return {fid: json.loads(v).get("wait_minutes") for fid, v in raw.items()}
    except Exception:
        logger.warning("redis_unavailable_falling_back_to_supabase")

    try:
        rows = supabase_rpc("latest_wait_times", {})
    except Exception:
        logger.warning("wait_times_fallback_failed_returning_empty")
        return {}

    wait_map = {r["facility_id"]: r["wait_minutes"] for r in rows}
    try:
        pipe = redis_client.pipeline()
        for r in rows:
            pipe.hset(REDIS_HASH_KEY, r["facility_id"], json.dumps({
                "wait_minutes": r["wait_minutes"], "raw_wait": r.get("raw_wait"),
            }))
        pipe.execute()
    except Exception:
        logger.warning("redis_populate_failed")

    return wait_map`,
      },
    ],
    diagramSteps: [
      { title: 'Facility Directory Read', desc: 'In-process dict, ETag over sorted-key JSON — no per-request Supabase query.', icon: 'ti ti-database' },
      { title: 'Wait-Time Cache-Aside Read', desc: 'Redis hash wait_times:current checked first, written by the scraper every ~15 min.', icon: 'ti ti-refresh' },
      { title: 'Supabase Fallback', desc: 'On Redis miss or error, latest_wait_times RPC runs and best-effort repopulates Redis.', icon: 'ti ti-arrow-back-up' },
      { title: 'Graceful Degradation', desc: 'If both fail, return an empty map — missing wait data always passes filters.', icon: 'ti ti-shield-check' },
    ],
    diagramImage: {
      src: twoTierCacheDiagram,
      alt: 'Diagram of the two-tier state read path: in-process facility cache, Redis wait-time cache-aside read, Supabase fallback, and graceful degradation to an empty map',
      caption: 'FIG 3.1: TWO-TIER STATE READ PATH',
    },
    lessonsLearned: [
      {
        title: 'The Redis repopulate-on-fallback step needs its own try/except',
        body: 'The first version of the Supabase fallback path let a Redis write failure during the best-effort repopulate step propagate up and mask a successful Supabase read — the caller would see an error even though it actually had good wait-time data in hand. Wrapping just that pipeline write in its own try/except, separate from the read path exception handling, fixed it.',
      },
      {
        title: 'ETag comparison beats re-diffing the facility list',
        body: 'Early versions of the facility cache had no ETag and downstream consumers re-serialized the full list on every poll to check whether anything had changed. Hashing the sorted-key JSON once at write time and comparing that string is far cheaper than re-diffing a list of facility dicts.',
      },
    ],
    tradeoff:
      "The facility-directory cache is explicitly a Phase 1 shortcut: it works for single-node deployment but doesn't survive horizontal scaling or process restarts. Every server instance would build its own independent view of the facility directory, with no invalidation signal between them. Wait times don't have that problem since Redis is already the shared store, but the two-tier split means the two data types have genuinely different consistency guarantees today, which is worth knowing if you're debugging why one field updated instantly and another didn't. What's next: moving the facility directory into the same shared store as wait times — Redis Cluster with AOF persistence — is the change that would let this run on more than one process. Priority-queue gating (routing emergent cases first, letting moderate/routine absorb remaining capacity) is also not backend logic yet; today that coordination is what Sandbox Mode visualizes on the frontend, not something this cache enforces server-side.",
    result:
      "METRIC PENDING — cache hit rate and Redis-fallback frequency, once there's production traffic to measure instead of local/sandbox runs",
  },
]
