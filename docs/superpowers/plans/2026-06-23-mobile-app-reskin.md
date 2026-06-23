# Mobile App Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the existing mobile app (`components/mobile/*`) from ad-hoc Tailwind defaults to the Stratum design system, converting the top tab strip into a floating bottom "Navigation Dock" per the design spec. Pure re-skin plus one structural reposition (the dock) — no new screens, no new tabs, no behavior changes.

**Architecture:** Token-only changes everywhere except `MobileLayout.tsx`, where the Map/AI tab switcher moves from a top-aligned flat strip to a bottom-aligned floating dock. The dock stays in normal flex layout (not `position: fixed`) — `MapTab.tsx` computes available height imperatively from fixed pixel constants (`NAV_H`, `TAB_H`), and `AiAssistantTab.tsx` pins its input bar to the bottom of its own flex column; a true floating overlay would require recalculating both, which is more structural change than this re-skin calls for. Instead, the dock occupies a real (smaller) flex slot at the bottom of the screen, visually styled to read as a detached floating pill (margin, rounded shell, blur, shadow) without actually overlaying content.

**Tech Stack:** React 19, Tailwind v4 (design-system tokens: `stratum-*` colors, `severity-*` colors, `radius-stratum-*`, `surface-card`, `shell-bezel`, `text-label-md`).

## Global Constraints

- No new mobile screens, tabs, or navigation structure — re-skin only. The dock conversion repositions the existing 2-tab switcher; it does not add tabs or change what each tab does.
- `MobileLayout`'s breakpoint-detection logic and tab-state management (`activeTab`, `setActiveTab`, the `Tab` type) are unchanged — only the tab switcher's visual presentation and position move.
- Severity colors (`severity-routine/moderate/urgent/emergent`) are reserved for severity contexts only — never used decoratively. Destructive actions (sign-out) and generic status indicators (online dot) stay on their existing non-token colors, since neither is a severity context and the design system doesn't define a generic "danger"/"success" role outside the severity ramp.
- The Google OAuth brand colors, Sandbox lab-flask accent, and any other previously-established literal-hex exceptions are out of scope for this plan (none of those appear in `components/mobile/*`).
- Token names must be real tokens in `webapp/src/index.css`: `stratum-bg`, `stratum-surface`, `stratum-accent`, `stratum-accent-2`, `stratum-text`, `stratum-text-muted`, `stratum-border`; `severity-routine/moderate/urgent/emergent`; `radius-stratum-control/md/lg/bezel`; `surface-card`, `shell-bezel`, `text-label-md`.

---

### Task 1: Navigation Dock (MobileNavBar top bar + MobileLayout dock conversion)

**Files:**
- Modify: `webapp/src/components/mobile/MobileNavBar.tsx`
- Modify: `webapp/src/components/mobile/MobileLayout.tsx`

**Interfaces:**
- Produces: the dock's fixed outer height becomes `64` (replacing the old top tab strip's `46`) — Task 2 must update `MapTab.tsx`'s height-budget constant to this same value, or the map/sheet height math will be wrong by 18px.
- No props change on any component in this task.

- [ ] **Step 1: Re-skin `MobileNavBar.tsx`'s top bar**

Replace the entire content of `webapp/src/components/mobile/MobileNavBar.tsx` with:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { DrawerMenu } from './DrawerMenu'
import { LoginModal } from '../auth/LoginModal'

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18M3 12h18M3 18h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Shared mobile nav bar — 56px tall. Manages its own drawer and login modal state. */
export function MobileNavBar() {
  const { user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  const initials = user?.email ? user.email[0].toUpperCase() : '?'

  return (
    <>
      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} defaultTab="signin" />

      <header
        className="flex-none flex items-center justify-between px-4 bg-stratum-bg border-b border-stratum-border z-10"
        style={{ height: 56 }}
      >
        {/* Logo */}
        <Link to="/app" className="flex items-center gap-2 no-underline">
          <div className="w-7 h-7 rounded-stratum-control overflow-hidden shadow-sm flex-none">
            <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
          </div>
          <span className="text-[15px] font-bold text-stratum-text tracking-tight">
            MediCoord<span className="text-stratum-accent">AI</span>
          </span>
        </Link>

        {/* Right side */}
        {user ? (
          <div className="flex items-center gap-1 flex-none">
            {/* Avatar — identity indicator, not interactive */}
            <div className="w-7 h-7 rounded-full bg-stratum-accent flex items-center justify-center text-white text-[11px] font-bold select-none">
              {initials}
            </div>
            {/* Hamburger — opens drawer */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center justify-center text-stratum-text-muted hover:text-stratum-text rounded-stratum-md"
              style={{ minWidth: 36, minHeight: 36 }}
              aria-label="Open menu"
            >
              <HamburgerIcon />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setLoginOpen(true)}
            className="text-[12px] font-semibold text-stratum-accent px-3 py-1.5"
            style={{ minHeight: 36 }}
          >
            Sign in
          </button>
        )}
      </header>
    </>
  )
}
```

- [ ] **Step 2: Convert `MobileLayout.tsx`'s tab switcher into a bottom Navigation Dock**

Replace the entire content of `webapp/src/components/mobile/MobileLayout.tsx` with:

```tsx
import { useState, useEffect } from 'react'
import type {
  Facility,
  Message,
  Session,
  ConversationsCache,
  ChatMessageResponse,
  TriageResult,
} from '@shared/types'
import { MapTab } from './MapTab'
import { AiAssistantTab } from './AiAssistantTab'
import { MobileNavBar } from './MobileNavBar'
import { useAuth } from '../../auth/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useTriageState } from '../../hooks/useTriageState'

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

