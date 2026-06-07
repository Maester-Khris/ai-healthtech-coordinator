# Sandbox v2 — Control Room Page Design

**Date:** 2026-06-07
**Branch:** feat/sandbox-v2
**Sprint:** Sprint 10

---

## Overview

A static, desktop-only "Control Room" page at `/sandbox`. Visually distinct from the main app — dark theme, professional SaaS control-room aesthetic (Vercel/Stripe/Retool energy). All interactive elements are styled but non-functional for this sprint; wiring the simulation engine and AI assistant is deferred.

---

## Route and Navigation

**Route:** `/sandbox` — added to `App.tsx` before the `path="*"` catch-all.

**Main app header link:** Subtle nav link added to `WebNavBar.tsx` between the logo and `rightContent`. Small flask SVG icon + "Sandbox" label. 12px text, 0.5px border, rounded-6, muted color. Visible on all main-app pages.

**Main app footer:** 28px row added at bottom of `Home.tsx` desktop layout. "MediCoord AI · Health Tech Platform" left, "Open Sandbox →" link with flask icon right. Styled with muted text and a top border.

**Mobile guard:** CSS-only breakpoint at 1024px. Below 1024px the three-panel layout is hidden and `SandboxMobileGuard` is shown instead. Above 1024px the guard is hidden.

---

## Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  SandboxHeader (52px, background: #0f1117)              │
├──────────────┬──────────────────────────────┬───────────┤
│ Simulation   │ SandboxMap (flex: 1)          │ Inspector │
│ Panel 240px  │ CartoDB DarkMatter tiles      │ Panel     │
│              │ 393 facilities (light colors) │ 340px     │
│              │ SANDBOX watermark (0.06 alpha)│           │
└──────────────┴──────────────────────────────┴───────────┘
```

- Page height: `100vh`, `display: flex; flex-direction: column`
- Three-panel row: `flex: 1; overflow: hidden`
- No main app `WebNavBar` on this page — sandbox has its own header

---

## CSS Color System

Scoped to `.sandbox-layout` in `SandboxPage.css`. No global vars modified.

```css
.sandbox-layout {
  --sb-bg-primary:    #0f1117;   /* page background */
  --sb-bg-secondary:  #161b27;   /* panels */
  --sb-bg-tertiary:   #1e2536;   /* inputs, cards */
  --sb-border:        rgba(255,255,255,0.08);
  --sb-text-primary:  #e8eaf0;
  --sb-text-secondary:#8b91a8;
  --sb-text-muted:    #4a5068;
  --sb-accent:        #EF9F27;   /* amber — sandbox identity */
  --sb-accent-dim:    rgba(239,159,39,0.15);
  --sb-teal:          #1D9E75;
  --sb-blue:          #185FA5;
  --sb-red:           #C0392B;
}
```

---

## SandboxHeader

- **Height:** 52px
- **Background:** `var(--sb-bg-primary)`
- **Left:** Flask SVG (amber, 18px) + "MediCoord**AI**" text (white) + "SANDBOX" badge (amber, 10px uppercase)
- **Right:** Environment switcher `<select>` + `<UserMenu />`
- **Environment switcher:** `useNavigate()` — "production" option navigates to `/`. Styled with amber text on dark tertiary background.

---

## Left Panel — SimulationPanel (240px, static)

All elements are visually polished but have no click handlers. `cursor: default` on buttons, `opacity: 0.6`. Code comment: `// TODO: wire simulation engine`.

**Section 1 — Scenario Templates:**
`<select>` with options: "Routine Saturday afternoon", "Friday night ER surge", "Mass casualty event", "Blizzard conditions".

**Section 2 — System Shock Toggles:**
Three styled buttons: "[+] Spawn simulated patient", "[+] Force facility outage", "[+] Restore all facilities".

**Section 3 — Emergency Load:**
Static progress bar at 72%. Green→amber→red CSS gradient fill. Percentage label.

**Section 4 — Simulation Controls (panel bottom):**
Play/Pause/Stop icon buttons (static). Speed selector: 1x/2x/5x (static).

---

## Center Panel — SandboxMap (flex: 1)

Bespoke component — does NOT reuse `MapPanel`. Reason: needs dark tiles, lighter marker colors, and SANDBOX watermark without modifying shared map config.

