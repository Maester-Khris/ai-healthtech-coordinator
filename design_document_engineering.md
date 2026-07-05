# MediCoord AI: Engineering Pages Design Specification
## `/for-engineer` Index Overhaul + New Engineering Case Study Detail Pages

This document supersedes the current `/for-engineer` implementation (`webapp/src/pages/ForEngineersPage.tsx`) and adds a new page type that does not exist yet: a dedicated, per-system **case study detail page**. It extends the design tokens and typography established in `design_document_app.md`, applied to a read/reference surface rather than the live command-center surface. Source of truth: approved mockups `artifacts/eng-index.png` (index) and `artifacts/eng-case-study.png` (case study detail).

Both pages are **static content** — no CMS, no backend call, no Supabase. Content is authored as a typed array in code, matching current Phase 1 scope.

---

## 1. Global Screen Framework

Unlike `/app` (fixed-height, no-scroll, 40/60 split command center), the engineering pages are a **scrolling content surface** — closer to a technical blog/docs site than a live dashboard. No ambient command-center drop shadows; flat bordered cards instead.

*   **Index (`/for-engineer`):** Sticky top utility header (full width) + below it a two-column region: **Left Filter Rail** (`280px`, sticky) and **Right Article Feed** (flex-1, content capped at `max-w-4xl`–`5xl`).
*   **Case Study Detail (`/for-engineer/:slug`):** Sticky top utility header (full width) + a two-column region: **Left Section Nav** (`240px`, sticky) and **Main Article Column** (single reading column, capped at `max-w-3xl` for prose comfort).
*   **Framing:** Same `1px` `color-border-subtle` (`#1C4659`) rules as the app doc. No `box-shadow` glass elevation — cards are flat-bordered (`border` + `color-bg-surface` fill only), signaling "reference document" rather than "live system."

---

## 2. Design Tokens — Reused + Deltas

Reuses all 7 core tokens from `design_document_app.md` verbatim (`color-bg-base`, `color-bg-surface`, `color-border-subtle`, `color-accent-mint`, `color-accent-blue`, `color-text-primary`, `color-text-muted`). No new hues introduced — this is an existing, shipped identity (`ForEngineersPage.tsx` already draws from this palette); the redesign extends components, not the palette.

| Token Identifier | Value | Role |
| :--- | :--- | :--- |
| `tag-chip-mint` | `bg: #48F6C1/10` `text: #48F6C1` `border: #48F6C1/20` | Category label chips, tags (`#AI-Agents`, `#KnowledgeGraphs`) |
| `tag-chip-blue` | `bg: #00D2FF/10` `text: #00D2FF` `border: #00D2FF/20` | Category chips for geospatial/infra topics |
| `callout-mint-border` | `border-left: 4px solid #48F6C1` on `color-bg-surface` | "Architectural Overview" summary callout |
| `failure-card-danger` | `border: #FF7B93/30` `heading: #FF7B93` | Two-up "what broke" highlight cards |
| `failure-card-info` | `border: #00D2FF/30` `heading: #00D2FF` | Paired highlight card (contrast condition) |
| `code-chrome-bg` | `#0D1B23` | Code block header strip (dot row + filename) |
| `code-dot-trio` | `#FF7B93` `#48F6C1` `#00D2FF` | Traffic-light dots — brand colors, not literal macOS red/yellow/green |
| `stat-value-mint` / `-blue` / `-danger` | same accent triplet | Bottom-of-article metric values, colored by meaning (success / latency / risk) |

Typography unchanged: **Inter/Geist Sans** for prose and headings, **JetBrains Mono/Fira Code** for eyebrows, tags, meta rows, and code — same split as the app doc.

---

## 3. Page 1: Engineering Index (`/for-engineer`)

### A. Top Utility Header
*   Left: small mint node/hexagon icon mark + bold white wordmark **"Dispatch HQ"** — a section-specific micro-brand, distinct from the main app header, signaling "this is the engineering wing."
*   Right: a live-pulse icon button (ambient system-health affordance, no label) + circular avatar.
*   `64px` height, `border-b border-[#1C4659]/80`, sticky.

