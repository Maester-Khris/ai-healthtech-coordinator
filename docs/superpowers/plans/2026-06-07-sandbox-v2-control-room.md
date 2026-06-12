# Sandbox v2 — Static Control Room Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, dark-themed `/sandbox` control room page with three panels (simulation config, dark map, inspector) that is visually isolated from the main app at first glance.

**Architecture:** `SandboxPage` is the sole hook owner — calls `useFacilities()` and passes facilities down. All other sandbox components are purely presentational (static, no hooks). Mobile guard enforced via CSS media query at 1024px. Sandbox CSS vars scoped to `.sandbox-layout` to prevent bleed into main app. Facility markers rendered directly inside `MapContainer` using a local dark-adapted icon factory — no shared `FacilityMarkerLayer` modification needed.

**Tech Stack:** React 18, TypeScript, React Leaflet (already installed), CartoDB DarkMatter tile layer, Tabler Icons webfont (CDN), Vite, Tailwind CSS (global, unchanged)

---

> ⚠️ No test infrastructure exists in this project. `npx tsc --noEmit` (run from `webapp/`) serves as the verification step after each commit.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `webapp/src/pages/SandboxPage.tsx` | Root: instantiates `useFacilities()`, composes three-panel layout |
| Create | `webapp/src/pages/SandboxPage.css` | Sandbox CSS vars + mobile/desktop media queries |
| Create | `webapp/src/components/sandbox/SandboxHeader.tsx` | 52px dark header: brand mark, env switcher, UserMenu |
| Create | `webapp/src/components/sandbox/SimulationPanel.tsx` | 240px left panel: scenario select, toggles, progress bar, controls |
| Create | `webapp/src/components/sandbox/SandboxMap.tsx` | Center panel: CartoDB DarkMatter, 393 facilities, SANDBOX watermark |
| Create | `webapp/src/components/sandbox/InspectorPanel.tsx` | 340px right panel: mock chat tab + static logs tab |
| Create | `webapp/src/components/sandbox/SandboxMobileGuard.tsx` | Full-screen guard shown below 1024px |
| Modify | `webapp/index.html` | Add Tabler Icons CDN stylesheet |
| Modify | `webapp/src/App.tsx` | Add `/sandbox` route before the `*` catch-all |
| Modify | `webapp/src/components/WebNavBar.tsx` | Add subtle sandbox nav link between logo and rightContent |
| Modify | `webapp/src/Menucomponents/Home.tsx` | Add 28px footer with "Open Sandbox" link |

---

### Task 1: Tabler Icons CDN + CSS foundation + SandboxMobileGuard

**Files:**
- Modify: `webapp/index.html`
- Create: `webapp/src/pages/SandboxPage.css`
- Create: `webapp/src/components/sandbox/SandboxMobileGuard.tsx`

- [ ] **Step 1.1: Add Tabler Icons webfont to index.html**

Open `webapp/index.html`. In `<head>`, add after the Google Fonts link:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
```

Full `<head>` result:

```html
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/jpeg" href="/logo.png" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Ubuntu&family=Ubuntu+Mono&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
  <title>Health coordinator</title>
</head>
```

- [ ] **Step 1.2: Create SandboxPage.css**

Create `webapp/src/pages/SandboxPage.css`:

```css
/* Sandbox CSS vars — scoped to .sandbox-layout only, no global bleed */
.sandbox-layout {
  --sb-bg-primary:     #0f1117;
  --sb-bg-secondary:   #161b27;
  --sb-bg-tertiary:    #1e2536;
  --sb-border:         rgba(255, 255, 255, 0.08);
  --sb-text-primary:   #e8eaf0;
  --sb-text-secondary: #8b91a8;
  --sb-text-muted:     #4a5068;
  --sb-accent:         #EF9F27;
  --sb-accent-dim:     rgba(239, 159, 39, 0.15);
  --sb-teal:           #1D9E75;
  --sb-blue:           #185FA5;
  --sb-red:            #C0392B;
}

