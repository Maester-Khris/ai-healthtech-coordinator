# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full OneSignal Web Push pipeline — PWA install gate, permission capture, player_id storage, backend relay endpoint, and /test-notif test page.

**Architecture:** A platform detection hook (`usePWAInstall`) drives a three-variant install gate modal (iOS manual / Android native prompt / desktop skip). After install, `useNotificationPermission` initializes the OneSignal SDK, captures the permission grant, and stores `player_id` in localStorage. A FastAPI endpoint proxies test sends to OneSignal's REST API. A `/test-notif` page reads localStorage and lets the developer fire a test push.

**Tech Stack:** React 19 + TypeScript + Tailwind v4, OneSignal Web SDK v16 (CDN), Tabler Icons (CDN), FastAPI + httpx

**Auth decision:** `/notifications/send` keeps `get_current_user` auth. The user is already logged in during testing. The TestNotifPage uses the existing `apiFetch` utility which injects the Bearer token automatically.

---

## Platform Detection Matrix

| Platform | Detect as | Show install gate? | Show permission prompt? | Push supported? |
|---|---|---|---|---|
| iOS Safari standalone ≥16.4 | `ios_safari` | No | Yes | Yes |
| iOS Safari browser tab ≥16.4 | `ios_safari` | Yes (manual steps) | After user confirms install | Yes |
| iOS Safari < 16.4 | `ios_safari` | Yes (unsupported msg) | No | No |
| iOS non-Safari browser | `unsupported` | Yes (use Safari msg) | No | No |
| Android Chrome standalone | `android_chrome` | No | Yes | Yes |
| Android Chrome browser tab | `android_chrome` | Yes (native prompt) | After install | Yes |
| Desktop Chrome (tab) | `desktop_chrome` | Soft (skippable) | Yes | Yes |
| Desktop Firefox (tab) | `desktop_other` | No | Yes | Yes |
| Desktop Safari | `unsupported` | No | No | No |

## localStorage Schema

| Key | Shape | Set when | Read when | Cleared when |
|---|---|---|---|---|
| `medicoord_install_modal_dismissed` | `"true"` | User dismisses install modal | Hook mount | Never auto-cleared |
| `medicoord_onesignal_player_id` | UUID string | OneSignal getUserId callback | TestNotifPage + permission prompt | `clearToken()` |
| `medicoord_onesignal_platform` | platform string | Same as above | TestNotifPage | `clearToken()` |
| `medicoord_push_granted` | `"true"` | After permission granted | Hook mount | `clearToken()` |
| `medicoord_permission_prompt_dismissed` | ISO timestamp | User clicks "Not now" on prompt | Hook mount (7-day check) | After 7 days |

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `webapp/public/manifest.json` | PWA manifest — enables `beforeinstallprompt` |
| Modify | `webapp/index.html` | Add manifest link, Tabler CSS CDN, OneSignal SDK CDN |
| Modify | `webapp/src/index.css` | Add `:root` CSS custom properties for design system colors |
| Modify | `webapp/.env.example` | Add `VITE_ONESIGNAL_APP_ID` and backend `ONESIGNAL_*` vars |
| Create | `webapp/src/hooks/usePWAInstall.ts` | Platform detection, install state, BeforeInstallPrompt capture |
| Create | `webapp/src/hooks/useNotificationPermission.ts` | OneSignal init, permission grant, player_id localStorage |
| Create | `webapp/src/components/pwa/PWAInstallModal.tsx` | Three-variant install gate modal |
| Create | `webapp/src/components/pwa/NotificationPermissionPrompt.tsx` | Bottom-of-screen permission card |
| Create | `backend/routers/notifications.py` | POST /notifications/send → OneSignal REST API |
| Create | `backend/tests/test_notifications.py` | pytest tests for notifications router |
| Create | `webapp/src/pages/TestNotifPage.tsx` | /test-notif developer test page |
| Modify | `webapp/src/App.tsx` | Add /test-notif route, PWAInstallModal, NotificationPermissionPrompt |
| Modify | `backend/main.py` | Include notifications router |

---

## Task 1: PWA Foundation — manifest, CDN links, CSS variables, env vars

**Files:**
- Create: `webapp/public/manifest.json`
- Modify: `webapp/index.html`
- Modify: `webapp/src/index.css`
- Modify: `webapp/.env.example`

- [ ] **Step 1: Create the PWA manifest**

  Create `webapp/public/manifest.json`:
  ```json
  {
    "name": "MediCoord AI",
    "short_name": "MediCoord",
    "description": "AI-powered health coordination and emergency care finder",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#185FA5",
    "icons": [
      { "src": "/logo.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/logo.png", "sizes": "512x512", "type": "image/png" }
    ]
  }
  ```

- [ ] **Step 2: Update index.html — add manifest link, Tabler CSS CDN, OneSignal SDK**

  Replace the `<head>` section of `webapp/index.html` with:
  ```html
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/jpeg" href="/logo.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#185FA5" />
    <link href="https://fonts.googleapis.com/css2?family=Ubuntu&family=Ubuntu+Mono&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css" />
    <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
    <title>Health coordinator</title>
  </head>
  ```

