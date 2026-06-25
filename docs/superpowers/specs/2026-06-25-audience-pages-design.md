# Audience Pages: /for-investors & /for-engineers

*Spec date: 2026-06-25*

## Summary

Add two new audience-specific pages reachable from footer links on the landing page. Each page speaks to a single audience in their own language, replacing the dual-tone approach currently baked into the landing page's mid-section cards.

No new npm packages. No new backend routes. Two new page components, two new routes, one footer update.

---

## Scope

**In scope:**
- `ForInvestorsPage.tsx` — new page at `/for-investors`
- `ForEngineersPage.tsx` — new page at `/for-engineers`
- Route additions in `App.tsx`
- Footer link additions in `LandingPage.tsx`
- Reuse existing dark theme palette and typography exactly

**Out of scope:**
- Removing the existing mid-section cards on the landing page (separate decision)
- Any backend changes
- Any new dependencies
- Auth-gating either page

---

## Architecture

### New files
```
webapp/src/pages/ForInvestorsPage.tsx
webapp/src/pages/ForEngineersPage.tsx
```

### Modified files
```
webapp/src/App.tsx          — add two routes
webapp/src/pages/LandingPage.tsx  — add two footer links
```

### Routes added to App.tsx
```tsx
<Route path="/for-investors" element={<ForInvestorsPage />} />
<Route path="/for-engineers" element={<ForEngineersPage />} />
```

### Footer update (LandingPage.tsx:1217)
Current right-side links: Privacy Policy · Cookie Policy · Data Disclosure

New layout — two groups in the footer nav:
- **Left/secondary group:** `For Investors · For Engineers`
- **Right/legal group:** Privacy Policy · Cookie Policy · Data Disclosure

Both groups use the same `Link` component and hover style as existing footer links.

---

## Page 1: ForInvestorsPage

### Audience
Health system operators, municipal health directors, B2B healthcare buyers, investors evaluating city-scale health coordination platforms.

### Tone
Executive-level, outcome-driven, confident. No patient-facing softening. Numbers and mechanisms over emotion.

### Page structure

#### Header / Nav
Minimal sticky header: MediCoord AI logo + "Back to overview" link to `/`. No sign-in/sign-up CTA on this page.

#### Hero block
- **Eyebrow tag:** `For Health System Operators & Investors`
- **H1:** City-wide patient coordination. Real-time. At scale.
- **Subtext:** MediCoord AI routes hundreds of patients simultaneously across Toronto's health network — prioritized by severity, balanced by load, in real time.

#### Three callout blocks (horizontal row, cards)
1. **Priority Queue** — Severity-weighted dispatch. Emergent cases route first. Moderate and routine cases absorb available city-wide capacity.
2. **City-Wide Coordination** — All facilities tracked simultaneously. Load redistributes as patient volume shifts. No single facility becomes a new bottleneck.
3. **Org Sandbox** — Evaluate with simulated patient load. No PHI, no live infrastructure, full coordination fidelity.

#### Main pitch section
**Heading:** Most routing systems find the nearest facility. MediCoord AI coordinates across all of them.

**Paragraph 1 — Composite routing:**
The system scores every candidate facility by `travel_time + active_wait_queue`, not by proximity. A clinic 1.5km away with a 60-minute queue loses to a hospital 4km away with a 23-minute total ETA. Severity gates minimum facility capability: emergent cases never route to urgent care regardless of ETA advantage.

**Paragraph 2 — Load balancing:**
As facilities fill, routing decisions shift to preserve system-wide throughput. Inbound routing decisions in flight are factored into each new score — preventing the coordination trap of sending every patient to the same "best" option.

#### Org Sandbox CTA block (highlighted card)
- **Label:** Available for Organizations — Sandbox Mode
- **Copy:** Run a simulated patient load across the city network. Watch priority queue dispatch and load rebalancing in real time. No PHI, no live infrastructure required.
- **Button:** "Launch Sandbox Mode →" → links to `/sandbox`

#### Trust row (below CTA)
`Built on real Canadian public health data · Toronto facility network · Session-only, zero PHI storage`

#### Footer
Standard LandingPage footer pattern — © 2026 MediCoord AI + legal links.

---

## Page 2: ForEngineersPage

### Audience
Senior engineers, ML engineers, infrastructure engineers. Evaluating the system or curious about implementation choices.