/* Desktop-first defaults */
.sandbox-desktop-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sandbox-mobile-guard {
  display: none;
}

/* Below 1024px: show guard, hide panels */
@media (max-width: 1023px) {
  .sandbox-desktop-layout {
    display: none;
  }

  .sandbox-mobile-guard {
    display: flex;
    flex: 1;
  }
}

/* Amber pulse animation for the facilities-active dot */
@keyframes sb-ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}
```

- [ ] **Step 1.3: Create SandboxMobileGuard.tsx**

Create `webapp/src/components/sandbox/SandboxMobileGuard.tsx`:

```tsx
export function SandboxMobileGuard() {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--sb-bg-primary)",
        padding: 32,
        textAlign: "center",
      }}
    >
      <i
        className="ti ti-device-desktop-off"
        style={{ fontSize: 48, color: "var(--sb-text-muted)", marginBottom: 24, display: "block" }}
      />
      <h2
        style={{
          color: "var(--sb-text-primary)",
          fontSize: 20,
          fontWeight: 500,
          margin: "0 0 12px",
        }}
      >
        Sandbox requires a larger screen
      </h2>
      <p
        style={{
          color: "var(--sb-text-secondary)",
          fontSize: 14,
          lineHeight: 1.6,
          maxWidth: 320,
          margin: "0 0 28px",
        }}
      >
        The simulation control room is optimized for desktop. Open MediCoord on
        a laptop or desktop to access sandbox.
      </p>
      <a
        href="/"
        style={{
          color: "var(--sb-accent)",
          fontSize: 14,
          fontWeight: 500,
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        Return to MediCoord
        <i className="ti ti-arrow-right" style={{ fontSize: 14 }} />
      </a>
    </div>
  )
}
```

---

### Task 2: SandboxPage root + App.tsx route (Commit 1)

**Files:**
- Create: `webapp/src/pages/SandboxPage.tsx`
- Modify: `webapp/src/App.tsx`

- [ ] **Step 2.1: Create SandboxPage.tsx**

Create `webapp/src/pages/SandboxPage.tsx`:

```tsx
import "./SandboxPage.css"
import { useFacilities } from "../hooks/useFacilities"
import { SandboxHeader } from "../components/sandbox/SandboxHeader"
import { SimulationPanel } from "../components/sandbox/SimulationPanel"
import { SandboxMap } from "../components/sandbox/SandboxMap"
import { InspectorPanel } from "../components/sandbox/InspectorPanel"
import { SandboxMobileGuard } from "../components/sandbox/SandboxMobileGuard"

export default function SandboxPage() {
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
      <SandboxHeader />

      <div className="sandbox-mobile-guard">
        <SandboxMobileGuard />
      </div>

      <div className="sandbox-desktop-layout">
        <SimulationPanel />
        <SandboxMap facilities={facilities} facilitiesLoading={facilitiesLoading} />
        <InspectorPanel />
      </div>
    </div>
  )
}
```

- [ ] **Step 2.2: Add /sandbox route to App.tsx**

In `webapp/src/App.tsx`, add the import after line 47 (existing `TestLocationPage` import):

```tsx
import SandboxPage from './pages/SandboxPage'
```

Replace the `<Routes>` block with the version that adds `/sandbox` before the `*` catch-all:

```tsx
<Routes>
  <Route path="/setup" element={<SetupPage />} />
  <Route path="/testlocation" element={<TestLocationPage />} />
  <Route path="/sandbox" element={<SandboxPage />} />
  <Route path="*" element={<AppInner />} />
</Routes>
```

- [ ] **Step 2.3: Type-check**

```bash
cd /home/niki/Documents/saas/medi-sandbox/webapp && npx tsc --noEmit
```

Expected: errors only about the missing sandbox component imports (`SandboxHeader`, `SimulationPanel`, `SandboxMap`, `InspectorPanel` are not yet created). Zero regressions in existing files.

- [ ] **Step 2.4: Commit**

```bash
git add webapp/index.html \
        webapp/src/pages/SandboxPage.css \
        webapp/src/pages/SandboxPage.tsx \
        webapp/src/components/sandbox/SandboxMobileGuard.tsx \
        webapp/src/App.tsx
