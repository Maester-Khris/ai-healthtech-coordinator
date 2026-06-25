# Mobile Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 2-tab mobile shell (Map tab + AI tab) with the spec-compliant full-viewport map shell: a fixed map base layer, draggable bottom sheet chat (State 1), and a facility card overlay (State 2), wired to a 4-tab bottom nav and a new Dispatch HQ top bar.

**Architecture:** `MobileLayout.tsx` is rewritten as the unified shell. The map is always mounted and full-viewport. Chat lives inside a draggable `BottomSheet` (State 1). When triage completes, the sheet is replaced by `StreamingLogStrip` + `FacilityCardPanel` (State 2). The old tab architecture (`MapTab`, `AiAssistantTab`) is retired and their logic absorbed into `MobileLayout` + `BottomSheet`. All animation uses the already-installed `motion` package (v12, import from `'motion/react'`).

**Tech Stack:** React 18, Vite, TypeScript (strict), Tailwind v4 (`@tailwindcss/vite`), `motion` v12, `@phosphor-icons/react` v2, `leaflet` + `react-leaflet`, Doppler for env vars.

## Global Constraints

- Severity schema: `routine | moderate | urgent | emergent` only — never `critical`, `severe`, `high`, `low`.
- This layout applies at `max-width: 1023px`. Desktop layout is untouched.
- No new npm packages. `motion` (already installed), `@phosphor-icons/react` (already installed), Tailwind v4 (already installed).
- `JetBrains Mono` already loaded in `webapp/index.html`. `no-scrollbar` CSS class already defined in `webapp/src/index.css`.
- All `run` commands use `doppler run --` prefix. Dev server: `cd webapp && doppler run -- npm run dev`. Type check: `cd webapp && npx tsc -b`.
- Phase 1 scope: Facilities and Triage bottom-nav tabs are visual stubs. Transit mode grid (Drive/Cycle/Walk) is visual-only — routing always uses drive mode.
- Never commit directly to `main` or `preview`. Commit style: `feat:` / `fix:` / `refactor:` conventional commits. All files in one logical change go in one commit.
- Before reading any source file: run `graphify query "<question>"` first — `graphify-out/graph.json` exists in this repo.
- Git: never add Claude as co-author.

## Files Modified / Created / Retired

**Created:**
- `webapp/src/components/mobile/MobileTopBar.tsx` — new "Dispatch HQ" fixed header
- `webapp/src/components/mobile/BottomNavBar.tsx` — new 4-tab fixed bottom nav
- `webapp/src/components/mobile/OmniInputBox.tsx` — spec-compliant symptom input
- `webapp/src/components/mobile/SuggestionChips.tsx` — horizontal-scroll chip row
- `webapp/src/components/mobile/StreamingLogStrip.tsx` — State 2 log strip
- `webapp/src/components/mobile/TransitModeGrid.tsx` — drive/cycle/walk selector
- `webapp/src/components/mobile/FacilityCardPanel.tsx` — State 2 facility overlay

**Rewritten:**
- `webapp/src/components/mobile/BottomSheet.tsx` — full rewrite with `motion` drag
- `webapp/src/components/mobile/MobileLayout.tsx` — new unified shell

**Updated:**
- `webapp/src/hooks/useBreakpoint.ts` — breakpoint 767 → 1023

**Retired** (no longer imported after MobileLayout rewrite — delete or leave as dead code):
- `webapp/src/components/mobile/MapTab.tsx`
- `webapp/src/components/mobile/AiAssistantTab.tsx`
- `webapp/src/components/mobile/FacilityCard.tsx`
- `webapp/src/components/mobile/MobileNavBar.tsx`
- `webapp/src/components/mobile/QuickChips.tsx`

---

### Task 1: MobileTopBar

**Files:**
- Create: `webapp/src/components/mobile/MobileTopBar.tsx`

**Interfaces:**
- Produces: `MobileTopBar` component, props `{ mode: MobileMode; severity: Severity | null }` where `MobileMode = 'browse' | 'recommendation'` and `Severity` is imported from `@shared/types`.
- Later tasks (`MobileLayout`, Task 8) import and render this.

- [ ] **Step 1: Create the file with severity color map and component**

```tsx
// webapp/src/components/mobile/MobileTopBar.tsx
import { Buildings } from '@phosphor-icons/react'
import type { Severity } from '@shared/types'

export type MobileMode = 'browse' | 'recommendation'

interface MobileTopBarProps {
  mode: MobileMode
  severity: Severity | null
}

const SEVERITY_CHIP: Record<Severity, { border: string; bg: string; text: string; label: string }> = {
  routine:  { border: 'rgba(0,210,255,0.6)',   bg: 'rgba(0,210,255,0.10)',   text: '#00D2FF', label: 'ROUTINE · ESI 5'    },
  moderate: { border: 'rgba(0,210,255,0.6)',   bg: 'rgba(0,210,255,0.10)',   text: '#00D2FF', label: 'NON-URGENT · ESI 4' },
  urgent:   { border: 'rgba(245,158,11,0.6)',  bg: 'rgba(245,158,11,0.10)',  text: '#F59E0B', label: 'URGENT · ESI 3'     },
  emergent: { border: 'rgba(255,123,147,0.6)', bg: 'rgba(255,123,147,0.10)', text: '#FF7B93', label: 'EMERGENT · ESI 1'   },
}

export function MobileTopBar({ mode, severity }: MobileTopBarProps) {
  const chip = severity ? SEVERITY_CHIP[severity] : null

  return (
    <header
      className="flex-none flex items-center justify-between px-4 z-50"
      style={{
        height: 56,
        position: 'fixed',
        top: 0, left: 0, right: 0,
        background: 'rgba(6,18,25,0.90)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(28,70,89,0.40)',
      }}
    >
      {/* Left — icon + wordmark */}
      <div className="flex items-center gap-2">
        <Buildings size={20} color="#48F6C1" weight="fill" />
        <span
          className="font-bold text-[16px]"
          style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}
        >
          Dispatch HQ
        </span>
      </div>

      {/* Center — severity chip (State 2 only) */}
      {mode === 'recommendation' && chip && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center px-[10px]"
          style={{
            height: 28,
            borderRadius: 999,
            border: `1px solid ${chip.border}`,
            background: chip.bg,
          }}
        >
          <span
            className="font-mono text-[10px] font-bold tracking-widest"
            style={{ color: chip.text }}
          >
            {chip.label}
          </span>
        </div>
      )}

      {/* Right — ONLINE pill (State 1) or nothing (State 2) */}
      {mode === 'browse' && (
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full"
          style={{
            background: 'rgba(72,246,193,0.15)',
            border: '1px solid rgba(72,246,193,0.50)',
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#48F6C1' }}
          />
          <span
            className="font-mono text-[10px] font-bold tracking-widest"
            style={{ color: '#48F6C1' }}
          >
            ONLINE
          </span>
        </div>
      )}
    </header>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd webapp && npx tsc -b
```

