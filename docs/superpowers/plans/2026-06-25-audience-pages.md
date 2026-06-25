# Audience Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/for-investors` and `/for-engineers` pages with footer links from the landing page.

**Architecture:** Two new static page components in `webapp/src/pages/`, two new routes in `App.tsx`, and one footer update in `LandingPage.tsx`. No logic, no state, no new dependencies — pure content and Tailwind styling that inherits the existing dark theme exactly.

**Tech Stack:** React 18, React Router v6, TypeScript (strict), Tailwind CSS, @phosphor-icons/react

## Global Constraints

- No new npm packages
- TypeScript strict mode — no `any`, all props interfaces defined
- Design tokens (copy verbatim): bg `#061219`, accent mint `#48F6C1`, accent blue `#00D2FF`, muted `#85A4B1`, dim `#7AA0B0`, card `border border-[#1C4659]/50 bg-[#0A1D27]/80 rounded-2xl`
- All internal links use `Link` from `react-router-dom`
- Commit style: conventional commits, no co-author, one commit per task
- Type-check: `cd webapp && tsc -b` (not `tsc --noEmit`)
- Dev server: `cd webapp && doppler run -- npm run dev`
- Python venv: `source /home/niki/Documents/workenv/pydev/bin/activate` (not needed here — frontend only)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `webapp/src/pages/ForInvestorsPage.tsx` | Full investor-audience page |
| Create | `webapp/src/pages/ForEngineersPage.tsx` | Full engineers-audience page |
| Modify | `webapp/src/App.tsx` | Add 2 routes |
| Modify | `webapp/src/pages/LandingPage.tsx` | Add 2 footer links |

---

## Task 1: Stubs + Routes + Footer Links

Wire up the routing skeleton end-to-end before filling in page content. This lets us verify navigation works before writing the real copy.

**Files:**
- Create: `webapp/src/pages/ForInvestorsPage.tsx`
- Create: `webapp/src/pages/ForEngineersPage.tsx`
- Modify: `webapp/src/App.tsx` (imports block + routes block)
- Modify: `webapp/src/pages/LandingPage.tsx` (footer `<div>` at line 1217)

**Interfaces:**
- Consumes: `react-router-dom` (`Link`, `Route`) — already installed
- Produces: routes `/for-investors` and `/for-engineers` that render stubs; footer shows two new links

---

- [ ] **Step 1: Create stub ForInvestorsPage**

Create `webapp/src/pages/ForInvestorsPage.tsx`:

```tsx
export default function ForInvestorsPage() {
  return (
    <div className="bg-[#061219] min-h-screen text-[#E2F1F5] p-8">
      For Investors — stub
    </div>
  )
}
```

- [ ] **Step 2: Create stub ForEngineersPage**

Create `webapp/src/pages/ForEngineersPage.tsx`:

```tsx
export default function ForEngineersPage() {
  return (
    <div className="bg-[#061219] min-h-screen text-[#E2F1F5] p-8">
      For Engineers — stub
    </div>
  )
}
```

- [ ] **Step 3: Add imports and routes to App.tsx**

In `webapp/src/App.tsx`, add two imports after the existing page import block (after line 12, `import LandingPage`):

```tsx
import ForInvestorsPage from './pages/ForInvestorsPage'
import ForEngineersPage from './pages/ForEngineersPage'
```

Inside the `<Routes>` block, add after the `/data-disclosure` route (before the catch-all `*` route):

```tsx
<Route path="/for-investors" element={<ForInvestorsPage />} />
<Route path="/for-engineers" element={<ForEngineersPage />} />
```

- [ ] **Step 4: Update footer in LandingPage.tsx**

In `webapp/src/pages/LandingPage.tsx`, replace the inner `<div className="flex items-center gap-6">` block inside the footer (lines 1217–1221) with:

```tsx
<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
  <Link to="/for-investors" className="hover:text-[#48F6C1] transition-colors">For Investors</Link>
  <Link to="/for-engineers" className="hover:text-[#00D2FF] transition-colors">For Engineers</Link>
  <span className="text-[#1C4659] hidden md:inline" aria-hidden>·</span>
  <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
  <Link to="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link>
  <Link to="/data-disclosure" className="hover:text-white transition-colors">Data Disclosure</Link>
</div>
```

- [ ] **Step 5: Type-check**

```bash
cd webapp && tsc -b
```

Expected: exits 0, no errors.

- [ ] **Step 6: Smoke-test in browser**

```bash
cd webapp && doppler run -- npm run dev
```

Navigate to `http://localhost:5173/`:
- Footer shows "For Investors" (hovers mint `#48F6C1`) and "For Engineers" (hovers blue `#00D2FF`) links, separated from legal links by a centered dot on desktop
- `/for-investors` → stub renders on dark background
- `/for-engineers` → stub renders on dark background
- Back-button from stub navigates correctly

- [ ] **Step 7: Commit**

