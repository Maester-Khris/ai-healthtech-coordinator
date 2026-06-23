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

**Correction (post-implementation-planning):** the original draft of this
spec assumed `MobileNavBar.tsx` owned the Map/AI tab switcher. It doesn't —
`MobileNavBar.tsx` is purely the top header (logo + auth/hamburger), and the
actual tab switcher with the active-indicator lives inline inside
`MobileLayout.tsx` (lines ~106-124). The component list and the "Navigation
Dock" requirement below are corrected to reflect the real file ownership.

- **`MobileNavBar`** → re-skinned as a slim top bar using Stratum tokens
  (same treatment pattern as `WebNavBar` from the web re-skin sub-project)
  — it has no tabs, so it does not become a dock. Logo, avatar, and
  hamburger button restyled; structure unchanged.
- **`MobileLayout`'s inline Map/AI tab switcher** → rebuilt as the floating
  bottom "Navigation Dock": fixed position, `backdrop-blur-xl`,
  double-bezel shell, pulse-animated active-tab indicator (replaces the
  current top-aligned flat tab strip with bottom-border indicator). This is
  a structural reposition (top strip → floating bottom dock), not a pure
  token swap — `MobileLayout`'s own "out of scope" note below is narrowed
  to exclude this one piece.
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
  (the dock conversion repositions the existing 2-tab switcher, it does not
  add tabs or change what each tab does)
- `MobileLayout`'s breakpoint-detection logic and tab-state management
  (`activeTab`, `setActiveTab`, the `Tab` type) — unchanged; only the tab
  switcher's visual presentation and position move
