# Mobile UI Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 UI regressions in the mobile layout: wordmark, drawer trigger, collapsed sheet empty space, map filter clutter, State-2 card layout, non-functional nav tabs, and hidden focus button.

**Architecture:** All fixes are in existing components — no new files, no new packages. Each task is independently testable on a mobile viewport in browser devtools (390×844 / iPhone 14).

**Tech Stack:** React 18, TypeScript strict, Tailwind CSS, Framer Motion (`motion/react`), Phosphor Icons (`@phosphor-icons/react`)

## Global Constraints

- No new npm packages
- TypeScript strict — no `any`, all props typed
- Run app: `doppler run -- npm run dev`
- After each task: open `http://localhost:5173` at 390×844 viewport to verify
- Commit style: conventional (`fix(mobile): ...`), one commit per task, no co-author trailer

---

## File Map

| File | What changes |
|------|-------------|
| `webapp/src/components/mobile/MobileTopBar.tsx` | Add `onMenuOpen` prop, rename wordmark, make left slot tappable |
| `webapp/src/components/mobile/MobileLayout.tsx` | Mount DrawerMenu, pass handler, fix tab routing |
| `webapp/src/components/mobile/BottomSheet.tsx` | Remove flex-1 spacer that hides chips/input in collapsed state |
| `webapp/src/components/mobile/FacilityCardPanel.tsx` | Remove inner `position: fixed` so it stacks with StreamingLogStrip |
| `webapp/src/components/map/MapPanel.tsx` | Gate filter chips + travel mode behind `!isMobile`; raise focus button above sheet |

---

### Task 1: Wordmark + Drawer trigger

**Root cause:**
- `MobileTopBar.tsx:42` hardcodes "Dispatch HQ" — should be "MediCoordAI"
- `MobileTopBar` has no tap target to open the drawer
- `MobileLayout` never mounts `DrawerMenu`

**Files:**
- Modify: `webapp/src/components/mobile/MobileTopBar.tsx`
- Modify: `webapp/src/components/mobile/MobileLayout.tsx`

**Interfaces:**
- Produces: `MobileTopBar` gains optional `onMenuOpen?: () => void` prop
- Consumes: `DrawerMenu` already accepts `{ isOpen: boolean; onClose: () => void }`

- [ ] **Step 1: Update MobileTopBar — add onMenuOpen prop and rename wordmark**

Replace the left slot in `webapp/src/components/mobile/MobileTopBar.tsx`:

```tsx
// Add List to the phosphor import
import { List } from '@phosphor-icons/react'

// Extend props interface
interface MobileTopBarProps {
  mode: MobileMode
  severity: Severity | null
  onMenuOpen?: () => void   // ← add
}

export function MobileTopBar({ mode, severity, onMenuOpen }: MobileTopBarProps) {
```

Replace the left icon + wordmark div (currently `<div className="flex items-center gap-2">`) with a button:

```tsx
{/* Left — hamburger + wordmark as a single tap target */}
<button
  onClick={onMenuOpen}
  className="flex items-center gap-2 bg-transparent border-none p-0 cursor-pointer"
  aria-label="Open menu"
>
  <List size={20} color="#48F6C1" weight="bold" />
  <span
    className="font-bold text-[16px]"
    style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}
  >
    MediCoordAI
  </span>
</button>
```

- [ ] **Step 2: Mount DrawerMenu in MobileLayout**

In `webapp/src/components/mobile/MobileLayout.tsx`:

Add import at the top:
```tsx
import { DrawerMenu } from './DrawerMenu'
```

Add state inside the component:
```tsx
const [isDrawerOpen, setIsDrawerOpen] = useState(false)
```

Pass handler to MobileTopBar (find the existing `<MobileTopBar` line and add the prop):
```tsx
<MobileTopBar
  mode={mode}
  severity={triage.severity}
  onMenuOpen={() => setIsDrawerOpen(true)}
/>
```

Add DrawerMenu just before the closing `</div>` of the root shell:
```tsx
<DrawerMenu isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
```

- [ ] **Step 3: Verify in browser**