- [ ] **Step 3: Add CSS design-system variables to `webapp/src/index.css`**

  Append to the end of `webapp/src/index.css`:
  ```css
  /* Push notification design system variables */
  :root {
    --color-primary: #185FA5;
    --color-primary-light: #EBF3FC;
    --color-primary-dark: #0E3D6E;
    --color-background-info: #EBF3FC;
    --color-text-info: #185FA5;
    --color-surface: #ffffff;
    --color-text-primary: #111827;
    --color-text-secondary: #6B7280;
    --color-border: #E5E7EB;
    --color-step-bg: #F9FAFB;
    --color-warning-bg: #FEF3E2;
    --color-warning: #E8813A;
    --color-success-bg: #ECFDF5;
    --color-success: #059669;
  }
  ```

- [ ] **Step 4: Add env vars to `.env.example`**

  After the `VITE_GEOAPIFY_API_KEY=` line, add:
  ```bash
  # OneSignal — frontend (player_id capture)
  VITE_ONESIGNAL_APP_ID=

  # OneSignal — backend (send notifications via REST API)
  ONESIGNAL_APP_ID=
  ONESIGNAL_API_KEY=
  ```

- [ ] **Step 5: Verify manifest is served**

  Run `npm run dev` in `webapp/`, open DevTools → Application → Manifest. Confirm "MediCoord AI" appears with no errors.

- [ ] **Step 6: Commit**
  ```bash
  git add webapp/public/manifest.json webapp/index.html webapp/src/index.css .env.example
  git commit -m "feat(push): PWA manifest, OneSignal SDK v16, Tabler CSS CDN, design-system CSS vars"
  ```

---

## Task 2: `usePWAInstall` Hook

**Files:**
- Create: `webapp/src/hooks/usePWAInstall.ts`

- [ ] **Step 1: Create the file with types and detection logic**

  Create `webapp/src/hooks/usePWAInstall.ts`:
  ```typescript
  import { useState, useEffect, useRef } from "react"

  export type Platform =
    | "ios_safari"
    | "android_chrome"
    | "desktop_chrome"
    | "desktop_other"
    | "unsupported"

  export type InstallState =
    | "standalone"       // already installed as PWA
    | "installable"      // browser tab, native install prompt available
    | "manual_install"   // browser tab, no prompt (iOS or Firefox)
    | "not_applicable"   // desktop where install is optional

  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
  }

  export interface UsePWAInstallResult {
    platform: Platform
    installState: InstallState
    isStandalone: boolean
    isPushSupported: boolean
    promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">
    installModalDismissed: boolean
    dismissInstallModal: () => void
  }

  const DISMISS_KEY = "medicoord_install_modal_dismissed"

  function detectPlatform(): Platform {
    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
    if (isIOS) {
      const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua)
      return isSafari ? "ios_safari" : "unsupported"
    }
    if (/Android/.test(ua)) return "android_chrome"
    if (/Chrome/.test(ua) && !/Chromium|OPR|Edge/.test(ua)) return "desktop_chrome"
    return "desktop_other"
  }

  function detectiOSVersion(): number | null {
    const match = navigator.userAgent.match(/OS (\d+)_/)
    return match ? parseInt(match[1], 10) : null
  }

  export function usePWAInstall(): UsePWAInstallResult {
    const [capturedPrompt, setCapturedPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [dismissed, setDismissed] = useState(false)

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true

    const platform = detectPlatform()
    const iOSVersion = platform === "ios_safari" ? detectiOSVersion() : null

    const isPushSupported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      (platform !== "ios_safari" || (iOSVersion !== null && iOSVersion >= 16))

    const installState: InstallState = isStandalone
      ? "standalone"
      : capturedPrompt !== null
        ? "installable"
        : platform === "ios_safari"
          ? "manual_install"
          : "not_applicable"

    useEffect(() => {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "true")
    }, [])

    useEffect(() => {
      const handler = (e: Event) => {
        e.preventDefault()
        setCapturedPrompt(e as BeforeInstallPromptEvent)
      }
      window.addEventListener("beforeinstallprompt", handler)
      return () => window.removeEventListener("beforeinstallprompt", handler)
    }, [])

    const promptInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
      if (!capturedPrompt) return "unavailable"
      await capturedPrompt.prompt()
      const { outcome } = await capturedPrompt.userChoice
      setCapturedPrompt(null)
      return outcome
    }

    const dismissInstallModal = () => {
      localStorage.setItem(DISMISS_KEY, "true")
      setDismissed(true)
    }

    return {
      platform,
      installState,
      isStandalone,
      isPushSupported,
      promptInstall,
      installModalDismissed: dismissed,
      dismissInstallModal,
    }
  }
  ```

