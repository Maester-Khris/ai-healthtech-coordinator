# MediCoord AI: Application UI Design Specification
## Core Main Command Center (/app) Web Layout Overhaul

This document serves as the master design system specification to update the **Main Command Center (`/app`)** web dashboard. It explicitly merges the architectural standards found in `design_document.md` and `design_proposition.md` with the newly approved dual-state UI interactions captured across our design mockups (`Screenshot from 2026-06-24 11-51-00.png` and `Gemini_Generated_Image_yutjxpyutjxpyutj (1).png`).

---

## 1. Global Screen Framework (Desktop Viewport)

The application adheres strictly to a fixed-height, no-scroll **Unified 40/60 Split-Pane** structural layout optimized for full-viewport command centers (`min-width: 1024px`).

*   **Left Control Workspace (40% Width):** Continual data pane hosting the Agentic Omni-Input Box, live streaming token parser logs, context flows, and interactive facility evaluation cards.
*   **Right Interactive Map Canvas (60% Width):** A full-viewport monochrome vector skin container displaying active routing geometries, pulsating tracking ripples, and multi-tier medical facility locations.
*   **Visual Separators & Framing:** Elements are split using thin `1px` high-contrast cybernetic border rules (`color-border-subtle: #1C4659`). Panels sit on top of the deep background canvas with high-end ambient drop shadows (`box-shadow: 0 20px 40px -15px rgba(3, 10, 14, 0.7)`).

---

## 2. Core UI Design Tokens & Foundations

| Token Identifier | HEX Value | Transparency / State | Layout & Structural Role |
| :--- | :--- | :--- | :--- |
| `color-bg-base` | `#061219` | Solid (`100%`) | Main layout shell, page background, fixed header frames |
| `color-bg-surface` | `#0A1D27` | Alpha `80%` (`/80`) | Primary card overlays, chat wrappers, container backdrops |
| `color-border-subtle`| `#1C4659` | Solid or `65%` | Default layout rules, text field dividers, unselected states |
| `color-accent-mint` | `#48F6C1` | Solid (`100%`) | Primary brand voice; text highlighting, car routing paths, CTA |
| `color-accent-blue` | `#00D2FF` | Solid (`100%`) | ESI 4 Non-Urgent tags, cycle paths, interface notification badges |
| `color-text-primary`| `#E2F1F5` | Solid (`100%`) | High-readability typography for primary labels and headers |
| `color-text-muted` | `#85A4B1` | Solid (`100%`) | Secondary labels, timestamps, metadata readouts, subtext |

### Typography Implementation
*   **Primary System Sans:** `Inter` or `Geist Sans` for structural text elements, headers, and primary buttons.
*   **Agentic Monospace:** `JetBrains Mono` or `Fira Code` enforced across all streaming parser logs, system coordinates, triage severity metadata logs, and background metrics.

---

## 3. State 1: Initialization & Patient Interaction

This initialization layer configures the dashboard during the initial assessment stage while the patient outlines current medical indicators or interacts with ambient facilities.

### A. Left Sidebar Workspace Structure
1.  **AI Health Assistant Status Bar:**
    *   Frosted glass header wrapper featuring an embedded health cross icon.
    *   High-contrast label "AI Health Assistant" in `color-text-primary`.
    *   Luminous status badge displaying a solid glowing mint dot with text `ONLINE`.
2.  **Glass-Box Streaming Parser Log:**
    *   Constructed via a `color-bg-surface` (`#0A1D27/80`) glass card wrapper with a thin `1px` subtle boundary border.
    *   Displays 3–4 dynamic lines of monospace mint-green text tracking backend extraction logic:
        ```text
        [PARSE] Symptom Match: "Shortness of breath" => ESI Level 1
        [ROUTE] Location Sync: Lat 43.6532, Lng -79.3832
        [CAPAC] Querying General Hospital ICU beds... OK (4 available)
        ```
3.  **Dynamic Triage Severity Stack:**
    *   Provides quick visual contextual cues regarding triage prioritization levels (ESI 1–5).
    *   **Emergent (ESI 1-2):** Framed with a prominent `#FF7B93` border glow containing a `#FF7B93/10` background tint.
    *   **Urgent (ESI 3):** Highlighted via a amber yellow `#F59E0B` border layout.