git commit -m "feat(sandbox-v2): /sandbox route, three-panel shell, mobile guard, CSS vars"
```

---

### Task 3: SandboxHeader

**Files:**
- Create: `webapp/src/components/sandbox/SandboxHeader.tsx`

- [ ] **Step 3.1: Create SandboxHeader.tsx**

`UserMenu` is at `webapp/src/components/auth/UserMenu.tsx` — relative import is `../auth/UserMenu`.

Create `webapp/src/components/sandbox/SandboxHeader.tsx`:

```tsx
import { useNavigate } from "react-router-dom"
import { UserMenu } from "../auth/UserMenu"

export function SandboxHeader() {
  const navigate = useNavigate()

  return (
    <header
      style={{
        height: 52,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "var(--sb-bg-primary)",
        borderBottom: "0.5px solid var(--sb-border)",
      }}
    >
      {/* Brand mark */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <i className="ti ti-flask" style={{ fontSize: 20, color: "var(--sb-accent)" }} />
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--sb-text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          MediCoord
          <span style={{ color: "var(--sb-accent)" }}>AI</span>
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            background: "var(--sb-accent-dim)",
            color: "var(--sb-accent)",
            padding: "2px 7px",
            borderRadius: 4,
            textTransform: "uppercase" as const,
          }}
        >
          SANDBOX
        </span>
      </div>

      {/* Environment switcher + user menu */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <select
          defaultValue="sandbox"
          onChange={e => {
            if (e.target.value === "production") navigate("/")
          }}
          style={{
            background: "var(--sb-bg-tertiary)",
            border: "0.5px solid var(--sb-border)",
            color: "var(--sb-accent)",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="sandbox">⬤ Sandbox Environment</option>
          <option value="production">◯ Production</option>
        </select>
        <UserMenu />
      </div>
    </header>
  )
}
```

> Note: `UserMenu` renders a portal dropdown (`createPortal(..., document.body)`). The dropdown itself is outside `.sandbox-layout`, so it appears in main-app white styling when opened. This is an acceptable visual quirk for this sprint — the spec says to reuse the existing component as-is.

---

### Task 4: SimulationPanel (Commit 2)

**Files:**
- Create: `webapp/src/components/sandbox/SimulationPanel.tsx`

- [ ] **Step 4.1: Create SimulationPanel.tsx**

Create `webapp/src/components/sandbox/SimulationPanel.tsx`:

```tsx
import type { CSSProperties } from "react"

const SECTION_LABEL: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color: "var(--sb-text-muted)",
  margin: "0 0 8px",
}

const DIVIDER: CSSProperties = {
  height: "0.5px",
  background: "var(--sb-border)",
  margin: "16px 0",
}

const STATIC_BTN: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  background: "var(--sb-bg-tertiary)",
  border: "0.5px solid var(--sb-border)",
  borderRadius: 6,
  color: "var(--sb-text-secondary)",
  fontSize: 12,
  padding: "8px 10px",
  cursor: "default",
  opacity: 0.6,
  textAlign: "left" as const,
}

const DARK_SELECT: CSSProperties = {
  width: "100%",
  background: "var(--sb-bg-tertiary)",
  border: "0.5px solid var(--sb-border)",
  borderRadius: 6,
  color: "var(--sb-text-primary)",
  fontSize: 12,
  padding: "7px 10px",
  cursor: "default",
  outline: "none",
}