type Tab = 'map' | 'ai'

function MapIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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

  const [activeTab, setActiveTab] = useState<Tab>('map')
  const [sessionKey, setSessionKey] = useState(0)
  const [symptomValue, setSymptomValue] = useState('')

  useEffect(() => {
    if (!user) geo.setCoords(null)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewConversation = () => {
    triageReset()
    setSessionKey(k => k + 1)
    setSymptomValue('')
  }

  const handleApplyTriage = async (
    result: TriageResult,
    coords: { lat: number; lng: number } | null
  ) => {
    await applyTriageResult(result, coords)
    if (result.recommended_facility) {
      setTimeout(() => setActiveTab('map'), 1200)
    }
  }

  const handleMapSend = () => {
    if (symptomValue.trim()) setActiveTab('ai')
  }

  return (
    <div className="flex flex-col bg-stratum-bg" style={{ height: '100dvh' }}>
      <MobileNavBar />

      {/* Tab content — both mounted to keep Leaflet alive */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className="absolute inset-0"
          style={{ display: activeTab === 'map' ? 'block' : 'none' }}
        >
          <MapTab
            facilities={facilities}
            facilitiesLoading={facilitiesLoading}
            triage={triage}
            symptomValue={symptomValue}
            onSymptomChange={setSymptomValue}
            onSymptomSend={handleMapSend}
            inputDisabled={!user}
            visible={activeTab === 'map'}
            onClear={handleNewConversation}
          />
        </div>

        <div
          className="absolute inset-0 flex flex-col"
          style={{ display: activeTab === 'ai' ? 'flex' : 'none' }}
        >
          <AiAssistantTab
            key={sessionKey}
            user={user}
            cache={conversationsCache}
            sendMessage={sendMessage}
            createSession={createSession}
            loadOlderMessages={loadOlderMessages}
            geo={geo}
            profile={profile}
            triage={triage}
            onTriageResult={handleApplyTriage}
            onNewConversation={handleNewConversation}
            symptomValue={symptomValue}
            onSymptomChange={setSymptomValue}
          />
        </div>
      </div>

      {/* Navigation Dock — floating bottom tab switcher */}
      <div className="flex-none flex items-center justify-center px-4 pb-3" style={{ height: 64 }}>
        <div className="flex items-center gap-1 w-full max-w-sm surface-card shell-bezel rounded-stratum-bezel backdrop-blur-xl p-1.5">
          {(['map', 'ai'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 text-label-md rounded-stratum-control transition-colors ${
                activeTab === tab
                  ? 'text-white bg-stratum-accent'
                  : 'text-stratum-text-muted'
              }`}
            >
              {tab === 'map' ? <MapIcon /> : <ChatIcon />}
              {tab === 'map' ? 'Map view' : 'AI assistant'}
              {activeTab === tab && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-stratum-accent-3 animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

(The dock's outer wrapper height — `64` — matches the `DOCK_H` constant Task 2 will set in `MapTab.tsx`. The active-tab pulse dot reuses Tailwind's built-in `animate-pulse` utility — already used elsewhere in this codebase, no new keyframes needed.)

- [ ] **Step 3: Build**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/MobileNavBar.tsx webapp/src/components/mobile/MobileLayout.tsx
git commit -m "style(mobile): re-skin top bar, convert tab switcher to floating Navigation Dock"
```

---

### Task 2: Map tab chain (MapTab, BottomSheet, FacilityCard)

**Files:**
- Modify: `webapp/src/components/mobile/MapTab.tsx`
- Modify: `webapp/src/components/mobile/BottomSheet.tsx`
- Modify: `webapp/src/components/mobile/FacilityCard.tsx`

**Interfaces:**
- Consumes: the dock height (`64`) established in Task 1 — `MapTab.tsx`'s renamed `DOCK_H` constant must equal it exactly, or the map/sheet height split will be off by however many pixels they differ.
- No props change on any component in this task.

- [ ] **Step 1: Update `MapTab.tsx`'s height constant and re-skin its own controls**

In `webapp/src/components/mobile/MapTab.tsx`, find:

```tsx
const NAV_H = 56
const TAB_H = 46
const MIN_SHEET_H = 70
const INPUT_BAR_H = 72  // height of the slim input-only sheet when triage is inactive
```

Replace with:

```tsx
const NAV_H = 56
const DOCK_H = 64
const MIN_SHEET_H = 70
const INPUT_BAR_H = 72  // height of the slim input-only sheet when triage is inactive
```

Then replace every other use of `TAB_H` in this file with `DOCK_H` (there is exactly one more occurrence, in the initial `availH` state):

Find:
```tsx
  const [availH, setAvailH] = useState(() => window.innerHeight - NAV_H - TAB_H)
```
Replace with:
```tsx
  const [availH, setAvailH] = useState(() => window.innerHeight - NAV_H - DOCK_H)
```

Find:
```tsx
      timer = setTimeout(() => setAvailH(window.innerHeight - NAV_H - TAB_H), 100)
```
Replace with:
```tsx
      timer = setTimeout(() => setAvailH(window.innerHeight - NAV_H - DOCK_H), 100)
```

Find the expand/collapse button's color and the "Nav" button's background (both use the old literal navy `#1a3a5c`):

```tsx
            color: '#1a3a5c',
            zIndex: 1000,
```
Replace with:
```tsx
            color: 'var(--color-stratum-accent)',
            zIndex: 1000,
```

```tsx
                  className="flex-none text-[11px] font-bold text-white rounded-lg px-3"
                  style={{ background: '#1a3a5c', minHeight: 44, minWidth: 44 }}
```
Replace with:
```tsx
                  className="flex-none text-[11px] font-bold text-white rounded-stratum-md px-3"
                  style={{ background: 'var(--color-stratum-accent)', minHeight: 44, minWidth: 44 }}
```

Find the recommended-facility name/ETA text colors inside the expanded slim bar:
```tsx
                  <p className="text-[11px] font-semibold text-gray-900 truncate leading-tight">
                    {recommended.name}
                  </p>
                  {route && (
                    <p className="text-[9px] text-gray-500">
```
Replace with:
```tsx
                  <p className="text-[11px] font-semibold text-stratum-text truncate leading-tight">
                    {recommended.name}
                  </p>
                  {route && (
                    <p className="text-[9px] text-stratum-text-muted">
```

(The Leaflet map itself stays full-bleed, no card wrapper — maps are conventionally edge-to-edge on mobile, and the design spec explicitly leaves the equivalent Sandbox map untouched for the same reason. The double-bezel treatment lands on the `BottomSheet` below instead.)

- [ ] **Step 2: Re-skin `BottomSheet.tsx`**

Replace the entire content of `webapp/src/components/mobile/BottomSheet.tsx` with:

```tsx
import { forwardRef, type ReactNode } from 'react'

interface BottomSheetProps {
  children: ReactNode
}

export const BottomSheet = forwardRef<HTMLDivElement, BottomSheetProps>(
  function BottomSheet({ children }, ref) {
    return (
      <div
        ref={ref}
        className="flex flex-col surface-card border-t border-stratum-border overflow-hidden"
        style={{ flexShrink: 0 }}
      >
        {/* DRAG DISABLED — revisit later */}
        {/*
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="flex-none flex flex-col items-center gap-1 pt-2 pb-1 select-none"
          style={{ touchAction: 'none', cursor: 'grab', minHeight: showHint ? 32 : 20 }}
        >
          <div className="w-7 h-[3px] bg-gray-300 rounded-full" />
          {showHint && (
            <span className="text-[9px] text-gray-400">↑ drag to expand</span>
          )}
        </div>
        */}
        {/* DRAG DISABLED — revisit later */}
        {children}
      </div>
    )
  }
)
```

(`surface-card` provides the gradient fill + dual shadow material; `shell-bezel`'s all-around gradient-stroke wrapper is deliberately skipped — this sheet is attached flush to the bottom and side edges of the screen, not a floating card, so a wrap-around bezel would look wrong. Same reasoning as Sandbox's edge-attached panels.)

- [ ] **Step 3: Re-skin `FacilityCard.tsx` with the severity ramp**

Replace the entire content of `webapp/src/components/mobile/FacilityCard.tsx` with:

```tsx
import type { TriageUIState } from '@shared/types'
import { useNextActions } from '../../hooks/useNextActions'

const SEVERITY_COLORS: Record<string, { bg: string }> = {
  emergent: { bg: 'var(--color-severity-emergent)' },
  urgent:   { bg: 'var(--color-severity-urgent)' },
  moderate: { bg: 'var(--color-severity-moderate)' },
  routine:  { bg: 'var(--color-severity-routine)' },
}

interface FacilityCardProps {
  triage: TriageUIState
}

export function FacilityCard({ triage }: FacilityCardProps) {
  const { getDirections, saveRecommendation } = useNextActions(triage.severity)

  if (!triage.active || !triage.severity || !triage.recommendedFacility) return null

  const sev = SEVERITY_COLORS[triage.severity] ?? { bg: '#888' }
  const facility = triage.recommendedFacility
  const route = triage.routes.find(r => r.facilityId === triage.recommendedFacilityId)

  return (
    <div className="flex flex-col">
      {/* Severity banner */}
      <div className="px-2 py-1" style={{ background: sev.bg }}>
        <span className="text-white text-[9px] font-bold tracking-widest uppercase">
          ⚠ {triage.severity.toUpperCase()} — RECOMMENDED
        </span>
      </div>

      {/* Facility info */}
      <div className="px-3 py-1.5">
        <p className="text-[11px] font-semibold text-stratum-text leading-snug">{facility.name}</p>
        <p className="text-[9px] text-stratum-text-muted mt-0.5">{facility.address}</p>
        <div className="flex items-center flex-wrap gap-1.5 mt-1">
          {route && (
            <span className="text-[9px] text-stratum-text-muted">
              🚗 {route.etaMinutes} min · {route.distanceKm} km
            </span>
          )}
          <span className="text-[8px] font-semibold text-stratum-accent-2 border border-stratum-accent-2/40 rounded-full px-1.5 py-0.5">
            Best route
          </span>
        </div>
        {triage.reasoning && (
          <p className="text-[8px] text-stratum-text-muted italic mt-1 leading-tight">{triage.reasoning}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-3 pb-2">
        <button
          onClick={() => getDirections(facility.name, facility.lat, facility.lng)}
          className="flex-1 rounded-stratum-md text-[11px] font-semibold text-white bg-stratum-accent"
          style={{ minHeight: 44, padding: '8px 0' }}
        >
          Directions
        </button>
        <button
          onClick={saveRecommendation}
          className="flex-1 rounded-stratum-md text-[11px] font-semibold border border-stratum-accent text-stratum-accent"
          style={{ minHeight: 44, padding: '8px 0' }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
```

(Severity colors now reference the same `--color-severity-*` custom properties the rest of the app uses, replacing the old ad-hoc hex values — this is the "map markers switch to the new severity color ramp" requirement from the design spec; there is no separate Leaflet-marker-color config to touch, this banner is the actual ad-hoc severity color in the mobile map experience.)

- [ ] **Step 4: Build**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/mobile/MapTab.tsx webapp/src/components/mobile/BottomSheet.tsx webapp/src/components/mobile/FacilityCard.tsx
git commit -m "style(mobile): re-skin map tab, bottom sheet, and facility card with severity ramp"
```

---

### Task 3: AI assistant chain (AiAssistantTab, QuickChips, SymptomInput)

**Files:**
- Modify: `webapp/src/components/mobile/AiAssistantTab.tsx`
- Modify: `webapp/src/components/mobile/QuickChips.tsx`
- Modify: `webapp/src/components/mobile/SymptomInput.tsx`

**Interfaces:** none — no props change on any component in this task.

- [ ] **Step 1: Re-skin `AiAssistantTab.tsx`**

Replace the entire content of `webapp/src/components/mobile/AiAssistantTab.tsx` with:

```tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import type {
  Message,
  Session,
  ConversationsCache,
  ChatMessageResponse,
  TriageResult,
  TriageUIState,
} from '@shared/types'
import { TriageCard } from '../triage/TriageCard'
import { ToolCallProgress } from '../triage/ToolCallProgress'
import { SymptomInput } from './SymptomInput'
import { QuickChips } from './QuickChips'
import type { GeolocationPermission } from '../../hooks/useGeolocation'

interface AuthUser {
  id: string
  email: string | undefined
}

interface GeoProps {
  coords: { lat: number; lng: number } | null
  requestOnce: () => Promise<{ lat: number; lng: number } | null>
  permission: GeolocationPermission
}

interface ProfileProps {
  location_preference: 'always' | 'ask'
  emergency_contact_phone?: string | null
}

type ProgressStage = 'idle' | 'typing' | 'analyzing' | 'locating' | 'complete'

interface AiAssistantTabProps {
  user: AuthUser | null
  cache: ConversationsCache | null
  sendMessage: (
    sessionId: string,
    content: string,
    coords?: { lat: number; lng: number } | null
  ) => Promise<ChatMessageResponse | null>
  createSession: (firstMessage: string) => Promise<Session | null>
  loadOlderMessages: (sessionId: string, beforeId: string) => Promise<Message[]>
  geo: GeoProps
  profile: ProfileProps | null
  triage: TriageUIState
  onTriageResult: (
    result: TriageResult,
    coords: { lat: number; lng: number } | null
  ) => Promise<void>
  onNewConversation: () => void
  symptomValue: string
  onSymptomChange: (v: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function stripToolNarration(content: string): string {
  return content
    .replace(/I'm going to call[\s\S]*?triage_response\([^)]*\)\s*/gi, '')
    .trim()
}

export function AiAssistantTab({
  user,
  cache,
  sendMessage,
  createSession,
  loadOlderMessages,
  geo,
  profile,
  triage,
  onTriageResult,
  onNewConversation,
  symptomValue,
  onSymptomChange,
}: AiAssistantTabProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [localMessages, setLocalMessages] = useState<Message[]>([])
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [progressStage, setProgressStage] = useState<ProgressStage>('idle')
  const [pastConvosOpen, setPastConvosOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages])

  const handleNewConversation = () => {
    setActiveSessionId(null)
    setLocalMessages([])
    onSymptomChange('')
    onNewConversation()
  }

  const handleSelectSession = (session: Session) => {
    setActiveSessionId(session.id)
    setLocalMessages(cache?.messages[session.id] ?? [])
  }

  const handleSend = async () => {
    if (!symptomValue.trim() || !user) return
    const text = symptomValue.trim()
    onSymptomChange('')

    let coords = geo.coords
    if (!coords) {
      if (profile?.location_preference === 'always') {
        coords = await geo.requestOnce()
      } else if (!activeSessionId) {
        coords = await geo.requestOnce()
      }
    }

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
    setLocalMessages(prev => [...prev, optimisticMsg])

    setProgressStage('typing')
    const response = await sendMessage(sid, text, coords)

    if (response) {
      const cleanedAssistant = {
        ...response.assistant_message,
        content: stripToolNarration(response.assistant_message.content),
      }
      setLocalMessages(prev => [
        ...prev.filter(m => m.id !== optimisticMsg.id),
        optimisticMsg,
        cleanedAssistant,
      ])
      if (response.triage) {
        setProgressStage('analyzing')
        await onTriageResult(response.triage, coords)
        setProgressStage('complete')
        setTimeout(() => setProgressStage('idle'), 800)
      } else {
        setProgressStage('idle')
      }
    } else {
      setProgressStage('idle')
    }
  }

  const handleScroll = useCallback(async () => {
    const el = scrollContainerRef.current
    if (!el || !activeSessionId || localMessages.length === 0) return
    // column-reverse: scrollTop=0 is the visual bottom (newest msgs).
    // Load older messages when near the visual top = scrollTop near its maximum.
    const distanceFromTop = el.scrollHeight - el.clientHeight - el.scrollTop
    if (distanceFromTop > 50) return
    if (loadMoreRef.current) return

    const oldest = localMessages[0]
    if (!oldest.created_at.includes('+')) return

    loadMoreRef.current = true
    setLoadingOlder(true)
    try {
      const older = await loadOlderMessages(activeSessionId, oldest.id)
      if (older.length > 0) setLocalMessages(prev => [...older, ...prev])
    } finally {
      setLoadingOlder(false)
      loadMoreRef.current = false
    }
  }, [activeSessionId, localMessages, loadOlderMessages])

  const sessions = cache?.sessions ?? []
  const recentSessions = sessions.slice(0, 2)
  const hasMessages = localMessages.length > 0
  const lastMsg = localMessages[localMessages.length - 1]
  const showTriageCard = triage.active && lastMsg?.role === 'assistant'

  return (
    <div className="flex flex-col h-full bg-stratum-bg/50">
      {/* AI header */}
      <div
        className="flex-none flex items-center justify-between px-4 surface-card border-b border-stratum-border"
        style={{ minHeight: 48, paddingTop: 10, paddingBottom: 10 }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-none animate-pulse" />
          <div>
            <p className="text-[13px] font-bold text-stratum-text leading-tight">AI health assistant</p>
            <p className="text-[10px] text-stratum-text-muted">Online · secure &amp; confidential</p>
          </div>
        </div>
        <button
          onClick={handleNewConversation}
          disabled={!user}
          className="px-3 py-1.5 text-[11px] font-semibold text-stratum-accent-2 border border-stratum-accent-2/40 rounded-[20px] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ minHeight: 32 }}
        >
          ＋ New
        </button>
      </div>

      {/* Scrollable content */}
      {hasMessages ? (
        // column-reverse anchors content to the bottom — newest messages stay visible
        // without programmatic scroll. DOM order is reversed from visual order:
        //   1st child (DOM) = past conversations → visual bottom, just above input bar
        //   2nd child (DOM) = message thread     → visual top, grows upward
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col-reverse"
        >
          {/* 1st in DOM → visual bottom */}
          {user && recentSessions.length > 0 && (
            <div className="px-4 mt-4 pt-4 pb-2 border-t border-stratum-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-stratum-text-muted uppercase tracking-wide">
                  Past conversations
                </span>
                <button
                  onClick={() => setPastConvosOpen(v => !v)}
                  className="text-[11px] font-semibold text-stratum-accent-2"
                >
                  {pastConvosOpen ? 'Hide' : 'See'}
                </button>
              </div>
              <div
                style={{
                  maxHeight: pastConvosOpen ? '400px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.25s ease',
                }}
              >
                <div className="flex flex-col gap-2">
                  {recentSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      className="w-full text-left px-3 py-2.5 border border-stratum-border rounded-stratum-lg bg-white"
                    >
                      <p className="text-[9px] font-semibold text-stratum-text leading-snug">
                        {session.title}
                      </p>
                      <p className="text-[8px] text-stratum-text-muted mt-0.5">
                        {formatDate(session.updated_at)}
                      </p>
                    </button>
                  ))}
                </div>
                <button className="text-[11px] font-semibold text-stratum-accent-2 mt-2 block">See all</button>
              </div>
            </div>
          )}

          {/* 2nd in DOM → visual top (message thread, chronological column within) */}
          <div className="flex flex-col gap-3 px-4 py-4">
            {loadingOlder && (
              <p className="text-center text-[11px] text-stratum-text-muted py-2">Loading older messages…</p>
            )}
            {localMessages.map((msg, idx) => {
              const isLastAssistant = msg.role === 'assistant' && idx === localMessages.length - 1
              return (
                <div key={msg.id}>
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] min-w-0 px-3 py-2 text-[13px] leading-snug break-words overflow-hidden ${
                        msg.role === 'user'
                          ? 'bg-stratum-accent text-white'
                          : 'bg-white border border-stratum-border text-stratum-text shadow-sm'
                      }`}
                      style={{
                        borderRadius:
                          msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                  {isLastAssistant && showTriageCard && (
                    <div className="mt-1 max-w-[80%]">
                      <TriageCard
                        triage={triage}
                        emergencyContactPhone={profile?.emergency_contact_phone ?? null}
                      />
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      ) : (
        // Empty state — centered, no column-reverse needed
        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center justify-center gap-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-stratum-lg bg-stratum-accent flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white">
                <path
                  d="M8 10h8M8 14h4M21 12c0 4.97-4.03 9-9 9-2.07 0-3.98-.7-5.5-1.88L3 20l.88-3.5C2.7 14.98 2 13.07 2 12c0-4.97 4.03-9 9-9s9 4.03 9 9z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-[17px] font-bold text-stratum-text">How are you feeling?</h3>
            <p className="text-[13px] text-stratum-text-muted mt-1 max-w-[240px] mx-auto">
              Describe your symptoms or ask a health-related question.
            </p>
          </div>
          <QuickChips
            onSelect={v => { if (user) onSymptomChange(v) }}
            disabled={!user}
          />
          {user && recentSessions.length > 0 && (
            <div className="w-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-stratum-text-muted uppercase tracking-wide">
                  Past conversations
                </span>
                <button
                  onClick={() => setPastConvosOpen(v => !v)}
                  className="text-[11px] font-semibold text-stratum-accent-2"
                >
                  {pastConvosOpen ? 'Hide' : 'See'}
                </button>
              </div>
              <div
                style={{
                  maxHeight: pastConvosOpen ? '400px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.25s ease',
                }}
              >
                <div className="flex flex-col gap-2">
                  {recentSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      className="w-full text-left px-3 py-2.5 border border-stratum-border rounded-stratum-lg bg-white"
                    >
                      <p className="text-[9px] font-semibold text-stratum-text leading-snug">
                        {session.title}
                      </p>
                      <p className="text-[8px] text-stratum-text-muted mt-0.5">
                        {formatDate(session.updated_at)}
                      </p>
                    </button>
                  ))}
                </div>
                <button className="text-[11px] font-semibold text-stratum-accent-2 mt-2 block">See all</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress trace */}
      <ToolCallProgress stage={progressStage} />

      {/* Pinned input */}
      <div className="flex-none px-4 pt-3 pb-5 surface-card border-t border-stratum-border">
        <SymptomInput
          value={symptomValue}
          onChange={onSymptomChange}
          onSend={handleSend}
          disabled={!user}
          className="bg-white"
        />
        {geo.permission === 'denied' ? (
          <p className="text-[10px] font-semibold text-center mt-2">
            <span style={{ color: 'var(--color-severity-urgent)' }}>⚠ Location blocked — facility map routing unavailable</span>
          </p>
        ) : (
          <p className="text-[10px] font-semibold text-center text-stratum-text-muted mt-2 flex items-center justify-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Secure &amp; confidential
          </p>
        )}
      </div>
    </div>
  )
}
```

(The online-status dot stays `bg-emerald-500` — a generic platform "online" indicator, not a severity context, same reasoning as leaving the Sandbox status colors and Google's brand colors untouched. The location-blocked warning's color changes from the old ad-hoc `#E8813A` to `var(--color-severity-urgent)` — it's a genuinely elevated-concern message, so this is exactly the "replace ad-hoc severity colors" requirement, not a stretch.)

- [ ] **Step 2: Re-skin `QuickChips.tsx`**

Replace the entire content of `webapp/src/components/mobile/QuickChips.tsx` with:

```tsx
const SUGGESTIONS = [
  'I have a fever and sore throat',
  'Chest pain and shortness of breath',
  'Twisted my ankle — it\'s swollen',
] as const

interface QuickChipsProps {
  onSelect: (text: string) => void
  disabled?: boolean
}

export function QuickChips({ onSelect, disabled = false }: QuickChipsProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      {SUGGESTIONS.map(s => (
        <button
          key={s}
          onClick={() => { if (!disabled) onSelect(s) }}
          disabled={disabled}
          className="w-full text-left px-4 py-3 text-[13px] font-medium text-stratum-text bg-white border border-stratum-border rounded-stratum-md hover:border-stratum-accent-2 hover:bg-stratum-bg hover:text-stratum-text transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: 44 }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Re-skin `SymptomInput.tsx`**

Replace the entire content of `webapp/src/components/mobile/SymptomInput.tsx` with:

```tsx
interface SymptomInputProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function SymptomInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = 'Describe how you feel…',
  className = '',
}: SymptomInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div
      className={`flex items-center gap-2 bg-stratum-bg border border-stratum-border px-3 py-2 rounded-stratum-bezel ${className}`}
    >
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder={placeholder}
        className="flex-1 bg-transparent resize-none text-[13px] text-stratum-text focus:outline-none placeholder-stratum-text-muted disabled:cursor-not-allowed leading-5"
        style={{ minHeight: 24 }}
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-none transition-all ${!disabled && value.trim()
            ? 'bg-stratum-accent text-white'
            : 'bg-stratum-border text-stratum-text-muted cursor-not-allowed'
          }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
```

(The old inline `borderRadius: 14` becomes the `rounded-stratum-bezel` token (15px) — a 1px difference, visually indistinguishable, and keeps this fully tokenized instead of carrying one arbitrary non-token radius.)

- [ ] **Step 4: Build**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/mobile/AiAssistantTab.tsx webapp/src/components/mobile/QuickChips.tsx webapp/src/components/mobile/SymptomInput.tsx
git commit -m "style(mobile): re-skin AI assistant tab, quick chips, and symptom input"
```

---

### Task 4: DrawerMenu re-skin

**Files:**
- Modify: `webapp/src/components/mobile/DrawerMenu.tsx`

**Interfaces:** none — `DrawerMenuProps` and all behavior (navigation handlers, sign-out) unchanged.

- [ ] **Step 1: Replace the file content**

Replace the entire content of `webapp/src/components/mobile/DrawerMenu.tsx` with:

```tsx
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

interface DrawerMenuProps {
  isOpen: boolean
  onClose: () => void
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 21V12h6v9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 01-3.46 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="16,17 21,12 16,7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="21"
        y1="12"
        x2="9"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DrawerMenu({ isOpen, onClose }: DrawerMenuProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const email = user?.email ?? ''
  const initials = email ? email[0].toUpperCase() : '?'
  const displayName = email
    ? email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : ''

  const handleHome = () => {
    onClose()
    navigate('/app')
  }

  const handleProfile = () => {
    onClose()
    navigate('/setup')
  }

  const handleTestNotifications = () => {
    onClose()
    navigate('/test-notif')
  }

  const handleSignOut = async () => {
    onClose()
    await signOut()
  }

  return (
    <>
      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(0,0,0,0.4)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        className="surface-card"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          zIndex: 50,
          width: 260,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
        }}
      >
        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 20px 20px' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--color-stratum-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-stratum-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-stratum-text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email}
            </p>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--color-stratum-border)', margin: '0 20px' }} />

        {/* Home */}
        <button
          onClick={handleHome}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 20px',
            minHeight: 44,
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'var(--color-stratum-text)',
          }}
        >
          <HomeIcon />
          <span style={{ flex: 1, fontSize: 14 }}>Home</span>
          <span style={{ color: 'var(--color-stratum-text-muted)' }}>
            <ChevronRightIcon />
          </span>
        </button>

        <div style={{ height: 1, background: 'var(--color-stratum-border)', margin: '0 20px' }} />

        {/* My profile */}
        <button
          onClick={handleProfile}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 20px',
            minHeight: 44,
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'var(--color-stratum-text)',
          }}
        >
          <ProfileIcon />
          <span style={{ flex: 1, fontSize: 14 }}>My profile</span>
          <span style={{ color: 'var(--color-stratum-text-muted)' }}>
            <ChevronRightIcon />
          </span>
        </button>

        <div style={{ height: 1, background: 'var(--color-stratum-border)', margin: '0 20px' }} />

        {/* Test notifications */}
        <button
          onClick={handleTestNotifications}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 20px',
            minHeight: 44,
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'var(--color-stratum-text)',
          }}
        >
          <BellIcon />
          <span style={{ flex: 1, fontSize: 14 }}>Test notifications</span>
          <span style={{ color: 'var(--color-stratum-text-muted)' }}>
            <ChevronRightIcon />
          </span>
        </button>

        <div style={{ height: 1, background: 'var(--color-stratum-border)', margin: '0 20px' }} />

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 20px',
            minHeight: 44,
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            color: '#dc2626',
          }}
        >
          <SignOutIcon />
          <span style={{ flex: 1, fontSize: 14 }}>Sign out</span>
        </button>
      </div>
    </>
  )
}
```

(The drawer is a flush, full-height side panel — `surface-card` className supplies the gradient fill + dual shadow material; `shell-bezel`'s all-around rounded bezel is skipped since the drawer has square edges flush to the screen, same reasoning as `BottomSheet`. The overlay scrim and the sign-out red (`#dc2626`, a destructive-action color outside both the structural and severity token sets) stay exactly as they are.)

- [ ] **Step 2: Build**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/DrawerMenu.tsx
git commit -m "style(mobile): re-skin DrawerMenu with Stratum tokens"
```

---

### Task 5: Visual verification

**Files:** none modified — verification only.

**Interfaces:** none.

- [ ] **Step 1: Full production build**

Run: `cd webapp && npm run build`
Expected: exits 0, `tsc -b` reports no errors, `vite build` completes.

- [ ] **Step 2: Start or reuse the dev server**

Check whether a dev server is already running on port 5173 before starting a new one (this has happened repeatedly in this session's prior verification tasks). Reuse it if so; otherwise start one and remember to stop it when done.

- [ ] **Step 3: Playwright check at a mobile viewport**

Use the `playwright-cli` skill (no Playwright MCP server in this environment) against the dev server, with the browser viewport set to a phone size (e.g. 390×844) so `MobileLayout` renders instead of the desktop `Home` shell:

1. Navigate to `/app` at the mobile viewport — confirm the top bar is beige (Stratum), and confirm the bottom Navigation Dock renders as a floating pill (not a flush top strip) with the active tab ("Map view") highlighted in the tan `stratum-accent` color and a small pulse dot visible.
2. Tap "AI assistant" in the dock — confirm the active highlight moves to that tab, the map/AI content swaps, and the AI tab's header/input bar render with the beige card material (not white/gray-100).
3. Tap the hamburger icon in the top bar — confirm `DrawerMenu` slides in from the right with the beige card material, and the avatar circle is the tan accent color (not blue).
4. If a triage result can be reached (may require backend + auth, same caveat as prior sub-projects' verification tasks — note as ⚠️ if not reachable rather than skipping silently), confirm `FacilityCard`'s severity banner uses one of the four severity-ramp colors, not the old ad-hoc hex values.
5. Take one screenshot of the mobile `/app` view (map tab, dock visible) and one of the AI assistant tab.

No defects expected; if any step fails, treat it as a real bug in this task's re-skin code and fix it before reporting done. Pay particular attention to whether the map and bottom sheet still fill the screen correctly with no visible gap or overlap at the dock boundary — this is the one place in this sub-project where layout math (not just colors) changed, per Task 1/2's `DOCK_H` constant.

- [ ] **Step 4: Commit (only if a fix was needed)**

If verification passed with no fixes needed, there is nothing to commit for this task.

---

## Self-Review Notes

- **Spec coverage:** `MobileNavBar` top-bar re-skin → Task 1. Tab-switcher-to-dock conversion → Task 1 (corrected from the spec's original mistaken attribution to `MobileNavBar`). `BottomSheet`/`FacilityCard` card material + severity ramp → Task 2. `MapTab` double-bezel-adjacent container treatment (applied to its sheet, not the full-bleed map) → Task 2. `AiAssistantTab`/`QuickChips`/`SymptomInput` → Task 3. `DrawerMenu` → Task 4. `MobileLayout` container-level token updates → Task 1 (background color) — its breakpoint-detection logic and tab-state management are untouched, as required.
- **Placeholder scan:** none — every step has literal, complete file content.
- **Type consistency:** `DOCK_H` is introduced in Task 1 (the dock's literal `64`) and consumed by name in Task 2's `MapTab.tsx` edit — both tasks use the same constant name and value. No prop interfaces change anywhere in this plan.