- [ ] **Step 2: Type-check**

  Run from `webapp/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors related to `usePWAInstall.ts`.

- [ ] **Step 3: Commit**
  ```bash
  git add webapp/src/hooks/usePWAInstall.ts
  git commit -m "feat(push): usePWAInstall hook — platform detection, BeforeInstallPrompt capture, standalone detection"
  ```

---

## Task 3: `useNotificationPermission` Hook

**Files:**
- Create: `webapp/src/hooks/useNotificationPermission.ts`

- [ ] **Step 1: Create the file**

  Create `webapp/src/hooks/useNotificationPermission.ts`:
  ```typescript
  import { useState, useEffect, useRef } from "react"

  export type PermissionState = "unknown" | "default" | "granted" | "denied"

  export interface UseNotificationPermissionResult {
    permissionState: PermissionState
    playerId: string | null
    requesting: boolean
    requestPermission: () => Promise<void>
    clearToken: () => void
  }

  const PLAYER_ID_KEY = "medicoord_onesignal_player_id"
  const PLATFORM_KEY  = "medicoord_onesignal_platform"
  const GRANTED_KEY   = "medicoord_push_granted"

  declare global {
    interface Window {
      OneSignal: {
        push: (fn: () => void) => void
        init: (config: {
          appId: string
          notifyButton: { enable: boolean }
          allowLocalhostAsSecureOrigin?: boolean
        }) => void
        getUserId: (callback: (userId: string | null) => void) => void
      }
    }
  }

  function detectPlatformLabel(): string {
    const ua = navigator.userAgent
    if (/iPad|iPhone|iPod/.test(ua)) return "ios_safari"
    if (/Android/.test(ua)) return "android_chrome"
    if (/Chrome/.test(ua) && !/Chromium|OPR|Edge/.test(ua)) return "desktop_chrome"
    return "desktop_other"
  }

  export function useNotificationPermission(): UseNotificationPermissionResult {
    const [permissionState, setPermissionState] = useState<PermissionState>("unknown")
    const [playerId, setPlayerId] = useState<string | null>(null)
    const [requesting, setRequesting] = useState(false)
    const initialized = useRef(false)

    useEffect(() => {
      const stored = localStorage.getItem(PLAYER_ID_KEY)
      if (stored) setPlayerId(stored)

      if (!("Notification" in window)) {
        setPermissionState("unknown")
        return
      }
      const perm = Notification.permission
      setPermissionState(perm === "default" ? "default" : perm as PermissionState)
    }, [])

    const requestPermission = async () => {
      if (initialized.current) return
      setRequesting(true)
      try {
        await new Promise<void>((resolve) => {
          window.OneSignal.push(() => {
            window.OneSignal.init({
              appId: import.meta.env.VITE_ONESIGNAL_APP_ID as string,
              notifyButton: { enable: false },
              allowLocalhostAsSecureOrigin: true,
            })
            resolve()
          })
        })

        initialized.current = true

        const userId = await new Promise<string | null>((resolve) => {
          window.OneSignal.push(() => {
            window.OneSignal.getUserId((id: string | null) => resolve(id))
          })
        })

        if (userId) {
          localStorage.setItem(PLAYER_ID_KEY, userId)
          localStorage.setItem(PLATFORM_KEY, detectPlatformLabel())
          localStorage.setItem(GRANTED_KEY, "true")
          setPlayerId(userId)
          setPermissionState("granted")
        } else {
          // SDK initialized but user may have denied
          const perm = Notification.permission
          setPermissionState(perm as PermissionState)
        }
      } catch (err) {
        console.error("[OneSignal] init failed:", err)
      } finally {
        setRequesting(false)
      }
    }

    const clearToken = () => {
      localStorage.removeItem(PLAYER_ID_KEY)
      localStorage.removeItem(PLATFORM_KEY)
      localStorage.removeItem(GRANTED_KEY)
      setPlayerId(null)
      setPermissionState("default")
      initialized.current = false
    }

    return { permissionState, playerId, requesting, requestPermission, clearToken }
  }
  ```

- [ ] **Step 2: Type-check**

  Run from `webapp/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors related to `useNotificationPermission.ts`.

- [ ] **Step 3: Commit**
  ```bash
  git add webapp/src/hooks/useNotificationPermission.ts
  git commit -m "feat(push): useNotificationPermission hook — OneSignal init, player_id capture, localStorage"
  ```

---

## Task 4: `PWAInstallModal` Component

**Files:**
- Create: `webapp/src/components/pwa/PWAInstallModal.tsx`

