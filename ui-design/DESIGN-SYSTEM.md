---
name: "MediCoord AI — Merged Design System"
status: "approved"
date: "2026-06-22"
sources:
  - aura-connect-interface-1-DESIGN.md
  - Stratum---System-Coordination-Framework-DESIGN.md
---

# MediCoord AI — Merged Design System

Single source of truth for the Sprint 13 UI/product reframe. This file is the
canonical token spec. When tokens change, edit `webapp/src/index.css`
(Tailwind v4 `@theme` block) first, then update this file to match — one
direction of truth.

Base material/typography/shape language is **Stratum** (light, warm,
"calculated skeuomorphism" — chosen over Aura's dark dashboard look because
this is a patient-facing healthtech product, not an ops tool). **Aura**
contributes the dense dashboard layout pattern for web breakpoints only.

## Colors

Base palette (Stratum, all UI chrome):

| Role | Value | Use |
|---|---|---|
| Background | `#EAE5DF` | App background |
| Surface | `#A3907A` (as gradient base, see Material) | Cards, panels |
| Primary | `#A3907A` | Main accent, emphasis, primary actions |
| Secondary | `#8C8273` | Supporting accent, secondary emphasis |
| Tertiary | `#A1AE7A` | Sparse supporting contrast (never severity) |
| Neutral | `#7A756D` | Borders, dividers, inactive states |
| Text primary | `#3D3A35` | Body copy (darkened from spec's `#8C8273` for AA contrast on `#EAE5DF`) |
| Text secondary | `#7A756D` | Secondary copy |
| Border | `#EAE5DF` / `#DCD6CC` | Hairline dividers |

Semantic severity ramp (dedicated — only for severity states: markers,
badges, triage cards, next-action urgency cues. Never used decoratively):

| Severity | Value | Notes |
|---|---|---|
| Routine | `#6B8F71` | Muted sage green — calm, low-urgency |
| Moderate | `#C9A227` | Muted amber — caution |
| Urgent | `#D17A3D` | Muted burnt orange — elevated |
| Emergent | `#B6453E` | Muted brick red — critical, unambiguous |

## Typography

Inter throughout. Body/UI weights and sizes are overridden upward from the
Stratum source spec (200/12px) for healthtech legibility — the audience
includes elderly/low-vision/stressed users reading triage-critical text.

| Token | Spec | Use |
|---|---|---|
| `display-lg` | Inter 96px / 200 / uppercase / -0.025em | Hero headlines only (landing/marketing) |
| `display-md` | Inter 48px / 300 / uppercase | Section headers |
| `body-md` | Inter 16px / 400 | All functional/UI text — triage results, forms, legal pages, badges |
| `label-md` | Inter 14px / 500 | Labels, metadata, table headers |
| `mono` | JetBrains Mono 12px / 500 (borrowed from Aura) | Technical/data readouts only — sandbox inspector, timestamps, IDs |

## Spacing & Shape

Stratum, unchanged.

- Base unit: 4px
- Scale: 1px, 4px, 8px, 10px, 12px, 14px, 16px, 20px
- Section padding: 24px, 56px
- Card padding: 8px, 12px, 16px, 18px
- Gaps: 6px, 8px, 12px, 16px
- Radius family: 2px, 3px, 4px, 5px, 6px, 8px (buttons 5px, cards 5–8px, large bezels up to 15px)

## Material ("calculated skeuomorphism")

Applies to both web and mobile — this is the signature visual identity.

- Cards/panels: gradient fill `linear-gradient(#FDFBF7 → #EAE5DF)` + `backdrop-blur-md` + dual shadow (soft outer `rgba(0,0,0,0.08)` + inset top highlight `inset 0 1px 0 white`)
- Outer 1px gradient-stroke shell around primary containers ("double-bezel" effect): wrap surface in outer shell with 1px padding + 6px radius, `linear-gradient(#FFFFFF, #FDFBF7, #DCD6CC)`, inset the real content surface at a slightly smaller radius
- Large blurred radial gradients (180px blur) reserved for ambient background glow only — never on interactive elements
- `backdrop-blur-md`/`backdrop-blur-xl` reserved for floating components (nav dock, modals) to separate them from the base plane

## Iconography

`@phosphor-icons/react` at `weight="thin"` / `weight="light"` — already
installed, natively matches the "1.5px linear stroke" requirement. No new
icon dependency (drops the source spec's suggested Solar set).

## Motion

Moderate intensity, per Stratum.

- Hover/load transitions: `transition-colors duration-300`, easing `ease` / `cubic-bezier(0.4, 0, 0.2, 1)`
- List/message entrance: gentle opacity fade + slide-in
- Use plain CSS transitions for hover/load states. Reach for the `motion` library only for gesture/spring-physics interactions explicitly needed (e.g. bottom sheet drag) — not routine hover states.

## Sandbox exception

`/sandbox` is a deliberately distinct dark "control room" environment — not
patient-facing, narratively justified as a testing/ops zone. It is the one
place in the app that uses **Aura's dark palette** directly instead of the
Stratum base:

| Role | Value |
|---|---|
| Background | `#050505` |
| Surface | `#18181B` |
| Text primary | `#FFFFFF` |
| Text secondary | `#A1A1AA` |
| Border | `#27272A` |
| Label/mono | JetBrains Mono, 12px/600 |

Sandbox still uses the same spacing/radius/motion tokens and the same
severity ramp as the rest of the app — only the background/surface/text
palette differs. `InspectorPanel`/`SimulationPanel` adopt Aura's dense
bento/metric-panel hierarchy directly (its intended use case).

## Layout pattern split

**Web (≥1024px) — Aura's dense dashboard pattern:**
- Keep the existing 70/30 map+chat split shell, but adopt nested-surface bento hierarchy (panels within panels, compact metric/status emphasis)
- Sandbox `InspectorPanel` becomes a true dense data panel, not stub-styled cards
- `WebNavBar` becomes a slim top bar, not a full hero nav

**Mobile (<1024px) — Stratum's dock + card pattern:**
- `MobileNavBar` → floating bottom "Navigation Dock": fixed, `backdrop-blur-xl`, detached double-bezel shell, pulse-animated active indicator
- `BottomSheet`, `FacilityCard`, `DrawerMenu` adopt the card material system directly (token swap, not restructure)

## Implementation notes

- Tailwind v4 `@theme` block in `webapp/src/index.css` is the only place token *values* live in code. This doc is the decision record; code is the implementation.
- Replaces the current ad-hoc `--color-primary` CSS vars and leftover Quicksand/Fredoka font imports in `index.css`.

## Rollout sequence (per Sprint 13)

1. Design system foundation (this doc + `@theme` tokens) — **this spec**
2. New landing page + legal pages (privacy, cookie, data disclosure) — net new, no existing UI debt
3. Web app re-skin (Home map+chat split, WebNavBar, auth/onboarding modals, sandbox)
4. Mobile app re-skin (MobileLayout, bottom nav dock, drawer, bottom sheet, tabs)

Each of 2–4 gets its own spec → plan → implementation pass, drawing from this
file as the token source:

- `docs/superpowers/specs/2026-06-22-landing-legal-pages-design.md`
- `docs/superpowers/specs/2026-06-22-web-app-reskin-design.md`
- `docs/superpowers/specs/2026-06-22-mobile-app-reskin-design.md`
