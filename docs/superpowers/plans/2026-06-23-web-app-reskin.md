# Web App Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the existing web app (Home map+chat shell, nav, auth/onboarding modals, sandbox) from ad-hoc Tailwind defaults (gray-200 borders, blue-600 accents) to the merged design system (Stratum light palette for the app, Aura dark palette for Sandbox) landed in sub-project 1. Pure re-skin — no structural changes, no new features.

**Architecture:** Token-only changes everywhere. The app shell, nav, and modals swap Tailwind utility classes from generic grays/blues to the `stratum-*` design tokens and the `surface-card`/`shell-bezel` material utilities (all already defined in `webapp/src/index.css` from sub-project 1). Sandbox already drives its colors through CSS custom properties scoped to `.sandbox-layout` (`webapp/src/pages/SandboxPage.css`) — re-skinning it means changing those variable *values* to Aura-derived ones, not touching the components that consume them (most Sandbox components inherit the new palette automatically).

**Tech Stack:** React 19, Tailwind v4 (design-system tokens from sub-project 1: `stratum-*` colors, `severity-*` colors, `radius-stratum-*`, `surface-card`, `shell-bezel`, `text-display-*`/`text-body-*`/`text-label-*`).

## Global Constraints

- No structural rebuild, no new screens or flows — this is a re-skin pass only (per `docs/superpowers/specs/2026-06-22-web-app-reskin-design.md`).
- Sandbox's System Shock playback controls stay styled-but-unwired (already marked not-wired in the changelog) — do not wire them.
- Semantic/status colors that aren't part of the Stratum or Aura palettes (severity-unrelated log-level colors, System Shock button warning/success states, the capacity gauge's red/amber/green gradient) stay untouched — only the *structural* bg/surface/text/border roles get re-skinned.
- The Sandbox lab-flask accent color (`#EF9F27`) on `WebNavBar`'s "Sandbox" link stays exactly as-is — it's a deliberate visual cue for the dark zone beyond, per the design spec.
- Token names must be the ones that actually exist in `webapp/src/index.css`: `stratum-bg`, `stratum-surface`, `stratum-accent`, `stratum-accent-2`, `stratum-accent-3`, `stratum-neutral`, `stratum-text`, `stratum-text-muted`, `stratum-border`; `radius-stratum-xs/sm/md/control/lg/xl/bezel`; `surface-card`, `shell-bezel`, `surface-sandbox-card`; `text-display-lg/md`, `text-body-md`, `text-label-md`, `text-mono-meta`.

---

### Task 1: Sandbox dark palette (Aura)

**Files:**
- Modify: `webapp/src/pages/SandboxPage.css`
- Modify: `webapp/src/components/sandbox/InspectorPanel.tsx`
- Modify: `webapp/src/components/sandbox/SandboxSplashScreen.tsx`

**Interfaces:** none — pure value/style changes, no props or exports change. `SandboxHeader.tsx` and `SimulationPanel.tsx` need NO changes in this task — they already consume the `--sb-*` CSS variables exclusively for their structural colors, so they inherit the new Aura-derived values automatically once `SandboxPage.css` changes.

- [ ] **Step 1: Update the `--sb-*` CSS variable values in `SandboxPage.css`**

In `webapp/src/pages/SandboxPage.css`, replace the `.sandbox-layout` variable block:

```css
.sandbox-layout {
  --sb-bg-primary:     #050505; /* Aura background */
  --sb-bg-secondary:   #18181B; /* Aura surface */
  --sb-bg-tertiary:    #0A0A0A; /* Between primary and surface, for contrast elements */
  --sb-border:         #27272A; /* Aura border */
  --sb-text-primary:   #FFFFFF; /* Aura text primary */
  --sb-text-secondary: #A1A1AA; /* Aura text secondary */
  --sb-text-muted:     #71717A; /* Dimmer third tier, not in Aura's 5-token set */
  --sb-accent:         #F59E0B; /* Vibrant amber yellow */
  --sb-accent-dim:     rgba(245, 158, 11, 0.15);
  --sb-teal:           #1D9E75;
  --sb-blue:           #3B82F6;
  --sb-red:            #EF4444;
}
```

