import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShieldCheck, ChartBar, Globe, Flask } from '@phosphor-icons/react'

export default function ForInvestorsPage() {
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

      <main className="flex-1 max-w-7xl mx-auto px-6 py-16 lg:py-24 w-full flex flex-col gap-16">

        {/* Hero */}
        <div className="flex flex-col gap-5 max-w-3xl">
          <div className="inline-flex items-center self-start gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#48F6C1]/10 text-[#48F6C1] border border-[#48F6C1]/20 tracking-wider uppercase">
            For Health System Operators & Investors
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
            City-wide patient coordination.<br />Real-time. At scale.
          </h1>
          <p className="text-[#85A4B1] text-base leading-relaxed max-w-2xl">
            MediCoord AI routes hundreds of patients simultaneously across Toronto's health network — prioritized by severity, balanced by load, in real time.
          </p>
        </div>

        {/* Three callout cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-[#1C4659]/50 bg-[#0A1D27]/80 rounded-2xl p-7 flex flex-col gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#48F6C1]/10 border border-[#48F6C1]/20 text-[#48F6C1] flex items-center justify-center">
              <ChartBar className="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-bold text-white">Priority Queue</h3>
              <p className="text-sm text-[#85A4B1] leading-relaxed">
                Severity-weighted dispatch. Emergent cases route first. Moderate and routine cases absorb available city-wide capacity without crowding critical pathways.
              </p>
            </div>
          </div>

          <div className="border border-[#1C4659]/50 bg-[#0A1D27]/80 rounded-2xl p-7 flex flex-col gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#00D2FF]/10 border border-[#00D2FF]/20 text-[#00D2FF] flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-bold text-white">City-Wide Coordination</h3>
              <p className="text-sm text-[#85A4B1] leading-relaxed">
                All facilities tracked simultaneously. Load redistributes as patient volume shifts across the network. No single facility becomes a new bottleneck.
              </p>
            </div>
          </div>

          <div className="border border-[#1C4659]/50 bg-[#0A1D27]/80 rounded-2xl p-7 flex flex-col gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#48F6C1]/10 border border-[#48F6C1]/20 text-[#48F6C1] flex items-center justify-center">
              <Flask className="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-bold text-white">Org Sandbox</h3>
              <p className="text-sm text-[#85A4B1] leading-relaxed">
                Evaluate with simulated patient load. No PHI, no live infrastructure, full coordination fidelity. Watch routing and rebalancing before any commitment.
              </p>
            </div>
          </div>
        </div>

        {/* Main pitch */}
        <section className="border-t border-[#132A37]/80 pt-16 flex flex-col gap-8 max-w-3xl">
          <h2 className="text-2xl lg:text-3xl font-extrabold text-white leading-snug">
            Most routing systems find the nearest facility.{' '}
            <span className="text-[#48F6C1]">MediCoord AI coordinates across all of them.</span>
          </h2>
          <div className="flex flex-col gap-5 text-[#85A4B1] text-sm leading-relaxed">
            <p>
              The system scores every candidate facility by composite ETA: road travel time plus active wait queue — not proximity. A clinic 1.5 km away with a 60-minute queue loses to a hospital 4 km away with a 23-minute total ETA. Severity gates minimum facility capability: emergent cases never route to urgent care regardless of ETA advantage.
            </p>
            <p>
              As facilities fill, routing decisions shift to preserve system-wide throughput. Inbound routing decisions in flight are factored into each new score — preventing the coordination trap of sending every patient to the same "best" option and recreating the bottleneck you set out to solve.
            </p>
          </div>
        </section>

        {/* Sandbox CTA */}
        <div className="border border-[#00D2FF]/30 bg-[#0A1D27]/80 rounded-2xl p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono font-bold text-[#00D2FF] uppercase tracking-wider">
              Available for Organizations — Sandbox Mode
            </span>
            <h3 className="text-xl font-bold text-white">See the coordination in action</h3>
            <p className="text-sm text-[#85A4B1] max-w-xl leading-relaxed">
              Run a simulated patient load across the city network. Watch priority queue dispatch and load rebalancing in real time. No PHI, no live infrastructure required.
            </p>
          </div>
          <Link
            to="/sandbox"
            className="flex-none inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-[#061219] bg-[#00D2FF] hover:bg-[#00b4db] rounded-xl shadow-sm transition-all duration-200 active:scale-95 whitespace-nowrap"
          >
            Launch Sandbox Mode
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Trust row */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[#132A37]/80 pt-8 text-xs font-mono text-[#7AA0B0]">
          {[
            'Built on real Canadian public health data',
            'Toronto facility network',
            'Session-only, zero PHI storage',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#48F6C1] flex-none" />
              <span>{item}</span>
            </div>
          ))}
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