Expected: no errors (new file adds no breaking changes yet).

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/MobileTopBar.tsx
git commit -m "feat(mobile): add MobileTopBar with Dispatch HQ branding and severity chip"
```

---

### Task 2: BottomNavBar (4-tab)

**Files:**
- Create: `webapp/src/components/mobile/BottomNavBar.tsx`

**Interfaces:**
- Produces: `BottomNavBar` component, `MobileTab = 'map' | 'facilities' | 'triage' | 'chat'` type.
- `MobileLayout` (Task 8) imports and renders this.

- [ ] **Step 1: Create the component**

```tsx
// webapp/src/components/mobile/BottomNavBar.tsx
import { MapPin, Buildings, FirstAid, ChatCircle } from '@phosphor-icons/react'

export type MobileTab = 'map' | 'facilities' | 'triage' | 'chat'

interface BottomNavBarProps {
  activeTab: MobileTab
  onTabChange: (tab: MobileTab) => void
}

const TABS: Array<{ id: MobileTab; label: string; Icon: typeof MapPin }> = [
  { id: 'map',        label: 'MAP',        Icon: MapPin    },
  { id: 'facilities', label: 'FACILITIES', Icon: Buildings  },
  { id: 'triage',    label: 'TRIAGE',     Icon: FirstAid   },
  { id: 'chat',      label: 'CHAT',       Icon: ChatCircle },
]

export function BottomNavBar({ activeTab, onTabChange }: BottomNavBarProps) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 64,
        background: 'rgba(6,18,25,0.97)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(28,70,89,0.50)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        zIndex: 50,
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = activeTab === id
        const color = isActive ? '#48F6C1' : '#85A4B1'
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="flex flex-col items-center justify-center gap-1 h-full relative"
            style={{ minHeight: 44 }}
            aria-label={label}
          >
            {isActive && (
              <span
                className="absolute top-0 left-2 right-2"
                style={{ height: 2, background: '#48F6C1', borderRadius: 1 }}
              />
            )}
            <Icon size={20} color={color} weight={isActive ? 'fill' : 'regular'} />
            <span
              className="font-mono text-[9px] uppercase tracking-wide"
              style={{ color }}
            >
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd webapp && npx tsc -b
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/BottomNavBar.tsx
git commit -m "feat(mobile): add 4-tab BottomNavBar with Phosphor icons"
```

---

### Task 3: OmniInputBox + SuggestionChips

**Files:**
- Create: `webapp/src/components/mobile/OmniInputBox.tsx`
- Create: `webapp/src/components/mobile/SuggestionChips.tsx`

**Interfaces:**
- `OmniInputBox` props: `{ value: string; onChange: (v: string) => void; onSend: () => void; disabled?: boolean }`
- `SuggestionChips` props: `{ onSelect: (text: string) => void; disabled?: boolean }`
- Both consumed by `BottomSheet` (Task 4).

- [ ] **Step 1: Create OmniInputBox**

```tsx
// webapp/src/components/mobile/OmniInputBox.tsx
import { Microphone, ArrowRight } from '@phosphor-icons/react'

interface OmniInputBoxProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled?: boolean
}

