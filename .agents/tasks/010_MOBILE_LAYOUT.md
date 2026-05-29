# Task: Mobile Responsive UI — Small Screen Experience

**ID:** 001  
**Scope:** `frontend`  
**Branch:** `feat/mobile-responsive-ui` — create before running this task  
**Tests required:** no

---

## Context

MediCoordAI is currently desktop-only in practice. On small screens (< 768px) the
split-pane layout (map left, chat panel right) is unusable — the map collapses, the
chat panel overflows, and interactive elements are too small to tap.

This task introduces a dedicated mobile layout. It does **not** change any backend
API calls, data fetching logic, or shared types. It is purely a responsive presentation
layer change confined to `webapp/src`.

Three core screens are in scope:
1. **Map view** — tab-based, with filter pills, draggable bottom sheet, and facility card
2. **AI assistant tab** — full-height chat thread with past conversations below
3. **Profile setup page** — multi-step onboarding flow (post-signup, steps 1–3)

---

## Design Spec

### Layout strategy
- Breakpoint: `< 768px` → mobile layout. `≥ 768px` → existing desktop layout unchanged.
- Use a CSS media query or Tailwind `md:` prefix consistently. Do not restructure desktop JSX.
- Mobile root: two tabs — **Map view** and **AI assistant** — rendered as a full-height
  `100dvh` column. No sidebar.

### Screen 1 — Map view (mobile)

**Top nav bar** (shared across both tabs):
- Left: logo icon + "MediCoord**AI**" wordmark (AI in brand blue `#2563eb`)
- Right: user avatar circle (initials, blue bg)
- Height: ~44px, `border-bottom`

**Tab bar** (below nav):
- Two tabs: "Map view" (map icon) and "AI assistant" (message-circle icon)
- Active tab: blue underline + blue text
- Height: ~36px

**Map area** (below tab bar):
- Default state: fixed height `~210px`, map fills it
- Draggable: user can drag the bottom sheet handle upward; map grows to fill freed space
  up to `100dvh - nav - tabs - mini-bar (~70px)`
- On drag up to fullscreen: map takes all remaining space, bottom sheet collapses to a
  slim persistent bar (~70px) showing: facility name, distance/time, "Nav" button, and
  the symptom input bar

**Filter bar** (absolutely positioned, top of map):
- Pill 1: "All types ▾" — dropdown or bottom sheet to select: All / Hospital / Community
- Pill 2: "Community" secondary quick filter
- Right side: facility count badge with green dot (e.g. "3 shown")
- Pills: white bg, 0.5px border, 20px border-radius, 8px font

**Bottom sheet** (default state, below map):
- Drag handle at top (28px wide, 3px high, centered)
- "drag to expand" hint text with up arrow icon (disappears once dragged)
- Severity banner: amber bg (`#c07a10`), white uppercase label e.g. "⚠ MODERATE — RECOMMENDED"
- Facility card:
  - Name (11px, 500 weight)
  - Address (9px, muted)
  - Distance/time row + "Best route" pill (blue border, blue text)
  - Italic reasoning note (8px, tertiary color)
- Two buttons: "Directions" (dark fill `#1a3a5c`) + "Save" (outline)
- Symptom input bar at bottom: no left icon, placeholder "Describe how you feel…", send icon on right, 20px border-radius

**Drag behaviour** (implement with touch events):
```
onTouchStart → record startY
onTouchMove  → compute deltaY, update sheet translateY (or map height)
onTouchEnd   → snap to EXPANDED (map full) or COLLAPSED (map 210px) based on threshold
```
Snap threshold: if dragged > 80px upward → expand; else → collapse back.
Use CSS `transition: height 0.25s ease` on the map container for smooth snap.

### Screen 2 — AI assistant tab (mobile)

**AI header** (below tab bar):
- Left: green status dot + "AI health assistant" title + "Online · secure & confidential" subtitle
- Right: "＋ New" button (blue border, blue text, 20px border-radius)
- Height: ~48px, `border-bottom`

