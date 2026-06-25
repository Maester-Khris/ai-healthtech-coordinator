# MediCoord AI: Mobile UI Design Specification
## Main Command Center (`/app`) — Mobile Layout (max-width: 1023px)

This document is the single source of truth for implementing the mobile layout of the MediCoord AI main application. It is derived directly from the Stitch-generated mobile mockups and must be read **in conjunction with `design_document.md`** (global tokens, glassmorphism rules, typography scale) and **`design_document_app.md`** (state machine, component semantics). Token values are not re-declared here — treat those documents as upstream dependencies.

---

## 1. Layout Architecture

The mobile layout is a **full-viewport map shell** with two overlaid layers:

```
┌─────────────────────────────┐
│        TOP BAR (56px)       │  ← fixed, z-50
├─────────────────────────────┤
│                             │
│     LEAFLET MAP CANVAS      │  ← fills 100dvh, z-0
│     (full bleed, always     │
│      visible behind sheet)  │
│                             │
├─────────────────────────────┤
│  [STREAMING LOG STRIP]      │  ← z-20, State 2 only
│  BOTTOM SHEET / CARD PANEL  │  ← z-20, slides up from bottom
├─────────────────────────────┤
│     BOTTOM NAV BAR (64px)   │  ← fixed, z-50
└─────────────────────────────┘
```

- Map occupies `100dvh` with `position: fixed`, `inset: 0`, `z-index: 0`. It never scrolls.
- The bottom sheet slides up from above the nav bar — it does **not** cover the nav bar.
- All overlaid panels use `backdrop-filter: blur(16px)` and `bg-[#0A1D27]/92`.
- Safe area insets must be respected: use `pb-[env(safe-area-inset-bottom)]` on the nav bar.

---

## 2. Design Tokens (Mobile-Specific Additions)

All base tokens (colors, typography, shadows) are inherited from `design_document.md` §2 and §3.

The following are **mobile-only structural tokens**:

| Token | Value | Usage |
| :--- | :--- | :--- |
| `mobile-topbar-height` | `56px` | Fixed top bar |
| `mobile-nav-height` | `64px` | Bottom nav bar |
| `mobile-sheet-collapsed` | `~220px` | Bottom sheet collapsed height (State 1) |
| `mobile-sheet-expanded` | `85dvh` | Bottom sheet expanded height |
| `mobile-card-panel-height` | `auto` | Facility card panel height (State 2) |
| `mobile-log-strip-height` | `48px` | Streaming log strip height (State 2) |
| `mobile-touch-min` | `44px` | Minimum touch target size |
| `mobile-chip-height` | `32px` | Filter / suggestion chips |
| `mobile-transit-chip-height` | `56px` | Transit mode selector cells |

---

## 3. Top Bar

Fixed header, `height: 56px`, `z-index: 50`.

```
┌──────────────────────────────────────────────────────┐
│  [■] Dispatch HQ       [NON-URGENT · ESI 4]   [(•)]  │
└──────────────────────────────────────────────────────┘
```

**Structure (left → right):**

| Slot | State 1 | State 2 |
| :--- | :--- | :--- |
| Left icon | Grid/building icon `#48F6C1` 20px | Same |
| Wordmark | "Dispatch HQ" `font-sans font-bold text-[16px] text-[#E2F1F5]` | Same |
| Center | *(empty)* | Severity chip (see below) |
| Right | `ONLINE` pill | Signal/status icon |

**`ONLINE` pill (State 1):**
- `bg-[#48F6C1]/15 border border-[#48F6C1]/50 rounded-full px-3 py-1`
- `text-[#48F6C1] font-mono text-[10px] font-bold tracking-widest`
- Prefixed by a `●` dot at 8px with `animate-pulse`

**Severity chip (State 2, replaces ONLINE pill):**
- Maps directly to triage severity colors from `design_document.md` §2C
- Non-urgent: `border-[#00D2FF]/60 bg-[#00D2FF]/10 text-[#00D2FF]`
- Urgent: `border-[#F59E0B]/60 bg-[#F59E0B]/10 text-[#F59E0B]`
- Emergent: `border-[#FF7B93]/60 bg-[#FF7B93]/10 text-[#FF7B93]`
- Label format: `"NON-URGENT · ESI 4"` — all caps, `font-mono text-[10px] font-bold tracking-widest`
- Height `28px`, `border-radius: 999px`, `padding: 0 10px`

**Background:** `bg-[#061219]/90 backdrop-blur-md border-b border-[#1C4659]/40`

