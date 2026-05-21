# Task: Home UI Refactor — Static SPA Layout

**ID:** 002
**Scope:** `frontend`
**Branch:** `refactor/home-ui` — cut from `preview` before running this task
**Tests required:** no

---

## Context

The current hackathon `webapp/` renders a three-tab simulation interface (Smart Routing,
In-house Scheduling, Predictive Analysis) driven by a live simulator engine. This is being
replaced with a static SPA home page that matches the approved design: a 70/30 split between
a Leaflet map (left) and a chat panel (right), with a minimal header.

The simulator, tab navigation, and all simulation state are removed. The page is fully static
at this stage — no API calls, no chat functionality, no geolocation. Those are wired in later tasks.

Design reference: the approved mockup from the product design session. Key decisions recorded in
this task under "Notes for Implementation".

---

## Acceptance Criteria

- [ ] Header renders with logo (icon + "MediCoord AI" wordmark + tagline), left-aligned nav
      with no links for now, and right-aligned "Sign in" (ghost) + "Get started" (solid blue) buttons
- [ ] Layout is a full-viewport SPA: header fixed at top, body fills remaining height with no scroll
- [ ] Body splits 70% map / 30% chat panel with a single vertical divider border
- [ ] Map panel: Leaflet map centered on CN Tower (lat: 43.6426, lng: -79.3871), zoom level 13,
      OpenStreetMap tiles, no simulation controls, no patient markers
- [ ] Map panel: 43 Toronto health facilities rendered as static markers using a red cross `+`
      circle icon (white fill, red border, red `+` glyph) at their coordinates from `baseData.ts`
- [ ] Map panel: CN Tower rendered as a distinct landmark marker (blue dot with pulse ring),
      separate from facility markers
- [ ] Map panel: zoom +/− controls top-left, "43 facilities active" status pill top-right,
      facility type legend bottom-left — all static, no interaction beyond Leaflet default pan/zoom
- [ ] Chat panel: header row with "Health assistant" title, "Describe your symptoms" subtitle,
      and a green "Online" status indicator — all static text
- [ ] Chat panel: empty state centered in the panel body — avatar ring (blue circle with robot
      icon), "How are you feeling?" heading, one-line descriptor, three static suggestion chips
      (no onclick handlers yet — chips are visual only at this stage)
- [ ] Chat panel: sticky input area at bottom — textarea with placeholder "Describe how you
      feel…", send button (blue, arrow-up icon), and hint text "Location access will be
      requested on first message" — input is rendered but does not submit anything
- [ ] All simulator state, wave logic, `useRef` queues, and simulation controls removed
- [ ] All three tab components (Home.tsx, Inhousescheduler.tsx, Map.tsx) replaced or collapsed
      into a single home route — tab navigation removed entirely from `App.tsx`
- [ ] No commented-out simulation code left in the codebase — delete, do not comment out
- [ ] TypeScript compiles with zero errors (`npx tsc --noEmit`)
- [ ] Vite dev server runs without console errors (`doppler run -- npm run dev`)
- [ ] No hardcoded secrets

---

## Out of Scope

- Chat functionality — no API calls, no message sending, no streaming
- Geolocation — `navigator.geolocation` is not called in this task
- "Get started" modal — button renders but has no onClick handler yet
- "Sign in" flow — button renders but has no onClick handler yet
- Suggestion chip click handlers — chips are static UI only
- Backend integration of any kind
- Patient markers, route polylines, or any dynamic map state
- Predictive Analysis or In-house Scheduling views — fully removed, not hidden
- Supabase, auth, or session logic
- Mobile responsive layout — desktop only for this task

---

## Notes for Implementation

### File targets
Primary files to modify or replace:
- `webapp/src/App.tsx` — remove tab router, render single layout component
- `webapp/src/Menucomponents/Home.tsx` — replace with new static layout
- `webapp/src/Menucomponents/subcomponent/MapPanel.tsx` — strip simulation props,
  keep Leaflet map, update markers to static facility pins only

Files to delete entirely:
- `webapp/src/Menucomponents/Inhousescheduler.tsx`
- `webapp/src/Menucomponents/Map.tsx` (Predictive Analysis tab)
- `webapp/src/Menucomponents/subcomponent/SimulationForm.tsx`

Files to keep as-is (read-only reference):
- `webapp/src/Menucomponents/utils/baseData.ts` — facility coordinates used for static markers
- `webapp/src/Menucomponents/utils/customIcon.tsx` — can reuse or replace icon logic

### Layout spec
```
┌─────────────────────────────────────────────────────┐
│ HEADER  logo          [nav — empty]   sign in  CTA  │  height: 52px
├────────────────────────────────┬────────────────────┤
│                                │  chat header       │
│                                │──────────────────  │
│         LEAFLET MAP            │                    │
│            70%                 │   empty state      │
│                                │   (avatar+chips)   │
│                                │                    │
│                                │──────────────────  │
│                                │   input area       │
└────────────────────────────────┴────────────────────┘
                                  30%
```

### Color tokens (match approved mockup exactly)
- Primary blue: `#185FA5`
- Facility marker border/glyph: `#E24B4A`
- CN Tower dot: `#185FA5` with 15% opacity pulse ring
- Online indicator: `#1D9E75`
- Avatar ring background: `#E6F1FB`, border: `#B5D4F4`
- All other colors via Tailwind or CSS variables — no hardcoded hex elsewhere

### Marker implementation
Use Leaflet `divIcon` for both marker types:

```typescript
// Facility marker
L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:50%;
         background:white;border:1.5px solid #E24B4A;
         display:flex;align-items:center;justify-content:center;
         font-size:12px;color:#E24B4A;font-weight:500;">+</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// CN Tower marker
L.divIcon({
  className: '',
  html: `<div style="width:12px;height:12px;border-radius:50%;
         background:#185FA5;box-shadow:0 0 0 6px rgba(24,95,165,0.15)"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})
```

### Dead npm packages to remove in this task
These were installed but never used — clean them now since we are touching `package.json`:
`recharts`, `@turf/turf`, `@turf/helpers`, `react-slick`, `@material-tailwind/react`,
`@heroicons/react`

Note removal in outcome summary. Run `npm install` after removal to update lockfile.