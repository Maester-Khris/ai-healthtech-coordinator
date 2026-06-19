# Push Notifications — Feature Audit & Completion Plan
**Date:** 2026-06-12 · **Branch merged to:** `preview`

---

## Current State by Platform

### ✅ Web (Desktop Chrome) — Working
Confirmed end-to-end in previous session.

| Signal | Value |
|--------|-------|
| platform | `desktop_chrome` |
| push_supported | `true` |
| install_state | `not_applicable` (correct — install optional on desktop) |
| permission | `granted` |
| OneSignal player ID | captured, stored in localStorage |
| Send API | `/notifications/send` → `200 OK` |

Nothing to fix.

---

### ✅ Android Chrome — Working
PWA install modal appeared on Vercel preview URL. Permission granted.

| Signal | Value |
|--------|-------|
| platform | `android_chrome` |
| push_supported | `true` |
| install_state | `not_applicable` (after prompt consumed — expected) |
| permission | `granted` |

**Note on `install_state: not_applicable` post-install**: `beforeinstallprompt` fires at most once per browser session and is consumed when the modal calls `prompt()`. After the user accepts/dismisses and reloads, the prompt is gone and `capturedPrompt` is null — hence `not_applicable`. This is browser behaviour, not a bug. If the user installed the PWA, `isStandalone` would be `true` on next open.

Nothing to fix for the happy path.

---

### ❌ iOS — Not Working
User tested in **Chrome for iOS** (`CriOS` UA). This is the root cause for all the "unsupported" signals.

| Signal | Value | Root cause |
|--------|-------|------------|
| platform | `unsupported` | Correct: Chrome on iOS has no Push API |
| push_supported | `false` | Correct: `"Notification" in window` is false on Chrome/iOS |
| install_state | `not_applicable` | Correct: no `beforeinstallprompt` on iOS, platform not `ios_safari` |
| permission | `unknown` | Correct: `Notification` object doesn't exist |

**iOS web push hard requirements (browser limitation, not code):**
- Must use **Safari** (not Chrome, Firefox, or any CriOS wrapper)
- Requires **iOS 16.4+**
- App must be **installed as PWA** (opened from Home Screen in standalone mode)
- Only then does Safari expose `Notification`, `serviceWorker`, and `PushManager`

---

## Gap Analysis

### Gap 1 — Codebase: No guidance for Chrome-on-iOS users (highest priority)

**Location:** `App.tsx` `showInstallModal` condition + `TestNotifPage.tsx`

When `platform === "unsupported"` on an iOS device, the user sees:
- No modal, no card, no explanation
- Just silent `push_supported: false` and `platform: unsupported` in the debug panel

The current `showInstallModal` condition:
```typescript
(isPushSupported || platform === "ios_safari")
```
…evaluates `false` for Chrome-on-iOS → modal never shows.

**Fix needed:** Detect "iOS device but wrong browser" and show a "Open this page in Safari" guidance card/modal. The detection is already available:
```typescript
// usePWAInstall.ts already has this logic — just need to export it
const isIOS = /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1)
const isWrongBrowser = isIOS && platform === "unsupported"
```

---

### Gap 2 — Codebase: PWAInstallModal has no `unsupported` variant

**Location:** `webapp/src/components/pwa/PWAInstallModal.tsx:64-66`

```typescript
{platform === "ios_safari" && <IOSVariant .../>}
{platform === "android_chrome" && <AndroidVariant .../>}
{(platform === "desktop_chrome" || platform === "desktop_other") && <DesktopVariant .../>}
// No branch for platform === "unsupported"
```

Even if we fix `showInstallModal` to include the "wrong browser" case, the modal renders nothing for `unsupported`.

**Fix needed:** Add a `WrongBrowserVariant` that says "Open MediCoord in Safari to enable notifications" with a Safari deeplink (or manual instruction).

---

### Gap 3 — Codebase: HTML favicon declares wrong MIME type for logo.png

**Location:** `webapp/index.html:6`

```html
<link rel="icon" type="image/jpeg" href="/logo.png" />
```

The actual file is a **500×500 PNG** (`file` command confirms). The manifest correctly declares `image/png`. iOS Safari validates icon types for PWA installability — a type mismatch can prevent the "Add to Home Screen" prompt from showing.

**Fix:** Change `type="image/jpeg"` → `type="image/png"`.

---

### Gap 4 — Codebase: `detectPlatformLabel()` always returns `ios_safari` for any iOS UA

**Location:** `webapp/src/hooks/useNotificationPermission.ts:39-44`

```typescript
if (/iPad|iPhone|iPod/.test(ua)) return "ios_safari"
```