- **Tile:** `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- **Center:** CN Tower `[43.6426, -79.3871]`, **zoom 11**
- **Facilities:** Props from `SandboxPage` via `useFacilities()`. Rendered using `MapProvider` (INACTIVE_TRIAGE) + `FacilityMarkerLayer` with a local `getSandboxFacilityIcon()` that uses lighter colors:
  ```ts
  const DARK_CATEGORY_COLORS = {
    hospital:    "#E87070",
    ambulatory:  "#4DBFA0",
    residential: "#85A865",
  }
  ```
- **Top overlay:** Dark-styled filter dropdown + "N FACILITIES ACTIVE" pill (amber dot)
- **SANDBOX watermark:** `position: absolute; fontSize: 80; letterSpacing: 0.3em; color: rgba(239,159,39,0.06); zIndex: 400; pointer-events: none`
- **Legend:** Reuses `FacilityLegend` component (dark card via CSS vars)
- **State:** Always INACTIVE_TRIAGE — no user pin, no route, no triage state

---

## Right Panel — InspectorPanel (340px, fully static)

Two tabs: **AI Preview Assistant** | **Live System Logs**. Tab state: local `useState`, default `"chat"`. Active tab: amber bottom-border underline.

### AI Preview Assistant tab

A static mock chat UI — **not the real ChatPanel**. No hooks, no API calls.

Header: "AI PREVIEW ASSISTANT" label (11px muted) + "MOCK" badge (amber).

Hardcoded conversation:
```ts
const MOCK_CHAT = [
  { role: "user",      content: "I have a fever of 38.9°C and a sore throat since this morning." },
  { role: "assistant", content: "Based on your symptoms, I'm classifying this as moderate severity. I've located Richview Community Care (4 min away) as the best match for walk-in care." },
  { role: "user",      content: "What should I bring with me?" },
  { role: "assistant", content: "Bring your health card (OHIP), a list of any current medications, and a mask. Walk-in wait time is approximately 25 minutes." },
]
```

Disabled input field with placeholder "AI assistant (preview only)". Send button grayed out.

### Live System Logs tab

10 static hardcoded entries. Monospace font (Ubuntu Mono, already loaded). `overflow-y: auto`. Each row: timestamp + type badge + message.

```ts
const STATIC_LOGS = [
  { time: "14:42:81", type: "INFO",      msg: "Sandbox session initialized" },
  { time: "14:42:83", type: "INFO",      msg: "Mock patient generated at [43.6, -79.3]" },
  { time: "14:42:85", type: "ALGORITHM", msg: "Evaluating nearest facilities — severity: urgent" },
  { time: "14:42:86", type: "ALGORITHM", msg: "Candidate: Richview Community Care — ETA 4min" },
  { time: "14:42:87", type: "ALGORITHM", msg: "Candidate: Etobicoke Medical Centre — ETA 6min" },
  { time: "14:42:88", type: "ALGORITHM", msg: "Scoring candidates by ETA + busyness weight" },
  { time: "14:42:89", type: "ALGORITHM", msg: "Richview score: 3.6 | Etobicoke score: 5.2" },
  { time: "14:42:90", type: "SUCCESS",   msg: "Route locked → Richview Community Care" },
  { time: "14:42:91", type: "INFO",      msg: "Redis busyness data age: 4min 32sec" },
  { time: "14:42:92", type: "SUCCESS",   msg: "Patient routed successfully" },
]
```

---

## SandboxMobileGuard (< 1024px)

Full-screen, dark background, centered. Tabler icon `ti-device-desktop-off` (48px muted). Title, body copy, "Return to MediCoord →" link with amber color.

---

## Prop Interfaces (final)

```tsx
// SandboxPage        — no props; instantiates useFacilities() only
// SandboxHeader      — no props; uses useAuth() + useNavigate() internally
// SimulationPanel    — no props (all static)
// SandboxMap         — { facilities: Facility[], facilitiesLoading: boolean }
// InspectorPanel     — no props (all static)
// SandboxMobileGuard — no props
```

`SandboxPage` is the only component that calls hooks. The page is self-contained.

---

## Files to Create

| File | Purpose |
|---|---|
| `webapp/src/pages/SandboxPage.tsx` | Root page: useFacilities, three-panel layout, mobile guard |
| `webapp/src/pages/SandboxPage.css` | Sandbox CSS vars + media queries |
| `webapp/src/components/sandbox/SandboxHeader.tsx` | Dark header with env switcher + UserMenu |
| `webapp/src/components/sandbox/SimulationPanel.tsx` | 240px static left panel |
| `webapp/src/components/sandbox/SandboxMap.tsx` | Dark-tile map with light-color markers + watermark |
| `webapp/src/components/sandbox/InspectorPanel.tsx` | Tabs: mock chat + static logs |
| `webapp/src/components/sandbox/SandboxMobileGuard.tsx` | Desktop-only guard < 1024px |

## Files to Modify

| File | Change |
|---|---|
| `webapp/index.html` | Add Tabler Icons CDN stylesheet |
| `webapp/src/App.tsx` | Add `/sandbox` route before `*` catch-all |
| `webapp/src/components/WebNavBar.tsx` | Add sandbox nav link between logo and rightContent |
| `webapp/src/Menucomponents/Home.tsx` | Add 28px footer row |

---

## Commit Plan

1. `feat(sandbox-v2): /sandbox route, three-panel shell, mobile guard, CSS vars`
2. `feat(sandbox-v2): sandbox header, simulation config panel (static)`
3. `feat(sandbox-v2): dark CartoDB map with sandbox markers, inspector panel`
4. `feat(sandbox-v2): sandbox link in main app header and footer`

---

## Verification Checklist

- [ ] /sandbox route renders without errors
- [ ] Page background is dark — immediately distinct from main app
- [ ] Three panels visible and proportioned on 1440px screen
- [ ] Left panel: scenario dropdown, 3 toggle buttons, 72% progress bar, play/pause/stop controls
- [ ] Center panel: CartoDB DarkMatter tiles, 393 facilities with light-colored markers
- [ ] SANDBOX watermark barely visible centered on map
- [ ] Right panel: two tabs switch between mock chat and logs
- [ ] AI Preview tab: 4 hardcoded messages + disabled input + MOCK badge
- [ ] Live System Logs tab: 10 entries with type badges, monospace font
- [ ] Environment switcher "Production" navigates to /
- [ ] Below 1024px: mobile guard shown, panels hidden
- [ ] Main app header shows subtle sandbox link
- [ ] Main app footer shows "Open Sandbox" link
- [ ] `npx tsc --noEmit` passes
- [ ] No sandbox CSS vars leak into main app
