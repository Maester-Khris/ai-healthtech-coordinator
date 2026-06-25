import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, TreeStructure, Compass, ChartLineUp } from '@phosphor-icons/react'

const PROXIMITY_SNIPPET = `# ponytail: phase-1 composite score — ML-weighted version when we have outcome data
score = travel_minutes + queue_minutes
# severity gates min_capability before scoring, not via score inflation`

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

      <main className="flex-1 max-w-4xl mx-auto px-6 py-16 lg:py-24 w-full flex flex-col gap-20">

        {/* Hero */}
        <div className="flex flex-col gap-5">
          <div className="inline-flex items-center self-start gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/20 tracking-wider uppercase">
            Engineering
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
            How it works under the hood
          </h1>
          <p className="text-[#85A4B1] text-base leading-relaxed max-w-2xl">
            Three deep-dives into the systems that make MediCoord AI accurate, fast, and defensible at city scale.
          </p>
        </div>

        {/* Section 1: Graph RAG */}
        <article className="flex flex-col gap-6 border-t border-[#132A37]/80 pt-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#48F6C1]/10 border border-[#48F6C1]/20 text-[#48F6C1] flex items-center justify-center flex-none">
              <TreeStructure className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono font-bold text-[#48F6C1] uppercase tracking-widest">Graph RAG</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">Why we don't trust the LLM alone</h2>
          <div className="flex flex-col gap-4 text-[#85A4B1] text-sm leading-relaxed">
            <p>
              Lay descriptions of symptoms don't map cleanly to clinical urgency. "My kid won't stop shaking and won't eat" could be a dozen conditions with wildly different severities. We ground the model with a medical knowledge graph that maps symptom clusters to clinical entities before the LLM reasons about them.
            </p>
            <p>
              The extraction step injects structured context —{' '}
              <code className="text-[#48F6C1] bg-[#132E3C]/60 px-1.5 py-0.5 rounded text-xs font-mono">
                [Symptom: Tachypnea] + [Patient: Pediatric] + [Risk: Dehydration]
              </code>{' '}
              — constraining the output space. The LLM reasons about a structured representation of the complaint, not raw text. This prevents the common failure mode where a confident LLM response maps benign symptoms to a critical routing decision.
            </p>
            <div className="border border-[#FF7B93]/20 bg-[#FF7B93]/5 rounded-xl p-4 text-[#FF7B93] text-xs font-mono">
              <span className="font-bold uppercase tracking-wider block mb-1">Honest tradeoff</span>
              The graph is a maintenance burden and a knowledge snapshot. Edge cases still fall through to base LLM priors. Graph RAG reduces hallucination frequency — not to zero.
            </div>
          </div>
        </article>

        {/* Section 2: Proximity Search */}
        <article className="flex flex-col gap-6 border-t border-[#132A37]/80 pt-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#00D2FF]/10 border border-[#00D2FF]/20 text-[#00D2FF] flex items-center justify-center flex-none">
              <Compass className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono font-bold text-[#00D2FF] uppercase tracking-widest">Proximity Search</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">The problem with "nearest"</h2>
          <div className="flex flex-col gap-4 text-[#85A4B1] text-sm leading-relaxed">
            <p>
              Straight-line distance is wrong for patient routing. A clinic 1.5 km away with a 60-minute queue means 65 minutes to care. A hospital 4 km away with an 8-minute drive and a 15-minute wait means 23 minutes to care. The "nearest" option loses by 42 minutes.
            </p>
            <p>
              We score every candidate facility with a composite ETA: road travel time via OSRM plus active wait time. Geoapify's Route Matrix API returns road-accurate travel times to N facilities in a single request. Severity gates minimum facility capability independently of the score — an emergent case never routes to urgent care even if it wins on ETA.
            </p>
            <pre className="bg-[#0A1D27] border border-[#1C4659]/60 rounded-xl p-4 text-xs font-mono text-[#48F6C1] overflow-x-auto leading-relaxed">
              <code>{PROXIMITY_SNIPPET}</code>
            </pre>
            <div className="border border-[#FF7B93]/20 bg-[#FF7B93]/5 rounded-xl p-4 text-[#FF7B93] text-xs font-mono">
              <span className="font-bold uppercase tracking-wider block mb-1">Honest tradeoff</span>
              Live queue data is the hardest piece. Phase 1 models queue depth from facility type + time-of-day patterns. Real-time facility feed integration is the next defensibility moat.
            </div>
          </div>
        </article>

        {/* Section 3: Realtime Load Tracker */}
        <article className="flex flex-col gap-6 border-t border-[#132A37]/80 pt-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#48F6C1]/10 border border-[#48F6C1]/20 text-[#48F6C1] flex items-center justify-center flex-none">
              <ChartLineUp className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono font-bold text-[#48F6C1] uppercase tracking-widest">Realtime Load Tracker</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">Don't create a new bottleneck</h2>
          <div className="flex flex-col gap-4 text-[#85A4B1] text-sm leading-relaxed">
            <p>
              Routing everyone to the "best" facility is a self-defeating optimization. If 80 patients all score the same hospital, you've moved the bottleneck, not eliminated it. The load tracker maintains city-wide facility state: current queue depth, inbound routing decisions in flight, and capability by facility type.
            </p>
            <p>
              New routing decisions factor in both current load and projected load from pending decisions. The priority queue controls resolution order: emergent always routes first; urgent goes to the lowest-composite-ETA facility with sufficient capability; moderate and routine absorb load across the wider network — including clinics emergent cases would never target. This is what Sandbox Mode visualizes: watch routing decisions redistribute as simulated patient volume fills individual facilities.
            </p>
            <div className="border border-[#FF7B93]/20 bg-[#FF7B93]/5 rounded-xl p-4 text-[#FF7B93] text-xs font-mono">
              <span className="font-bold uppercase tracking-wider block mb-1">Honest tradeoff</span>
              Currently modeled at the application layer. Production at city scale needs a durable event bus with facility state as a shared service. The sandbox shows the coordination behavior faithfully — the production architecture would differ.
            </div>
          </div>
        </article>

        {/* Footer CTA */}
        <div className="border-t border-[#132A37]/80 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-sm text-[#7AA0B0]">See the load balancer in action</p>
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