```bash
git add webapp/src/pages/ForInvestorsPage.tsx webapp/src/pages/ForEngineersPage.tsx webapp/src/App.tsx webapp/src/pages/LandingPage.tsx
git commit -m "feat(routing): scaffold /for-investors and /for-engineers with footer links"
```

---

## Task 2: ForInvestorsPage — Full Implementation

Replace the stub with the full investor-facing page. Audience: health system operators, municipal health directors, B2B buyers, investors. Tone: executive-level, outcome-driven, no patient-facing softening.

**Files:**
- Modify: `webapp/src/pages/ForInvestorsPage.tsx` (full replacement)

**Interfaces:**
- Consumes: `Link`, `ArrowLeft`, `ArrowRight`, `ShieldCheck`, `ChartBar`, `Globe`, `Flask` from `@phosphor-icons/react`
- Produces: complete page at `/for-investors` with hero, 3 callout cards, pitch section, sandbox CTA, trust row, footer

---

- [ ] **Step 1: Replace ForInvestorsPage with full implementation**

Replace the entire contents of `webapp/src/pages/ForInvestorsPage.tsx` with:

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
cd webapp && tsc -b
```

Expected: exits 0, no errors.

- [ ] **Step 3: Visual verify in browser**

With dev server still running (`doppler run -- npm run dev`), navigate to `http://localhost:5173/for-investors`.

Verify:
- Dark `#061219` background, sticky header with logo + "Back to overview" link
- Hero: eyebrow tag (mint), H1, grey subtext
- 3 cards in a row on desktop (stacked on mobile): Priority Queue (mint icon), City-Wide (blue icon), Org Sandbox (mint icon)
- Pitch section: two-tone H2 with mint accent on second sentence
- Sandbox CTA card: blue border, "Launch Sandbox Mode" button links to `/sandbox`
- Trust row: 3 shield-check items with mint icons
- Footer: copyright + "← Back to overview"

- [ ] **Step 4: Commit**

```bash
git add webapp/src/pages/ForInvestorsPage.tsx
git commit -m "feat(pages): implement /for-investors investor-facing page"
```

---

## Task 3: ForEngineersPage — Full Implementation

Replace the stub with the full engineer-facing page. Three short technical blog sections: Graph RAG, Proximity Search, Realtime Load Tracker. Each section has a title, body paragraphs, an honest-tradeoff callout, and (for Proximity Search) a Python code snippet.

**Files:**
- Modify: `webapp/src/pages/ForEngineersPage.tsx` (full replacement)

**Interfaces:**
- Consumes: `Link`, `ArrowLeft`, `ArrowRight`, `TreeStructure`, `Compass`, `ChartLineUp` from `@phosphor-icons/react`
- Produces: complete page at `/for-engineers` with hero, 3 blog articles, sandbox CTA footer

---

- [ ] **Step 1: Replace ForEngineersPage with full implementation**

Replace the entire contents of `webapp/src/pages/ForEngineersPage.tsx` with:

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
cd webapp && tsc -b
```

Expected: exits 0, no errors.

- [ ] **Step 3: Visual verify in browser**

Navigate to `http://localhost:5173/for-engineers`.

Verify:
- Blue `#00D2FF` eyebrow tag "Engineering", H1, grey subtext
- Section 1 (Graph RAG): mint icon + label, H2 "Why we don't trust the LLM alone", two body paragraphs with inline `code` styled in mint, red-tinted tradeoff box
- Section 2 (Proximity Search): blue icon + label, H2 "The problem with nearest", dark `<pre>` block with green-on-dark code snippet, red tradeoff box
- Section 3 (Load Tracker): mint icon + label, H2 "Don't create a new bottleneck", two body paragraphs, red tradeoff box
- Bottom CTA: "Explore the Sandbox" mint button links to `/sandbox`
- Footer: copyright + "← Back to overview"
- Mobile: all sections stack cleanly, `<pre>` block scrolls horizontally if needed

- [ ] **Step 4: Commit**

```bash
git add webapp/src/pages/ForEngineersPage.tsx
git commit -m "feat(pages): implement /for-engineers technical blog page"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `/for-investors` route → Task 1 + Task 2
- ✅ `/for-engineers` route → Task 1 + Task 3
- ✅ Footer links (For Investors mint hover, For Engineers blue hover) → Task 1 Step 4
- ✅ Investor: hero, 3 callout cards, pitch section, sandbox CTA, trust row → Task 2
- ✅ Engineers: 3 blog sections (Graph RAG, Proximity Search, Load Tracker) with honest tradeoffs → Task 3
- ✅ Python code snippet with `ponytail:` comment in Proximity section → Task 3
- ✅ No new npm packages
- ✅ Both pages link back to `/` and forward to `/sandbox`
- ✅ Design tokens match spec exactly

**Placeholder scan:** No TBD, TODO, or "similar to" references. All code blocks are complete.

**Type consistency:** `ForInvestorsPage` and `ForEngineersPage` are default exports matching the import names in `App.tsx`. `Link`, `ArrowLeft`, `ArrowRight` are used consistently. `PROXIMITY_SNIPPET` is a module-level string constant, not a prop.