(Only the first 7 variables change — `--sb-accent`, `--sb-accent-dim`, `--sb-teal`, `--sb-blue`, `--sb-red` are semantic status colors outside Aura's defined scope and stay exactly as they are.)

- [ ] **Step 2: Replace hardcoded duplicate-of-token-value literals in `InspectorPanel.tsx`**

In `webapp/src/components/sandbox/InspectorPanel.tsx`, there are two places where `"#0F172A"` is hardcoded as the old `--sb-bg-tertiary` value (used as a dark icon color against the amber accent background) and one place where `"#64748B"` is hardcoded as the old `--sb-text-muted` value. Replace all three with variable references so they track the new palette:

Find (around line 75):
```tsx
              <i className="ti ti-message-circle-2" style={{ fontSize: 28, color: "#0F172A" }}></i>
```
Replace with:
```tsx
              <i className="ti ti-message-circle-2" style={{ fontSize: 28, color: "var(--sb-bg-primary)" }}></i>
```

Find (around line 101):
```tsx
                  color:
                    msg.role === "user" ? "#0F172A" : "var(--sb-text-primary)",
```
Replace with:
```tsx
                  color:
                    msg.role === "user" ? "var(--sb-bg-primary)" : "var(--sb-text-primary)",
```

Find (around line 180):
```tsx
          <span style={{ color: "#64748B", opacity: 0.85, paddingTop: 2 }}>
```
Replace with:
```tsx
          <span style={{ color: "var(--sb-text-muted)", opacity: 0.85, paddingTop: 2 }}>
```

- [ ] **Step 3: Convert `SandboxSplashScreen.tsx` from its own one-off hardcoded palette to the shared `--sb-*` variables**

`SandboxSplashScreen` renders inside the same `.sandbox-layout`-scoped tree as the rest of Sandbox (see `SandboxPage.tsx`'s ternary), but currently hardcodes its own near-duplicate colors instead of using the shared variables. Replace the whole file with:

```tsx
import { useState, useEffect } from "react"

const STEPS = [
  { text: "Initializing MediCoord Sandbox v2.0...",            delay: 0,    duration: 600 },
  { text: "Loading synthetic facility dataset (393 records)...", delay: 700,  duration: 700 },
  { text: "Configuring simulation engine...",                   delay: 1500, duration: 500 },
  { text: "Provisioning isolated session...",                   delay: 2100, duration: 600 },
  { text: "Mounting visualization canvas...",                   delay: 2800, duration: 400 },
  { text: "Ready.",                                             delay: 3300, duration: 300 },
]

export function SandboxSplashScreen({ onComplete }: { onComplete: () => void }) {
  // visibleLines: how many lines have appeared
  const [visibleLines, setVisibleLines] = useState(0)
  // completedLines: how many lines have their checkmark
  const [completedLines, setCompletedLines] = useState(0)
  const [showSkip, setShowSkip] = useState(false)
  const [fading, setFading] = useState(false)

  const progress = (completedLines / STEPS.length) * 100

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    STEPS.forEach((step, i) => {
      // Line appears at step.delay
      timers.push(setTimeout(() => setVisibleLines(i + 1), step.delay))
      // Checkmark appears after cursor blinks for duration
      timers.push(setTimeout(() => setCompletedLines(i + 1), step.delay + step.duration))
    })

    // After last checkmark + 400ms pause: fade out then call onComplete
    const lastComplete = STEPS[STEPS.length - 1].delay + STEPS[STEPS.length - 1].duration
    timers.push(
      setTimeout(() => {
        setFading(true)
        timers.push(setTimeout(onComplete, 400))
      }, lastComplete + 400)
    )

    // Skip link after 1s
    timers.push(setTimeout(() => setShowSkip(true), 1000))

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        background: "var(--sb-bg-primary)",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.4s ease",
      }}
    >
      <div style={{ width: 560, maxWidth: "90vw" }}>

        {/* Identity header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 32,
          fontFamily: '"Fira Code", "JetBrains Mono", "SF Mono", monospace',
        }}>
          <i className="ti ti-flask" style={{ fontSize: 18, color: "var(--sb-accent)" }} aria-hidden="true" />
          <span style={{
            fontSize: 14,
            color: "var(--sb-accent)",
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}>
            MEDICOORD AI
          </span>
          <span style={{
            fontSize: 11,
            color: "var(--sb-text-muted)",
            fontWeight: 500,
            letterSpacing: "0.12em",
            paddingLeft: 8,
            borderLeft: "1px solid var(--sb-border)",
          }}>
            SANDBOX v2.0
          </span>
        </div>

        {/* Terminal lines */}
        <div style={{ fontFamily: '"Fira Code", "JetBrains Mono", "SF Mono", monospace', fontSize: 13, lineHeight: 1.9, color: "var(--sb-text-secondary)" }}>
          {STEPS.slice(0, visibleLines).map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span>
                <span style={{ color: "var(--sb-accent)", marginRight: 10 }}>{">"}</span>
                {step.text}
              </span>
              {i < completedLines ? (
                <span style={{ color: "var(--sb-accent)", fontSize: 14, marginLeft: "auto", paddingLeft: 16 }}>✓</span>
              ) : (
                <span className="sandbox-cursor" style={{ marginLeft: 4 }} />
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 20 }}>
          <div style={{
            height: 2,
            background: "var(--sb-border)",
            borderRadius: 1,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${progress}%`,
              background: "var(--sb-accent)",
              borderRadius: 1,
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>

      </div>

      {/* Skip link */}
      {showSkip && (
        <button
          onClick={() => { setFading(true); setTimeout(onComplete, 400) }}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "none",
            border: "none",
            color: "var(--sb-text-muted)",
            fontSize: 12,
            fontFamily: '"Fira Code", "JetBrains Mono", "SF Mono", monospace',
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          skip
          <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
        </button>
      )}
    </div>
  )
}
```

(The only logic/structure change from the original file: every hardcoded hex color is replaced with the matching `var(--sb-*)` reference, and the generic `fontFamily: "monospace"` becomes the same explicit mono stack already used in `SandboxHeader.tsx`/`InspectorPanel.tsx`. No timing, JSX structure, or behavior changes.)

- [ ] **Step 4: Build**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/pages/SandboxPage.css webapp/src/components/sandbox/InspectorPanel.tsx webapp/src/components/sandbox/SandboxSplashScreen.tsx
git commit -m "style(sandbox): formalize dark palette as Aura tokens"
```

