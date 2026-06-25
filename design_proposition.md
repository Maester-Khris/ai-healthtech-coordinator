# Design Proposition: Main App & Sandbox UI/UX Redesign Specification

This document details the UI/UX design specifications for the **Main Command Center (`/app`)** and the **Sandbox Simulator Dashboard (`/sandbox`)**. It builds directly upon the foundational design tokens, color systems, and aesthetics outlined in [design_document.md](file:///home/niki/Documents/saas/medicoordai/design_document.md), extending it to complete the reskinning and behavioral updates of the entire MediCoord AI platform.

---

## 1. Main Command Center (`/app`) UI Redesign

The main application UI represents the primary interface for users describing symptoms, viewing clinical triage recommendations, and coordinating multi-modal transit to facilities.

### A. Layout Architectures (Desktop & Mobile)

#### 1. Desktop Viewport Layout (min-width: 1024px)
- **Unified 40/60 Split Pane:**
  - **Left Sidebar Workspace (40% width):** Serves as the primary control center containing the chat console, parsing indicators, and facility routing cards.
  - **Right Interactive Map (60% width):** Displays the full-height desaturated city canvas containing routing lines and pulsating pins.
- **Glassmorphic Overlays on Map:**
  - **Top Floating Pill Box:** Houses quick facility status filters (ER availability, PCR labs, Urgent Care wait times).
  - **Bottom Left System Badge:** Displays real-time GPS precision data and satellite connection state (`font-mono text-[9px]`).

#### 2. Mobile Viewport Layout (max-width: 1023px)
- **Back-Layer Backdrop Map:** The desaturated Leaflet map occupies the full viewport background (`h-[100dvh]`).
- **Spring-Animated Bottom Sheet:** A sliding glassmorphic sheet floats above the map to organize the chat flow:
  - **Collapsed State (height: ~140px):** Shows the *Agentic Omni-Input Box* and the current ETA status banner.
  - **Expanded State (height: ~85%):** Displays the full message history, triage severity details, and transit selectors.
- **Docked Quick Actions:** A floating drawer handles quick swaps between Map layers and AI chat threads using oversized touch zones (min `48px`).

---

### B. Presentation & Ergonomic Guidelines

#### 1. Material Specs & Glassmorphism
- All panels and cards utilize a high-end frosted glass layout to stand out cleanly against the desaturated map canvas:
  ```css
  background: rgba(10, 29, 39, 0.82);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(28, 70, 89, 0.55);
  box-shadow: 0 20px 40px -15px rgba(3, 10, 14, 0.7);
  ```

#### 2. Visual Hierarchy & Status Indications
- **Triage Severity Cards:** Triage cards adapt ESI colors to draw attention:
  - **ESI 1-2 (Emergent):** Border `#FF7B93` with `#FF7B93`/10 background glow.
  - **ESI 3 (Urgent):** Border `#F59E0B` with `#F59E0B`/10 background glow.
  - **ESI 4-5 (Non-Urgent):** Border `#00D2FF` with `#00D2FF`/10 background glow.
- **Multi-Modal Transit Cards:** Transit mode cards display travel duration, distance, and routes with high-contrast Phosphor icons (Car, Bike, User).

---

### C. Modern Agentic UI Flow

#### 1. "Glass-Box" Streaming Parser Logs
- To build patient trust, the AI does not just hide behind a spinner. An active parser log sits above the chat input, showing real-time token extractions in a monospaced readout:
  ```
  [PARSE] Symptom Match: "Shortness of breath" => ESI Level 1
  [ROUTE] Location Sync: Lat 43.6532, Lng -79.3832
  [CAPAC] Querying General Hospital ICU beds... OK (4 available)
  ```
- Parse status indicators flash and stream active parameters during matching.

#### 2. Proactive Emergency Escalations
- If the agent detects symptoms matching high-urgency conditions (ESI 1-2), a persistent **Emergency Overlay Banner** (`bg-[#FF7B93]/20 border-[#FF7B93]`) overrides standard triage recommendations:
  - Offers a single-click button to call emergency services.
  - Automatically loads driving directions to the closest emergency room without waiting for further user input.

#### 3. Interactive Route Checkpoints
- Users can click any routing waypoint directly on the map. The map triggers an inline agent event to recalculate transit times for alternative routes, feeding the updated ETA back to the chat log as an automated message.

---

## 2. Sandbox Simulator Dashboard (`/sandbox`) UI Redesign

The Sandbox serves as the administrative testing environment to simulate city-wide emergency loads, traffic congestion, and infrastructure stress-testing.

### A. Layout Architectures (Desktop & Mobile)

#### 1. Desktop Viewport Layout (min-width: 1024px)
- **Three-Pane Command Control:**
  - **Left Pane (25% width):** *Simulation Setup Panel*. Contains dials and controls for toggling weather conditions, emergency severity loads, and active traffic bottlenecks.
  - **Center Pane (50% width):** *OSRM Simulation Map*. Shows a full-viewport map indicating active routes, dispatch coordinates, and facility capacity heatmaps.
  - **Right Pane (25% width):** *Agent System Inspector*. Houses real-time JSON inspector parameters, system latency telemetry, and database write events.

#### 2. Mobile Viewport Layout (max-width: 1023px)
- Replacing the simple mobile guard blocking access, a **Mobile Monitoring HUD** organizes elements vertically:
  - Top 35% height holds a desaturated read-only Leaflet map with active route flows.
  - Middle 35% displays real-time dispatch statistics (active cases, queue levels).
  - Bottom 30% contains a scrollable stream of system agent logs.

---

### B. Presentation & Ergonomic Guidelines

#### 1. Dark Ops Simulation Theme
- The background color remains deep slate `#061219` but is offset with vibrant **Amber Yellow (`#F59E0B`)** accents and borders to emphasize a developer/testing console environment.
- Heatmaps use gradient ramps from cyan (`#00D2FF`) to urgent crimson (`#FF7B93`) to indicate facility capacity overload.

#### 2. Telemetry Cards & Dials
- Telemetry modules are styled as dark instrumental gauges with monospaced readouts, utilizing circular SVG indicators for active loads:
  ```css
  font-family: var(--font-mono);
  color: var(--color-accent-mint); /* `#48F6C1` */
  border: 1px solid rgba(245, 158, 11, 0.2);
  ```

---

### C. Modern Agentic UI Flow

#### 1. Active Simulation Shock Controls
- Interactive dials let administrators inject "system shocks" (e.g., severe storm, multi-vehicle highway crash, server database failure):
  - Recalculations are rendered live on the OSRM map using kinetic route dash movements.
  - The System Inspector console flashes warning states, outputting triage updates from the agent parser.

#### 2. Historic Timeline Rewind & Inspect
- A persistent scrubbing timeline bar sits at the bottom of the Sandbox screen. Developers can click or drag to previous simulation ticks, instantly updating the map routes, facility capacity levels, and inspector logs to match that historic state.

#### 3. Interactive JSON Parser Panel
- Clickable JSON payload inspector tabs allow developers to view raw API parameters sent to/from the AI models at each step of the dispatch process, complete with code formatting and quick-copy anchors.
