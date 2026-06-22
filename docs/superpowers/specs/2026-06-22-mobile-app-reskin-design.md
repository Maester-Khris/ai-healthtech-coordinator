# Mobile App Re-skin — Design Spec

**Date:** 2026-06-22
**Sub-project:** 4 of 4 (Sprint 13 UI/product reframe)
**Depends on:** `ui-design/DESIGN-SYSTEM.md`

## Problem

The existing mobile components (`components/mobile/*`) are built with the
same ad-hoc styling as the web app. This spec applies the design system's
dock+card layout pattern (Stratum) to the existing mobile structure — a
re-skin, not a rebuild. No new mobile-only components are needed.

## Components and changes

- **`MobileNavBar`** → rebuilt as the floating bottom "Navigation Dock":
  fixed position, `backdrop-blur-xl`, double-bezel shell, pulse-animated
  active-tab indicator (replaces the current flat tab bar)
- **`BottomSheet`, `FacilityCard`** → adopt the card material system
  directly (gradient fill, dual shadow) — already card-shaped, so this is a
  token swap, not a restructure
- **`DrawerMenu`** → restyled with the same material, same slide-in-over-dim
  backdrop behavior as today
- **`MapTab`, `AiAssistantTab`** → containers get the double-bezel
  treatment; map markers switch to the new severity color ramp (replacing
  whatever ad-hoc severity colors are used today)
- **`QuickChips`, `SymptomInput`** → restyled to new radius/spacing/typography
  tokens, no structural change

## Tokens

Identical color/typography/motion tokens to the web re-skin (Stratum base +
severity ramp) — only the *layout pattern* differs between breakpoints (dock
+ card stack on mobile vs. top bar + bento grid on web), per
`ui-design/DESIGN-SYSTEM.md`.

## Components touched

`components/mobile/MobileNavBar.tsx`, `components/mobile/BottomSheet.tsx`,
`components/mobile/FacilityCard.tsx`, `components/mobile/DrawerMenu.tsx`,
`components/mobile/MapTab.tsx`, `components/mobile/AiAssistantTab.tsx`,
`components/mobile/QuickChips.tsx`, `components/mobile/SymptomInput.tsx`,
`components/mobile/MobileLayout.tsx` (container-level token updates only)

## Out of scope

- Any new mobile screens, tabs, or navigation structure — re-skin only
- `MobileLayout`'s breakpoint-detection logic (unchanged, just restyled
  children)