At 390×844: top bar shows "MediCoordAI" with hamburger icon. Tapping it slides the drawer in from the right, showing user initial, display name, email, and nav items. Tapping outside closes it.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/MobileTopBar.tsx webapp/src/components/mobile/MobileLayout.tsx
git commit -m "fix(mobile): rename wordmark to MediCoordAI and wire drawer trigger"
```

---

### Task 2: Fix BottomSheet collapsed layout (empty space)

**Root cause:** `BottomSheet.tsx:158-162` renders a `flex-1 min-h-0` spacer div when not expanded. The sheet is `85dvh` tall; when collapsed `y = slideOffset = expandedH - 220`, only the top 220px of the div is visible. The spacer fills that 220px space, pushing chips, input, and security badge below the visible window. The drag handle, title, and subtitle are visible, but chips and input are not.

**Files:**
- Modify: `webapp/src/components/mobile/BottomSheet.tsx`

- [ ] **Step 1: Remove the spacer block**

Delete these lines from `BottomSheet.tsx` (around L158–162):

```tsx
{/* Spacer when not expanded */}
{(!isExpanded || messages.length === 0) && (
  <div className="flex-1 min-h-0" />
)}
```

The message thread (`className="flex-1 overflow-y-auto ..."`) is already gated by `{isExpanded && messages.length > 0}`. When it's absent, elements flow top-to-bottom with no gap: handle (~28px) → header (~32px) → subtitle (~28px) → chips (~44px) → input (~60px) → badge (~28px) ≈ 220px total — exactly `COLLAPSED_H`.

- [ ] **Step 2: Verify collapsed state**

At 390×844: the bottom sheet in its default state shows the drag handle, "AI Health Assistant", "READY TO ASSIST YOU", the four suggestion chips, the input box, and the security badge — all visible with no empty dark gap.

- [ ] **Step 3: Verify expanded state**

Drag the sheet up. It expands to ~85dvh. Messages render between subtitle and chips (flex-1). Drag down — springs back to collapsed with all chips + input still visible.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/BottomSheet.tsx
git commit -m "fix(mobile): remove spacer that hid suggestion chips and input in collapsed sheet"
```

---

### Task 3: Hide map filter chips on mobile

**Root cause:** `MapPanel.tsx` renders three filter UI blocks — (1) the travel mode selector (L120), (2) category chip row + (3) Open Now / Wait Time / Proximity sub-filters (both inside the block at L179) — without checking `isMobile`. The `isMobile` variable is computed at L36 via `useBreakpoint()` but only forwarded to `MapProvider`, not used to gate the overlays.

**Files:**
- Modify: `webapp/src/components/map/MapPanel.tsx`

- [ ] **Step 1: Gate the travel mode selector**

At line ~120, change:
```tsx
{activeTriage.active && (
```
to:
```tsx
{!isMobile && activeTriage.active && (
```

- [ ] **Step 2: Gate the category + sub-filter chips**

At line ~179, change:
```tsx
{!activeTriage.active && (
```
to:
```tsx
{!isMobile && !activeTriage.active && (
```

This single guard covers both the category chip row and the sub-filter row because they're both children of this container.

- [ ] **Step 3: Verify on mobile**

At 390×844: map shows only pins, no filter chips above them. Switch to desktop width (≥ 1024px): filter chips appear as before.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/map/MapPanel.tsx
git commit -m "fix(mobile): hide map filter chips and travel mode selector on mobile viewport"
```

---

### Task 4: Fix FacilityCardPanel layout in State 2

**Root cause:** `FacilityCardPanel.tsx` sets `position: 'fixed', bottom: 64, left: 0, right: 0` on its root `motion.div`. It's rendered inside a parent `motion.div` in `MobileLayout` that also has `position: 'fixed', bottom: 64`. The inner `position: fixed` escapes the parent's flow and places the card at the same vertical origin as the `StreamingLogStrip`, causing them to overlap.

**Files:**
- Modify: `webapp/src/components/mobile/FacilityCardPanel.tsx`

- [ ] **Step 1: Remove position:fixed from FacilityCardPanel's root element**

In `FacilityCardPanel.tsx`, the outer `motion.div` (L40–54) currently has:
```tsx
style={{
  position: 'fixed',
  bottom: 64,
  left: 0, right: 0,
  background: 'rgba(10,29,39,0.92)',
  backdropFilter: 'blur(16px)',
  borderTop: '1px solid rgba(28,70,89,0.40)',
  zIndex: 20,
  overflowY: 'auto',
  maxHeight: '60dvh',
}}
```

Replace with:
```tsx
style={{
  background: 'rgba(10,29,39,0.92)',
  backdropFilter: 'blur(16px)',
  borderTop: '1px solid rgba(28,70,89,0.40)',
  overflowY: 'auto',
  maxHeight: '55dvh',
}}
```

The parent `motion.div` in `MobileLayout` handles placement (`position: fixed; bottom: 64; left: 0; right: 0`). The card now flows naturally after `StreamingLogStrip` in that parent.

- [ ] **Step 2: Verify State 2 layout**

Trigger a triage result (type a symptom and submit). The `StreamingLogStrip` (48px) should appear between the map and the facility card — not overlapped. The "Get Directions →" CTA button should be visible and tappable without being obscured.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/FacilityCardPanel.tsx
git commit -m "fix(mobile): remove inner position:fixed from FacilityCardPanel so it stacks above StreamingLogStrip"
```