---

### Task 2: WebNavBar re-skin

**Files:**
- Modify: `webapp/src/components/WebNavBar.tsx`

**Interfaces:** none — `WebNavBarProps` (`{ rightContent?: React.ReactNode }`) is unchanged; this is a pure visual re-skin of the component's own markup.

- [ ] **Step 1: Replace the file content**

Replace the entire content of `webapp/src/components/WebNavBar.tsx` with:

```tsx
import { Link } from 'react-router-dom'

interface WebNavBarProps {
  rightContent?: React.ReactNode
}

export function WebNavBar({ rightContent }: WebNavBarProps) {
  return (
    <header className="flex-none flex items-center justify-between px-8 bg-stratum-bg border-b border-stratum-border z-10" style={{ height: 64 }}>
      <Link to="/app" className="flex items-center gap-3 no-underline">
        <div className="flex items-center justify-center w-10 h-10 rounded-stratum-control flex-none overflow-hidden shadow-md">
          <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
        </div>
        <div className="leading-tight flex flex-col">
          <span className="text-lg font-bold text-stratum-text tracking-tight">
            MediCoord<span className="text-stratum-accent">AI</span>
          </span>
          <span className="text-label-md text-stratum-text-muted uppercase tracking-wider">
            Health Tech Platform
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-4 ml-auto">
        <Link
          to="/sandbox"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-stratum-text-muted hover:text-stratum-text rounded-stratum-md transition-colors no-underline"
          style={{ border: "0.5px solid var(--color-stratum-border)" }}
        >
          <i className="ti ti-flask" style={{ fontSize: 13, color: "#EF9F27" }} />
          Sandbox
        </Link>
        {rightContent && <div className="flex items-center gap-4">{rightContent}</div>}
      </div>
    </header>
  )
}
```