### B. Left Filter Rail (280px, sticky)
1.  **Heading block:** "Technical Index" (H2, white, bold) + one-line muted description: `"Exploring the architecture of automated clinical coordination."`
2.  **Search input:** bordered pill/rect, magnifier icon, placeholder `"Search technical case studies"`.
3.  **Tag filter list:** vertical stack of rows, each a rounded rect containing `#Tag` in mono + trailing chevron. Active filter (`#AI-Agents`) gets a filled `color-bg-surface`-toned background + border; inactive rows are borderless/transparent until hovered.
4.  **Status card:** bottom-anchored bordered box — mono label `STATUS`, a solid mint dot, and bold white `"3 Live Systems"`. Communicates the count of documented systems, not a live metric feed (this page doesn't poll anything).

### C. Right Article Feed
1.  **Ambient banner strip:** full-width, subtly-tinted dark teal bordered box with small tracked mono label, e.g. `SYSTEM ARCHITECTURE DEEP-DIVES` — a quiet section-context ribbon, not a CTA.
2.  **Eyebrow chip:** `ENGINEERING BLOG` — mint-on-dark pill, uppercase, tracked.
3.  **H1:** `"How it works under the hood"` — large, bold, white.
4.  **Subhead:** muted paragraph, `max-w-2xl`, one sentence describing the format ("what broke, how we approached it, what we traded away").
5.  **Case study preview cards** (vertical stack, `gap-6`, each a bordered `rounded-2xl` card, `p-8`):
    *   **Row 1:** category icon tile (colored bg/border matching the system's accent) + colored mono category label (e.g. `LLM SYMPTOM UNDERSTANDING`) on the left; muted mono `"N MIN READ"` right-aligned.
    *   **Row 2:** tag chip row (`#AI-Agents #KnowledgeGraphs #LLMs`), small bordered chips, colored to match category.
    *   **Title:** H3, bold white, large (e.g. `"Graph RAG with Canadian Medical KG"`).
    *   **Description:** 2–3 line muted summary paragraph.
    *   **CTA:** bordered (not filled) button, left-aligned under the copy: `"Read Case Study ↗"`.
6.  **Footer:** border-top strip — copyright left (`"© 2026 MediCoord AI · Patient Routing Platform. All rights reserved."`), links right: `Architecture Roadmap` · `API Docs` · `Back to Overview`.

---

## 4. Page 2: Engineering Case Study Detail (`/for-engineer/:slug`) — NEW

This page type does not exist in the current codebase. Each of the three (soon more) systems documented on the index gets its own route and full-detail treatment.

### A. Top Utility Header
*   Left: bold white wordmark **"MediCoord AI Engineering"** — the full, formal brand, deliberately different from the index's "Dispatch HQ" micro-brand, since a case study is the citable/shareable artifact (linked externally, quoted, bookmarked).
*   Right: `"Back to Overview"` text link + solid mint `"Subscribe"` button.

> **Flag:** the two approved mockups use two different header wordmarks per page. Carrying this forward as an intentional register shift (index = internal-feeling "ops" brand, detail = external-facing "engineering blog" brand) rather than silently unifying them — noting it here per project convention so it's a conscious call, not an oversight.

### B. Left Section Nav (240px, sticky)
1.  **Heading block:** "Technical Index" + muted subtitle `"MediCoord Core"`.
2.  **Nav list** (icon + label rows): `Architecture`, `Infrastructure` (active — filled pill background), `AI Models`, `Security`, `Change Logs`. This is a **static, non-functional taxonomy for now** — it groups case studies by system layer; only the current article's category needs to resolve to an active state.
3.  **Divider.**
4.  **"View Roadmap"** — full-width bordered button.
5.  **External links:** `Github`, `Documentation` — icon + muted text, hover to white.

### C. Main Article Column
1.  **Breadcrumb:** `← BACK TO TECHNICAL INDEX`, small, blue (`color-accent-blue`), mono.
2.  **H1:** article title, large, bold, wraps to 2 lines max.
3.  **Meta row:** calendar icon + `"Published: [date]"` · pencil icon + `"Written by [author]"` · clock icon + `"[N] Min Read"` — muted, separated by `•`.
4.  **Architectural Overview callout:** bordered card, `4px` solid mint left border, `color-bg-surface` fill. Heading `"Architectural Overview"` (bold white) + one-paragraph summary (muted). This is the "too long, didn't read" version of the whole article.
5.  **Section block** (repeats per section — `"The Problem: ..."`, `"The Architecture Strategy"`, etc.):
    *   Heading row: `4px` colored vertical bar (color varies by section intent — e.g. pink/red for problem framing, mint for strategy) + H2 (white, bold).
    *   Body paragraph with inline emphasis: bold white spans for key terms, inline accent-colored spans (e.g. blue) for a called-out technical claim.
    *   **Optional two-up highlight cards** directly under a "Problem" paragraph: `grid-cols-2` (stacks to 1 col on mobile), each a bordered card with a colored heading (`color-danger-soft` red/pink for a failure mode, `color-accent-blue` for a secondary condition) and a short muted description. Mirrors the existing "Concurrency Failure" / "Latency Spike" pairing in the mockup.
6.  **Architecture diagram embed:** bordered `rounded-xl` frame around the diagram image/SVG, with a small mono caption strip along the bottom edge (e.g. `FIG 1.2: ATOMIC PIPELINE LOCK SCHEMATIC`).
7.  **Code block component:**
    *   Header chrome bar (`code-chrome-bg`): three brand-colored traffic-light dots (not literal red/yellow/green) + right-aligned mono filename tab (e.g. `facility_lock.lua`).
    *   Body: monospace, syntax-tinted (keywords in blue, string/atom literals in mint, comments muted gray), horizontal scroll on overflow — never wrap.
8.  **Stat row:** 3-up grid (`grid-cols-3`, stacks to 1 col below `sm`), each a bordered stat card: large colored numeral (mint = success/positive, blue = latency/neutral, pink = risk/retry) + small muted uppercase mono label beneath (e.g. `99.8%` / `WRITE SUCCESS`).
9.  **Footer:** border-top — left `"© 2026 MediCoord Engineering. Internal Distribution Only."`, right `Share Repo` / `Helpful` (icon + text, muted).

---

## 5. Content Data Model (static, code-authored)

Extends the existing `SECTIONS: BlogSection[]` shape in `ForEngineersPage.tsx` — becomes the shared source for both the index cards and the detail pages (one entry per case study, one route per entry):

```ts
interface CaseStudy {
  slug: string                 // routes /for-engineer/:slug
  navSection: 'architecture' | 'infrastructure' | 'ai-models' | 'security' | 'change-logs'
  category: string              // e.g. "LLM Symptom Understanding"
  accent: 'mint' | 'blue'
  tags: string[]                // "#AI-Agents", "#KnowledgeGraphs"...
  title: string
  readTimeMinutes: number
  publishedDate: string
  author: string
  summary: string                // index card description + detail-page overview callout
  problem: string
  problemHighlights?: { heading: string; body: string; accent: 'danger' | 'info' }[]
  approach: string
  approachEmphasis?: string[]    // inline-highlighted phrases
  diagram?: { src: string; caption: string }
  code?: { filename: string; language: string; content: string }
  tradeoff: string
  stats?: { value: string; label: string; accent: 'mint' | 'blue' | 'danger' }[]
}
```

No backend, no CMS — this array lives in `webapp/src` and is imported by both the index page and the new `EngineeringCaseStudyPage.tsx`. Matches Phase 1 scope (`CLAUDE.md`: no Supabase/DB integration yet).

---

## 6. Routing

*   `/for-engineer` — index (existing route, component rebuilt per §3).
*   `/for-engineer/:slug` — **new** route, one static page per `CaseStudy` entry, resolved client-side against the array (no server fetch).

---

## 7. Responsive Behavior (brief)

*   Below `lg`: both sidebars (filter rail, section nav) collapse behind a top disclosure/accordion trigger; content becomes single-column.
*   Two-up highlight cards and the 3-up stat row collapse to 1 column below `sm`.
*   Code blocks always scroll horizontally — never wrap, never shrink font below readable size.
