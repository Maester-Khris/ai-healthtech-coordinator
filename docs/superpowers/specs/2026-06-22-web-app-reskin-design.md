# Web App Re-skin — Design Spec

**Date:** 2026-06-22
**Sub-project:** 3 of 4 (Sprint 13 UI/product reframe)
**Depends on:** `ui-design/DESIGN-SYSTEM.md`

## Problem

The existing web app (Home map+chat shell, nav, auth/onboarding modals,
sandbox) is built with ad-hoc Tailwind defaults (gray-200 borders, blue-600
accents, Quicksand/Fredoka fonts) — not the new merged design system. This
spec covers re-skinning it in place: no structural rebuild, no new features.

## Home shell (map+chat 70/30 split)

- Layout structure unchanged (`flex-[7]` map / `flex-[3]` chat)
- Map panel and chat panel containers get the double-bezel + gradient-surface
  treatment from the design system (replaces flat `bg-white border
  border-gray-200 shadow-sm`)
- `WebNavBar` → slim top bar using new tokens: logo/wordmark restyled per
  typography spec, "Sandbox" link keeps its lab-flask accent (visual cue for
  the dark zone beyond it)
- Footer bar restyled to new spacing/type tokens, content unchanged

## Auth & onboarding modals

`LoginModal`, `GettingStartedModal`:
- Restyled with the card material system (gradient fill, dual shadow,
  double-bezel shell)
- Form inputs get new radius/spacing tokens
- No structural or flow changes — pure re-skin

## Sandbox

Sandbox keeps its dark "control room" identity — narratively justified as a
testing/ops environment, not patient-facing. Formalized as **Aura's dark
palette** (see `ui-design/DESIGN-SYSTEM.md` → Sandbox exception):
`#050505` background, `#18181B` surface, JetBrains Mono labels.

- `SandboxHeader` → dark slim top bar, same height/spacing shape as
  `WebNavBar` but dark in color
- `InspectorPanel`, `SimulationPanel` → adopt Aura's dense bento/metric-panel
  hierarchy directly (this is the intended use case for that pattern)
- `SandboxSplashScreen` terminal boot animation stays conceptually the same,
  restyled with the new mono type tokens
- `SandboxMap` dark CartoDB tiles stay as-is (already fits)

## Components touched

`Menucomponents/Home.tsx`, `components/WebNavBar.tsx`,
`components/auth/LoginModal.tsx`, `components/onboarding/GettingStartedModal.tsx`,
`pages/SandboxPage.tsx`, `components/sandbox/SandboxHeader.tsx`,
`components/sandbox/InspectorPanel.tsx`, `components/sandbox/SimulationPanel.tsx`,
`components/sandbox/SandboxSplashScreen.tsx`

## Out of scope

- Sandbox's deferred System Shock playback controls (already marked
  not-wired in the changelog — re-skin styles them, doesn't wire them)
- Any new screens or flows — this is a re-skin pass only