---

## 4. Map Canvas

The Leaflet map is always the full-viewport base layer.

- Tile style: dark desaturated navy (CartoDB Dark Matter or equivalent)
- `position: fixed; inset: 0; z-index: 0; height: 100dvh; width: 100vw`
- Map controls (zoom buttons) hidden on mobile — pinch-to-zoom only
- Attribution badge: `font-mono text-[8px] text-[#85A4B1]/50`, bottom-right corner above nav bar

### Facility Pins (State 1)

Circular markers, no default Leaflet teardrop:

| Facility Type | Fill | Size | Label |
| :--- | :--- | :--- | :--- |
| Hospital / Emergency | `#FF7B93` with outer ripple ring | 24px diameter | `H` |
| Walk-in Clinic | `#48F6C1` | 20px diameter | `W` |
| Lab / Pharmacy | `#00D2FF` | 16px diameter | `Rx` |
| Specialty Care | `#35A7C4` | 16px diameter | `S` |

Pin structure (custom HTML marker):
```html
<div class="relative flex items-center justify-center">
  <!-- ripple (hospitals only) -->
  <div class="absolute w-10 h-10 rounded-full bg-[#FF7B93]/20 animate-ping" />
  <!-- pin body -->
  <div class="w-6 h-6 rounded-full bg-[#FF7B93] flex items-center justify-center
              border-2 border-[#061219] shadow-lg shadow-[#FF7B93]/30">
    <span class="text-[#061219] font-mono text-[9px] font-bold">H</span>
  </div>
</div>
```

### Route & Markers (State 2)

- **User position pin:** 12px solid mint `#48F6C1` circle + two concentric radar rings animating outward (`scale(1)→scale(1.8)`, `opacity(1)→opacity(0)`, `duration: 1.5s infinite`)
- **Route polyline:** `stroke: #48F6C1`, `strokeWidth: 3`, `strokeOpacity: 0.9`, dash-animated (`stroke-dasharray: 8 4`, `stroke-dashoffset` animated via CSS `@keyframes`)
- **ETA label mid-route:** glassmorphic pill anchored to polyline midpoint
  - `bg-[#0A1D27]/90 border border-[#48F6C1]/30 rounded-full px-3 py-1`
  - `font-mono text-[10px] text-[#E2F1F5]` — content: `"3 min · 0.41 km"`
- **Primary facility pin:** 32px, `#48F6C1` fill, 3-ring pulsating radar animation, `z-index` above secondary pins
- **Secondary pins:** 20px, desaturated — Hospital: `#FF7B93/60`, Walk-in: `#00D2FF/60`

---

## 5. State 1 — Initial / Browse

```
┌────────────────────────────────────┐
│           TOP BAR                  │
│                                    │
│          LEAFLET MAP               │
│      (facility pins visible)       │
│                                    │
│ ┌──────────────────────────────────┤
│ │▔▔▔▔▔▔▔                           │  ← drag handle
│ │  AI Health Assistant      (•)    │
│ │  READY TO ASSIST YOU             │
│ │  [I have a fever] [Chest pain]…  │
│ │  ┌────────────────────────────┐  │
│ │  │ 🎤  Describe symptoms...  ▶ │  │
│ │  └────────────────────────────┘  │
│ │  🔒 SECURE & CONFIDENTIAL…       │
│ └──────────────────────────────────┤
│           BOTTOM NAV               │
└────────────────────────────────────┘
```

### 5A. Bottom Sheet (Collapsed — default)

Height: `~220px`. Anchored above nav bar.

**Container:**
```css
position: fixed;
bottom: 64px; /* nav bar height */
left: 0; right: 0;
background: rgba(10, 29, 39, 0.92);
backdrop-filter: blur(16px);
border-top: 1px solid rgba(28, 70, 89, 0.5);
border-radius: 24px 24px 0 0;
z-index: 20;
padding: 12px 16px 16px;
```

**Drag handle:**
- `w-9 h-1 rounded-full bg-[#1C4659] mx-auto mb-3`

**Title row:**
- Left: `"AI Health Assistant"` — `font-sans font-semibold text-[15px] text-[#E2F1F5]`
- Right: `(•)` voice indicator icon — `text-[#48F6C1] text-[18px]`, subtle pulse animation

**Subtitle:**
- `"READY TO ASSIST YOU"` — `font-mono text-[10px] tracking-widest text-[#85A4B1] mb-3`

