import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, TreeStructure, Compass, ChartLineUp } from '@phosphor-icons/react'

interface BlogSection {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  iconBorder: string
  label: string
  labelColor: string
  title: string
  problem: string
  approach: string
  approachCode?: string
  tradeoff: string
  result: string
}

const SECTIONS: BlogSection[] = [
  {
    icon: TreeStructure,
    iconColor: 'text-[#48F6C1]',
    iconBg: 'bg-[#48F6C1]/10',
    iconBorder: 'border-[#48F6C1]/20',
    label: 'LLM Symptom Understanding',
    labelColor: 'text-[#48F6C1]',
    title: 'Graph RAG with Canadian Medical KG',
    problem:
      "LLMs produce confident but wrong clinical relationships from lay language. 'My child won't eat and keeps shaking' maps to over a dozen conditions — with radically different severity and facility requirements. Prompt-only LLMs have no mechanism to prefer the clinically correct interpretation.",
    approach:
      "We built a medical knowledge graph sourced from Canadian diagnostic datasets (ICD-10-CA). A preprocessing step extracts clinical entities from user input and injects them as structured context before the LLM prompt: [Symptom: Tachypnea] + [Patient: Pediatric] + [Risk: Dehydration]. The LLM reasons over a structured representation of the complaint, not raw text. This constrains the output space to grounded clinical relationships and eliminates the most common hallucination failure modes.",
    tradeoff:
      "The KG is a knowledge snapshot with a maintenance cost. Rare conditions and unusual symptom presentations still fall through to LLM base priors. The extraction step adds ~80–120ms latency per query. Grounding reduces misclassification frequency — it doesn't reduce it to zero.",
    result:
      "METRIC PENDING — % reduction in routing misclassification vs. baseline LLM without KG grounding, measured against Canadian ED triage benchmark dataset",
  },
  {
    icon: Compass,
    iconColor: 'text-[#00D2FF]',
    iconBg: 'bg-[#00D2FF]/10',
    iconBorder: 'border-[#00D2FF]/20',
    label: 'Proximity Search',
    labelColor: 'text-[#00D2FF]',
    title: 'PostGIS Spatial Index + Composite ETA Scoring',
    problem:
      "Straight-line distance is the wrong metric for patient routing. A clinic 1.5 km away with a 60-minute queue means 65 minutes to care. A hospital 4 km away with an 8-minute drive and a 15-minute wait means 23 minutes. Nearest-neighbor routing loses to composite ETA routing by 42 minutes on this example — and the gap widens under load.",
    approach:
      "Facility coordinates are indexed with a PostGIS spatial index on the PostgreSQL facilities table. For each routing request, a spatial query returns candidate facilities within radius, pre-filtered by severity-gated capability tier (emergent cases never enter the candidate set of urgent care clinics). Each candidate is scored: ETA = road_travel_time (OSRM API) + queue_depth (Redis load tracker). The facility with the lowest composite ETA wins. The GIS index makes the spatial filter sub-millisecond even across thousands of facilities.",
    approachCode: `-- PostGIS candidate query (simplified)
SELECT id, name, capability_tier,
  ST_Distance(geog, ST_MakePoint($lon, $lat)::geography) AS dist_m
FROM facilities
WHERE ST_DWithin(geog, ST_MakePoint($lon, $lat)::geography, $radius_m)
  AND capability_tier >= $min_tier
ORDER BY dist_m
LIMIT 10;

-- Composite score in application layer
score = osrm_travel_minutes + redis_queue_depth_minutes`,
    tradeoff:
      "PostGIS adds infrastructure complexity over a pure in-memory geo index. More critically: in Phase 1, queue depth is modeled from facility type and time-of-day heuristics — not live facility data feeds. The routing math is correct; the queue input is an approximation. Live feed integration is the next defensibility moat.",
    result:
      "METRIC PENDING — average minutes saved per routing decision vs. straight-line nearest-neighbor, across sandbox simulation runs",
  },
  {
    icon: ChartLineUp,
    iconColor: 'text-[#48F6C1]',
    iconBg: 'bg-[#48F6C1]/10',
    iconBorder: 'border-[#48F6C1]/20',
    label: 'Realtime Load Tracker',
    labelColor: 'text-[#48F6C1]',
    title: 'Distributed Redis Cache for City-Wide Facility State',
    problem:
      "Optimal single-patient routing is self-defeating at scale. Route 80 patients to the same best-scoring hospital and you've recreated the bottleneck. The system needs shared load state that captures not just current queue depth but routing decisions already in flight.",
    approach:
      "A Redis cache stores per-facility state: current queue depth, inbound routing decisions in flight (not yet reflected in the measured queue), and capability tier. Each routing decision reads projected state atomically (GET + pipeline write) and increments the in-flight count for the winning facility. The priority queue gates resolution order: emergent cases route first; urgent routes to the lowest composite ETA with matching capability; moderate and routine absorb remaining capacity across the full network — including clinics that emergent cases would never target. This is what Sandbox Mode visualizes in real time.",
    tradeoff:
      "Phase 1 runs the cache in-process at the app layer — no external Redis instance. This works for single-node sandbox simulation but doesn't survive horizontal scaling or process restarts. Production city-scale deployment requires Redis Cluster with AOF persistence and a durable event bus for decision replay. The sandbox models the coordination logic faithfully; it doesn't model distributed failure modes.",
    result:
      "METRIC PENDING — % improvement in facility utilization balance (std dev of queue depth across facilities) under simulated peak load, vs. non-load-aware routing baseline",
  },
]