export function SimulationPanel() {
  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--sb-bg-secondary)",
        borderRight: "0.5px solid var(--sb-border)",
        overflowY: "auto",
        padding: "16px 14px",
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--sb-text-secondary)", margin: "0 0 16px" }}>
        Simulation Configuration
      </p>

      {/* Section 1 — Scenario Templates */}
      <p style={SECTION_LABEL}>Scenario Templates</p>
      <select style={DARK_SELECT}>
        <option>Routine Saturday afternoon</option>
        <option>Friday night ER surge</option>
        <option>Mass casualty event</option>
        <option>Blizzard conditions</option>
      </select>

      <div style={DIVIDER} />

      {/* Section 2 — System Shock Toggles */}
      <p style={SECTION_LABEL}>System Shock Toggles</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* TODO: wire simulation engine */}
        {(["Spawn simulated patient", "Force facility outage", "Restore all facilities"] as const).map(
          label => (
            <button key={label} style={STATIC_BTN}>
              <i className="ti ti-plus" style={{ fontSize: 12, flexShrink: 0 }} />
              {label}
            </button>
          ),
        )}
      </div>

      <div style={DIVIDER} />

      {/* Section 3 — Emergency Load */}
      <p style={SECTION_LABEL}>Emergency Load</p>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "var(--sb-text-secondary)" }}>System capacity</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#E87070" }}>72%</span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: "var(--sb-bg-tertiary)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "72%",
            borderRadius: 4,
            background: "linear-gradient(90deg, #1D9E75 0%, #EF9F27 60%, #C0392B 100%)",
          }}
        />
      </div>

      <div style={DIVIDER} />

      {/* Section 4 — Simulation Controls */}
      <p style={SECTION_LABEL}>Simulation Controls</p>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {(["player-play", "player-pause", "player-stop"] as const).map(icon => (
          <button
            key={icon}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--sb-bg-tertiary)",
              border: "0.5px solid var(--sb-border)",
              borderRadius: 6,
              color: "var(--sb-text-secondary)",
              cursor: "default",
              opacity: 0.6,
              flexShrink: 0,
            }}
          >
            <i className={`ti ti-${icon}`} style={{ fontSize: 14 }} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <select
          style={{
            background: "var(--sb-bg-tertiary)",
            border: "0.5px solid var(--sb-border)",
            borderRadius: 6,
            color: "var(--sb-text-secondary)",
            fontSize: 11,
            padding: "5px 8px",
            cursor: "default",
            outline: "none",
          }}
        >
          <option>1×</option>
          <option>2×</option>
          <option>5×</option>
        </select>
      </div>
    </div>
  )
}
```

- [ ] **Step 4.2: Type-check**

```bash
cd /home/niki/Documents/saas/medi-sandbox/webapp && npx tsc --noEmit
```

Expected: errors only for still-missing `SandboxMap` and `InspectorPanel`. No new errors in header or simulation panel files.

- [ ] **Step 4.3: Commit**

```bash
git add webapp/src/components/sandbox/SandboxHeader.tsx \
        webapp/src/components/sandbox/SimulationPanel.tsx
git commit -m "feat(sandbox-v2): sandbox header, simulation config panel (static)"
```

---

### Task 5: SandboxMap

**Files:**
- Create: `webapp/src/components/sandbox/SandboxMap.tsx`

Markers are rendered directly inside `MapContainer` using a local `getSandboxFacilityIcon` function — no `MapProvider`, no `FacilityMarkerLayer`, no shared icon file changes.

- [ ] **Step 5.1: Create SandboxMap.tsx**

Create `webapp/src/components/sandbox/SandboxMap.tsx`:

```tsx
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useState } from "react"
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet"
import type { Facility } from "@shared/types"
import { cnTowerPos } from "../map/config/constants"
import { cnTowerIcon } from "../map/config/icons"

interface SandboxMapProps {
  facilities: Facility[]
  facilitiesLoading: boolean
}

const DARK_CATEGORY: Record<string, { color: string; letter: string }> = {
  hospital:    { color: "#E87070", letter: "H" },
  ambulatory:  { color: "#4DBFA0", letter: "A" },
  residential: { color: "#85A865", letter: "R" },
}