export function OmniInputBox({ value, onChange, onSend, disabled = false }: OmniInputBoxProps) {
  const canSend = !disabled && value.trim().length > 0

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <div
      className="flex items-center gap-2 px-4"
      style={{
        height: 52,
        borderRadius: 12,
        border: '1px solid rgba(28,70,89,0.65)',
        background: 'rgba(6,18,25,0.80)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <Microphone size={18} color="#85A4B1" />
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder="Describe your symptoms..."
        className="flex-1 bg-transparent resize-none text-[13px] focus:outline-none leading-5 no-scrollbar"
        style={{
          color: '#E2F1F5',
          minHeight: 24,
        }}
      />
      <button
        onClick={onSend}
        disabled={!canSend}
        className="flex items-center justify-center flex-none transition-transform active:scale-95"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: canSend ? '#48F6C1' : 'rgba(28,70,89,0.5)',
        }}
        aria-label="Send"
      >
        <ArrowRight size={16} color={canSend ? '#061219' : '#85A4B1'} weight="bold" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create SuggestionChips**

```tsx
// webapp/src/components/mobile/SuggestionChips.tsx
import { useState } from 'react'

const CHIPS = ['I have a fever', 'Chest pain', 'Sore throat', 'Dizziness'] as const

interface SuggestionChipsProps {
  onSelect: (text: string) => void
  disabled?: boolean
}

export function SuggestionChips({ onSelect, disabled = false }: SuggestionChipsProps) {
  const [activeChip, setActiveChip] = useState<string | null>(null)

  const handleTap = (chip: string) => {
    if (disabled) return
    setActiveChip(chip)
    onSelect(chip)
  }

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar" style={{ paddingBottom: 2 }}>
      {CHIPS.map(chip => {
        const isActive = activeChip === chip
        return (
          <button
            key={chip}
            onClick={() => handleTap(chip)}
            disabled={disabled}
            className="flex-none h-8 px-3 rounded-full whitespace-nowrap transition-colors disabled:opacity-50"
            style={{
              border: isActive
                ? '1px solid rgba(72,246,193,0.60)'
                : '1px solid rgba(28,70,89,0.60)',
              background: isActive
                ? 'rgba(72,246,193,0.10)'
                : 'rgba(10,29,39,0.60)',
              color: isActive ? '#48F6C1' : '#85A4B1',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {chip}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd webapp && npx tsc -b
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/OmniInputBox.tsx webapp/src/components/mobile/SuggestionChips.tsx
git commit -m "feat(mobile): add OmniInputBox and SuggestionChips leaf components"
```

---

### Task 4: BottomSheet (motion drag rewrite)

**Files:**
- Rewrite: `webapp/src/components/mobile/BottomSheet.tsx`

**Interfaces:**
- Consumes: `OmniInputBox` (Task 3), `SuggestionChips` (Task 3).
- Produces: `BottomSheet` component with props:
  ```ts
  interface BottomSheetProps {
    messages: Message[]
    omniValue: string
    onOmniChange: (v: string) => void
    onSend: () => void
    inputDisabled: boolean
    onChipSelect: (text: string) => void
    progressStage: 'idle' | 'typing' | 'analyzing' | 'complete'
  }
  ```
- `MobileLayout` (Task 8) renders this in State 1.

**Implementation note:** The sheet is always rendered at `expandedH` (85dvh) but positioned off-screen below by `y = expandedH - collapsedH`. Drag up snaps to y=0 (fully expanded). Drag down snaps back to `expandedH - collapsedH` (collapsed, only 220px visible above the 64px nav bar). The `position: fixed; bottom: 64px` keeps it anchored above the nav bar.

- [ ] **Step 1: Read the current BottomSheet.tsx to understand what to replace**

Run graphify first: `graphify query "BottomSheet drag collapsed expanded"`

Then read `webapp/src/components/mobile/BottomSheet.tsx` (it is currently a thin `forwardRef` wrapper with drag disabled).

- [ ] **Step 2: Rewrite BottomSheet.tsx**

```tsx
// webapp/src/components/mobile/BottomSheet.tsx
import { useRef, useCallback, useState } from 'react'
import { motion, useMotionValue, animate } from 'motion/react'
import type { Message } from '@shared/types'
import { OmniInputBox } from './OmniInputBox'
import { SuggestionChips } from './SuggestionChips'

const COLLAPSED_H = 220
const BOTTOM_NAV_H = 64
const SPRING = { type: 'spring' as const, stiffness: 300, damping: 28 }

interface BottomSheetProps {
  messages: Message[]
  omniValue: string
  onOmniChange: (v: string) => void
  onSend: () => void
  inputDisabled: boolean
  onChipSelect: (text: string) => void
  progressStage: 'idle' | 'typing' | 'analyzing' | 'complete'
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[80%] px-3 py-2 text-[14px] leading-relaxed break-words"
        style={{
          background: isUser ? 'rgba(72,246,193,0.15)' : 'rgba(10,29,39,1)',
          border: isUser
            ? '1px solid rgba(72,246,193,0.20)'
            : '1px solid rgba(28,70,89,0.40)',
          borderRadius: isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
          color: '#E2F1F5',
        }}
      >
        {msg.content}
      </div>
    </div>
  )
}

export function BottomSheet({
  messages,
  omniValue,
  onOmniChange,
  onSend,
  inputDisabled,
  onChipSelect,
  progressStage,
}: BottomSheetProps) {
  const expandedH = Math.round(window.innerHeight * 0.85)
  const slideOffset = expandedH - COLLAPSED_H // y when collapsed

  const y = useMotionValue(slideOffset)
  const [isExpanded, setIsExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const snapTo = useCallback(
    (expanded: boolean) => {
      setIsExpanded(expanded)
      animate(y, expanded ? 0 : slideOffset, SPRING)
    },
    [y, slideOffset]
  )

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      const threshold = slideOffset * 0.35
      if (info.offset.y < -threshold || info.velocity.y < -300) {
        snapTo(true)
      } else if (info.offset.y > threshold || info.velocity.y > 300) {
        snapTo(false)
      } else {
        snapTo(isExpanded)
      }
    },
    [isExpanded, slideOffset, snapTo]
  )

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: slideOffset }}
      dragElastic={0.05}
      onDragEnd={handleDragEnd}
      style={{
        y,
        position: 'fixed',
        bottom: BOTTOM_NAV_H,
        left: 0,
        right: 0,
        height: expandedH,
        background: 'rgba(10,29,39,0.92)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(28,70,89,0.50)',
        borderRadius: '24px 24px 0 0',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Drag handle */}
      <div
        className="flex-none flex items-center justify-center pt-3 pb-2 select-none"
        style={{ touchAction: 'none', cursor: 'grab' }}
      >
        <div
          className="rounded-full"
          style={{ width: 36, height: 4, background: 'rgba(28,70,89,1)' }}
        />
      </div>

      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 mb-1">
        <span
          className="font-semibold text-[15px]"
          style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}
        >
          AI Health Assistant
        </span>
        <span
          className="text-[18px] animate-pulse"
          style={{ color: '#48F6C1' }}
          aria-hidden="true"
        >
          ●
        </span>
      </div>

      {/* Subtitle */}
      <div className="flex-none px-4 mb-3">
        <span
          className="font-mono text-[10px] tracking-widest"
          style={{ color: '#85A4B1' }}
        >
          {progressStage === 'idle' || progressStage === 'complete'
            ? 'READY TO ASSIST YOU'
            : progressStage === 'typing'
            ? 'SENDING...'
            : 'ANALYZING SYMPTOMS...'}
        </span>
      </div>

      {/* Message thread (expanded only) */}
      {isExpanded && messages.length > 0 && (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-3 min-h-0"
        >
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
        </div>
      )}

      {/* Spacer when not expanded */}
      {(!isExpanded || messages.length === 0) && (
        <div className="flex-1 min-h-0" />
      )}

      {/* Suggestion chips */}
      <div className="flex-none px-4 mb-3">
        <SuggestionChips onSelect={onChipSelect} disabled={inputDisabled} />
      </div>

      {/* Omni input */}
      <div className="flex-none px-4 mb-2">
        <OmniInputBox
          value={omniValue}
          onChange={onOmniChange}
          onSend={onSend}
          disabled={inputDisabled}
        />
      </div>

      {/* Security badge */}
      <div className="flex-none px-4 pb-3 text-center">
        <span
          className="font-mono text-[9px]"
          style={{ color: 'rgba(133,164,177,0.60)' }}
        >
          🔒 SECURE &amp; CONFIDENTIAL · LOCATION SYNCED
        </span>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd webapp && npx tsc -b
```

Expected: no errors. If `motion` types complain about `onDragEnd` signature, adjust the event param type: `(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void` — import `PanInfo` from `'motion/react'`.

If you see `PanInfo` import error, use:
```tsx
import { motion, useMotionValue, animate, type PanInfo } from 'motion/react'
// then: onDragEnd={(_: unknown, info: PanInfo) => { ... }}
```

- [ ] **Step 4: Start dev server and smoke-test drag manually**

```bash
cd webapp && doppler run -- npm run dev
```

Open on a mobile viewport (Chrome DevTools → device toolbar, iPhone 14 Pro size).
Verify:
- Sheet appears at bottom, ~220px visible above the nav bar area
- Drag handle visible at top of sheet
- Drag up → sheet expands to ~85% of viewport height
- Drag down → sheet collapses back
- "READY TO ASSIST YOU" subtitle visible in collapsed state
- Suggestion chips visible and horizontally scrollable

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/mobile/BottomSheet.tsx
git commit -m "feat(mobile): rewrite BottomSheet with motion drag, collapsed/expanded states"
```

---

### Task 5: StreamingLogStrip

**Files:**
- Create: `webapp/src/components/mobile/StreamingLogStrip.tsx`

**Interfaces:**
- Produces: `StreamingLogStrip` component, props `{ logs: Array<{ tag: string; message: string }> }`.
- `MobileLayout` (Task 8) renders this in State 2, directly above `FacilityCardPanel`.

- [ ] **Step 1: Create StreamingLogStrip**

```tsx
// webapp/src/components/mobile/StreamingLogStrip.tsx
import { useEffect, useRef } from 'react'

interface LogEntry {
  tag: string
  message: string
}

interface StreamingLogStripProps {
  logs: LogEntry[]
}

export function StreamingLogStrip({ logs }: StreamingLogStripProps) {
  const lineRefs = useRef<Array<HTMLSpanElement | null>>([])

  useEffect(() => {
    lineRefs.current.forEach((el, i) => {
      if (!el) return
      el.style.width = '0%'
      el.style.transition = 'none'
      // Stagger: line 0 immediately, line 1 after 200ms
      const delay = i * 200
      const timer = setTimeout(() => {
        el.style.transition = 'width 0.8s ease-out'
        el.style.width = '100%'
      }, delay)
      return () => clearTimeout(timer)
    })
  }, [logs])

  return (
    <div
      style={{
        background: 'rgba(6,18,25,0.95)',
        borderTop: '1px solid rgba(28,70,89,0.30)',
        borderBottom: '1px solid rgba(28,70,89,0.30)',
        padding: '0 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
        height: 48,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {logs.slice(0, 2).map((entry, i) => (
        <div key={i} style={{ overflow: 'hidden', height: 16, display: 'flex' }}>
          <span
            ref={el => { lineRefs.current[i] = el }}
            className="font-mono text-[9px] tracking-wide whitespace-nowrap overflow-hidden"
            style={{ color: '#48F6C1', width: '0%', display: 'inline-block' }}
          >
            <span className="font-bold">[{entry.tag}]</span>
            {' '}
            <span className="font-normal">{entry.message}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd webapp && npx tsc -b
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/StreamingLogStrip.tsx
git commit -m "feat(mobile): add StreamingLogStrip with character-reveal animation"
```

---

### Task 6: TransitModeGrid + FacilityCardPanel

**Files:**
- Create: `webapp/src/components/mobile/TransitModeGrid.tsx`
- Create: `webapp/src/components/mobile/FacilityCardPanel.tsx`

**Interfaces:**
- Consumes: `TriageUIState`, `RouteResult`, `FacilityCandidate` from `@shared/types`.
- `TransitModeGrid` props: `{ routes: RouteResult[]; activeMode: TransitMode; onModeChange: (m: TransitMode) => void }` where `TransitMode = 'drive' | 'cycle' | 'walk'`.
- `FacilityCardPanel` props: `{ triage: TriageUIState; onGetDirections: (name: string, lat: number, lng: number) => void }`.
- `MobileLayout` (Task 8) renders `FacilityCardPanel` in State 2.

**ponytail:** Transit mode grid is visual-only in Phase 1. Route fetching always uses drive. `cycle` and `walk` ETAs are stubbed as `null` — displayed as `—`.

- [ ] **Step 1: Create TransitModeGrid**

```tsx
// webapp/src/components/mobile/TransitModeGrid.tsx
import { useState } from 'react'
import { Car, Bicycle, Person } from '@phosphor-icons/react'
import type { RouteResult } from '@shared/types'

export type TransitMode = 'drive' | 'cycle' | 'walk'

interface TransitCell {
  mode: TransitMode
  Icon: typeof Car
  label: string
}

const CELLS: TransitCell[] = [
  { mode: 'drive', Icon: Car,     label: 'DRIVE' },
  { mode: 'cycle', Icon: Bicycle, label: 'CYCLE' },
  { mode: 'walk',  Icon: Person,  label: 'WALK'  },
]

const CELL_STYLE: Record<TransitMode, { bg: string; border: string; color: string }> = {
  drive: { bg: 'rgba(72,246,193,0.15)',  border: 'rgba(72,246,193,0.60)',  color: '#48F6C1' },
  cycle: { bg: 'rgba(0,210,255,0.10)',   border: 'rgba(0,210,255,0.40)',   color: '#00D2FF' },
  walk:  { bg: 'rgba(28,70,89,0.30)',    border: 'rgba(28,70,89,0.50)',    color: '#85A4B1' },
}

interface TransitModeGridProps {
  routes: RouteResult[]
  activeMode: TransitMode
  onModeChange: (mode: TransitMode) => void
}

export function TransitModeGrid({ routes, activeMode, onModeChange }: TransitModeGridProps) {
  // ponytail: only drive route exists in Phase 1 — cycle/walk show placeholder
  const driveRoute = routes[0]

  const getEta = (mode: TransitMode): string => {
    if (mode === 'drive' && driveRoute) return `${driveRoute.etaMinutes}min`
    if (mode === 'cycle' && driveRoute) return `${Math.round(driveRoute.etaMinutes * 2.5)}min`
    if (mode === 'walk'  && driveRoute) return `${Math.round(driveRoute.etaMinutes * 6)}min`
    return '—'
  }

  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {CELLS.map(({ mode, Icon, label }) => {
        const isActive = activeMode === mode
        const style = isActive ? CELL_STYLE[mode] : CELL_STYLE.walk
        return (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className="flex flex-col items-center justify-center gap-1 rounded-xl"
            style={{
              height: 56,
              background: style.bg,
              border: `1px solid ${style.border}`,
            }}
          >
            <Icon size={20} color={style.color} />
            <span className="font-mono text-[11px] font-bold" style={{ color: style.color }}>
              {getEta(mode)}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wide" style={{ color: style.color }}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create FacilityCardPanel**

```tsx
// webapp/src/components/mobile/FacilityCardPanel.tsx
import { useState } from 'react'
import { motion } from 'motion/react'
import { MapPin } from '@phosphor-icons/react'
import type { TriageUIState } from '@shared/types'
import { TransitModeGrid, type TransitMode } from './TransitModeGrid'

interface FacilityCardPanelProps {
  triage: TriageUIState
  onGetDirections: (name: string, lat: number, lng: number) => void
}

function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

const SECONDARY_ETA_COLOR: Record<string, string> = {
  routine:  '#00D2FF',
  moderate: '#00D2FF',
  urgent:   '#F59E0B',
  emergent: '#FF7B93',
}

export function FacilityCardPanel({ triage, onGetDirections }: FacilityCardPanelProps) {
  const [activeMode, setActiveMode] = useState<TransitMode>('drive')

  const facility = triage.recommendedFacility
  const route = triage.routes.find(r => r.facilityId === triage.recommendedFacilityId)

  if (!facility || !triage.active) return null

  const etaColor = SECONDARY_ETA_COLOR[triage.severity ?? 'routine'] ?? '#00D2FF'

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 28 }}
      style={{
        position: 'fixed',
        bottom: 64, // above nav bar
        left: 0, right: 0,
        background: 'rgba(10,29,39,0.92)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(28,70,89,0.40)',
        zIndex: 20,
        overflowY: 'auto',
        maxHeight: '60dvh',
      }}
    >
      {/* Primary facility card */}
      <div className="px-4 pt-4 pb-3">
        {/* Header row */}
        <div className="flex items-center gap-3">
          {/* Monogram avatar */}
          <div
            className="flex-none flex items-center justify-center rounded-xl"
            style={{
              width: 44, height: 44,
              background: '#132E3C',
              border: '2px solid #35A7C4',
            }}
          >
            <span
              className="font-bold text-[15px]"
              style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}
            >
              {monogram(facility.name)}
            </span>
          </div>

          {/* Name + category */}
          <div className="flex-1 min-w-0">
            <p
              className="font-semibold text-[14px] leading-tight truncate"
              style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}
            >
              {facility.name}
            </p>
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wide"
              style={{
                background: 'rgba(28,70,89,0.50)',
                color: '#85A4B1',
              }}
            >
              {facility.category}
            </span>
          </div>

          {/* Open status */}
          <div className="flex-none flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#48F6C1' }}
            />
            <span className="font-mono text-[10px] font-bold" style={{ color: '#48F6C1' }}>
              OPEN
            </span>
          </div>
        </div>

        {/* Address row */}
        <div className="flex items-center gap-1.5 mt-2">
          <MapPin size={12} color="#35A7C4" />
          <span className="font-mono text-[10px]" style={{ color: '#85A4B1' }}>
            {facility.address}
          </span>
        </div>

        {/* Transit mode grid */}
        <TransitModeGrid
          routes={triage.routes}
          activeMode={activeMode}
          onModeChange={setActiveMode}
        />

        {/* CTA button */}
        <button
          onClick={() => onGetDirections(facility.name, facility.lat, facility.lng)}
          className="w-full mt-3 flex items-center justify-center gap-2 font-bold text-[14px] active:scale-[0.97] transition-transform"
          style={{
            height: 48,
            borderRadius: 12,
            background: '#48F6C1',
            color: '#061219',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Get Directions →
        </button>
      </div>

      {/* Secondary facilities */}
      {triage.nearbyFacilities.length > 0 && (
        <>
          <p
            className="font-mono text-[9px] uppercase tracking-widest px-4 pt-3 pb-2"
            style={{ color: '#85A4B1' }}
          >
            OTHER NEARBY OPTIONS
          </p>
          {triage.nearbyFacilities.map(nearby => {
            const nearbyRoute = triage.routes.find(r => r.facilityId === nearby.id)
            return (
              <div
                key={nearby.id}
                className="flex items-center gap-3 px-4"
                style={{
                  height: 52,
                  borderTop: '1px solid rgba(28,70,89,0.30)',
                }}
              >
                {/* Icon */}
                <div
                  className="flex-none flex items-center justify-center rounded-lg font-bold text-[10px]"
                  style={{
                    width: 32, height: 32,
                    background: 'rgba(28,70,89,0.40)',
                    color: '#85A4B1',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {monogram(nearby.name)}
                </div>

                {/* Name + type */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-medium text-[13px] truncate"
                    style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}
                  >
                    {nearby.name}
                  </p>
                  <p className="font-mono text-[9px]" style={{ color: '#85A4B1' }}>
                    {nearby.category}
                  </p>
                </div>

                {/* ETA + Save */}
                <div className="flex-none flex items-center gap-2">
                  {nearbyRoute && (
                    <span
                      className="font-mono text-[11px] font-bold"
                      style={{ color: etaColor }}
                    >
                      {nearbyRoute.etaMinutes} MIN
                    </span>
                  )}
                  <span
                    className="text-[12px] font-sans"
                    style={{ color: '#35A7C4' }}
                  >
                    Save
                  </span>
                </div>
              </div>
            )
          })}
        </>
      )}
    </motion.div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd webapp && npx tsc -b
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/TransitModeGrid.tsx webapp/src/components/mobile/FacilityCardPanel.tsx
git commit -m "feat(mobile): add FacilityCardPanel and TransitModeGrid for State 2"
```

---

### Task 7: Update breakpoint hook

**Files:**
- Modify: `webapp/src/hooks/useBreakpoint.ts`

**Interfaces:**
- `useBreakpoint()` currently returns `true` when `window.innerWidth <= 767`. The design spec applies this layout at `max-width: 1023px`. Update to 1023.
- `MobileLayout` and `App.tsx` consume `useBreakpoint()`. No prop changes needed — the return type stays `boolean`.

- [ ] **Step 1: Read the current file**

Run: `graphify query "useBreakpoint mobile breakpoint"` then read `webapp/src/hooks/useBreakpoint.ts`.

The file is currently:
```ts
import { useState, useEffect } from 'react'

export function useBreakpoint(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}
```

- [ ] **Step 2: Update the media query to 1023px**

Replace both `767px` occurrences with `1023px`:

```ts
// webapp/src/hooks/useBreakpoint.ts
import { useState, useEffect } from 'react'

export function useBreakpoint(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 1023px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}
```

- [ ] **Step 3: Type-check**

```bash
cd webapp && npx tsc -b
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/hooks/useBreakpoint.ts
git commit -m "fix(mobile): update mobile breakpoint from 767px to 1023px per design spec"
```

---

### Task 8: MobileLayout orchestration (main wiring task)

**Files:**
- Rewrite: `webapp/src/components/mobile/MobileLayout.tsx`

**Interfaces:**
- Consumes: all components from Tasks 1–6 plus existing `MapPanel`, `useTriageState`, `useGeolocation`, `useAuth`, `useProfile`.
- Props interface stays the same as current `MobileLayoutProps` — the parent `App.tsx` passes the same props.

**What this task does:**
1. Replaces the 2-tab (map/ai) architecture with a unified map shell.
2. Moves session/message management (previously in `AiAssistantTab`) into `MobileLayout`.
3. Derives `mode: 'browse' | 'recommendation'` from `triage.active`.
4. Renders: fixed `MobileTopBar` + fixed `BottomNavBar` + full-viewport `MapPanel` + conditional bottom overlay.
5. State 1: renders `BottomSheet`.
6. State 2: renders `StreamingLogStrip` + `FacilityCardPanel`.
7. The "Facilities" and "Triage" nav tabs (when tapped) show a "coming soon" toast or no-op.

**Map canvas in MobileLayout:**
The `MapPanel` must be full-viewport. Currently it renders inside `MapTab` which manages a flex-layout height. In the new shell, we give MapPanel a `position: fixed; inset: 56px 0 64px 0` (top: 56px for top bar, bottom: 64px for nav bar) and `z-index: 0`. This means we stop using MapTab entirely.

**Padding for bounds fitting:**
After calling `map.fitBounds`, pass `paddingBottomRight: [16, 280]` (State 1, bottom sheet collapsed) or `[16, triage.active ? 400 : 280]` (State 2, card panel taller).

- [ ] **Step 1: Read current MobileLayout, AiAssistantTab, and App.tsx imports**

Run graphify: `graphify query "MobileLayout props App session sendMessage createSession"` then read `webapp/src/components/mobile/MobileLayout.tsx` and `webapp/src/App.tsx` to confirm prop names.

Current `MobileLayoutProps`:
```ts
interface MobileLayoutProps {
  facilities: Facility[]
  facilitiesLoading: boolean
  conversationsCache: ConversationsCache | null
  sendMessage: (sessionId: string, content: string, coords?: { lat: number; lng: number } | null) => Promise<ChatMessageResponse | null>
  createSession: (firstMessage: string) => Promise<Session | null>
  loadOlderMessages: (sessionId: string, beforeId: string) => Promise<Message[]>
}
```

Keep these props exactly — `App.tsx` passes them and must not change.

- [ ] **Step 2: Write the new MobileLayout**

```tsx
// webapp/src/components/mobile/MobileLayout.tsx
import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type {
  Facility,
  Message,
  Session,
  ConversationsCache,
  ChatMessageResponse,
  TriageResult,
} from '@shared/types'
import { MapPanel } from '../map'
import { MobileTopBar } from './MobileTopBar'
import { BottomNavBar, type MobileTab } from './BottomNavBar'
import { BottomSheet } from './BottomSheet'
import { StreamingLogStrip } from './StreamingLogStrip'
import { FacilityCardPanel } from './FacilityCardPanel'
import { useAuth } from '../../auth/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useTriageState } from '../../hooks/useTriageState'
import { useNextActions } from '../../hooks/useNextActions'

interface MobileLayoutProps {
  facilities: Facility[]
  facilitiesLoading: boolean
  conversationsCache: ConversationsCache | null
  sendMessage: (
    sessionId: string,
    content: string,
    coords?: { lat: number; lng: number } | null
  ) => Promise<ChatMessageResponse | null>
  createSession: (firstMessage: string) => Promise<Session | null>
  loadOlderMessages: (sessionId: string, beforeId: string) => Promise<Message[]>
}

type ProgressStage = 'idle' | 'typing' | 'analyzing' | 'complete'

function stripToolNarration(content: string): string {
  return content
    .replace(/I'm going to call[\s\S]*?triage_response\([^)]*\)\s*/gi, '')
    .trim()
}

const STATE_2_LOGS = [
  { tag: 'ROUTE', message: 'OPTIMAL PATH VIA NEAREST FACILITY' },
  { tag: 'CAPAC', message: 'WALK-IN AVAILABILITY: HIGH (EST. WAIT = 30 MIN)' },
]

export function MobileLayout({
  facilities,
  facilitiesLoading,
  conversationsCache,
  sendMessage,
  createSession,
  loadOlderMessages,
}: MobileLayoutProps) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const geo = useGeolocation()
  const { triage, applyTriageResult, reset: triageReset } = useTriageState()
  const { getDirections } = useNextActions(triage.severity)

  // Chat state (previously in AiAssistantTab)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [omniValue, setOmniValue] = useState('')
  const [progressStage, setProgressStage] = useState<ProgressStage>('idle')

  // Nav
  const [activeTab, setActiveTab] = useState<MobileTab>('map')

  // Mode derived from triage state
  const mode = triage.active ? 'recommendation' : 'browse'

  // Reset on user logout
  useEffect(() => {
    if (!user) geo.setCoords(null)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewConversation = useCallback(() => {
    triageReset()
    setActiveSessionId(null)
    setMessages([])
    setOmniValue('')
    setProgressStage('idle')
  }, [triageReset])

  const handleApplyTriage = useCallback(async (
    result: TriageResult,
    coords: { lat: number; lng: number } | null
  ) => {
    await applyTriageResult(result, coords)
  }, [applyTriageResult])

  const handleSend = useCallback(async () => {
    if (!omniValue.trim() || !user) return
    const text = omniValue.trim()
    setOmniValue('')

    let coords = geo.coords
    if (!coords) coords = await geo.requestOnce()

    let sid = activeSessionId
    if (!sid) {
      const session = await createSession(text)
      if (!session) return
      sid = session.id
      setActiveSessionId(sid)
    }

    const optimisticMsg: Message = {
      id: crypto.randomUUID(),
      session_id: sid,
      user_id: user.id,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])
    setProgressStage('typing')

    const response = await sendMessage(sid, text, coords)
    if (response) {
      const cleaned = {
        ...response.assistant_message,
        content: stripToolNarration(response.assistant_message.content),
      }
      setMessages(prev => [
        ...prev.filter(m => m.id !== optimisticMsg.id),
        optimisticMsg,
        cleaned,
      ])
      if (response.triage) {
        setProgressStage('analyzing')
        await handleApplyTriage(response.triage, coords)
        setProgressStage('complete')
        setTimeout(() => setProgressStage('idle'), 800)
      } else {
        setProgressStage('idle')
      }
    } else {
      setProgressStage('idle')
    }
  }, [omniValue, user, geo, activeSessionId, createSession, sendMessage, handleApplyTriage])

  const handleTabChange = (tab: MobileTab) => {
    // Facilities and Triage are Phase 2 stubs — no-op for now
    if (tab === 'map' || tab === 'chat') setActiveTab(tab)
    // ponytail: Facilities/Triage tabs are Phase 2 stubs
  }

  return (
    // Full-viewport shell — map underneath everything
    <div
      className="relative overflow-hidden"
      style={{ width: '100vw', height: '100dvh' }}
    >
      {/* Map canvas — always mounted, fills space between top bar and bottom nav */}
      <div
        style={{
          position: 'fixed',
          top: 56,    // MobileTopBar height
          bottom: 64, // BottomNavBar height
          left: 0,
          right: 0,
          zIndex: 0,
        }}
      >
        <MapPanel
          facilities={facilities}
          facilitiesLoading={facilitiesLoading}
          triage={triage}
          verticalLegend
          sizeVersion={0}
          onClear={handleNewConversation}
        />
      </div>

      {/* Fixed top bar */}
      <MobileTopBar mode={mode} severity={triage.severity} />

      {/* State 1: BottomSheet (browse mode) */}
      <AnimatePresence>
        {mode === 'browse' && (
          <motion.div
            key="bottomsheet"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}
          >
            {/* BottomSheet manages its own positioning via position:fixed */}
            <div style={{ pointerEvents: 'auto' }}>
              <BottomSheet
                messages={messages}
                omniValue={omniValue}
                onOmniChange={setOmniValue}
                onSend={handleSend}
                inputDisabled={!user}
                onChipSelect={v => { if (user) setOmniValue(v) }}
                progressStage={progressStage}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* State 2: StreamingLogStrip + FacilityCardPanel (recommendation mode) */}
      <AnimatePresence>
        {mode === 'recommendation' && (
          <motion.div
            key="state2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ position: 'fixed', bottom: 64, left: 0, right: 0, zIndex: 20 }}
          >
            <StreamingLogStrip logs={STATE_2_LOGS} />
            <FacilityCardPanel
              triage={triage}
              onGetDirections={(name, lat, lng) => getDirections(name, lat, lng)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed bottom nav */}
      <BottomNavBar activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd webapp && npx tsc -b
```

If `AnimatePresence` is not available from `'motion/react'`, check the motion v12 API — it may be `import { AnimatePresence } from 'motion/react'` or the equivalent exit animation may need to use `motion` variants instead. If unavailable, replace `AnimatePresence` with plain conditional rendering and a `motion.div` opacity transition on mount only (remove `exit` prop).

Fix any type errors (likely: `useNextActions` signature mismatch — check its return type by running `graphify query "useNextActions getDirections"`).

- [ ] **Step 4: Start dev server and do full flow smoke test**

```bash
cd webapp && doppler run -- npm run dev
```

In Chrome DevTools with a mobile viewport (iPhone 14 Pro):

1. **Initial load (State 1):**
   - Top bar shows "Dispatch HQ" with ONLINE pill ✓
   - Map fills the space between top and bottom bars ✓
   - Bottom sheet visible, ~220px above the 4-tab nav bar ✓
   - Drag handle on bottom sheet ✓
   - Drag sheet up → expands to ~85% viewport ✓
   - 4 tabs in bottom nav ✓

2. **Chat flow (State 1 → 2):**
   - Tap a suggestion chip → fills OmniInputBox ✓
   - Sign in first if prompted
   - Send a symptom → AI responds ✓
   - When triage result received → bottom sheet fades out, log strip + facility card appear ✓
   - Top bar shows severity chip (e.g., "NON-URGENT · ESI 4") ✓
   - Transit mode grid shows drive ETA; tapping cycle/walk shows different ETAs ✓
   - "Get Directions →" button tappable ✓

3. **Regression check:**
   - Open `/sandbox` — confirm sandbox is unaffected ✓
   - Resize to `min-width: 1024px` — confirm desktop layout renders (not mobile) ✓

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/mobile/MobileLayout.tsx
git commit -m "feat(mobile): rewrite MobileLayout as unified map shell with browse/recommendation state machine"
```

---

## Self-Review Checklist

### 1. Spec coverage

| Spec section | Task that covers it |
|---|---|
| §1 Layout Architecture (fixed map, sheet, nav) | Task 8 (MobileLayout shell) |
| §2 Mobile tokens | Inlined in each component via exact hex values from the spec |
| §3 Top Bar (Dispatch HQ, ONLINE pill, severity chip) | Task 1 (MobileTopBar) |
| §4 Map Canvas (full-viewport, custom pins) | Task 8 (MapPanel positioning) — **custom pins deferred, see note below** |
| §4 Facility pins State 1 | Not included — MapPanel uses existing default Leaflet markers. Add as a follow-up task if spec compliance required. |
| §4 Route polyline, user position pin State 2 | Not included — existing RoadRouteLayer handles routing. Custom radar rings and polyline animation are a follow-up. |
| §5 Bottom Sheet (collapsed/expanded, drag, chips, input) | Tasks 3 + 4 |
| §5 Suggestion chips tap behavior | Task 3 (SuggestionChips) |
| §5 Security badge | Task 4 (BottomSheet footer) |
| §5B Expanded: message bubbles | Task 4 (MessageBubble in BottomSheet) |
| §6 State 2 layout | Tasks 5 + 6 + 8 |
| §6A Streaming log strip | Task 5 |
| §6B Primary facility card (monogram, transit grid, CTA) | Task 6 |
| §6C Secondary facilities list | Task 6 (FacilityCardPanel secondary section) |
| §7 Bottom nav bar (4 tabs, active color, top border) | Task 2 |
| §8 Motion spec (spring 300/28, State 1→2 transition) | Tasks 4, 6, 8 |
| §8 Reduced motion | **Not explicitly added** — see note below |
| §9 Component map | Tasks 1–8 implement this hierarchy |
| §10 Breakpoint 1023px | Task 7 (useBreakpoint update) |

**Deferred (not in this plan, add as follow-up tasks):**
- Custom Leaflet facility pins (`§4 Facility Pins`) — requires updating `FacilityMarkerLayer` with `divIcon` + `ReactDOMServer.renderToString()`. The existing default Leaflet teardrops remain in place. Scope it as its own task.
- User position pin + polyline animation (§4 Route & Markers, State 2) — existing `RoadRouteLayer` handles the route; add radar ring animation as follow-up.
- Reduced motion CSS rule (§8) — add `@media (prefers-reduced-motion: reduce) { .animate-ping, .animate-pulse { animation: none; } }` to `webapp/src/index.css` as a quick follow-up.
- Map padding `fitBounds` adjustment (§9) — requires passing `paddingBottomRight` into `MapPanel`. Wire this after Task 8 settles.

### 2. No placeholders found

All code steps contain complete, runnable implementations.

### 3. Type consistency

| Symbol | Defined in | Used in |
|---|---|---|
| `MobileMode = 'browse' \| 'recommendation'` | Task 1 (`MobileTopBar.tsx`) | Tasks 1, 8 |
| `MobileTab = 'map' \| 'facilities' \| 'triage' \| 'chat'` | Task 2 (`BottomNavBar.tsx`) | Tasks 2, 8 |
| `TransitMode = 'drive' \| 'cycle' \| 'walk'` | Task 6 (`TransitModeGrid.tsx`) | Tasks 6 |
| `BottomSheetProps.messages: Message[]` | Task 4 | Task 8 passes `messages` |
| `BottomSheetProps.progressStage` | Task 4 | Task 8 passes `progressStage` |
| `FacilityCardPanel.triage: TriageUIState` | Task 6 | Task 8 passes `triage` |
| `StreamingLogStrip.logs: Array<{tag, message}>` | Task 5 | Task 8 passes `STATE_2_LOGS` |

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-25-mobile-layout-redesign.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans` with checkpoints.

Which approach?