export default function ForEngineersPage() {
  return (
    <div className="bg-[#061219] min-h-screen flex flex-col font-sans text-[#E2F1F5] overflow-x-hidden">

      {/* Header */}
      <header className="w-full border-b border-[#132A37]/80 bg-[#061219]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#1C4659]/50 flex-none shadow-sm">
              <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
            </div>
            <span className="text-xs font-bold tracking-wide text-white uppercase">MediCoord AI</span>
          </div>
          <Link to="/" className="flex items-center gap-1.5 text-xs text-[#7AA0B0] hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to overview
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-16 lg:py-24 w-full flex flex-col gap-24">

        {/* Hero */}
        <div className="flex flex-col gap-5">
          <div className="inline-flex items-center self-start gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/20 tracking-wider uppercase">
            Engineering
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
            How it works under the hood
          </h1>
          <p className="text-[#85A4B1] text-base leading-relaxed max-w-2xl">
            Three system deep-dives. Each one follows the same structure: what broke, how we approached it, what we traded away, and what we'll measure.
          </p>
        </div>

        {/* Blog sections */}
        {SECTIONS.map((section, i) => {
          const Icon = section.icon
          return (
            <article key={i} className="flex flex-col gap-8 border-t border-[#132A37]/80 pt-12">

              {/* Section header */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${section.iconBg} ${section.iconBorder} border ${section.iconColor} flex items-center justify-center flex-none`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-mono font-bold ${section.labelColor} uppercase tracking-widest`}>
                    {section.label}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-white">{section.title}</h2>
              </div>

              {/* Problem */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono font-bold text-[#FF7B93] uppercase tracking-widest">Problem</span>
                <div className="border-l-2 border-[#FF7B93]/60 pl-4">
                  <p className="text-sm text-[#85A4B1] leading-relaxed">{section.problem}</p>
                </div>
              </div>

              {/* Approach */}
              <div className="flex flex-col gap-3">
                <span className={`text-[10px] font-mono font-bold ${section.labelColor} uppercase tracking-widest`}>Approach</span>
                <div className={`border ${section.iconBorder} ${section.iconBg} rounded-xl p-5 flex flex-col gap-3`}>
                  <p className="text-sm text-[#E2F1F5] leading-relaxed">{section.approach}</p>
                  {section.approachCode && (
                    <pre className="bg-[#061219]/80 border border-[#1C4659]/60 rounded-lg p-4 text-xs font-mono text-[#48F6C1] overflow-x-auto leading-relaxed mt-1">
                      <code>{section.approachCode}</code>
                    </pre>
                  )}
                </div>
              </div>

              {/* Tradeoff */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono font-bold text-[#7AA0B0] uppercase tracking-widest">Tradeoff</span>
                <div className="border border-[#1C4659]/50 bg-[#0A1D27]/60 rounded-xl p-4">
                  <p className="text-sm text-[#85A4B1] leading-relaxed">{section.tradeoff}</p>
                </div>
              </div>

              {/* Result */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono font-bold text-[#00D2FF] uppercase tracking-widest">Result</span>
                <div className="border border-dashed border-[#00D2FF]/30 bg-[#00D2FF]/5 rounded-xl p-4 flex items-start gap-3">
                  <span className="flex-none mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/20 uppercase tracking-wider whitespace-nowrap">
                    Pending
                  </span>
                  <p className="text-xs text-[#7AA0B0] leading-relaxed italic">{section.result}</p>
                </div>
              </div>

            </article>
          )
        })}

        {/* Footer CTA */}
        <div className="border-t border-[#132A37]/80 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-sm text-[#7AA0B0]">See the load balancer and routing in action</p>
          <Link
            to="/sandbox"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-[#061219] bg-[#48F6C1] hover:bg-[#3ce0ad] rounded-xl shadow-sm transition-all duration-200 active:scale-95"
          >
            Explore the Sandbox
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#132A37]/80 bg-[#061219]/50 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#7AA0B0]">
          <span>© 2026 MediCoord AI · Patient Routing Platform. All rights reserved.</span>
          <Link to="/" className="hover:text-white transition-colors">← Back to overview</Link>
        </div>
      </footer>

    </div>
  )
}