**Chat thread** (scrollable, fills remaining height):
- User bubbles: right-aligned, blue bg (`#2563eb`), white text, `border-radius: 10px 10px 2px 10px`
- AI bubbles: left-aligned, secondary bg, tertiary border, `border-radius: 10px 10px 10px 2px`
- Recommendation card (inline in thread):
  - Amber severity banner at top
  - Facility name, address, distance row
  - "Directions" (dark fill) + "View on map" (outline) buttons side by side

**Past conversations section** (below active thread, inside scroll):
- Divider line with label "Past conversations" left + "See all" link right (blue)
- Each entry: bordered card, facility/symptom title (9px, 500) + subtitle with outcome (8px, muted)
- Show last 2 entries max; "See all" navigates to history page

**Empty state** (no active conversation):
- Centered icon (chat bubble, blue bg card), "How are you feeling?" heading
- Subtitle: "Describe your symptoms or ask a health-related question."
- Three quick-chip suggestion buttons stacked vertically:
  - "I have a fever and sore throat"
  - "Chest pain and shortness of breath"
  - "Twisted my ankle — it's swollen"

**Pinned input bar** (bottom, outside scroll):
- No left icon
- Placeholder "Describe how you feel…"
- Send icon right
- 20px border-radius, secondary bg

### Screen 3 — Profile setup page (post-signup, `/setup` route)

This replaces the existing modal-based onboarding on mobile. On desktop, the modal
continues to function as-is.

**Structure:** Full-page route `/setup`. Rendered only on mobile or when navigated
to directly after signup.

**Hero section** (top, dark bg `#1a3a5c`):
- Logo icon (heart-plus, white) in rounded square
- "Welcome to MediCoord**AI**" heading (white, AI in `#60a5fa`)
- Subtitle tagline

**Step indicator** (below hero):
- 3 steps: Account ✓ (green) → Location (blue, active) → Emergency (pending, muted)
- Connected by lines; completed step shows checkmark
- Step labels below dots: "Account", "Location", "Emergency"

**Step 2 content — Location access:**
- Section title + subtitle
- Two radio cards (full-width, bordered):
  - "Always allow" — "We'll use your saved location each time"
  - "Ask each time" (selected by default) — "You'll be prompted when you start a session"
  - Selected card: blue border + light blue bg (`#eff6ff`)

**Step 2 content — Emergency contact (same page, below location):**
- Title + "(optional)" label + subtitle
- Two inputs: "Name" and "Phone number"

**CTA button:** "Save and continue" (full width, dark fill)

**Privacy note** (below CTA, before page end):
- Shield-lock icon + 8px muted text about security and confidential location handling

**Navigation logic:**
- Step 1 (Account) = existing signup/login flow → on success, redirect to `/setup`
- Step 2 (Location + Emergency) = this page → "Save and continue" → Step 3 or home
- Step 3 can be a stub page for now or skipped to home

---

## File Scope

**Only touch files inside `webapp/src/`.**

Likely files to create or modify:
```
webapp/src/
  components/
    mobile/
      MobileLayout.tsx          ← tab shell, nav bar
      MapTab.tsx                ← map view with filter bar + draggable sheet
      AiAssistantTab.tsx        ← chat thread + past convos + empty state
      BottomSheet.tsx           ← reusable draggable sheet primitive
      FilterBar.tsx             ← filter pills + count badge
      FacilityCard.tsx          ← severity bar + facility details + buttons
      SymptomInput.tsx          ← input bar (no left icon, send icon)
      QuickChips.tsx            ← suggestion chips for empty AI state
  pages/
    SetupPage.tsx               ← /setup route, step 2 onboarding
  hooks/
    useBottomSheet.ts           ← drag gesture logic (touch events + snap)
    useBreakpoint.ts            ← returns isMobile boolean (< 768px)
```

Existing desktop components must not be modified structurally. If a component needs
mobile awareness, wrap it with `useBreakpoint` and conditionally render.

---

## Acceptance Criteria

