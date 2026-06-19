# PWA Install + Push Notification Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PWA installation work on every mobile platform (Android confirmed, iOS fixed), then verify and live-test the OneSignal push notification pipeline end-to-end on Web, Android, and iOS.

**Architecture:** Phase 1 closes the gaps that currently block or hide the install prompt on iOS, fixes a discovered install-modal re-arm bug, and confirms Android still works after a recent Vercel routing change. Phase 2 verifies the OneSignal/Vercel configuration and runs a live send-and-receive test on each platform using the existing `/notifications/send` → OneSignal REST API pipeline. No new architecture — this plan completes and verifies what `docs/superpowers/plans/2026-06-07-push-notifications.md` already built.

**Tech Stack:** React 19 + TypeScript, OneSignal Web SDK v16 (CDN), Vercel (static hosting + rewrites), Python 3 + Pillow (icon resize, dev-time only)

## Global Constraints

- iOS push requires Safari (not Chrome/Firefox/other iOS browsers) + iOS 16.4 or later + the app installed to the Home Screen (standalone mode). This is a browser/OS limitation — no code change can work around it; code can only detect it and guide the user correctly.
- Do not rename existing localStorage keys: `medicoord_install_modal_dismissed`, `medicoord_onesignal_player_id_<platform>` (prefix `PLAYER_ID_KEY_PREFIX`), `medicoord_onesignal_platform`, `medicoord_push_granted`, `medicoord_permission_prompt_dismissed`.
- Do not change the OneSignal SDK version (v16, loaded via CDN `<script>` in `webapp/index.html`) or the `/notifications/send` backend contract — both are already working for desktop Chrome.
- Match existing per-file conventions: `webapp/src/components/pwa/*` and `webapp/src/pages/TestNotifPage.tsx` use inline `style={{...}}` objects and Tabler icon font classes (`<i className="ti ti-*">`); `webapp/src/components/mobile/DrawerMenu.tsx` uses inline `style={{...}}` objects and hand-rolled inline SVG icon components (no Tabler in that file) — follow whichever convention the file you're editing already uses.
- Branch: `feat/push-notifications` (already cut from `preview`). Never commit or push directly to `main` or `preview` — both are protected; all changes to `preview` arrive via PR from this feature branch only.
- **Commit style — per `.AGENTS.md` and `.claude/.CLAUDE.md`:** conventional commits only (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, with an optional scope like `fix(push):`), one-line subject, no body, never add an AI assistant as co-author. One commit per logical change, not per file — every file touched by a given task is staged together (`git add <f1> <f2> ...`) and committed in a single commit. Unrelated changes get separate commits. **Every commit requires explicit approval before running — never auto-run `git commit`, even mid-task.**
- **Testing can only happen against the `preview` branch's deployed Vercel URL** — OneSignal's registered Site URL and the backend's CORS `allowed_origins` are both scoped to the main domain plus that specific preview URL, not arbitrary per-branch Vercel preview deployments. A feature-branch-specific preview URL would fail OneSignal push registration and backend API calls. This means: don't open a PR per task — batch all of Phase 1's code tasks (2–7) into commits on `feat/push-notifications`, then push and merge **one** PR to `preview` before doing any device verification, to minimize merge → redeploy → physical-device-retest round trips.

---

## File Structure

| Action | Path | Purpose |
|---|---|---|
| Modify | `webapp/src/hooks/usePWAInstall.ts` | Export canonical `detectPlatform`; add `isIosNonSafari` flag; re-arm the install modal dismiss flag after a cooldown |
| Modify | `webapp/src/hooks/useNotificationPermission.ts` | Remove duplicate `detectPlatformLabel`, use `detectPlatform` instead |
| Modify | `webapp/src/pages/TestNotifPage.tsx` | Update import to use unified `detectPlatform` |
| Modify | `webapp/src/components/pwa/PWAInstallModal.tsx` | Add `WrongBrowserVariant` for iOS non-Safari |
| Modify | `webapp/src/App.tsx` | Trigger install modal for iOS non-Safari case |
| Modify | `webapp/index.html` | Fix favicon MIME type, add `apple-touch-icon` |
| Create | `webapp/public/logo-512.png` | Accurately-sized 512×512 icon for manifest |
| Modify | `webapp/public/manifest.json` | Reference the new 512×512 icon |
| Modify | `webapp/src/components/mobile/DrawerMenu.tsx` | Add "Test notifications" entry routing to `/test-notif` |

---

## Phase 1 — PWA Installability on Mobile