(The Sandbox link's lab-flask icon color `#EF9F27` is unchanged — deliberate per the design spec. The link's border uses the raw CSS variable `var(--color-stratum-border)` instead of a `border-stratum-border` utility class because it's set via inline `style`, not `className`, in the original — keeping that pattern rather than restructuring it into a className-only border.)

- [ ] **Step 2: Build**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/WebNavBar.tsx
git commit -m "style(nav): re-skin WebNavBar with Stratum tokens"
```

---

### Task 3: Home shell re-skin (map+chat panels, footer)

**Files:**
- Modify: `webapp/src/Menucomponents/Home.tsx`

**Interfaces:**
- Consumes: `WebNavBar` (Task 2, same props), design-system utilities `bg-stratum-bg`, `text-stratum-text-muted`, `text-stratum-text`, `bg-stratum-accent`, `rounded-stratum-control`, `surface-card`, `shell-bezel`, `rounded-stratum-lg`, `border-stratum-border`.

- [ ] **Step 1: Replace the file content**

Replace the entire content of `webapp/src/Menucomponents/Home.tsx` with:

```tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Facility, Message, Session, ConversationsCache, ChatMessageResponse } from '@shared/types'
import { MapPanel } from '../components/map'
import { ChatPanel } from './subcomponent/ChatPanel'
import { LoginModal } from '../components/auth/LoginModal'
import { UserMenu } from '../components/auth/UserMenu'
import { WebNavBar } from '../components/WebNavBar'
import { GettingStartedModal } from '../components/onboarding/GettingStartedModal'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useGeolocation } from '../hooks/useGeolocation'
import { useTriageState } from '../hooks/useTriageState'

interface HomeProps {
  facilities: Facility[]
  facilitiesLoading: boolean
  conversationsCache: ConversationsCache | null
  sendMessage: (sessionId: string, content: string, coords?: { lat: number; lng: number } | null) => Promise<ChatMessageResponse | null>
  createSession: (firstMessage: string) => Promise<Session | null>
  loadOlderMessages: (sessionId: string, beforeId: string) => Promise<Message[]>
}