This means Chrome-on-iOS would store its (non-existent) player ID under the `ios_safari` key, and `usePWAInstall.detectPlatform()` returning `unsupported` diverges from `useNotificationPermission.detectPlatformLabel()` returning `ios_safari` for the same device. Low risk today (Chrome on iOS can't register anyway), but will cause confusion later.

**Fix:** Mirror the same guard — only return `ios_safari` when it's actually Safari.

---

### Gap 5 — Infrastructure: Verify OneSignal dashboard iOS Web Push config

**What to check in OneSignal dashboard (app settings → Platforms):**
- "Safari Web Push" or "Apple Web Push" platform: must be enabled
- No separate APNS certificate is needed for web push (that's for native iOS apps) — OneSignal v16 uses the Web Push standard
- Confirm the App ID used in `VITE_ONESIGNAL_APP_ID` has web push enabled for all platforms

**How to verify without a device:**
1. Log into OneSignal dashboard
2. Go to Settings → Platforms
3. Confirm "Web Push" covers Safari/iOS (it should with v16 unified SDK)
4. Check if there are any Apple-specific configuration warnings

---

### Gap 6 — Infrastructure: Verify `VITE_ONESIGNAL_APP_ID` in Vercel preview env

**What to check:**
- In Vercel project → Settings → Environment Variables
- Confirm `VITE_ONESIGNAL_APP_ID` is set for the `preview` environment
- If not set, `%VITE_ONESIGNAL_APP_ID%` will be served as a literal string in index.html → OneSignal init will fail with "invalid app ID"
- Android push worked, which implies the env var IS set. But worth confirming explicitly.

---

### Gap 7 — Manifest: Only 2 icon sizes declared (192 and 500)

**Location:** `webapp/public/manifest.json`

Apple recommends `180x180` for Touch Icon and requires `512x512` for the Chrome splash screen. The current manifest has `192x192` and `500x500` (both pointing to the same 500×500 image). iOS Safari may reject icons that don't match declared sizes.

**Fix options:**
- Add a `<link rel="apple-touch-icon" href="/logo.png">` in `index.html` (simplest)
- Generate proper resized icons (192×192, 512×512) and update the manifest
- The 500×500 entry is non-standard — Chrome expects exactly 192 and 512

---

## Completion Plan

### Phase 1 — Codebase fixes (unblock iOS Safari path)

| # | File | Change |
|---|------|--------|
| 1 | `index.html` | Fix favicon `type="image/jpeg"` → `type="image/png"`, add `<link rel="apple-touch-icon">` |
| 2 | `manifest.json` | Add `512x512` icon entry; keep 192 |
| 3 | `usePWAInstall.ts` | Export `isIosDevice` boolean so callers can distinguish iOS+Safari from iOS+other |
| 4 | `useNotificationPermission.ts` | Fix `detectPlatformLabel()` to guard iOS Safari the same way `detectPlatform()` does |
| 5 | `PWAInstallModal.tsx` | Add `WrongBrowserVariant` — rendered when `platform === "unsupported"` and iOS device detected — shows "Open in Safari" instruction |
| 6 | `App.tsx` | Expand `showInstallModal` condition to include `isIosDevice && platform === "unsupported"` |
| 7 | `TestNotifPage.tsx` | Add "Open in Safari" warning card when `platform === "unsupported"` (complements the modal) |

### Phase 2 — Infrastructure verification (before iOS end-to-end test)

| # | Where | Action |
|---|-------|--------|
| 1 | OneSignal dashboard | Confirm Web Push platform enabled, no iOS-specific warnings |
| 2 | Vercel | Confirm `VITE_ONESIGNAL_APP_ID` is set on preview env |
| 3 | iOS Safari (physical device) | Open Vercel preview URL in Safari, check `/test-notif` shows `platform: ios_safari` |

### Phase 3 — End-to-end iOS test sequence

1. Open Vercel preview URL in **Safari on iOS 16.4+** (not Chrome)
2. `/test-notif` should show `platform: ios_safari`, `push_supported: true`
3. PWAInstallModal should appear → follow Share → Add to Home Screen steps
4. Open app from Home Screen → `isStandalone: true`
5. Permission prompt appears → Allow
6. `/test-notif` shows `permission: granted`, player ID captured under `ios_safari` key
7. Send test notification from web or another registered device
8. Notification arrives on iOS device

---

## Commit Plan (when implementing)

```
fix(pwa): correct favicon MIME type and add apple-touch-icon
fix(push): iOS wrong-browser guidance — detect Chrome-on-iOS, show "Open in Safari" modal variant
fix(push): align detectPlatformLabel with detectPlatform for iOS non-Safari case
```

---

## Summary Table

| Platform | Status | Blocking issue |
|----------|--------|----------------|
| Web (desktop Chrome) | ✅ Done | — |
| Android Chrome | ✅ Done | — |
| iOS Safari | ✅ Done | Resolved 2026-06-19 — see `docs/superpowers/plans/2026-06-18-pwa-push-notifications-completion.md`. Fixed the wrong-browser guidance gap, the `detectPlatform`/`detectPlatformLabel` divergence, and a second bug found during live testing (iOS conflated "OS too old" with "not installed yet" since Apple only exposes the Push APIs to installed PWAs). Confirmed end-to-end on a real iPhone 15 Pro (iOS 26.4): install → permission grant → notification delivery all succeeded. |
| Chrome-on-iOS (and other non-Safari iOS browsers) | ✅ Done | Shows "Open in Safari" guidance instead of nothing; confirmed no false "supported" signals. |