**Suggestion chips (horizontal scroll, no scrollbar):**
- Container: `flex gap-2 overflow-x-auto no-scrollbar mb-3`
- Each chip: `h-8 px-3 rounded-full border border-[#1C4659]/60 bg-[#0A1D27]/60`
- Label: `font-sans text-[12px] font-medium text-[#85A4B1] whitespace-nowrap`
- Chips: `"I have a fever"`, `"Chest pain"`, `"Sore throat"`, `"Dizziness"`
- On tap: chip fills with `bg-[#48F6C1]/10 border-[#48F6C1]/60 text-[#48F6C1]` and pre-fills input

**Omni-Input Box:**
- Height `52px`, `rounded-xl`, `border border-[#1C4659]/65`, `bg-[#061219]/80 backdrop-blur-sm`
- Left slot: microphone icon `text-[#85A4B1]` 18px, `pl-4`
- Placeholder: `"Describe your symptoms..."` in `text-[#85A4B1]`
- Right slot: send button — `w-8 h-8 rounded-lg bg-[#48F6C1] flex items-center justify-center mr-2`
  - Arrow icon `text-[#061219]` 16px
  - On press: scale `0.95` spring

**Security badge (below input):**
- `🔒 SECURE & CONFIDENTIAL · LOCATION SYNCED`
- `font-mono text-[9px] text-[#85A4B1]/60 text-center mt-2`

### 5B. Bottom Sheet (Expanded)

On drag up or after message sent, sheet animates to `85dvh`:
- Shows full conversation history above suggestion chips
- Message bubbles: AI messages `bg-[#0A1D27] text-[#E2F1F5]`, user messages `bg-[#48F6C1]/15 border border-[#48F6C1]/20 text-[#E2F1F5]`
- Font: `font-sans text-[14px] leading-relaxed`
- Timestamp: `font-mono text-[9px] text-[#85A4B1]`
- Collapse on drag down past 40% height, spring back to collapsed

**Spring animation (Framer Motion):**
```js
transition: { type: "spring", stiffness: 300, damping: 28 }
```

---

## 6. State 2 — Recommendation

Triggered when the AI returns a triage result. The bottom sheet **is replaced** by the card panel. The map shows the route.

```
┌────────────────────────────────────┐
│           TOP BAR (+ severity)     │
│                                    │
│     LEAFLET MAP (route visible)    │
│                                    │
├────────────────────────────────────┤
│  STREAMING LOG STRIP (48px)        │
├────────────────────────────────────┤
│  PRIMARY FACILITY CARD             │
│  ┌──────────────────────────────┐  │
│  │ [FP]  Belrose Community...   │  │
│  │       Community Health  OPEN │  │
│  │  📍 50 Queens Quay W...      │  │
│  │  [3min DRIVE] [8min] [18min] │  │
│  │  [    Get Directions →     ] │  │
│  └──────────────────────────────┘  │
│  OTHER NEARBY OPTIONS              │
│  [ St. Michael's Hospital  12 MIN ]│
├────────────────────────────────────┤
│           BOTTOM NAV               │
└────────────────────────────────────┘
```

### 6A. Streaming Log Strip

Height: `48px`. Sits directly above the card panel, below the map.

```css
background: rgba(6, 18, 25, 0.95);
border-top: 1px solid rgba(28, 70, 89, 0.3);
border-bottom: 1px solid rgba(28, 70, 89, 0.3);
padding: 0 16px;
display: flex;
flex-direction: column;
justify-content: center;
gap: 2px;
```

Content (two lines, alternating or static):
- `[ROUTE] OPTIMAL PATH VIA QUEENS QUAY S`
- `[CAPAC] WALK-IN AVAILABILITY: HIGH (EST. WAIT = 30 MIN)`
- Font: `font-mono text-[9px] text-[#48F6C1] tracking-wide`
- Labels `[ROUTE]`, `[CAPAC]` in `font-bold`; rest in `font-normal`
- Simulate streaming: characters appear left-to-right on mount (`overflow: hidden`, width animates from 0 to 100%)

### 6B. Primary Facility Card

**Container:**
```css
background: rgba(10, 29, 39, 0.92);
backdrop-filter: blur(16px);
border-top: 1px solid rgba(28, 70, 89, 0.4);
padding: 16px 16px 8px;
```

**Header row:**

Left block — Monogram avatar:
- `w-11 h-11 rounded-xl bg-[#132E3C] border-2 border-[#35A7C4] flex items-center justify-center flex-shrink-0`
- `font-sans text-[15px] font-bold text-[#E2F1F5]` — monogram e.g. `"FP"`