### Tone
Peer-to-peer, precise, intellectually honest about tradeoffs. No marketing softening. Named tradeoffs are a feature, not a liability.

### Page structure

#### Header / Nav
Same minimal header as investor page.

#### Hero block
- **Eyebrow tag:** `Engineering`
- **H1:** How it works under the hood
- **Subtext:** Three deep-dives into the systems that make MediCoord AI accurate, fast, and defensible at city scale.

#### Blog section 1 — Graph RAG

**Title:** Why we don't trust the LLM alone

**Body:**
Lay descriptions of symptoms don't map cleanly to clinical urgency. "My kid won't stop shaking and won't eat" could be a dozen conditions with wildly different severities. We ground the model with a medical knowledge graph that maps symptom clusters to clinical entities before the LLM reasons about them.

The extraction step injects structured context — `[Symptom: Tachypnea] + [Patient: Pediatric] + [Risk: Dehydration]` — constraining the output space. The LLM reasons about a structured representation of the complaint, not raw text. This prevents the common failure mode where confident-sounding LLM output maps benign symptoms to critical routing decisions.

**Honest tradeoff:** The graph is a maintenance burden and a knowledge snapshot. Edge cases still fall through to base LLM priors. Graph RAG reduces hallucination frequency, not to zero.

#### Blog section 2 — Proximity Search

**Title:** The problem with "nearest"

**Body:**
Straight-line distance is wrong for patient routing. 1.5km clinic + 60-minute queue = 65 minutes to care. 4km hospital + 8-minute drive + 15-minute wait = 23 minutes to care. The "nearest" option loses by 42 minutes.

We score every candidate facility: `ETA = road_travel_time (OSRM) + active_wait_time`. Geoapify's Route Matrix API returns road-accurate travel times to N facilities in a single request. Severity gates minimum facility capability independently of the score — an emergent case never routes to urgent care even if it wins on ETA.

```python
# ponytail: phase-1 composite score — ML-weighted version when we have outcome data
score = travel_minutes + queue_minutes
# severity gates min_capability before scoring, not via score inflation
```

**Honest tradeoff:** Live queue data is the hardest piece. Phase 1 models queue depth from facility type + time-of-day patterns. Real-time facility feed integration is the next defensibility moat.

#### Blog section 3 — Realtime Load Tracker

**Title:** Don't create a new bottleneck

**Body:**
Routing everyone to the "best" facility is a self-defeating optimization. If 80 patients all score the same hospital, you've moved the bottleneck, not eliminated it. The load tracker maintains city-wide facility state: current queue depth, inbound routing decisions in flight, and capability by facility type.

New routing decisions factor in both current load and projected load from pending decisions. The priority queue layer controls resolution order: emergent cases always route first, urgent routes to lowest-composite-ETA with sufficient capability, moderate and routine absorb load across the wider network including clinics that emergent cases would never target.

This is what Sandbox Mode visualizes — you can watch routing decisions redistribute as simulated patient volume fills individual facilities.

**Honest tradeoff:** Currently modeled at the application layer. Production at city scale needs a durable event bus (Kafka or equivalent) with facility state managed as a shared service. The sandbox shows the coordination behavior faithfully; the production architecture would differ.

#### Footer CTA row
`Explore the sandbox →` links to `/sandbox`.

#### Footer
Standard footer pattern.

---

## Visual / Style contract

Both pages inherit the landing page's design system exactly:
- Background: `bg-[#061219]`
- Primary accent: `#48F6C1` (mint green)
- Secondary accent: `#00D2FF` (cyber blue)
- Text: `text-[#E2F1F5]`, muted `text-[#85A4B1]`
- Card style: `border border-[#1C4659]/50 bg-[#0A1D27]/80 rounded-2xl`
- Font: `font-sans` for body, `font-mono` for labels/tags/code
- Phosphor icons for any iconography

Code snippets on the engineers page use dark code block styling consistent with the existing simulation panels on the landing page.

---

## Spec self-review

- No TBD or placeholders — all content is specified
- Routes, files, and components are all named
- Both pages reference existing design tokens exactly — no new styles invented
- Footer placement is specified (two groups)
- Sandbox CTA on investor page links to existing `/sandbox` route
- Engineer code snippet uses `ponytail:` comment convention
- Scope is tight: 2 new files, 2 file edits, zero new dependencies
