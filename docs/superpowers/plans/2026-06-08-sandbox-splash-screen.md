# Sandbox Splash Screen Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show `SandboxSplashScreen` on every `/sandbox` visit; swap to the normal layout when its boot sequence completes.

**Architecture:** Conditional render in `SandboxPage` — `showSplash` state (always initialized `true`) gates whether the splash or the main layout is rendered. The splash div is wrapped inside `.sandbox-layout` so CSS variables are in scope. A `.sandbox-cursor` blinking-cursor animation is added to `SandboxPage.css`, which the component already references but which was never defined.

**Tech Stack:** React 18 (useState), TypeScript, Vite, existing CSS custom properties

---

## Files

| Action | Path |
|--------|------|
| Modify | `webapp/src/pages/SandboxPage.tsx` |
| Modify | `webapp/src/pages/SandboxPage.css` |

---

### Task 1: Add `.sandbox-cursor` animation to CSS

The `SandboxSplashScreen` component renders a `<span className="sandbox-cursor">` but the class is not defined anywhere. Without it the blinking cursor is invisible.

**Files:**
- Modify: `webapp/src/pages/SandboxPage.css`

- [ ] **Step 1: Add keyframe and cursor rule**

Append to the bottom of `webapp/src/pages/SandboxPage.css`:

```css
@keyframes sandbox-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

.sandbox-cursor::after {
  content: "▋";
  color: var(--sb-accent);
  animation: sandbox-blink 1s step-start infinite;
}
```

- [ ] **Step 2: Verify the rule is scoped correctly**

The `.sandbox-cursor` rule does NOT need to be nested inside `.sandbox-layout` — the component is already rendered inside `.sandbox-layout`, which is where the CSS vars are defined. The rule can live at the top level of the file.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/pages/SandboxPage.css
git commit -m "feat(sandbox-v2): add blinking cursor animation for splash screen"
```

---

### Task 2: Wire `SandboxSplashScreen` into `SandboxPage`

**Files:**
- Modify: `webapp/src/pages/SandboxPage.tsx`

- [ ] **Step 1: Update imports**

Replace the top of `webapp/src/pages/SandboxPage.tsx` with:

```tsx
import { useState } from "react"
import "./SandboxPage.css"
import { useFacilities } from "../hooks/useFacilities"
import { SandboxHeader } from "../components/sandbox/SandboxHeader"
import { SimulationPanel } from "../components/sandbox/SimulationPanel"
import { SandboxMap } from "../components/sandbox/SandboxMap"
import { InspectorPanel } from "../components/sandbox/InspectorPanel"
import { SandboxMobileGuard } from "../components/sandbox/SandboxMobileGuard"
import { SandboxSplashScreen } from "../components/sandbox/SandboxSplashScreen"
```

- [ ] **Step 2: Add state and conditional render**

Replace the full `SandboxPage` function body:

```tsx
export default function SandboxPage() {
  const [showSplash, setShowSplash] = useState(true)
  const { facilities, loading: facilitiesLoading } = useFacilities()

  return (
    <div
      className="sandbox-layout"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--sb-bg-primary)",
      }}
    >
      {showSplash ? (
        <SandboxSplashScreen onComplete={() => setShowSplash(false)} />
      ) : (
        <>
          <SandboxHeader />

          <div className="sandbox-mobile-guard">
            <SandboxMobileGuard />
          </div>

          <div className="sandbox-desktop-layout">
            <SimulationPanel />
            <SandboxMap facilities={facilities} facilitiesLoading={facilitiesLoading} />
            <InspectorPanel />
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd webapp && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke-test in browser**

```bash
cd webapp && npm run dev
```

Navigate to `http://localhost:5173/sandbox`. You should see:
1. The dark splash screen with terminal lines appearing one by one
2. A blinking amber cursor between lines
3. A progress bar filling over ~2.5 seconds
4. The "Ready." line appearing
5. ~300ms later the full sandbox layout (header + three panels) replaces the splash

Reload the page — the splash should appear again from the start.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/pages/SandboxPage.tsx
git commit -m "feat(sandbox-v2): show splash screen on every /sandbox visit"
```
