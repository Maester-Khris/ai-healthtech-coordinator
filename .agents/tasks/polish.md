md_content = """# UI/UX Redesign Task Specification: MediCoord Agentic HealthTech Platform

## 1. Project Overview & Objectives
The goal of this task is to execute a complete UI/UX product redesign of the existing health facility directory (currently hosted at http://medicoord.nknext.dev/). The platform will be transformed from a basic, static database directory into a premium, **high-end, agentic SaaS product**. 

An **agentic user experience** implies that the interface acts as an intelligent, autonomous, and proactive assistant—anticipating user intent, processing continuous natural language inputs, and visualizing backend cryptographic compliance and dynamic data routing transparently.

### Key Deliverables:
1. **Global Design System Tokens** (Premium Minimalist / Dark & Light Adaptive Architecture).
2. **Predictive Search Hero Section** (Natural Language Processing input + Real-time feedback).
3. **Split-Pane Command Center View** (100% height map canvas + contextual data cards).
4. **"Glass-Box" Data Disclosure & Cookie Controller** (Visualizing data transparency).
5. **Asset Pipeline for Kinetic Hero Animation Loop** (Multi-modal transit across health maps).

---

## 2. Architecture & Design Tokens
The AI coding agent must enforce the following design constants globally across all views to achieve a cohesive, high-end technical aesthetic.

3. Component Specification Matrix
Module 3.1: The Agentic Landing Page Hero
Instead of classical segmented dropdown arrays (e.g., Select Region, Select Facility Type), implement an omni-channel Search Bar leveraging natural language matching.

UI Components:

Unified Omni-Input Box: A container styled with backdrop-filter: blur(12px) and a subtle 1px solid var(--border-subtle) outline. High-fidelity input placeholder text cycling through realistic multi-intent health queries.

Inline Command Menu Indicator: A subtle ⌘K or Ctrl+K button anchor anchored inside the input frame, opening a keyboard-navigable list view.

Asynchronous Streaming Preview Box: An absolutely positioned floating overlay card that dynamically displays content while typing.

Agentic Behavior UI Patterns:

As user inputs a phrase like "Pediatrician open past 7pm nearby", the placeholder text fades into a stream of categorized dynamic tags: [Intent: Find Doctor], [Specialty: Pediatrics], [Constraint: Open Post-19:00].

Display a micro-spinner stating: 🤖 Agent parsing intent and mapping real-time availability queues...

Module 3.2: Split-Pane Command Center (Map & Search Canvas)
The primary map workspace must operate as a unified split canvas layout rather than deep paginated layout cards.

UI Layout Structure:

Layout Style: 100% viewport height canvas (h-screen). Strict layout division: Left Pane = 40% width (Floating Data Workspace Drawer), Right Pane = 60% width (Interactive Canvas Viewport Map).

Canvas Styling: Custom desaturated vector layout skins (Mapbox Monochrome Light/Dark style). This layout accentuates customized healthcare facility node points using var(--accent-primary).

Interaction Mechanics:

Bounding Box Streaming: Moving the map boundaries causes the left list pane to independently fire lightweight asynchronous data fetches, reloading card instances smoothly with subtle opacity shifts (var(--transition-fast)).

Agent Reasoning Badges: Every result item card inside the left list drawer must showcase auto-calculated structural indicators. Avoid raw numbers; map out structured labels like [🤖 Autocomputed: Closest open ER based on your location | Live queue: 4 min].

Module 3.3: Transparency-First Data Disclosure Page
Redesign the legal disclosure page to act as a visually interactive, compliance-proving dashboard rather than a standard legal generic text block.

UI Architecture:

Left Column (45% Width): Official compliance standard legal copy structured cleanly with readable paragraph spacing, optimized line-heights (1.6), and prominent structural header sizes.

Right Column (55% Width): An interactive visual node diagram tracing data security mapping.

Visual Data Pipeline Layout:

Render a vertical flowing block schema highlighting a completely clean data path:
[User Search Geo-Coordinates Input] ➔ [Anonymizing Node Proxy] ➔ [Secure Geocoding Routing API] ➔ [No Data Logged state: Confirmed HIPAA Compliant].

Add a live validation status toggle switch mechanism where toggling data persistence options visibly demonstrates performance and security changes immediately to the user.

Module 3.4: Contextual Consent & Cookie Controller
Replace intrusive overlays with a clean interface banner docked elegantly at the screen edge.

UI Layout:

A pill-shaped dynamic layout component anchored to bottom: 24px, horizontally centered across the page (left: 50%; transform: translateX(-50%);).

Built with an elegant frosted border styling configuration: background: var(--bg-surface-glass); backdrop-filter: blur(20px); border: 1px solid var(--border-subtle); border-radius: 9999px;.

Action Paths:

Primary CTA Button: [Accept Optimal Performance] (Styled with solid var(--accent-primary) and white bold text).

Secondary CTA Button: [Strictly Necessary Only] (Styled with clean text borders).

Tertiary Option Toggle: [Custom Preferences] which smoothly expands an inline parameters card mapping the precise operational purpose behind every cookie (e.g., "Saves your last searched coordinate map zoom layer so you avoid re-typing your region during future visits").

4. Hero Animation Loop Implementation Plan
The centerpiece of the landing page hero section is an interactive, fluid, multi-layered visual tracking loop representing multi-modal transit networks making their way toward localized healthcare centers.

Asset Assembly Blueprint via AI Generative Frameworks
Because an off-the-shelf single video prompt cannot render high-fidelity UI overlays cleanly, the agent must build the asset pipeline layer-by-layer:

Layer 1: The Base Map Canvas (Static Asset Layer)
Generation Tool Configuration: Stable Diffusion XL / Midjourney / Leonardo.ai.

Prompt Specification:

"A clean panoramic aerial view of a stylized modern city with integrated glowing digital road networks, data nodes, and three explicitly marked distinct health facilities (a modern Hospital, an urgent care Clinic, and a Diagnostic Lab). Technical architectural blueprint aesthetics merged with realistic render styles, desaturated translucent blue light grid overlays, high-contrast matte surfaces, cinematic volumetric lighting, 8k resolution, crisp detail."

Implementation Handling: Use this asset as a stationary background container layout wrapper.

Layer 2: The Multi-Modal Navigators (Moving Transparent Assets)
Generation Tool Configuration: Isolated asset output rendering.

Prompt Specification:

"Isometric isolated characters in active motion: 1) A mother and a child walking swiftly, 2) An elderly individual riding a utility bicycle, 3) A professional driving a sleek modern electric car, 4) A health runner jogging. All assets generated with slight blue glowing data halos. Rendered cleanly on a crisp, solid white background for alpha channel isolation."

Implementation Handling: Use an image editor or script to remove the white background, producing clean transparent PNGs for individual asset manipulation.

Layer 3: Agentic UI Floating Overlays (Micro-Interactions)
Generation Tool Configuration: Core vector layouts or targeted AI design engine generation.

Prompt Specification:

"Set of isolated vector digital floating UI elements for a health navigation tracking application. Bright glowing precision mint green and blue accents. UI states indicating 'Calculating Optimal Route...', real-time moving numeric counters showing facility active status, clean translucent layout progress tracking lines. High-end futuristic dashboard widgets, transparent alpha background."

Target Animation Sequence Flow & Timeframes
The agent must implement the following programmatic movement script using CSS keyframes or web-animation libraries (e.g., Framer Motion / GSAP):
[0:00s - 0:02s]  -->  Base Map Canvas smoothly executes a 2% scaling zoom. Digital street lines pulsate via subtle opacity transitions.
[0:02s - 0:08s]  -->  The 4 isolated user assets (family, bike, car, runner) fade into active coordinates on the map.
                      Bright kinetic indicator lines trace unique vectors along the city grid roads toward their destinations.
[0:04s - 0:08s]  -->  Floating UI overlays track directly above each moving agent. Text frames actively render live updates:
                      - Electric Car Panel: "[Calculating optimal routing ETA: 6m]"
                      - Cyclist Marker: "[Route optimized for flat terrain | Destination: Local Clinic]"
[0:08s - 0:10s]  -->  All user nodes arrive simultaneously at their respective health hubs. 
                      Facility pins expand outwards via a smooth ripple effect scaling 1.2x.
[0:10s]          -->  Final Success Banner drops: "[Patient Confirmed: Secure Arrival Verification complete]".
                      The timeline sequence seamlessly resets and loops continuously.