- [ ] On viewport width < 768px, the map/chat split layout is replaced by the two-tab mobile layout
- [ ] On viewport width ≥ 768px, the existing desktop layout is completely unchanged
- [ ] Map view renders the map with filter pills (All types dropdown + Community pill + count badge)
- [ ] Bottom sheet is draggable: drag up snaps to fullscreen map; drag down restores card view
- [ ] In fullscreen map state, a slim bar (facility name + Nav button + input) persists at bottom
- [ ] AI assistant tab shows chat thread with user/AI bubbles styled per spec
- [ ] Recommendation card appears inline in the chat thread (not as a separate panel)
- [ ] Past conversations appear below the active thread with "See all" link
- [ ] Empty state shows icon + heading + 3 quick-chip buttons
- [ ] Symptom input bar has NO left icon on mobile (send icon only on right)
- [ ] `/setup` route renders the profile setup page (not a modal) on mobile
- [ ] Step indicator shows 3 steps with correct states (done/active/pending)
- [ ] Location radio cards are tappable and toggle correctly
- [ ] "Save and continue" on setup page navigates to next step or home
- [ ] All tap targets are ≥ 44px height
- [ ] No horizontal overflow / no content clipped at 375px viewport width
- [ ] TypeScript compiles with zero errors (`cd webapp && npm run build`)
- [ ] No hardcoded secrets or API keys introduced
- [ ] No files outside `webapp/src/` are modified

---

## Out of Scope

- Do **not** modify `backend/` in any way
- Do **not** modify `docs/`, `migrations/`, `seed/`, `shared/`, or any root config files
- Do **not** add new npm packages without flagging it first (prefer existing deps)
- Do **not** change any API call logic, data fetching, or state management outside of UI presentation
- Do **not** implement Step 3 (Emergency Contact follow-up) beyond a placeholder
- Do **not** change the desktop layout, modal, or any component behavior on ≥ 768px
- Do **not** write backend tests or modify `backend/tests/`

---

## Notes for Implementation

1. **Read first:** `webapp/src/` directory structure, existing component patterns, and
   how the map is currently rendered (likely Leaflet). Match existing import style and
   naming conventions.

2. **Breakpoint hook:** Create `useBreakpoint.ts` first — it is used by all other
   mobile components. Use `window.matchMedia('(max-width: 767px)')` with a resize
   listener and `useState`.

3. **Bottom sheet drag:** Track `touchstart`, `touchmove`, `touchend` on the handle
   element. Use a ref for the sheet container. Apply height change via inline style
   (not className) for performance during drag. Snap with `transition: height 0.25s ease`
   applied only on `touchend` (remove during drag to avoid lag).

4. **Map height during drag:** The map container height = `availableHeight - sheetHeight`.
   `availableHeight` = `window.innerHeight - navHeight - tabHeight`.

5. **Filter pills:** Implement as simple controlled state (`selectedFilter: 'all' | 'hospital' | 'community'`).
   The dropdown for "All types" can be a small absolute-positioned menu or a bottom sheet.
   Wire to whatever filtering mechanism already exists for the facility markers.

6. **Severity colours:**
   - `CRITICAL` → red (`#dc2626`)
   - `MODERATE` → amber (`#c07a10`)
   - `LOW` → green (`#15803d`)

7. **Tab routing:** Implement as local state (`activeTab: 'map' | 'ai'`) inside
   `MobileLayout.tsx`, not as separate routes, so the map stays mounted when switching
   to the AI tab (avoids re-initialising Leaflet).

8. **`/setup` route:** Add to the existing router. Check how auth redirect after login
   is currently handled and hook into it so mobile users land on `/setup` after first
   sign-in if profile is incomplete.

9. **Icon library:** Use whatever icon library is already in the project (check
   `webapp/package.json`). Do not add a new one.

10. **Colours:** Use CSS variables or Tailwind tokens already defined in the project.
    Brand blue `#2563eb`, dark navy `#1a3a5c`, amber `#c07a10` are established in the
    existing UI — reference them consistently.