export default function Home({ facilities, facilitiesLoading, conversationsCache, sendMessage, createSession, loadOlderMessages }: HomeProps) {
  const { user } = useAuth()
  const { profile, updateProfile } = useProfile()
  const geo = useGeolocation()
  const { triage, applyTriageResult, reset: triageReset } = useTriageState()
  const [sessionKey, setSessionKey] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<"signin" | "signup">("signin")
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  const handleNewConversation = () => {
    triageReset()
    setSessionKey(k => k + 1)  // remounts ChatPanel, clearing all local state
  }

  useEffect(() => {
    if (!user) geo.setCoords(null)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOnboardingComplete = async (data: {
    location_preference: 'always' | 'ask'
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
  }) => {
    await updateProfile({ ...data, getting_started_done: true })
  }

  const openSignIn = () => { setModalTab("signin"); setIsModalOpen(true) }
  const openSignUp = () => { setModalTab("signup"); setIsModalOpen(true) }

  return (
    <div className="flex flex-col h-screen bg-stratum-bg">
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
              className="px-4 py-2 text-sm font-semibold text-stratum-text-muted hover:text-stratum-text transition-colors"
              onClick={openSignIn}
            >
              Sign in
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-stratum-control bg-stratum-accent hover:opacity-90 transition-all active:scale-95"
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
        <div className="flex-[7] overflow-hidden surface-card shell-bezel rounded-stratum-lg relative">
          <MapPanel
            facilities={facilities}
            facilitiesLoading={facilitiesLoading}
            triage={triage}
            onClear={handleNewConversation}
          />
        </div>

        {/* Chat panel */}
        <div className="flex-[3] overflow-hidden surface-card shell-bezel rounded-stratum-lg relative min-w-[320px]">
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
      <div
        className="flex-none flex items-center justify-between px-8 border-stratum-border text-stratum-text-muted"
        style={{
          height: 28,
          borderTopWidth: "0.5px",
          fontSize: 11,
        }}
      >
        <span>MediCoord AI · Health Tech Platform</span>
        <Link
          to="/sandbox"
          className="flex items-center gap-1 no-underline text-stratum-text-muted hover:text-stratum-text"
          style={{ fontWeight: 600 }}
        >
          <i className="ti ti-flask" style={{ fontSize: 12, color: "#EF9F27" }} />
          Open Sandbox →
        </Link>
      </div>
    </div>
  )
}
```

(The map/chat panels now use the same `surface-card shell-bezel rounded-stratum-lg` combination as the landing page's step/feature cards from sub-project 2 — consistent material language across the whole product. The footer's `border-stratum-border` className handles the border *color*; `borderTopWidth: "0.5px"` stays inline since Tailwind has no built-in 0.5px border-width utility. The "Open Sandbox" link gains a `hover:text-stratum-text` state it didn't have before — a one-line consistency addition matching every other interactive text element re-skinned in this task, not a new feature.)

- [ ] **Step 2: Build**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/Menucomponents/Home.tsx
git commit -m "style(home): re-skin map+chat shell and footer with Stratum tokens"
```

---

### Task 4: LoginModal re-skin

**Files:**
- Modify: `webapp/src/components/auth/LoginModal.tsx`

**Interfaces:** none — `LoginModalProps` (`{ isOpen, onClose, defaultTab? }`) and all internal behavior (tab switching, `useEffect` re-sync from sub-project 2) are unchanged; pure visual re-skin.

- [ ] **Step 1: Replace the file content**

Replace the entire content of `webapp/src/components/auth/LoginModal.tsx` with:

```tsx
import { useEffect, useState } from "react"
import { useAuth } from "../../auth/useAuth"

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: "signin" | "signup"
}

export function LoginModal({ isOpen, onClose, defaultTab = "signin" }: LoginModalProps) {
  const { loading, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
  const [tab, setTab] = useState<"signin" | "signup">(defaultTab)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    if (isOpen) setTab(defaultTab)
  }, [isOpen, defaultTab])

  if (!isOpen) return null

  const handleEmailAction = async () => {
    if (tab === "signin") {
      await signInWithEmail(email, password)
    } else {
      await signUpWithEmail(email, password)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4 surface-card shell-bezel rounded-stratum-lg p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className="absolute top-4 right-4 text-stratum-text-muted hover:text-stratum-text transition-colors text-xl leading-none"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        {/* Logo + title */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-stratum-text">
            {tab === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-stratum-text-muted mt-1">
            {tab === "signin"
              ? "Sign in to your MediCoord account"
              : "Get started with MediCoord AI"}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-stratum-md bg-stratum-bg p-1 mb-6">
          <button
            className={`flex-1 py-2 text-sm font-semibold rounded-stratum-md transition-all ${
              tab === "signin"
                ? "bg-white text-stratum-text shadow-sm"
                : "text-stratum-text-muted hover:text-stratum-text"
            }`}
            onClick={() => setTab("signin")}
          >
            Sign in
          </button>
          <button
            className={`flex-1 py-2 text-sm font-semibold rounded-stratum-md transition-all ${
              tab === "signup"
                ? "bg-white text-stratum-text shadow-sm"
                : "text-stratum-text-muted hover:text-stratum-text"
            }`}
            onClick={() => setTab("signup")}
          >
            Sign up
          </button>
        </div>

        {/* Email + password fields */}
        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-stratum-text mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 text-sm border border-stratum-border rounded-stratum-md focus:outline-none focus:ring-2 focus:ring-stratum-accent focus:border-transparent"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stratum-text mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 text-sm border border-stratum-border rounded-stratum-md focus:outline-none focus:ring-2 focus:ring-stratum-accent focus:border-transparent"
              disabled={loading}
            />
          </div>
        </div>

        {/* Primary action button */}
        <button
          className="w-full py-2.5 text-sm font-semibold text-white rounded-stratum-control bg-stratum-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 mb-3"
          onClick={handleEmailAction}
          disabled={loading}
        >
          {loading
            ? "Please wait…"
            : tab === "signin"
            ? "Sign in"
            : "Create account"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-stratum-border" />
          <span className="text-xs text-stratum-text-muted font-medium">or</span>
          <div className="flex-1 h-px bg-stratum-border" />
        </div>

        {/* Google button */}
        <button
          className="w-full flex items-center justify-center gap-3 py-2.5 text-sm font-semibold text-stratum-text border border-stratum-border rounded-stratum-control hover:bg-stratum-bg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}
```

(The backdrop scrim (`bg-black/50 backdrop-blur-sm`) is unchanged — it's a neutral overlay, not part of the design system's role vocabulary. The active-tab pill stays literal `bg-white` — a deliberate raised-white-pill-on-tinted-track skeuomorphic detail, not a token. Google's brand-colored SVG paths are untouched — third-party brand mark.)

- [ ] **Step 2: Build**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/auth/LoginModal.tsx
git commit -m "style(auth): re-skin LoginModal with Stratum tokens"
```

---

### Task 5: GettingStartedModal re-skin

**Files:**
- Modify: `webapp/src/components/onboarding/GettingStartedModal.tsx`

**Interfaces:** none — `GettingStartedModalProps` and all internal behavior (location preference selection, geolocation request, form submission) are unchanged; pure visual re-skin.

- [ ] **Step 1: Replace the file content**

Replace the entire content of `webapp/src/components/onboarding/GettingStartedModal.tsx` with:

```tsx
import { useState } from "react"

interface GeoProps {
  requestOnce: () => Promise<{ lat: number; lng: number } | null>
  setCoords: (coords: { lat: number; lng: number } | null) => void
}

interface GettingStartedModalProps {
  onComplete: (data: {
    location_preference: 'always' | 'ask'
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
  }) => Promise<void>
  onClose: () => void
  geo: GeoProps
}

export function GettingStartedModal({ onComplete, onClose, geo }: GettingStartedModalProps) {
  const [locationPreference, setLocationPreference] = useState<'always' | 'ask'>('ask')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    await onComplete({
      location_preference: locationPreference,
      emergency_contact_name: contactName.trim() || null,
      emergency_contact_phone: contactPhone.trim() || null,
    })
    setSaving(false)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.4)' }}
      className="flex items-center justify-center"
    >
      <div className="surface-card shell-bezel rounded-stratum-lg w-full max-w-[480px] mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-stratum-border">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-stratum-control bg-stratum-accent flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4V20M4 12H20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-stratum-text tracking-tight">Welcome to MediCoord</h2>
                <p className="text-sm text-stratum-text-muted">Let's set up your profile</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-stratum-md text-stratum-text-muted hover:text-stratum-text hover:bg-stratum-bg transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-stratum-accent text-white text-xs font-bold">1</div>
            <div className="h-px flex-1 bg-stratum-border" />
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-stratum-bg text-stratum-text-muted text-xs font-bold">2</div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 flex flex-col gap-6">
          {/* Location preference */}
          <div>
            <h3 className="text-sm font-bold text-stratum-text mb-1">Location access</h3>
            <p className="text-sm text-stratum-text-muted mb-3">MediCoord uses your location to find nearby health facilities.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  setLocationPreference('always')
                  const position = await geo.requestOnce()
                  if (position) geo.setCoords(position)
                }}
                className={`flex items-start gap-3 px-4 py-3 rounded-stratum-md border text-left transition-all ${
                  locationPreference === 'always'
                    ? 'border-stratum-accent bg-stratum-bg'
                    : 'border-stratum-border bg-white hover:border-stratum-accent-2'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-none flex items-center justify-center transition-colors ${
                  locationPreference === 'always' ? 'border-stratum-accent' : 'border-stratum-border'
                }`}>
                  {locationPreference === 'always' && (
                    <div className="w-2 h-2 rounded-full bg-stratum-accent" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stratum-text">Always allow</p>
                  <p className="text-xs text-stratum-text-muted mt-0.5">We'll use your saved location each time</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLocationPreference('ask')}
                className={`flex items-start gap-3 px-4 py-3 rounded-stratum-md border text-left transition-all ${
                  locationPreference === 'ask'
                    ? 'border-stratum-accent bg-stratum-bg'
                    : 'border-stratum-border bg-white hover:border-stratum-accent-2'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-none flex items-center justify-center transition-colors ${
                  locationPreference === 'ask' ? 'border-stratum-accent' : 'border-stratum-border'
                }`}>
                  {locationPreference === 'ask' && (
                    <div className="w-2 h-2 rounded-full bg-stratum-accent" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stratum-text">Ask each time</p>
                  <p className="text-xs text-stratum-text-muted mt-0.5">You'll be prompted when you start a session</p>
                </div>
              </button>
            </div>
          </div>

          {/* Emergency contact */}
          <div>
            <h3 className="text-sm font-bold text-stratum-text mb-1">Emergency contact <span className="font-normal text-stratum-text-muted">(optional)</span></h3>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Name"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                className="w-full px-4 py-2.5 text-sm text-stratum-text border border-stratum-border rounded-stratum-md focus:outline-none focus:ring-2 focus:ring-stratum-accent/20 focus:border-stratum-accent placeholder-stratum-text-muted transition-all"
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                className="w-full px-4 py-2.5 text-sm text-stratum-text border border-stratum-border rounded-stratum-md focus:outline-none focus:ring-2 focus:ring-stratum-accent/20 focus:border-stratum-accent placeholder-stratum-text-muted transition-all"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 text-sm font-semibold text-white bg-stratum-accent hover:opacity-90 rounded-stratum-control transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

(The outer fixed-position scrim stays as inline `style` with a raw rgba overlay — unchanged, same reasoning as `LoginModal`'s backdrop. Custom colored drop-shadows on the icon badge, step-indicator circle, and submit button (`shadow-blue-600/25`, `shadow-blue-600/20`) are dropped rather than re-tinted — `surface-card`/`shell-bezel` already establish this component's shadow language, so a second bespoke colored shadow on top would be redundant, not a missing re-skin.)

- [ ] **Step 2: Build**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/onboarding/GettingStartedModal.tsx
git commit -m "style(onboarding): re-skin GettingStartedModal with Stratum tokens"
```

---

### Task 6: Visual verification

**Files:** none modified — verification only.

**Interfaces:** none.

- [ ] **Step 1: Full production build**

Run: `cd webapp && npm run build`
Expected: exits 0, `tsc -b` reports no errors, `vite build` completes.

- [ ] **Step 2: Start or reuse the dev server**

Check whether a dev server is already running on port 5173 before starting a new one (this has happened in prior sub-projects' verification tasks). Reuse it if so; otherwise start one (`cd webapp && npm run dev`) and remember to stop it when done.

- [ ] **Step 3: Playwright check of every re-skinned screen**

Use the `playwright-cli` skill (there is no Playwright MCP server in this environment) against the dev server:

1. Navigate to `/app` (logged out) — confirm the map/chat panels render with the warm beige background and double-bezel card styling (not white/gray-200), and the "Get started" button is the `stratum-accent` tan color (not blue).
2. Click "Get started" — confirm `LoginModal` opens styled with the same card material (gradient surface, double-bezel shell), beige tab-switcher track, and tan primary button.
3. Navigate to `/sandbox` — confirm the dark control-room palette renders (near-black background, not the old navy `#0B0F19`/`#1E293B`), and the boot splash screen (reload the page to see it again) matches the same dark tones with no visual seam between splash and the panels that follow.
4. Take one screenshot of `/app` and one of `/sandbox`.

No defects expected; if any step fails, treat it as a real bug in this task's re-skin code and fix it before reporting done. `GettingStartedModal` only appears for a logged-in user with an incomplete profile — if there's no way to trigger it without real auth in this environment, note that as a ⚠️ in the report rather than skipping verification silently; this is acceptable since its styling is identical in kind (same tokens, same card pattern) to the already-verified `LoginModal`.

- [ ] **Step 4: Commit (only if a fix was needed)**

If verification passed with no fixes needed, there is nothing to commit for this task.

---

## Self-Review Notes

- **Spec coverage:** Home shell (map+chat panels, footer) → Task 3. `WebNavBar` → Task 2. `LoginModal`/`GettingStartedModal` → Tasks 4–5. Sandbox dark palette formalization → Task 1. Sandbox's `InspectorPanel`/`SimulationPanel` dense bento hierarchy → already satisfied by existing structure once the palette updates (Task 1); no separate task needed since the spec explicitly rules out structural changes. `SandboxSplashScreen` mono type tokens → Task 1, Step 3. `SandboxMap` dark CartoDB tiles → explicitly out of scope per the design spec ("already fits"), correctly no task.
- **Placeholder scan:** none — every step has literal, complete file content.
- **Type consistency:** `WebNavBarProps`, `LoginModalProps`, `GettingStartedModalProps`, `HomeProps` are all unchanged across every task — verified against the actual current file contents read during planning, not assumed.
