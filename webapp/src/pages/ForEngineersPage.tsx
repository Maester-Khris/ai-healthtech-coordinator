import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CaretRight, MagnifyingGlass } from '@phosphor-icons/react'
import { CASE_STUDIES } from '../data/caseStudies'
import { filterCaseStudies } from '../utils/caseStudyContent'
import { useDocumentHead } from '../hooks/useDocumentHead'

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
  useDocumentHead(
    'Engineering Blog',
    'System deep-dives from the MediCoord AI engineering team: architecture, infrastructure, AI models, security, and what we learned building each.'
  )

  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const visibleCaseStudies = useMemo(
    () => filterCaseStudies(CASE_STUDIES, query, activeTag),
    [query, activeTag]
  )

  return (
    <div className="bg-[#061219] min-h-screen flex flex-col font-static text-[#E2F1F5] overflow-x-hidden">

      {/* Header */}
      <header className="w-full border-b border-[#132A37]/80 bg-[#061219]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#1C4659]/50 flex-none shadow-sm">
              <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
            </div>
            <span className="text-xs font-bold tracking-wide text-white uppercase">MediCoord AI Engineering</span>
          </div>
          <Link to="/" className="flex items-center gap-1.5 text-xs text-[#7AA0B0] hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to overview
          </Link>
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