- [ ] **Step 1: Create the component**

  Create `webapp/src/components/pwa/PWAInstallModal.tsx`:
  ```tsx
  import type { Platform, InstallState } from "../../hooks/usePWAInstall"

  interface PWAInstallModalProps {
    platform: Platform
    installState: InstallState
    isPushSupported: boolean
    onInstalled: () => void   // iOS: "I've installed it" / Android: after prompt accepted
    onDismiss: () => void     // "Maybe later" / "Not now" / "Skip"
    promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">
  }

  export function PWAInstallModal({
    platform,
    installState,
    isPushSupported,
    onInstalled,
    onDismiss,
    promptInstall,
  }: PWAInstallModalProps) {
    if (installState === "standalone") return null

    const handleAndroidInstall = async () => {
      const result = await promptInstall()
      if (result === "accepted") onInstalled()
      else onDismiss()
    }

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(0,0,0,0.55)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "0 0 env(safe-area-inset-bottom, 0)",
        }}
        onClick={onDismiss}
      >
        <div
          style={{
            background: "var(--color-surface)",
            borderRadius: "20px 20px 0 0",
            padding: "24px 20px 28px",
            width: "100%",
            maxWidth: 480,
            boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div style={{
            width: 40,
            height: 4,
            background: "var(--color-border)",
            borderRadius: 2,
            margin: "0 auto 20px",
          }} />

          {platform === "ios_safari" && <IOSVariant isPushSupported={isPushSupported} onInstalled={onInstalled} onDismiss={onDismiss} />}
          {platform === "android_chrome" && <AndroidVariant onInstall={handleAndroidInstall} onDismiss={onDismiss} />}
          {(platform === "desktop_chrome" || platform === "desktop_other") && <DesktopVariant onEnable={onInstalled} onDismiss={onDismiss} />}
        </div>
      </div>
    )
  }

  function IOSVariant({ isPushSupported, onInstalled, onDismiss }: {
    isPushSupported: boolean
    onInstalled: () => void
    onDismiss: () => void
  }) {
    if (!isPushSupported) {
      return (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 22, color: "var(--color-warning)" }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
              Push not supported on this device
            </h2>
          </div>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
            Push notifications require iOS 16.4 or later with Safari. Please update your device to enable health alerts.
          </p>
          <button onClick={onDismiss} style={secondaryButtonStyle}>Close</button>
        </>
      )
    }

    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className="ti ti-device-mobile" style={{ fontSize: 22, color: "var(--color-text-info)" }} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            Add MediCoord to your home screen
          </h2>
        </div>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
          Push notifications require the app to be installed. Follow these steps in Safari:
        </p>

        {[
          { icon: "ti-share", label: "Tap the Share button at the bottom of Safari" },
          { icon: "ti-square-plus", label: 'Tap "Add to Home Screen"' },
          { icon: "ti-circle-check", label: 'Tap "Add" — then open from your home screen' },
        ].map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--color-step-bg)", borderRadius: 10, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-info)" }}>{i + 1}</span>
            </div>
            <i className={`ti ${step.icon}`} style={{ fontSize: 18, color: "var(--color-text-info)", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.4 }}>{step.label}</span>
          </div>
        ))}

        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "12px 0 20px" }}>
          Requires iOS 16.4 or later
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={onInstalled} style={primaryButtonStyle}>
            <i className="ti ti-home-check" style={{ fontSize: 16, marginRight: 6 }} />
            I've installed it
          </button>
          <button onClick={onDismiss} style={secondaryButtonStyle}>Maybe later</button>
        </div>
      </>
    )
  }

  function AndroidVariant({ onInstall, onDismiss }: { onInstall: () => void; onDismiss: () => void }) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className="ti ti-bell-ringing" style={{ fontSize: 22, color: "var(--color-text-info)" }} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            Install MediCoord for health alerts
          </h2>
        </div>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 24 }}>
          Get emergency care recommendations sent directly to your device, even when the browser is closed.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={onInstall} style={primaryButtonStyle}>
            <i className="ti ti-download" style={{ fontSize: 16, marginRight: 6 }} />
            Install app
          </button>
          <button onClick={onDismiss} style={secondaryButtonStyle}>Not now</button>
        </div>
      </>
    )
  }

  function DesktopVariant({ onEnable, onDismiss }: { onEnable: () => void; onDismiss: () => void }) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className="ti ti-bell" style={{ fontSize: 22, color: "var(--color-text-info)" }} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            Enable health alerts
          </h2>
        </div>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 24 }}>
          Get push notifications when you need emergency care near you. Works in your browser — no install required.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={onEnable} style={primaryButtonStyle}>
            <i className="ti ti-bell-plus" style={{ fontSize: 16, marginRight: 6 }} />
            Enable notifications
          </button>
          <button onClick={onDismiss} style={secondaryButtonStyle}>Skip</button>
        </div>
      </>
    )
  }

  const primaryButtonStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    background: "var(--color-primary)",
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }

  const secondaryButtonStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    background: "transparent",
    color: "var(--color-text-secondary)",
    border: "1px solid var(--color-border)",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
  }
  ```