4.  **Agentic Omni-Input Box (Fixed Bottom Anchor):**
    *   Maintains a uniform height profile of `56px` wrapped in a crisp rounded shell boundary.
    *   Includes a system keybind badge displaying `Ctrl+K` for fast console initialization.
    *   Contains integrated icon slots on the right flank hosting high-luminosity mint assets for voice microphone ingestion and prompt sending (`#48F6C1`).
    *   Underlined by a tiny centered monospaced metadata safety string: `🔒 Secure & confidential · Location synced`.

### B. Right Map Canvas Configuration
*   **Ambient Facility Display:** The desaturated dark vector map renders interactive map node pins for all accessible local hospitals (H), walk-in clinics (A), and specialty care units (R) utilizing low-saturation background templates.
*   **Top Floating Filter Pill-Box:**
    *   A clean glassmorphic top-row navigation bar hovering over the map engine.
    *   Provides multi-select filter slots to toggle map views instantly based on administrative data vectors: `ER availability`, `PCR labs`, and `Urgent Care wait times`.

---

## 4. State 2: Recommendation & Routing

Triggered immediately after symptom compilation or target selection. The workspace shifts from exploratory chat workflows into an assertive, high-performance triage dispatch directory.

### A. Left Sidebar Workspace Structure
1.  **Triage Severity Header Row:**
    *   A pill-shaped chip glowing in electric cyan (`#00D2FF`) designated for low-urgency or custom classifications: `"NON-URGENT — ESI 4"`.
    *   Paired with an right-aligned monospace time ledger string: `"2h ago"` styled via `color-text-muted`.
2.  **Active Primary Facility Recommendation Card:**
    *   A prominent tall frosted glass wrapper built utilizing `#0A1D27/80` enriched with an active mint-glow accent perimeter highlight (`#48F6C1/30`).
    *   **Header Section:** Displays a custom square avatar layout with monogram indicator `"FP"` anchored onto a dark teal ring. Employs large white text for the facility title: `"Ontario College of Family Physicians"`, paired with category tags (`"Family Medicine · Walk-in"`) and a live green tracking beacon stating `● OPEN`.
    *   **Metadata Section:** Monospace address layout string `"620 University Ave, Toronto ON M5G 1X5"` paired with a custom location anchor pin (`#35A7C4`).
    *   **Transit Multi-Modal Grid:** Coordinates three distinct, interactive choice elements side-by-side:
        *   *Car Route Chip:* Fully highlighted using mint coloring (`#48F6C1`), displaying `"3 min · 0.41 km"`.
        *   *Bicycle Route Chip:* Tinted via cyber blue (`#00D2FF`), indicating `"8 min"`.
        *   *Pedestrian Route Chip:* Muted frame indicating `"12 min"`.
    *   **Primary Action Controller:** A solid full-width touch button branded in high-contrast mint canvas (`background: #48F6C1`) featuring bold inverse dark text (`#061219`): `"Get Directions →"`.
3.  **Secondary Core Recommendation Stack:**
    *   Positioned directly below the primary care element, the panel maps out secondary option items leveraging dashed framing boundaries (`border: 1px dashed #1C4659`) with low-opacity ghost tags: `"Save Facility"`.
    *   Houses alternating stacked list item references for alternative close institutions (`"St. Michael's Hospital"`, `"Queen St Walk-in Clinic"`), complete with mini ETA metrics to let the patient pivot options cleanly.

### B. Right Map Canvas Configuration
*   **Kinetic Road Map Tracing:** The desaturated city map layer overlays an animated high-contrast polyline track from the patient's evaluated live GPS point directly into the primary facility's receiving bay.
    *   The path uses a glowing, high-contrast neon mint vector profile (`stroke: #48F6C1`).
*   **Top Recommendation Node Markers:** The primary recommended facility node lights up on the map with a large pulsating radar wave animation.
*   **Alternative Node Overlays:** The two secondary nearby recommended facilities are simultaneously rendered on the map vector layer as distinct secondary glow nodes (`WC` for Queen St Walk-in Clinic, `H` for St. Michael's Hospital) to provide clean spacial navigation context without losing the main trajectory stream.