Center block:
- Facility name: `font-sans font-semibold text-[14px] text-[#E2F1F5] leading-tight`
- Category chip: `inline-block mt-1 px-2 py-0.5 rounded-full bg-[#1C4659]/50 text-[#85A4B1] font-mono text-[9px] uppercase tracking-wide`

Right block:
- `● OPEN` — `font-mono text-[10px] font-bold text-[#48F6C1]` with 6px dot `animate-pulse`

**Address row:**
- Location pin icon `text-[#35A7C4]` 12px + address `font-mono text-[10px] text-[#85A4B1]`
- `mt-2 flex items-center gap-1.5`

**Transit grid:**
- `grid grid-cols-3 gap-2 mt-3`
- Each cell: `h-14 rounded-xl flex flex-col items-center justify-center gap-1 border`

| State | Background | Border | Icon color | Text color |
| :--- | :--- | :--- | :--- | :--- |
| Drive (active) | `#48F6C1/15` | `#48F6C1/60` | `#48F6C1` | `#48F6C1` |
| Cycle | `#00D2FF/10` | `#00D2FF/40` | `#00D2FF` | `#00D2FF` |
| Walk (default) | `#1C4659/30` | `#1C4659/50` | `#85A4B1` | `#85A4B1` |

Cell content:
- Phosphor icon (Car / Bicycle / Person) at `20px`
- Duration: `font-mono text-[11px] font-bold`
- Mode label: `font-mono text-[9px] uppercase tracking-wide`

Only one cell active at a time. On tap: swap active state, update route on map.

**CTA Button:**
- `w-full h-12 mt-3 rounded-xl bg-[#48F6C1] flex items-center justify-center gap-2`
- Label: `"Get Directions →"` — `font-sans text-[14px] font-bold text-[#061219]`
- On press: scale `0.97`, spring release; navigates to map directions overlay
- Minimum touch target satisfied by `h-12` (48px)

### 6C. Secondary Facilities List

**Section label:**
- `"OTHER NEARBY OPTIONS"` — `font-mono text-[9px] uppercase tracking-widest text-[#85A4B1] px-4 pt-3 pb-2`

**Each row:**
- Height: `52px`, `border-top border-[#1C4659]/30`, `px-4`, `flex items-center gap-3`
- Left: facility icon/monogram `w-8 h-8 rounded-lg bg-[#1C4659]/40 flex items-center justify-center text-[#85A4B1] text-[10px] font-bold`
- Center: name `font-sans text-[13px] font-medium text-[#E2F1F5]` + type `font-mono text-[9px] text-[#85A4B1]`
- Right: ETA chip + Save link
  - ETA: `font-mono text-[11px] font-bold` — color follows severity (`#F59E0B` for urgent, `#00D2FF` for non-urgent)
  - `"Save"`: `font-sans text-[12px] text-[#35A7C4] ml-2`

---

## 7. Bottom Navigation Bar

Fixed, `height: 64px`, `z-index: 50`.

```
┌───────────────────────────────────────────┐
│  [Map]    [Facilities]  [Triage]  [Chat]  │
└───────────────────────────────────────────┘
```

**Container:**
```css
position: fixed;
bottom: 0; left: 0; right: 0;
background: rgba(6, 18, 25, 0.97);
backdrop-filter: blur(20px);
border-top: 1px solid rgba(28, 70, 89, 0.5);
padding-bottom: env(safe-area-inset-bottom);
height: 64px;
display: grid;
grid-template-columns: repeat(4, 1fr);
z-index: 50;
```

**Each tab item:**
- `flex flex-col items-center justify-center gap-1 h-full`
- Icon: Phosphor icon, `20px`
- Label: `font-mono text-[9px] uppercase tracking-wide`

| Tab | Icon | Active color | Default color |
| :--- | :--- | :--- | :--- |
| Map | `MapPin` | `#48F6C1` | `#85A4B1` |
| Facilities | `Buildings` | `#48F6C1` | `#85A4B1` |
| Triage | `FirstAid` | `#48F6C1` | `#85A4B1` |
| Chat | `ChatCircle` | `#48F6C1` | `#85A4B1` |

Active tab indicator: `2px` top border on the tab cell in `#48F6C1`, or a `4px` dot below the icon — both options acceptable.

No background highlight on active tab — only icon/label color change to avoid visual noise over map.

---

## 8. Motion & Animation Spec

All mobile animations must use Framer Motion. Reference `design_document.md` §7 for base spring params.

