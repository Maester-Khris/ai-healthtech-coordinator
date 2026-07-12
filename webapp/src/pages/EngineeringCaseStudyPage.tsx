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
import { formatPublishedDate, splitWithEmphasis, splitWithBoldPhrases, type MetricBullet } from '../utils/caseStudyContent'

function MetricBulletList({ items, ordered }: { items: MetricBullet[]; ordered?: boolean }) {
  const ListTag = ordered ? 'ol' : 'ul'
  return (
    <ListTag className={`flex flex-col gap-2 text-xs text-[#85A4B1] leading-relaxed ${ordered ? 'list-decimal' : 'list-disc'} pl-4 marker:text-[#7AA0B0]`}>
      {items.map((bullet, i) => (
        <li key={i}>
          {splitWithBoldPhrases(bullet).map((seg, j) =>
            seg.weight === 'bold' ? (
              <strong key={j} className="text-white font-bold">
                {seg.text}
              </strong>
            ) : (
              <span key={j}>{seg.text}</span>
            ),
          )}
        </li>
      ))}
    </ListTag>
  )
}

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
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
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
              {caseStudy.updatedDate && (
                <>
                  <span aria-hidden>·</span>
                  <span className="flex items-center gap-1.5">
                    <ClockCounterClockwise className="w-3.5 h-3.5" />
                    Updated: {formatPublishedDate(caseStudy.updatedDate)}
                  </span>
                </>
              )}
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

          {caseStudy.background && (
            <p className="text-sm text-[#85A4B1] leading-relaxed border-t border-[#132A37]/80 pt-10">
              {caseStudy.background}
            </p>
          )}

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

            {(caseStudy.codeSamples ?? (caseStudy.code ? [caseStudy.code] : [])).map((sample) => (
              <div key={sample.filename} className="flex flex-col gap-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#7AA0B0]">
                  {sample.language.toUpperCase()} Sample
                </span>
                <div className="border border-[#1C4659]/60 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#0D1B23] border-b border-[#1C4659]/60">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF7B93]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#48F6C1]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#00D2FF]" />
                    </div>
                    <span className="text-[11px] font-mono text-[#7AA0B0]">{sample.filename}</span>
                  </div>
                  <pre className="bg-[#061219]/80 p-4 text-xs font-mono text-[#48F6C1] overflow-x-auto leading-relaxed">
                    <code>{sample.content}</code>
                  </pre>
                </div>
              </div>
            ))}
          </section>

          {caseStudy.alternativesConsidered && caseStudy.alternativesConsidered.length > 0 && (
            <section className="flex flex-col gap-4 border-t border-[#132A37]/80 pt-10">
              <SectionHeading color="#00D2FF">Alternatives Considered</SectionHeading>
              <div className="flex flex-col gap-4">
                {caseStudy.alternativesConsidered.map((alt) => (
                  <div key={alt.title} className="border border-[#1C4659]/50 bg-[#0A1D27]/60 rounded-xl p-4 flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-white">{alt.title}</span>
                    <p className="text-xs text-[#85A4B1] leading-relaxed">{alt.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3 border-t border-[#132A37]/80 pt-10">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#7AA0B0]">System Flow</span>
            {caseStudy.diagramImage && (
              <figure className="border border-[#1C4659]/60 rounded-xl overflow-hidden bg-[#0A1D27]/60 flex flex-col items-center">
                <img
                  src={caseStudy.diagramImage.src}
                  alt={caseStudy.diagramImage.alt}
                  className="max-w-2xl w-full h-auto mx-auto"
                />
                <figcaption className="w-full text-center px-4 py-2 text-[10px] font-mono text-[#7AA0B0] border-t border-[#1C4659]/60 uppercase tracking-widest">
                  {caseStudy.diagramImage.caption}
                </figcaption>
              </figure>
            )}
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

          {caseStudy.lessonsLearned && caseStudy.lessonsLearned.length > 0 && (
            <section className="flex flex-col gap-4 border-t border-[#132A37]/80 pt-10">
              <SectionHeading color="#48F6C1">Lessons Learned</SectionHeading>
              <div className="flex flex-col gap-4">
                {caseStudy.lessonsLearned.map((lesson) => (
                  <div key={lesson.title} className="border border-[#1C4659]/50 bg-[#0A1D27]/60 rounded-xl p-4 flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-white">{lesson.title}</span>
                    <p className="text-xs text-[#85A4B1] leading-relaxed">{lesson.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3 border-t border-[#132A37]/80 pt-10">
            <span className="text-[10px] font-mono font-bold text-[#7AA0B0] uppercase tracking-widest">Tradeoff</span>
            <div className="border border-[#1C4659]/50 bg-[#0A1D27]/60 rounded-xl p-4">
              <p className="text-sm text-[#85A4B1] leading-relaxed">{caseStudy.tradeoff}</p>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold text-[#00D2FF] uppercase tracking-widest">Result</span>
            <div className="border border-dashed border-[#00D2FF]/30 bg-[#00D2FF]/5 rounded-xl p-4 flex flex-col gap-3">
              <span className="flex-none self-start px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/20 uppercase tracking-wider whitespace-nowrap">
                {caseStudy.methodology ? 'Measured: Simulated Load' : 'Pending'}
              </span>
              <MetricBulletList items={caseStudy.result} ordered={caseStudy.resultOrdered} />
            </div>
          </section>

          {caseStudy.methodology && (
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-mono font-bold text-[#7AA0B0] uppercase tracking-widest">Methodology</span>
              <div className="border border-[#1C4659]/50 bg-[#0A1D27]/60 rounded-xl p-4">
                <MetricBulletList items={caseStudy.methodology} ordered={caseStudy.methodologyOrdered} />
              </div>
            </section>
          )}

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