function getSandboxFacilityIcon(category: string): L.DivIcon {
  const s = DARK_CATEGORY[category] ?? { color: "#888888", letter: "?" }
  const size = 28, svg = 36, text = 12
  return L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${svg}" height="${svg}" viewBox="0 0 ${svg} ${svg}">
      <rect x="4" y="4" width="${size}" height="${size}" rx="${Math.round(size * 0.22)}"
            fill="${s.color}" />
      <text x="${svg / 2}" y="${svg / 2 + text * 0.38}"
            text-anchor="middle"
            font-family="system-ui,-apple-system,sans-serif"
            font-size="${text}" font-weight="700" fill="white">
        ${s.letter}
      </text>
    </svg>`,
    iconSize:    [svg, svg],
    iconAnchor:  [svg / 2, svg / 2],
    popupAnchor: [0, -(svg / 2 + 4)],
  })
}

type CategoryFilter = "all" | "hospital" | "ambulatory" | "residential"

const FILTER_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all",         label: "All types" },
  { value: "hospital",    label: "Hospital" },
  { value: "ambulatory",  label: "Walk-in / Clinic" },
  { value: "residential", label: "Residential Care" },
]

const LEGEND_ITEMS = [
  { color: "#E87070", letter: "H", label: "Hospital" },
  { color: "#4DBFA0", letter: "A", label: "Walk-in / Clinic" },
  { color: "#85A865", letter: "R", label: "Residential Care" },
]

export function SandboxMap({ facilities, facilitiesLoading }: SandboxMapProps) {
  const [filter, setFilter] = useState<CategoryFilter>("all")

  const counts: Record<CategoryFilter, number> = {
    all:         facilities.length,
    hospital:    facilities.filter(f => f.category === "hospital").length,
    ambulatory:  facilities.filter(f => f.category === "ambulatory").length,
    residential: facilities.filter(f => f.category === "residential").length,
  }

  const displayed =
    filter === "all" ? facilities : facilities.filter(f => f.category === filter)

  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      <MapContainer
        center={cnTowerPos}
        zoom={11}
        scrollWheelZoom={false}
        zoomControl={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          tileSize={512}
          zoomOffset={-1}
          detectRetina={true}
        />
        <Marker position={cnTowerPos} icon={cnTowerIcon}>
          <Tooltip className="text-[13px] font-semibold" direction="top">
            CN Tower Area
          </Tooltip>
        </Marker>
        {displayed.map(facility => (
          <Marker
            key={facility.id ?? facility.name}
            position={[facility.lat, facility.lng]}
            icon={getSandboxFacilityIcon(facility.category)}
          />
        ))}
      </MapContainer>

      {/* Loading spinner */}
      {facilitiesLoading && (
        <div
          style={{
            position: "absolute",
            top: 52,
            left: 12,
            zIndex: 15,
            background: "rgba(15,17,23,0.88)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            color: "var(--sb-text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              border: "2px solid var(--sb-accent)",
              borderTopColor: "transparent",
              display: "inline-block",
              animation: "spin 0.8s linear infinite",
            }}
          />
          Loading facilities…
        </div>
      )}

      {/* Top-right overlay: filter dropdown + active count */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as CategoryFilter)}
          style={{
            background: "rgba(15,17,23,0.88)",
            backdropFilter: "blur(4px)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            color: "#e8eaf0",
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 14px",
            cursor: "pointer",
            outline: "none",
          }}
        >
          {FILTER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label} ({counts[opt.value]})
            </option>
          ))}
        </select>

        <div
          style={{
            background: "rgba(15,17,23,0.88)",
            backdropFilter: "blur(4px)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: "#e8eaf0",
            display: "flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "var(--sb-accent)",
                opacity: 0.5,
                animation: "sb-ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
              }}
            />
            <span
              style={{
                position: "relative",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--sb-accent)",
              }}
            />
          </span>
          {facilitiesLoading ? "—" : displayed.length} FACILITIES ACTIVE
        </div>
      </div>

      {/* Bottom-left legend */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 12,
          zIndex: 20,
          background: "rgba(15,17,23,0.88)",
          backdropFilter: "blur(4px)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          padding: "8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {LEGEND_ITEMS.map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                background: item.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 700,
                color: "white",
                flexShrink: 0,
              }}
            >
              {item.letter}
            </div>
            <span style={{ fontSize: 11, color: "#8b91a8" }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* SANDBOX watermark */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: 80,
          fontWeight: 700,
          letterSpacing: "0.3em",
          color: "rgba(239,159,39,0.06)",
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
          zIndex: 400,
        }}
      >
        SANDBOX
      </div>
    </div>
  )
}
```

> Note: The `sb-ping` animation is defined in `SandboxPage.css` (added in Task 1). The `spin` animation is already defined in `webapp/src/index.css` and is globally available.

---

### Task 6: InspectorPanel (Commit 3)

**Files:**
- Create: `webapp/src/components/sandbox/InspectorPanel.tsx`

- [ ] **Step 6.1: Create InspectorPanel.tsx**

Create `webapp/src/components/sandbox/InspectorPanel.tsx`:

```tsx
import { useState } from "react"

const MOCK_CHAT = [
  {
    role: "user",
    content: "I have a fever of 38.9°C and a sore throat since this morning.",
  },
  {
    role: "assistant",
    content:
      "Based on your symptoms, I'm classifying this as moderate severity. I've located Richview Community Care (4 min away) as the best match for walk-in care.",
  },
  {
    role: "user",
    content: "What should I bring with me?",
  },
  {
    role: "assistant",
    content:
      "Bring your health card (OHIP), a list of any current medications, and a mask. Walk-in wait time is approximately 25 minutes.",
  },
] as const

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
] as const

const LOG_COLORS: Record<string, string> = {
  INFO:      "#185FA5",
  ALGORITHM: "#1D9E75",
  SUCCESS:   "#1D9E75",
  ERROR:     "#C0392B",
}

function MockChatTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Sub-header */}
      <div
        style={{
          padding: "8px 14px",
          borderBottom: "0.5px solid var(--sb-border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--sb-text-secondary)",
            textTransform: "uppercase",
          }}
        >
          AI Preview Assistant
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            background: "var(--sb-accent-dim)",
            color: "var(--sb-accent)",
            padding: "2px 6px",
            borderRadius: 4,
            letterSpacing: "0.06em",
          }}
        >
          MOCK
        </span>
      </div>

      {/* Hardcoded messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {MOCK_CHAT.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "82%",
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 12,
                lineHeight: 1.5,
                background:
                  msg.role === "user" ? "var(--sb-accent)" : "var(--sb-bg-tertiary)",
                color:
                  msg.role === "user" ? "#0f1117" : "var(--sb-text-primary)",
                borderBottomRightRadius: msg.role === "user" ? 4 : 12,
                borderBottomLeftRadius: msg.role === "assistant" ? 4 : 12,
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Disabled input */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "0.5px solid var(--sb-border)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "var(--sb-bg-tertiary)",
            border: "0.5px solid var(--sb-border)",
            borderRadius: 8,
            padding: "8px 10px",
            gap: 8,
            opacity: 0.45,
            cursor: "not-allowed",
          }}
        >
          <span style={{ flex: 1, fontSize: 12, color: "var(--sb-text-muted)" }}>
            AI assistant (preview only)
          </span>
          <i className="ti ti-send" style={{ fontSize: 14, color: "var(--sb-text-muted)" }} />
        </div>
      </div>
    </div>
  )
}

function LogsTab() {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "10px 0",
        fontFamily: "'Ubuntu Mono', monospace",
      }}
    >
      {STATIC_LOGS.map((entry, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "4px 14px",
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          <span style={{ color: "var(--sb-text-muted)", flexShrink: 0 }}>
            {entry.time}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.06em",
              padding: "2px 5px",
              borderRadius: 3,
              background: (LOG_COLORS[entry.type] ?? "#888") + "22",
              color: LOG_COLORS[entry.type] ?? "#888",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            {entry.type}
          </span>
          <span style={{ color: "var(--sb-text-secondary)" }}>{entry.msg}</span>
        </div>
      ))}
    </div>
  )
}

export function InspectorPanel() {
  const [tab, setTab] = useState<"chat" | "logs">("chat")

  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--sb-bg-secondary)",
        borderLeft: "0.5px solid var(--sb-border)",
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "0.5px solid var(--sb-border)",
          flexShrink: 0,
        }}
      >
        {(["chat", "logs"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              height: 40,
              background: "none",
              border: "none",
              borderBottom:
                tab === t ? "2px solid var(--sb-accent)" : "2px solid transparent",
              color:
                tab === t ? "var(--sb-text-primary)" : "var(--sb-text-muted)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "color 0.15s",
            }}
          >
            {t === "chat" ? "AI Preview Assistant" : "Live System Logs"}
          </button>
        ))}
      </div>

      {tab === "chat" ? <MockChatTab /> : <LogsTab />}
    </div>
  )
}
```

- [ ] **Step 6.2: Type-check**

```bash
cd /home/niki/Documents/saas/medi-sandbox/webapp && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6.3: Commit**

```bash
git add webapp/src/components/sandbox/SandboxMap.tsx \
        webapp/src/components/sandbox/InspectorPanel.tsx
git commit -m "feat(sandbox-v2): dark CartoDB map with sandbox markers, inspector panel"
```

---

### Task 7: Main app nav link + footer (Commit 4)

**Files:**
- Modify: `webapp/src/components/WebNavBar.tsx`
- Modify: `webapp/src/Menucomponents/Home.tsx`

- [ ] **Step 7.1: Update WebNavBar.tsx**

Replace the full contents of `webapp/src/components/WebNavBar.tsx` with this version that adds a `<nav>` element between the logo link and the `rightContent` div:

```tsx
import { Link } from 'react-router-dom'

interface WebNavBarProps {
  rightContent?: React.ReactNode
}

export function WebNavBar({ rightContent }: WebNavBarProps) {
  return (
    <header
      className="flex-none flex items-center justify-between px-8 bg-white border-b border-gray-200 shadow-sm z-10"
      style={{ height: 64 }}
    >
      <Link to="/" className="flex items-center gap-3 no-underline">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl flex-none overflow-hidden shadow-md">
          <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
        </div>
        <div className="leading-tight flex flex-col">
          <span className="text-lg font-bold text-gray-900 tracking-tight">
            MediCoord<span className="text-blue-600">AI</span>
          </span>
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Health Tech Platform
          </span>
        </div>
      </Link>

      <nav>
        <Link
          to="/sandbox"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "#9ca3af",
            textDecoration: "none",
            padding: "4px 8px",
            border: "0.5px solid #e5e7eb",
            borderRadius: 6,
          }}
        >
          <i className="ti ti-flask" style={{ fontSize: 13 }} aria-hidden="true" />
          Sandbox
        </Link>
      </nav>

      {rightContent && (
        <div className="flex items-center gap-4">{rightContent}</div>
      )}
    </header>
  )
}
```

- [ ] **Step 7.2: Update Home.tsx — add Link import and footer**

In `webapp/src/Menucomponents/Home.tsx`, add the `Link` import (after existing imports):

```tsx
import { Link } from 'react-router-dom'
```

Then in the JSX `return`, insert a `<footer>` element between the closing `</div>` of the body section and the closing `</div>` of the root:

The full updated `return` block:

```tsx
  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} defaultTab={modalTab} />
      {user && profile && !profile.getting_started_done && !onboardingDismissed && (
        <GettingStartedModal
          onComplete={handleOnboardingComplete}
          onClose={() => setOnboardingDismissed(true)}
          geo={geo}
        />
      )}

      {/* Header */}
      <WebNavBar
        rightContent={user ? (
          <UserMenu />
        ) : (
          <>
            <button
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              onClick={openSignIn}
            >
              Sign in
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 transition-all active:scale-95"
              onClick={openSignUp}
            >
              Get started
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
      />

      {/* Body — 70/30 split */}
      <div className="flex flex-1 overflow-hidden p-5 gap-5">
        {/* Map panel */}
        <div className="flex-[7] overflow-hidden rounded-2xl shadow-sm border border-gray-200 bg-white relative">
          <MapPanel
            facilities={facilities}
            facilitiesLoading={facilitiesLoading}
            triage={triage}
            onClear={handleNewConversation}
          />
        </div>

        {/* Chat panel */}
        <div className="flex-[3] overflow-hidden rounded-2xl shadow-sm border border-gray-200 bg-white relative min-w-[320px]">
          <ChatPanel
            key={sessionKey}
            user={user}
            cache={conversationsCache}
            sendMessage={sendMessage}
            createSession={createSession}
            loadOlderMessages={loadOlderMessages}
            geo={geo}
            profile={profile}
            triage={triage}
            onTriageResult={applyTriageResult}
            onNewConversation={handleNewConversation}
          />
        </div>
      </div>

      {/* Footer */}
      <footer
        style={{
          flexShrink: 0,
          borderTop: "0.5px solid #e5e7eb",
          padding: "0 20px",
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#9ca3af",
          background: "white",
        }}
      >
        <span>MediCoord AI · Health Tech Platform</span>
        <Link
          to="/sandbox"
          style={{
            color: "#9ca3af",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <i className="ti ti-flask" style={{ fontSize: 12 }} aria-hidden="true" />
          Open Sandbox
        </Link>
      </footer>
    </div>
  )
```

- [ ] **Step 7.3: Final type-check**

```bash
cd /home/niki/Documents/saas/medi-sandbox/webapp && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7.4: Commit**

```bash
git add webapp/src/components/WebNavBar.tsx \
        webapp/src/Menucomponents/Home.tsx
git commit -m "feat(sandbox-v2): sandbox link in main app header and footer"
```

---

## Verification Checklist

Run from `webapp/` after all 4 commits. Start dev server with `npm run dev` and open `http://localhost:5173/sandbox`.

- [ ] `/sandbox` renders without console errors
- [ ] Page background is `#0f1117` — dark, immediately distinct from main app
- [ ] SandboxHeader: flask icon, "MediCoordAI" + "SANDBOX" badge, env switcher, UserMenu all present at 52px height
- [ ] Three panels visible and proportioned (240px left / flex-1 center / 340px right)
- [ ] Left panel: scenario dropdown, 3 toggle buttons with `+` icons, 72% amber-to-red progress bar, play/pause/stop + speed select
- [ ] Center panel: CartoDB DarkMatter tiles load (dark background), 393 facility markers render with lighter colors (H=#E87070, A=#4DBFA0, R=#85A865)
- [ ] "SANDBOX" watermark barely visible, centered on map
- [ ] Top-right overlay: dark filter dropdown + amber-dot "N FACILITIES ACTIVE" pill; filter changes which markers are shown
- [ ] Bottom-left legend: dark frosted card with H/A/R items
- [ ] Right panel: tab bar switches between AI Preview and Live System Logs
- [ ] AI Preview tab: "MOCK" badge, 4 hardcoded messages, disabled input visible
- [ ] Live System Logs tab: 10 monospace log entries with colored type badges (INFO/ALGORITHM/SUCCESS)
- [ ] Environment switcher → "Production" navigates to `/`
- [ ] Resize browser to < 1024px: mobile guard shown, three panels hidden
- [ ] Navigate to `/` (main app): sandbox CSS vars not applied (DevTools → no `--sb-*` vars on body)
- [ ] Main app header shows "Sandbox" nav link (flask icon, subtle border, muted grey)
- [ ] Main app footer (28px) shows "Open Sandbox" with flask icon; clicking navigates to `/sandbox`
- [ ] `npx tsc --noEmit` exits with code 0