### Task 1: Verify Android install path on the current Vercel deployment

**Files:** none (verification only — `webapp/vercel.json` is read, not modified, unless this task finds it broken)

- [x] **Step 1: Get the current preview deployment URL**

  `https://medicoordai-git-preview-nkops-projects.vercel.app`

- [x] **Step 2: Confirm static assets aren't swallowed by the SPA rewrite**

  Confirmed via `curl -sI` against `/manifest.json`, `/OneSignalSDKWorker.js`, `/logo.png`, and `/` — all return `200` with correct content types (`application/json`, `application/javascript`, `image/png`, `text/html`), not HTML fallback. The SPA rewrite in `vercel.json` is not the problem; Vercel serves static files before applying it, as documented.

- [x] **Step 3: Manual install test on a real Android Chrome device**

  Confirmed working. Install succeeds and `isStandalone` is detected correctly once the install modal is actually shown.

- [x] **Step 4: Record the result**

  **Root cause of "intermittent" appearance found (not a Vercel/caching issue):** `dismissInstallModal()` in `usePWAInstall.ts` permanently sets `medicoord_install_modal_dismissed` in localStorage with no expiry, on every exit path from the modal (Install, Not now, or canceling Chrome's native install sheet). Unlike `NotificationPermissionPrompt`, which re-arms after 7 days, the install modal never reappears on a device once dismissed once. Confirmed by testing: the modal only reappeared after manually clearing the flag via `/test-notif`'s "Reset install modal" button, and installation worked correctly once shown. See Task 2 for the fix (1-hour re-arm, added 2026-06-18 per user decision — short cooldown chosen specifically for ease of testing).

---

### Task 2: Add a cooldown re-arm to the install modal dismiss flag

**Files:**
- Modify: `webapp/src/hooks/usePWAInstall.ts`

**Problem:** Discovered while verifying Task 1 — see Task 1 Step 4 for the root-cause writeup. The dismiss flag needs an expiry so the prompt re-arms instead of being permanently suppressed after one interaction. Per a 2026-06-18 decision, the cooldown is deliberately short (1 hour, not the 7 days used for the notification permission prompt) to make manual testing practical.

- [ ] **Step 1: Change the dismiss flag from a boolean to a timestamp with a cooldown check**

  In `webapp/src/hooks/usePWAInstall.ts`, change:
  ```typescript
  const DISMISS_KEY = "medicoord_install_modal_dismissed"
  ```
  to:
  ```typescript
  const DISMISS_KEY = "medicoord_install_modal_dismissed"
  const INSTALL_MODAL_REARM_MS = 60 * 60 * 1000 // 1 hour

  function isInstallModalDismissed(): boolean {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return false
    return Date.now() - new Date(ts).getTime() < INSTALL_MODAL_REARM_MS
  }
  ```

  Change the lazy state initializer from:
  ```typescript
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "true"
  )
  ```
  to:
  ```typescript
  const [dismissed, setDismissed] = useState(() => isInstallModalDismissed())
  ```

  Change `dismissInstallModal` from:
  ```typescript
  const dismissInstallModal = () => {
    localStorage.setItem(DISMISS_KEY, "true")
    setDismissed(true)
  }
  ```
  to:
  ```typescript
  const dismissInstallModal = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    setDismissed(true)
  }
  ```
  (Storing an ISO timestamp instead of the literal string `"true"` means any device that already dismissed the modal under the old code — including the one used for Task 1 testing — automatically re-arms on next load, since `new Date("true").getTime()` is `NaN` and `Date.now() - NaN < INSTALL_MODAL_REARM_MS` evaluates to `false`. No separate migration step needed.)

- [ ] **Step 2: Type-check**

  Run from `webapp/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Manual smoke test**

  Run `npm run dev`. In the browser DevTools console:
  ```js
  localStorage.setItem("medicoord_install_modal_dismissed", new Date().toISOString())
  ```
  Reload — modal should stay hidden (within the 1-hour window). Then:
  ```js
  localStorage.setItem("medicoord_install_modal_dismissed", new Date(Date.now() - 61 * 60 * 1000).toISOString())
  ```
  Reload — modal should reappear (61 minutes is past the 1-hour cooldown).

- [ ] **Step 4: Commit**
  ```bash
  git add webapp/src/hooks/usePWAInstall.ts
  git commit -m "fix(push): re-arm install modal dismiss after 1 hour instead of permanently"
  ```

---

### Task 3: Unify platform detection — remove the `detectPlatformLabel` / `detectPlatform` divergence

**Files:**
- Modify: `webapp/src/hooks/usePWAInstall.ts`
- Modify: `webapp/src/hooks/useNotificationPermission.ts`
- Modify: `webapp/src/pages/TestNotifPage.tsx`

**Interfaces:**
- Produces: `detectPlatform(): Platform` exported from `usePWAInstall.ts` (was previously internal/unexported) — this becomes the single source of truth for platform labeling, replacing `detectPlatformLabel(): string`.

**Problem:** `useNotificationPermission.ts` has its own `detectPlatformLabel()` that labels *any* iOS user agent as `"ios_safari"`, while `usePWAInstall.ts`'s `detectPlatform()` correctly narrows to Safari-only and returns `"unsupported"` for Chrome/Firefox-on-iOS. This means a Chrome-on-iOS user's (non-existent) player ID would get stored under the `ios_safari` localStorage key, diverging from what `usePWAInstall` reports.

- [ ] **Step 1: Export `detectPlatform` from `usePWAInstall.ts`**

  In `webapp/src/hooks/usePWAInstall.ts`, change:
  ```typescript
  function detectPlatform(): Platform {
  ```
  to:
  ```typescript
  export function detectPlatform(): Platform {
  ```

- [ ] **Step 2: Remove the duplicate detector from `useNotificationPermission.ts`**

  In `webapp/src/hooks/useNotificationPermission.ts`, delete:
  ```typescript
  export function detectPlatformLabel(): string {
    const ua = navigator.userAgent
    if (/iPad|iPhone|iPod/.test(ua)) return "ios_safari"
    if (/Android/.test(ua)) return "android_chrome"
    if (/Chrome/.test(ua) && !/Chromium|OPR|Edge/.test(ua)) return "desktop_chrome"
    return "desktop_other"
  }
  ```
  Add this import near the top of the file (after the existing `import { useState, useEffect, useRef } from "react"` line):
  ```typescript
  import { detectPlatform } from "./usePWAInstall"
  ```
  Then replace all four call sites in the same file:
  - `localStorage.getItem(PLAYER_ID_KEY_PREFIX + detectPlatformLabel())` → `localStorage.getItem(PLAYER_ID_KEY_PREFIX + detectPlatform())`
  - `localStorage.setItem(PLAYER_ID_KEY_PREFIX + detectPlatformLabel(), userId)` → `localStorage.setItem(PLAYER_ID_KEY_PREFIX + detectPlatform(), userId)`
  - `localStorage.setItem(PLATFORM_KEY, detectPlatformLabel())` → `localStorage.setItem(PLATFORM_KEY, detectPlatform())`
  - `localStorage.removeItem(PLAYER_ID_KEY_PREFIX + detectPlatformLabel())` → `localStorage.removeItem(PLAYER_ID_KEY_PREFIX + detectPlatform())`

- [ ] **Step 3: Update `TestNotifPage.tsx` to import from the new location**

  In `webapp/src/pages/TestNotifPage.tsx`, change:
  ```typescript
  import { useNotificationPermission, detectPlatformLabel, PLAYER_ID_KEY_PREFIX } from "../hooks/useNotificationPermission"
  import { usePWAInstall } from "../hooks/usePWAInstall"
  ```
  to:
  ```typescript
  import { useNotificationPermission, PLAYER_ID_KEY_PREFIX } from "../hooks/useNotificationPermission"
  import { usePWAInstall, detectPlatform } from "../hooks/usePWAInstall"
  ```
  And change:
  ```typescript
  const currentPlatform = detectPlatformLabel()
  ```
  to:
  ```typescript
  const currentPlatform = detectPlatform()
  ```

- [ ] **Step 4: Type-check**

  Run from `webapp/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors, and no remaining references to `detectPlatformLabel` (confirm with `grep -rn detectPlatformLabel webapp/src` returning nothing).

- [ ] **Step 5: Commit**
  ```bash
  git add webapp/src/hooks/usePWAInstall.ts webapp/src/hooks/useNotificationPermission.ts webapp/src/pages/TestNotifPage.tsx
  git commit -m "fix(push): unify platform detection, remove iOS-Safari mislabeling for non-Safari iOS browsers"
  ```

---

### Task 4: iOS wrong-browser guidance — show "Open in Safari" instead of nothing

**Files:**
- Modify: `webapp/src/hooks/usePWAInstall.ts`
- Modify: `webapp/src/components/pwa/PWAInstallModal.tsx`
- Modify: `webapp/src/App.tsx`

**Interfaces:**
- Consumes: `detectPlatform(): Platform` from Task 3.
- Produces: `isIosNonSafari: boolean` added to `UsePWAInstallResult` (returned by `usePWAInstall()`) — `true` when the device is iOS but the browser isn't Safari (e.g. Chrome-on-iOS, Firefox-on-iOS). Consumed by `App.tsx` and passed through to `PWAInstallModal`.

**Problem:** On iOS with a non-Safari browser, `detectPlatform()` returns `"unsupported"`. `App.tsx`'s `showInstallModal` condition (`isPushSupported || platform === "ios_safari"`) is `false` for that case, so no prompt ever shows — this is the exact behavior you're seeing ("iOS doesn't even propose install").

- [ ] **Step 1: Add `isIosNonSafari` to `usePWAInstall.ts`**

  In `webapp/src/hooks/usePWAInstall.ts`, replace the `isIOS` inline check inside `detectPlatform()` with a standalone helper, and expose a derived flag from the hook.

  Replace:
  ```typescript
  function detectPlatform(): Platform {
    const ua = navigator.userAgent
    const MSStream = (window as unknown as { MSStream?: unknown }).MSStream
    const isIOS =
      (/iPad|iPhone|iPod/.test(ua) && !MSStream) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    if (isIOS) {
      const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua)
      return isSafari ? "ios_safari" : "unsupported"
    }
    if (/Android/.test(ua)) {
      const isChrome = /Chrome/.test(ua) && !/Chromium/.test(ua)
      return isChrome ? "android_chrome" : "unsupported"
    }
    if (/Chrome/.test(ua) && !/Chromium|OPR|Edge/.test(ua)) return "desktop_chrome"
    return "desktop_other"
  }
  ```
  with:
  ```typescript
  function isIosDevice(): boolean {
    const ua = navigator.userAgent
    const MSStream = (window as unknown as { MSStream?: unknown }).MSStream
    return (
      (/iPad|iPhone|iPod/.test(ua) && !MSStream) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    )
  }

  export function detectPlatform(): Platform {
    const ua = navigator.userAgent
    if (isIosDevice()) {
      const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua)
      return isSafari ? "ios_safari" : "unsupported"
    }
    if (/Android/.test(ua)) {
      const isChrome = /Chrome/.test(ua) && !/Chromium/.test(ua)
      return isChrome ? "android_chrome" : "unsupported"
    }
    if (/Chrome/.test(ua) && !/Chromium|OPR|Edge/.test(ua)) return "desktop_chrome"
    return "desktop_other"
  }
  ```

  Add `isIosNonSafari: boolean` to the `UsePWAInstallResult` interface:
  ```typescript
  export interface UsePWAInstallResult {
    platform: Platform
    installState: InstallState
    isStandalone: boolean
    isPushSupported: boolean
    isIosNonSafari: boolean
    promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">
    installModalDismissed: boolean
    dismissInstallModal: () => void
  }
  ```

  Inside `usePWAInstall()`, after `const platform = detectPlatform()`, add:
  ```typescript
  const isIosNonSafari = isIosDevice() && platform === "unsupported"
  ```

  And add it to the returned object:
  ```typescript
  return {
    platform,
    installState,
    isStandalone,
    isPushSupported,
    isIosNonSafari,
    promptInstall,
    installModalDismissed: dismissed,
    dismissInstallModal,
  }
  ```

- [ ] **Step 2: Add `WrongBrowserVariant` to `PWAInstallModal.tsx`**

  In `webapp/src/components/pwa/PWAInstallModal.tsx`, add `isIosNonSafari` to the props interface:
  ```typescript
  interface PWAInstallModalProps {
    platform: Platform
    installState: InstallState
    isPushSupported: boolean
    isIosNonSafari: boolean
    onInstalled: () => void
    onDismiss: () => void
    promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">
  }
  ```
  Destructure it in the component signature:
  ```typescript
  export function PWAInstallModal({
    platform,
    installState,
    isPushSupported,
    isIosNonSafari,
    onInstalled,
    onDismiss,
    promptInstall,
  }: PWAInstallModalProps) {
  ```
  Add a render branch after the existing three (right after the `DesktopVariant` line):
  ```tsx
  {platform === "ios_safari" && <IOSVariant isPushSupported={isPushSupported} onInstalled={onInstalled} onDismiss={onDismiss} />}
  {platform === "android_chrome" && <AndroidVariant onInstall={handleAndroidInstall} onDismiss={onDismiss} />}
  {(platform === "desktop_chrome" || platform === "desktop_other") && <DesktopVariant onEnable={onInstalled} onDismiss={onDismiss} />}
  {platform === "unsupported" && isIosNonSafari && <WrongBrowserVariant onDismiss={onDismiss} />}
  ```
  Add the new component (place it after `IOSVariant`, before `AndroidVariant`):
  ```tsx
  function WrongBrowserVariant({ onDismiss }: { onDismiss: () => void }) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--color-warning-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className="ti ti-brand-safari" style={{ fontSize: 22, color: "var(--color-warning)" }} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            Open MediCoord in Safari
          </h2>
        </div>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
          Push notifications on iOS only work in Safari. Copy this page's link and open it in Safari, then add it to your home screen to enable health alerts.
        </p>
        <button onClick={onDismiss} style={secondaryButtonStyle}>Close</button>
      </>
    )
  }
  ```

- [ ] **Step 3: Wire `isIosNonSafari` into `App.tsx`**

  In `webapp/src/App.tsx`, add `isIosNonSafari` to the `usePWAInstall()` destructure:
  ```typescript
  const {
    platform,
    installState,
    isPushSupported,
    isIosNonSafari,
    promptInstall,
    installModalDismissed,
    dismissInstallModal,
  } = usePWAInstall()
  ```
  Update `showInstallModal` to also trigger for the wrong-browser case:
  ```typescript
  const showInstallModal =
    !installModalDismissed &&
    installState !== "standalone" &&
    (isPushSupported || platform === "ios_safari" || isIosNonSafari) &&
    !installConfirmed
  ```
  Pass the new prop to `PWAInstallModal`:
  ```tsx
  {showInstallModal && (
    <PWAInstallModal
      platform={platform}
      installState={installState}
      isPushSupported={isPushSupported}
      isIosNonSafari={isIosNonSafari}
      promptInstall={promptInstall}
      onInstalled={() => {
        dismissInstallModal()
        setInstallConfirmed(true)
      }}
      onDismiss={dismissInstallModal}
    />
  )}
  ```

- [ ] **Step 4: Type-check**

  Run from `webapp/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 5: Manual smoke test — simulate Chrome-on-iOS**

  Run `npm run dev` in `webapp/`. Open Chrome DevTools → toggle device toolbar → set a custom user agent string containing `CriOS` (e.g. via DevTools → Network conditions → User agent → Custom: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1`), reload.
  Expected: the "Open MediCoord in Safari" modal appears (not a blank sheet, not nothing).

- [ ] **Step 6: Commit**
  ```bash
  git add webapp/src/hooks/usePWAInstall.ts webapp/src/components/pwa/PWAInstallModal.tsx webapp/src/App.tsx
  git commit -m "fix(push): show Open-in-Safari guidance for iOS non-Safari browsers instead of no prompt"
  ```

---

### Task 5: Fix favicon MIME type and add `apple-touch-icon`

**Files:**
- Modify: `webapp/index.html`

- [ ] **Step 1: Fix the icon MIME type and add the Apple touch icon link**

  In `webapp/index.html`, change:
  ```html
  <link rel="icon" type="image/jpeg" href="/logo.png" />
  ```
  to:
  ```html
  <link rel="icon" type="image/png" href="/logo.png" />
  <link rel="apple-touch-icon" href="/logo.png" />
  ```
  (`/logo.png` is a 500×500 PNG, confirmed via `python3 -c "from PIL import Image; print(Image.open('webapp/public/logo.png').size, Image.open('webapp/public/logo.png').format)"` → `(500, 500) PNG`. The old `type="image/jpeg"` was simply wrong.)

- [ ] **Step 2: Verify in browser**

  Run `npm run dev` in `webapp/`, open DevTools → Network tab, reload, confirm `logo.png` loads with `content-type: image/png` and no console warnings about icon type mismatch.

- [ ] **Step 3: Commit**
  ```bash
  git add webapp/index.html
  git commit -m "fix(pwa): correct favicon MIME type, add apple-touch-icon link"
  ```

---

### Task 6: Add an accurate 512×512 manifest icon

**Files:**
- Create: `webapp/public/logo-512.png`
- Modify: `webapp/public/manifest.json`

**Problem:** The manifest declares a `500x500` icon entry pointing at `/logo.png`, which actually *is* 500×500 (truthful) — but Chrome's install criteria look for a `512x512` icon specifically. There's no accurately-sized 512×512 asset in the repo.

- [ ] **Step 1: Generate a true 512×512 icon from the existing logo**

  Run from the repo root (Pillow is already available — confirmed via `python3 -c "import PIL; print(PIL.__version__)"` → `11.3.0`):
  ```bash
  python3 -c "
  from PIL import Image
  im = Image.open('webapp/public/logo.png').convert('RGBA')
  im.resize((512, 512), Image.LANCZOS).save('webapp/public/logo-512.png')
  "
  ```

- [ ] **Step 2: Verify the new file**

  ```bash
  python3 -c "from PIL import Image; im = Image.open('webapp/public/logo-512.png'); print(im.size, im.format)"
  ```
  Expected: `(512, 512) PNG`.

- [ ] **Step 3: Update the manifest**

  In `webapp/public/manifest.json`, change:
  ```json
    "icons": [
      { "src": "/logo.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/logo.png", "sizes": "500x500", "type": "image/png" }
    ]
  ```
  to:
  ```json
    "icons": [
      { "src": "/logo.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/logo-512.png", "sizes": "512x512", "type": "image/png" }
    ]
  ```

- [ ] **Step 4: Verify in browser**

  Run `npm run dev` in `webapp/`, open DevTools → Application → Manifest. Confirm both icon entries load with no red warnings.

- [ ] **Step 5: Commit**
  ```bash
  git add webapp/public/logo-512.png webapp/public/manifest.json
  git commit -m "fix(pwa): add accurately-sized 512x512 manifest icon"
  ```

---

### Task 7: Add a "Test notifications" entry to the mobile drawer menu

**Files:**
- Modify: `webapp/src/components/mobile/DrawerMenu.tsx`

**Problem:** `/test-notif` (built in the original push-notifications plan) is fully functional but unreachable from the UI — it's only accessible by typing the URL directly. This is the "Add test button on homepage for push notif (Android + iOS PWA)" item from the weekly plan. `DrawerMenu.tsx` is the menu reached from the homepage hamburger icon on mobile (where Android/iOS testing happens) and already has a "Home" / "My profile" / "Sign out" list — follow that exact pattern.

- [ ] **Step 1: Add a bell icon component**

  In `webapp/src/components/mobile/DrawerMenu.tsx`, add this function after `ProfileIcon` (before `ChevronRightIcon`):
  ```tsx
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
  ```

- [ ] **Step 2: Add the navigation handler**

  After `handleProfile`, add:
  ```tsx
  const handleTestNotifications = () => {
    onClose()
    navigate('/test-notif')
  }
  ```

- [ ] **Step 3: Add the menu entry**

  After the "My profile" `<button>` block and its trailing divider `<div style={{ height: 1, background: '#e5e7eb', margin: '0 20px' }} />`, insert a new button + divider, before the "Sign out" button:
  ```tsx
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
      color: '#1f2937',
    }}
  >
    <BellIcon />
    <span style={{ flex: 1, fontSize: 14 }}>Test notifications</span>
    <span style={{ color: '#9ca3af' }}>
      <ChevronRightIcon />
    </span>
  </button>

  <div style={{ height: 1, background: '#e5e7eb', margin: '0 20px' }} />
  ```

- [ ] **Step 4: Type-check**

  Run from `webapp/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 5: Manual smoke test**

  Run `npm run dev`, open the app at mobile viewport width, open the hamburger menu, confirm "Test notifications" appears between "My profile" and "Sign out", and tapping it navigates to `/test-notif` and closes the drawer.

- [ ] **Step 6: Commit**
  ```bash
  git add webapp/src/components/mobile/DrawerMenu.tsx
  git commit -m "feat(push): add Test notifications entry to mobile drawer menu"
  ```

---

### Task 8: Push Phase 1 to `preview` and verify cross-device (close out Phase 1)

**Files:** none — git operations and verification only

- [ ] **Step 0: Push and merge one PR for all of Phase 1**

  After Tasks 2–7 are all committed on `feat/push-notifications`:
  ```bash
  git push origin feat/push-notifications
  gh pr create --title "fix(push): iOS install guidance, install-modal re-arm, manifest/favicon fixes, test-notif entry point" --body "Closes the iOS PWA-install gap (wrong-browser guidance, platform-detection divergence), fixes the install-modal permanent-dismiss bug, fixes favicon/manifest icon issues, adds a Test notifications entry to the mobile drawer menu. See docs/superpowers/plans/2026-06-18-pwa-push-notifications-completion.md."
  ```
  Review the diff, then merge the PR into `preview`. Wait for the Vercel deployment for `preview` to finish building before proceeding — confirm via the Vercel dashboard or `vercel ls`.

- [x] **Step 1: Android Chrome, browser tab → install → standalone**

  Confirmed working on a real Android device.

- [x] **Step 2: iOS Safari ≥16.4, browser tab → manual install → standalone**

  Tested on a real iPhone 15 Pro, iOS 26.4, in Safari. **Found a real bug, not yet installed:** the modal showed "Push not supported on this device — requires iOS 16.4 or later" instead of the install instructions, despite iOS 26.4 being far past the 16.4 floor. See Task 9 for the root cause and fix.

- [x] **Step 3: Chrome-on-iOS → guidance shown, no crash**

  Confirmed working — the "Open MediCoord in Safari" card from Task 4 appeared correctly on the same iPhone when opened in Chrome (CriOS).

- [x] **Step 4: Record results**

  Android and Chrome-on-iOS guidance both confirmed working. iOS Safari install is blocked by the bug fixed in Task 9 — re-verify Step 2 after Task 9 ships before proceeding to Phase 2.

---

### Task 9: Decouple the iOS version gate from live Push-API availability

**Files:**
- Modify: `webapp/src/hooks/usePWAInstall.ts`
- Modify: `webapp/src/components/pwa/PWAInstallModal.tsx`
- Modify: `webapp/src/App.tsx`
- Modify: `webapp/src/pages/TestNotifPage.tsx`

**Problem:** Discovered while verifying Task 8 Step 2 — a real iPhone 15 Pro on iOS 26.4 Safari (not yet installed) was shown "Push not supported on this device — requires iOS 16.4 or later" instead of the install instructions. Root cause: Apple does not expose `Notification`/`PushManager`/`serviceWorker` in `window`/`navigator` for a regular (non-installed) Safari tab on iOS — those APIs only become available once the page is added to the Home Screen and opened standalone. The old `isPushSupported` flag ANDed the iOS-16.4+ version check together with live presence of those APIs, so on any non-installed iOS Safari tab — regardless of how new the OS is — the live-API checks fail and the whole flag goes `false`, triggering the wrong "unsupported, update your device" message instead of install instructions.

**Fix:** split into two booleans — `isIosVersionSupported` (pure OS-version check, used by the modal to pick which iOS message to show) and `isPushSupported` (unchanged: still requires live API presence, correctly used to gate the actual permission-request flow post-install).

- [x] **Step 1: Add `isIosVersionSupported` to `usePWAInstall.ts`**

  Extract the version-gate clause out of `isPushSupported` into its own named boolean:
  ```typescript
  const isIosVersionSupported =
    platform !== "ios_safari" ||
    (iOSVersion !== null &&
      (iOSVersion.major > 16 || (iOSVersion.major === 16 && iOSVersion.minor >= 4)))

  const isPushSupported =
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    isIosVersionSupported
  ```
  Add `isIosVersionSupported: boolean` to `UsePWAInstallResult` and to the hook's returned object.

- [x] **Step 2: Use the version-only gate in `PWAInstallModal.tsx`**

  Replace the `isPushSupported` prop on `PWAInstallModal` and on `IOSVariant` with `isIosVersionSupported` — same plumbing, renamed to match what it actually checks now. `IOSVariant`'s `if (!isIosVersionSupported)` branch now only shows the "update your device" message for genuinely pre-16.4 versions, not for "not installed yet."

- [x] **Step 3: Wire `isIosVersionSupported` through `App.tsx`**

  Destructure `isIosVersionSupported` from `usePWAInstall()` alongside the existing `isPushSupported` (still needed for `showInstallModal`'s Android/desktop clause and `showPermissionPrompt`), and pass `isIosVersionSupported` (not `isPushSupported`) to `PWAInstallModal`.

- [x] **Step 4: Surface `isIosVersionSupported` in the `/test-notif` debug panel**

  Added an `ios_version_ok` row next to `push_supported` in `TestNotifPage.tsx`'s "PWA state" panel, so this exact class of bug is visible at a glance during testing instead of requiring a written bug report to diagnose.

- [x] **Step 5: Verify with the real build command**

  ```bash
  npx tsc -b && npm run build
  ```
  Both clean (only pre-existing warnings: missing local `VITE_ONESIGNAL_APP_ID` env var, a pre-existing dynamic/static import note, and a chunk-size note — none blocking).

- [x] **Step 6: Commit**

  Commit `cf23752`.

- [x] **Step 7: Push, PR, merge to preview, re-verify Task 8 Step 2**

  Pushed, PR #23 opened and merged (`89626cc`) into `preview`. Re-verified on the same real iPhone 15 Pro (iOS 26.4): install + notification permission grant now succeed directly after install, confirming the fix.

---

## Phase 2 — Push Notification Integration + Live Test

### Task 10: Verify OneSignal dashboard and Vercel environment configuration

**Files:** none — configuration verification only

- [x] **Step 1: Check OneSignal dashboard**

  Checked — dashboard shows 4 registered users across platforms (iOS Safari, Android Chrome, 2× desktop Chrome from earlier dev-machine testing), no configuration warnings.

- [x] **Step 2: Check Vercel environment variable**

  Not checked directly via the Vercel dashboard, but confirmed working by inference: `OneSignal.init()` requires a valid `VITE_ONESIGNAL_APP_ID` to succeed at all, and the dashboard shows live registered users — so the env var is correctly set on `Preview`.

- [x] **Step 3: Record results**

  Both prerequisites confirmed satisfied.

---

### Task 11: Live push notification test matrix across platforms

**Files:** none — manual live testing, using the existing `/notifications/send` endpoint and `/test-notif` page (reachable via the Task 7 drawer entry)

- [ ] **Step 1: Desktop Chrome — regression check**

  Not explicitly re-tested this session. No code change in this plan touched desktop-specific paths; low regression risk, but not formally confirmed.

- [x] **Step 2: Android Chrome — full pipeline**

  Confirmed indirectly: OneSignal dashboard shows an active Android Chrome registration (architecture `armv8l`, consistent with a phone, not desktop). A fresh send-and-receive wasn't explicitly re-confirmed in this exact session after the Phase 1/Task 9 changes — the user judged the dashboard evidence sufficient and chose not to spend further time on a formal re-test, since this device's registration predates this session's work and was already known-working.

- [x] **Step 3: iOS Safari ≥16.4 — full pipeline**

  Confirmed directly and freshly on a real iPhone 15 Pro (iOS 26.4): "directly after install required to give access to notification, after allowing it triggered the notification test." This is the test that had never succeeded before this work — proof the iOS gap is genuinely closed, not just that the install prompt appears.

- [x] **Step 4: Chrome-on-iOS — confirm graceful no-op, not a false positive**

  Confirmed in Task 8 Step 3 — the "Open in Safari" guidance card showed correctly, no crash.

- [x] **Step 5: Record results in the audit doc**

  Done — see `docs/push-notifications-audit-2026-06-12.md` summary table update in the same commit as this plan closure.

- [ ] **Step 6: Update the Notion weekly plan**

  Not yet done — ask before doing this, since it's an external-system write.

- [x] **Step 7: Commit the audit doc update**

  Bundled into the same commit as this plan's final status update.

---

## Verification Checklist

- [ ] `npx tsc -b` (or `npm run build`, which is what Vercel actually runs) passes with zero errors after every task in Phase 1. **Note:** `webapp/tsconfig.json` has `"files": []` and only `"references"` — plain `npx tsc --noEmit` silently checks an empty file set and will not catch real errors. This caused PR #22's first deployment to fail (`TestNotifPage.tsx` had a real type error around `KNOWN_PLATFORMS`/`targetPlatformId` typing after Task 3's `detectPlatform()` change, fixed in commit `804caa2`) despite every per-task `tsc --noEmit` check in this plan reporting clean. Always verify with `tsc -b` or the full `npm run build` going forward.
- [ ] No remaining references to `detectPlatformLabel` anywhere in `webapp/src`
- [ ] Install modal dismiss re-arms after 1 hour instead of permanently (Task 2)
- [ ] `webapp/public/manifest.json` has a `192x192` and a genuinely `512x512` icon entry
- [ ] `webapp/index.html` favicon is `type="image/png"`, plus an `apple-touch-icon` link
- [ ] Android Chrome: install prompt appears, install succeeds, standalone mode detected, push notification delivered
- [ ] iOS Safari ≥16.4: install prompt appears with manual steps, install succeeds, standalone mode detected, push notification delivered
- [ ] Chrome-on-iOS: "Open in Safari" guidance shown instead of nothing; no false "supported" signals
- [ ] Desktop Chrome: no regressions, push notification still delivered
- [ ] `/test-notif` reachable from the mobile drawer menu, not just by typing the URL
- [ ] OneSignal dashboard and Vercel env var confirmed correctly configured
- [ ] `docs/push-notifications-audit-2026-06-12.md` and the Notion weekly plan both reflect final, verified results
