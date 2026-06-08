---
name: sandbox-splash-screen
description: Integrate SandboxSplashScreen into SandboxPage as a conditional render on every visit
metadata:
  type: project
---

# Sandbox Splash Screen Integration

## Goal

Show `SandboxSplashScreen` every time `/sandbox` is accessed. When the boot sequence completes, swap to the normal sandbox layout.

## Approach

Conditional render inside `SandboxPage`. No overlay, no routing changes.

## Changes

### `webapp/src/pages/SandboxPage.tsx`

- Import `useState` from React
- Import `SandboxSplashScreen`
- Add `const [showSplash, setShowSplash] = useState(true)`
- If `showSplash`: render `<SandboxSplashScreen onComplete={() => setShowSplash(false)} />` inside the `.sandbox-layout` div (required for CSS vars)
- Else: render normal layout (`<SandboxHeader>`, `<SimulationPanel>`, `<SandboxMap>`, `<InspectorPanel>`)

### `webapp/src/pages/SandboxPage.css`

- Add `@keyframes sandbox-blink` and `.sandbox-cursor` rule — the component references this class but it is not yet defined

## Constraints

- `showSplash` always initializes `true` (component state, resets on every mount)
- No sessionStorage / localStorage — eager-fetch integration is deferred to a later feature
- Facilities are currently static — no background loading needed during splash