---

### Task 5: Wire bottom nav tabs

**Root cause:** `MobileLayout.tsx:143-145` — `handleTabChange` only calls `setActiveTab` for `'map'` and `'chat'`; tapping Triage or Facilities silently does nothing. The active-tab highlight never updates for those two tabs.

**Files:**
- Modify: `webapp/src/components/mobile/MobileLayout.tsx`

- [ ] **Step 1: Replace handleTabChange**

Find and replace the existing `handleTabChange` function:

```tsx
// before
const handleTabChange = (tab: MobileTab) => {
  if (tab === 'map' || tab === 'chat') setActiveTab(tab)
}
```

```tsx
// after
const handleTabChange = useCallback((tab: MobileTab) => {
  setActiveTab(tab)
  // triage and chat both surface the symptom-input sheet; reset recommendation mode if active
  if ((tab === 'chat' || tab === 'triage') && mode === 'recommendation') {
    handleNewConversation()
  }
}, [mode, handleNewConversation])
```

Add `useCallback` to the existing imports from `'react'` if not already present (it is, at L3).

- [ ] **Step 2: Verify all 4 tabs**

On mobile viewport:
- **Map**: tap → Map icon turns mint, top indicator appears
- **Facilities**: tap → Facilities icon turns mint (map view unchanged — no facility panel yet, intentional)
- **Triage**: tap → Triage icon turns mint; if in recommendation mode, sheet resets to browse
- **Chat**: tap → Chat icon turns mint; same as Triage behavior

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/MobileLayout.tsx
git commit -m "fix(mobile): wire all 4 bottom nav tabs; triage/chat reset to browse mode"
```

---

### Task 6: Raise focus button above the bottom sheet

**Root cause:** `FocusUserButton` (defined at `MapPanel.tsx:481`) uses `position: 'absolute', bottom: 16, right: 16`. Since the map canvas has `bottom: 64` set by MobileLayout, the button sits 16px above the nav bar — directly behind the 220px BottomSheet overlay. It's rendered but invisible.

**Files:**
- Modify: `webapp/src/components/map/MapPanel.tsx`

- [ ] **Step 1: Add isMobile prop to FocusUserButton signature**

The function is defined at line 481 and used at line 115. Update both:

At usage site (L115):
```tsx
<FocusUserButton geo={geo} isMobile={isMobile} />
```

At definition (L481), update the signature — also fix the existing `any` to the real type while you're there:
```tsx
function FocusUserButton({
  geo,
  isMobile,
}: {
  geo: ReturnType<typeof useGeolocation>
  isMobile: boolean
}) {
```

- [ ] **Step 2: Adjust bottom offset by viewport**

Inside `FocusUserButton`, change the style's `bottom` value:

```tsx
// before
bottom: 16,

// after
bottom: isMobile ? 236 : 16,  // 220px sheet + 16px gap on mobile
```

- [ ] **Step 3: Verify in browser**

Mobile viewport (no triage active): locate/focus button is visible in the bottom-right of the map, just above the collapsed sheet. Tapping it requests location and re-centers the map.

Desktop: button at its original `bottom: 16` position.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/map/MapPanel.tsx
git commit -m "fix(mobile): raise focus button above 220px bottom sheet overlay on mobile"
```

---

## Issue → Task coverage

| User-reported issue | Task |
|---------------------|------|
| Drawer menu not visible, no user name | Task 1 |
| "Dispatch HQ" instead of "MediCoordAI" | Task 1 |
| Triage and Facilities tabs do nothing | Task 5 |
| Large empty space in bottom section | Task 2 |
| Filter chips all over the place | Task 3 |
| Focus button not shown | Task 6 |
| StreamingLogStrip overlapped by FacilityCardPanel | Task 4 |

All 7 issues covered. 5 files touched. No new files or packages.