- [ ] **Step 2: Type-check**

  Run from `webapp/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**
  ```bash
  git add webapp/src/components/pwa/PWAInstallModal.tsx
  git commit -m "feat(push): PWAInstallModal — iOS manual steps, Android native prompt, desktop soft gate"
  ```

---

## Task 5: `NotificationPermissionPrompt` Component

**Files:**
- Create: `webapp/src/components/pwa/NotificationPermissionPrompt.tsx`

- [ ] **Step 1: Create the component**

  Create `webapp/src/components/pwa/NotificationPermissionPrompt.tsx`:
  ```tsx
  import { useState, useEffect } from "react"

  interface NotificationPermissionPromptProps {
    requesting: boolean
    onEnable: () => void
    onDismiss: () => void
  }

  const DISMISS_KEY = "medicoord_permission_prompt_dismissed"
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

  export function NotificationPermissionPrompt({
    requesting,
    onEnable,
    onDismiss,
  }: NotificationPermissionPromptProps) {
    const handleDismiss = () => {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString())
      onDismiss()
    }

    return (
      <div style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: 440,
        zIndex: 9000,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 16,
        padding: "14px 16px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "var(--color-background-info)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <i className="ti ti-bell" style={{ fontSize: 20, color: "var(--color-text-info)" }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>
            Enable health alerts
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
            Get notified when emergency care recommendations are ready.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleDismiss}
            style={{
              padding: "7px 12px",
              background: "transparent",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Not now
          </button>
          <button
            onClick={onEnable}
            disabled={requesting}
            style={{
              padding: "7px 14px",
              background: "var(--color-primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: requesting ? "not-allowed" : "pointer",
              opacity: requesting ? 0.7 : 1,
            }}
          >
            {requesting ? "…" : "Enable"}
          </button>
        </div>
      </div>
    )
  }

  export function shouldShowPermissionPrompt(): boolean {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return true
    return Date.now() - new Date(ts).getTime() > SEVEN_DAYS_MS
  }
  ```

- [ ] **Step 2: Type-check**

  Run from `webapp/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**
  ```bash
  git add webapp/src/components/pwa/NotificationPermissionPrompt.tsx
  git commit -m "feat(push): NotificationPermissionPrompt — bottom card, 7-day dismiss persistence"
  ```

---

## Task 6: Backend — `notifications.py` Router (TDD)

**Files:**
- Create: `backend/tests/test_notifications.py`
- Create: `backend/routers/notifications.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write the failing tests**

  Create `backend/tests/test_notifications.py`:
  ```python
  """
  Tests for POST /notifications/send — proxies to OneSignal REST API.
  OneSignal HTTP call is mocked; no network required.
  """
  import os, sys
  sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

  from unittest.mock import patch, MagicMock, AsyncMock
  from uuid import UUID

  import pytest
  import httpx
  from fastapi import FastAPI
  from fastapi.testclient import TestClient

  from routers.notifications import router as notif_router
  from middleware.auth import get_current_user

  FAKE_USER_ID = UUID("00000000-0000-0000-0000-000000000001")

  class _FakeUser:
      id = FAKE_USER_ID

  app = FastAPI()
  app.include_router(notif_router)
  app.dependency_overrides[get_current_user] = lambda: _FakeUser()
  client = TestClient(app)

  VALID_PAYLOAD = {
      "player_id": "test-player-id-abc123",
      "title": "MediCoord Test",
      "body": "Push notification pipeline working ✓",
  }

  def test_send_notification_success():
      """Returns notification_id when OneSignal responds 200."""
      mock_response = MagicMock(spec=httpx.Response)
      mock_response.status_code = 200
      mock_response.json.return_value = {"id": "notif-id-xyz789"}

      with patch("routers.notifications.httpx.post", return_value=mock_response):
          res = client.post("/notifications/send", json=VALID_PAYLOAD)

      assert res.status_code == 200
      data = res.json()
      assert data["notification_id"] == "notif-id-xyz789"

  def test_send_notification_onesignal_error():
      """Returns 502 when OneSignal returns an error."""
      mock_response = MagicMock(spec=httpx.Response)
      mock_response.status_code = 400
      mock_response.json.return_value = {"errors": ["Invalid player_id"]}

      with patch("routers.notifications.httpx.post", return_value=mock_response):
          res = client.post("/notifications/send", json=VALID_PAYLOAD)

      assert res.status_code == 502
      assert "OneSignal error" in res.json()["detail"]

  def test_send_notification_missing_player_id():
      """Returns 422 when player_id is missing."""
      res = client.post("/notifications/send", json={"title": "T", "body": "B"})
      assert res.status_code == 422

  def test_send_notification_onesignal_network_error():
      """Returns 502 when the HTTP call to OneSignal raises."""
      with patch("routers.notifications.httpx.post", side_effect=httpx.RequestError("timeout")):
          res = client.post("/notifications/send", json=VALID_PAYLOAD)
      assert res.status_code == 502
      assert "Failed to reach OneSignal" in res.json()["detail"]
  ```

- [ ] **Step 2: Run tests — confirm they all fail**

  Run from `backend/`:
  ```bash
  pytest tests/test_notifications.py -v
  ```
  Expected: `ImportError: cannot import name 'router' from 'routers.notifications'` or `ModuleNotFoundError` — the router doesn't exist yet.

- [ ] **Step 3: Implement the router**

  Create `backend/routers/notifications.py`:
  ```python
  import os
  import logging

  import httpx
  from fastapi import APIRouter, Depends, HTTPException
  from pydantic import BaseModel

  from middleware.auth import get_current_user

  logger = logging.getLogger(__name__)
  router = APIRouter(prefix="/notifications", tags=["notifications"])

  ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications"


  class SendNotificationRequest(BaseModel):
      player_id: str
      title: str
      body: str


  @router.post("/send")
  async def send_notification(
      body: SendNotificationRequest,
      _current_user: object = Depends(get_current_user),
  ) -> dict:
      app_id = os.environ.get("ONESIGNAL_APP_ID", "")
      api_key = os.environ.get("ONESIGNAL_API_KEY", "")

      if not app_id or not api_key:
          raise HTTPException(500, "OneSignal credentials not configured")

      payload = {
          "app_id": app_id,
          "include_player_ids": [body.player_id],
          "headings": {"en": body.title},
          "contents": {"en": body.body},
      }

      try:
          response = httpx.post(
              ONESIGNAL_API_URL,
              json=payload,
              headers={
                  "Authorization": f"Basic {api_key}",
                  "Content-Type": "application/json",
              },
              timeout=10.0,
          )
      except httpx.RequestError as exc:
          logger.error("onesignal_network_error", extra={"error": str(exc)})
          raise HTTPException(502, "Failed to reach OneSignal")

      if response.status_code != 200:
          logger.warning(
              "onesignal_error",
              extra={"status": response.status_code, "body": response.json()},
          )
          raise HTTPException(502, f"OneSignal error: {response.json()}")

      data = response.json()
      return {"notification_id": data.get("id")}
  ```

- [ ] **Step 4: Run tests — confirm they all pass**

  Run from `backend/`:
  ```bash
  pytest tests/test_notifications.py -v
  ```
  Expected output:
  ```
  test_notifications.py::test_send_notification_success PASSED
  test_notifications.py::test_send_notification_onesignal_error PASSED
  test_notifications.py::test_send_notification_missing_player_id PASSED
  test_notifications.py::test_send_notification_onesignal_network_error PASSED
  4 passed
  ```

- [ ] **Step 5: Wire router into `main.py`**

  In `backend/main.py`, add after the existing `chat_router` import and include:
  ```python
  from routers.notifications import router as notifications_router
  ```
  And after `app.include_router(chat_router)`:
  ```python
  app.include_router(notifications_router)
  ```

- [ ] **Step 6: Run full test suite to confirm no regressions**

  Run from `backend/`:
  ```bash
  pytest -v
  ```
  Expected: all tests pass including `test_chat.py`.

- [ ] **Step 7: Commit**
  ```bash
  git add backend/routers/notifications.py backend/tests/test_notifications.py backend/main.py
  git commit -m "feat(push): /notifications/send endpoint — proxies to OneSignal REST API, TDD"
  ```

---

## Task 7: `TestNotifPage` + Router

**Files:**
- Create: `webapp/src/pages/TestNotifPage.tsx`
- Modify: `webapp/src/App.tsx` (add route only)

- [ ] **Step 1: Create TestNotifPage**

  Create `webapp/src/pages/TestNotifPage.tsx`:
  ```tsx
  import { useState } from "react"
  import { apiFetch } from "../lib/apiClient"

  const PLAYER_ID_KEY = "medicoord_onesignal_player_id"
  const PLATFORM_KEY  = "medicoord_onesignal_platform"

  interface SendResult {
    ok: boolean
    notificationId?: string
    error?: string
  }

  export default function TestNotifPage() {
    const playerId   = localStorage.getItem(PLAYER_ID_KEY) ?? ""
    const platform   = localStorage.getItem(PLATFORM_KEY) ?? "unknown"
    const permission = "Notification" in window ? Notification.permission : "unsupported"

    const [title, setTitle]   = useState("MediCoord Test")
    const [body, setBody]     = useState("Push notification pipeline working ✓")
    const [sending, setSending] = useState(false)
    const [result, setResult] = useState<SendResult | null>(null)

    const handleSend = async () => {
      setSending(true)
      setResult(null)
      try {
        const res = await apiFetch("/notifications/send", {
          method: "POST",
          body: JSON.stringify({ player_id: playerId, title, body }),
        })
        if (res.ok) {
          const data = await res.json()
          setResult({ ok: true, notificationId: data.notification_id })
        } else {
          const data = await res.json()
          setResult({ ok: false, error: data.detail ?? "Unknown error" })
        }
      } catch (err) {
        setResult({ ok: false, error: String(err) })
      } finally {
        setSending(false)
      }
    }

    return (
      <div style={{
        maxWidth: 520,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
            Push notification test
          </h1>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0 }}>
            Test the full notification pipeline
          </p>
        </div>

        {/* Status card */}
        <div style={{
          background: "var(--color-step-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 20,
        }}>
          <StatusRow label="player_id" value={playerId || "not registered"} ok={!!playerId} />
          <StatusRow label="platform"  value={platform} ok={platform !== "unknown"} />
          <StatusRow label="permission" value={permission} ok={permission === "granted"} />
        </div>

        {!playerId && (
          <div style={{
            background: "var(--color-warning-bg)",
            border: "1px solid #F5CBA0",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 20,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: "var(--color-warning)", flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 14, color: "#7C4D0F", lineHeight: 1.5 }}>
              No device registered. Go to the app and enable push notifications first, then return here.
            </p>
          </div>
        )}

        {playerId && (
          <div style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            padding: "16px",
            marginBottom: 20,
          }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", display: "block", marginBottom: 6 }}>
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", display: "block", marginBottom: 6 }}>
                Body
              </label>
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={sending}
              style={{
                width: "100%",
                padding: "12px",
                background: sending ? "var(--color-border)" : "var(--color-primary)",
                color: sending ? "var(--color-text-secondary)" : "#ffffff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: sending ? "not-allowed" : "pointer",
              }}
            >
              {sending ? "Sending…" : "Send test notification"}
            </button>
          </div>
        )}

        {result && (
          <div style={{
            background: result.ok ? "var(--color-success-bg)" : "#FEF2F2",
            border: `1px solid ${result.ok ? "#A7F3D0" : "#FECACA"}`,
            borderRadius: 12,
            padding: "14px 16px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}>
            <i
              className={result.ok ? "ti ti-circle-check" : "ti ti-circle-x"}
              style={{ fontSize: 18, color: result.ok ? "var(--color-success)" : "#EF4444", flexShrink: 0, marginTop: 2 }}
            />
            <div>
              {result.ok ? (
                <>
                  <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "#065F46" }}>Sent</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#064E3B" }}>
                    notification_id: {result.notificationId} — check your device
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "#B91C1C" }}>Failed</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#7F1D1D" }}>{result.error}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)", fontFamily: "monospace" }}>{label}</span>
        <span style={{
          fontSize: 12,
          fontFamily: "monospace",
          color: ok ? "var(--color-success)" : "var(--color-warning)",
          maxWidth: 260,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {value}
        </span>
      </div>
    )
  }
  ```

- [ ] **Step 2: Add /test-notif route to App.tsx**

  In `webapp/src/App.tsx`, add the import at the top (near the existing `TestLocationPage` import):
  ```typescript
  import TestNotifPage from './pages/TestNotifPage'
  ```
  And inside `<Routes>` (before the `path="*"` catch-all):
  ```tsx
  <Route path="/test-notif" element={<TestNotifPage />} />
  ```

- [ ] **Step 3: Type-check**

  Run from `webapp/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**
  ```bash
  git add webapp/src/pages/TestNotifPage.tsx webapp/src/App.tsx
  git commit -m "feat(push): /test-notif page — status display, send form, POST /notifications/send"
  ```

---

## Task 8: Wire `PWAInstallModal` + `NotificationPermissionPrompt` into `App.tsx`

**Files:**
- Modify: `webapp/src/App.tsx`

- [ ] **Step 1: Update AppInner in App.tsx**

  Replace the `AppInner` function in `webapp/src/App.tsx` with:
  ```tsx
  import { useState } from 'react'
  import { BrowserRouter, Routes, Route } from 'react-router-dom'
  import * as Sentry from "@sentry/react"
  import Home from './Menucomponents/Home'
  import SetupPage from './pages/SetupPage'
  import TestLocationPage from './pages/TestLocationPage'
  import TestNotifPage from './pages/TestNotifPage'
  import { MobileLayout } from './components/mobile/MobileLayout'
  import { AuthProvider } from './auth/AuthContext'
  import { Notification } from './components/Notification'
  import { GpsPermissionModal } from './components/GpsPermissionModal'
  import { PWAInstallModal } from './components/pwa/PWAInstallModal'
  import { NotificationPermissionPrompt, shouldShowPermissionPrompt } from './components/pwa/NotificationPermissionPrompt'
  import { useFacilities } from './hooks/useFacilities'
  import { useConversations } from './hooks/useConversations'
  import { useBreakpoint } from './hooks/useBreakpoint'
  import { useGeolocation } from './hooks/useGeolocation'
  import { usePWAInstall } from './hooks/usePWAInstall'
  import { useNotificationPermission } from './hooks/useNotificationPermission'

  function AppInner() {
    const isMobile = useBreakpoint()
    const { facilities, loading: facilitiesLoading } = useFacilities()
    const { cache, sendMessage, createSession, loadOlderMessages } = useConversations()
    const geo = useGeolocation()
    const [gpsModalDismissed, setGpsModalDismissed] = useState(false)

    const {
      platform,
      installState,
      isPushSupported,
      promptInstall,
      installModalDismissed,
      dismissInstallModal,
    } = usePWAInstall()

    const {
      permissionState,
      requesting,
      requestPermission,
    } = useNotificationPermission()

    const [permissionPromptDismissed, setPermissionPromptDismissed] = useState(false)
    const [installConfirmed, setInstallConfirmed] = useState(installState === "standalone")

    const showGpsModal = geo.permission === "denied" && !gpsModalDismissed

    // Show install modal when: not standalone, not dismissed, push is supported (or iOS unsupported to show the unsupported message)
    const showInstallModal =
      !installModalDismissed &&
      installState !== "standalone" &&
      (isPushSupported || platform === "ios_safari") &&
      !installConfirmed

    // Show permission prompt when: install is done, push is supported, not yet granted, not dismissed
    const showPermissionPrompt =
      !showInstallModal &&
      isPushSupported &&
      permissionState !== "granted" &&
      permissionState !== "denied" &&
      !permissionPromptDismissed &&
      shouldShowPermissionPrompt()

    const sharedProps = {
      facilities,
      facilitiesLoading,
      conversationsCache: cache,
      sendMessage,
      createSession,
      loadOlderMessages,
    }

    return (
      <>
        <Notification />
        {showGpsModal && (
          <GpsPermissionModal onDismiss={() => setGpsModalDismissed(true)} />
        )}
        {showInstallModal && (
          <PWAInstallModal
            platform={platform}
            installState={installState}
            isPushSupported={isPushSupported}
            promptInstall={promptInstall}
            onInstalled={() => {
              dismissInstallModal()
              setInstallConfirmed(true)
            }}
            onDismiss={dismissInstallModal}
          />
        )}
        {showPermissionPrompt && (
          <NotificationPermissionPrompt
            requesting={requesting}
            onEnable={requestPermission}
            onDismiss={() => setPermissionPromptDismissed(true)}
          />
        )}
        {isMobile
          ? <MobileLayout {...sharedProps} />
          : <Home {...sharedProps} />
        }
      </>
    )
  }

  function App() {
    return (
      <Sentry.ErrorBoundary
        fallback={({ error }) => (
          <div style={{ padding: 24 }}>
            <p>Something went wrong. Please refresh.</p>
            {import.meta.env.DEV && <pre>{String(error)}</pre>}
          </div>
        )}
      >
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/testlocation" element={<TestLocationPage />} />
              <Route path="/test-notif" element={<TestNotifPage />} />
              <Route path="*" element={<AppInner />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </Sentry.ErrorBoundary>
    )
  }

  export default App
  ```

  > Note: This replaces the entire App.tsx content. The function components (AppInner and App) are rewritten; all imports are now at the top (removing the mid-file `import TestLocationPage` that existed before).

- [ ] **Step 2: Type-check**

  Run from `webapp/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Smoke-test in browser**

  Run `npm run dev` in `webapp/`. Open `http://localhost:5173` in Chrome.
  - DevTools → Application → Manifest: should show "MediCoord AI"
  - Console: no errors
  - On desktop Chrome: `NotificationPermissionPrompt` should appear (since `Notification.permission === "default"`)
  - Open `http://localhost:5173/test-notif`: status card renders, player_id shows "not registered"

- [ ] **Step 4: Final type-check across project**

  Run from `webapp/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: zero errors.

- [ ] **Step 5: Commit**
  ```bash
  git add webapp/src/App.tsx
  git commit -m "feat(push): wire PWAInstallModal and NotificationPermissionPrompt into App.tsx"
  ```

---

## Verification Checklist

- [ ] OneSignal SDK loads without console errors (check Network tab for SDK request)
- [ ] Tabler icons render correctly in modals (GpsPermissionModal icons visible)
- [ ] `manifest.json` is valid (DevTools → Application → Manifest, no red errors)
- [ ] On Android Chrome (browser tab): `beforeinstallprompt` fires, install modal appears
- [ ] On iOS Safari ≥16.4 (browser tab): manual install steps modal appears with step cards
- [ ] On iOS Safari < 16.4 or non-Safari: unsupported message shown
- [ ] On desktop Chrome: `NotificationPermissionPrompt` bottom card appears
- [ ] After granting permission via desktop Chrome: `medicoord_onesignal_player_id` appears in localStorage (DevTools → Application → Local Storage)
- [ ] `/test-notif` reads `player_id` from localStorage and shows it in the status card
- [ ] Sending test notification: `POST /notifications/send` returns 200 with `notification_id`
- [ ] Test notification appears on device within ~5 seconds
- [ ] Clicking "Maybe later" / "Not now" on install modal: modal does not reappear on hard refresh
- [ ] Clicking "Not now" on permission prompt: prompt hidden, reappears after 7 days (verify by checking `medicoord_permission_prompt_dismissed` in localStorage)
- [ ] Denying permission in browser dialog: `permissionState` becomes `"denied"`, permission prompt hidden
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `pytest tests/test_notifications.py -v` — 4 tests pass
- [ ] `pytest -v` (full suite) — no regressions