| Element | Trigger | Animation |
| :--- | :--- | :--- |
| Bottom sheet expand/collapse | Drag / programmatic | `y` spring: `stiffness 300, damping 28` |
| State 1 → State 2 transition | AI response received | Sheet fades out (`opacity 0, y +30`), log strip + card fade in (`opacity 0→1, y +20→0`), `duration 300ms ease-out` |
| Facility card mount | State 2 entered | `initial: { opacity: 0, y: 24 }` → `animate: { opacity: 1, y: 0 }`, `delay: 0.1s` |
| Route polyline draw | State 2 entered | `strokeDashoffset` from full path length to 0, `duration: 800ms ease-in-out` |
| User pin radar rings | State 2 entered | Scale `1→1.8`, opacity `1→0`, `duration: 1.5s`, `repeat: Infinity`, ring 2 delayed `0.5s` |
| Suggestion chip tap | Tap | Scale `0.95` spring, color fill transition `150ms` |
| Send button press | Tap | Scale `0.92→1.0` spring |
| Nav tab switch | Tap | Icon color + label color transition `150ms ease`, no layout shift |
| Streaming log text | State 2 mount | Character-by-character reveal per line, `delay: 200ms` between lines |

**Reduced motion:** All `animate-ping`, pulse, and streaming effects must be wrapped:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-ping, .animate-pulse { animation: none; }
}
```

---

## 9. Implementation Notes

### Component Map (React)

```
MobileLayout                    ← root shell, handles state machine
  ├── MobileTopBar              ← receives: mode ("browse"|"recommendation"), severity?
  ├── MapCanvas                 ← Leaflet, receives: pins[], route?, userPosition
  │     └── FacilityPin        ← custom Leaflet divIcon per type
  ├── StreamingLogStrip         ← State 2 only, receives: logs[]
  ├── BottomSheet               ← State 1 only, draggable
  │     ├── SuggestionChips
  │     └── OmniInputBox
  ├── FacilityCardPanel         ← State 2 only, receives: primary, secondaries[]
  │     ├── TransitModeGrid
  │     ├── GetDirectionsButton
  │     └── NearbyFacilityRow
  └── BottomNavBar              ← receives: activeTab, onTabChange
```

### File placement

Following the existing webapp structure:
- `webapp/src/components/mobile/MobileLayout.tsx` — already exists, extend this
- `webapp/src/components/mobile/MobileTopBar.tsx`
- `webapp/src/components/mobile/BottomSheet.tsx`
- `webapp/src/components/mobile/FacilityCardPanel.tsx`
- `webapp/src/components/mobile/StreamingLogStrip.tsx`
- `webapp/src/components/mobile/BottomNavBar.tsx`
- `webapp/src/components/mobile/TransitModeGrid.tsx`

### State machine (MobileLayout)

```ts
type MobileMode = "browse" | "recommendation";
// browse:         map + bottom sheet (collapsed by default)
// recommendation: map + route + log strip + facility card panel
```

Transition triggered by: receiving a non-null `TriageResult` from the `/triage` API response (see `shared/types.ts` for severity schema).

### Tailwind utilities needed

- `no-scrollbar`: add to `tailwind.config.ts` via `scrollbar-hide` plugin or manual CSS
- `dvh` units (`100dvh`): ensure Tailwind config includes `100dvh` in `height` if not already
- `backdrop-blur-xl`: already in use in web layout, should be available

### Leaflet custom markers

Replace default Leaflet markers with `divIcon` using `ReactDOMServer.renderToString()` to generate the custom HTML pin markup. Keep the rendering synchronous — no dynamic imports inside the icon factory.

### Map padding

Set Leaflet `paddingBottomRight` to account for the bottom sheet / card panel height so facility pins are not hidden behind the overlay:
```ts
map.fitBounds(bounds, {
  paddingTopLeft: [16, 72],      // top bar
  paddingBottomRight: [16, 280], // bottom sheet collapsed height
});
```

### Typography

`JetBrains Mono` must be loaded if not already. Add to `webapp/index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
```
Or via the existing font loading mechanism in `webapp/src/index.css`.

---

## 10. Responsive Breakpoint

This entire document applies at `max-width: 1023px`. At `min-width: 1024px`, the desktop layout from `design_document_app.md` takes over. The breakpoint guard lives in `MobileLayout.tsx` — render this layout only when `window.innerWidth < 1024`, or use Tailwind's `lg:hidden` / `max-lg:block` classes on the root wrapper.

The `BottomNavBar` is **mobile-only** and must not render on desktop.
