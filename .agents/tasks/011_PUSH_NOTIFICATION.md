You are implementing push notification infrastructure for MediCoord AI.
Two meta-instructions are active for this entire task:

SUPERPOWER: Before writing a single line of code, produce a complete
architectural plan covering every file, every state transition, every
API boundary, and every edge case. Structure it as: Context → Decision
→ Implementation → Edge cases → Verification. Wait for explicit
approval before implementing anything.

UI-UX-PRO-MAX: Every visual decision must be intentional and
production-grade. The install gate and permission prompt are the
first impression of the push feature. They must communicate value
("Get notified when you need emergency care near you") not just
mechanics ("Install the PWA"). iOS instruction flow needs actual
iconography. Every component must feel native to MediCoord's design
language — teal/blue primary palette, clean card surfaces, Tabler icons.
No generic modals. No lorem ipsum. Real copy.

Read AGENTS.md and .claude/CLAUDE.md before touching anything.
Confirm branch is feat/push-notifications before proceeding.

---

## STEP 1 — Architectural plan (write this, then STOP and wait for approval)

Produce the full plan in this structure:

### Platform detection matrix
Define exactly how each platform is detected and what behavior follows.
Cover all cases: iOS Safari standalone, iOS Safari browser tab,
Android Chrome standalone, Android Chrome browser tab,
Desktop Chrome, Firefox, Safari desktop, unsupported browsers.
For each: show install gate? show permission prompt? push supported?

### PWA install requirements per platform
iOS: what iOS version minimum? what browser? standalone-only for push?
Android: standalone required or optional for push?
Desktop: standalone optional, push works in tab?

### State machine — full flow
Define every state the user can be in and every transition:
  unknown → detecting → needs_install → installing → installed
  → needs_permission → requesting → granted → token_captured
  → registered (localStorage)
Draw this as a state list with transitions, not prose.

### Files to create (every single one)
Format: path | purpose | depends on

### Files to modify (every single one)
Format: path | what changes | why

### Hook architecture
Define the interface for each hook before implementation:
  usePWAInstall — what it detects, what it exposes, what it does
  useNotificationPermission — what it does, when it fires, what it stores
  useOneSignalSDK — how SDK is initialized, when, what callbacks

### Component architecture
Define props interface for each component before implementation:
  PWAInstallModal — when shown, what variants (iOS/Android/desktop),
                    what actions, how dismissed, persistence
  NotificationPermissionPrompt — when shown, what it says, actions
  TestNotifPage — route, what it reads, what it sends, success/error states

### OneSignal SDK integration
Where does the SDK script load (index.html head? lazy?)
What is the initialization config?
What callbacks are used and what do they return?
How is the player_id extracted from the SDK?
VAPID key requirement — do we need one? where does it come from?

### localStorage schema
Define every key stored and its shape:
  key name | value shape | set when | read when | cleared when

### Backend changes
Does /notifications/send need auth removed for testing?
Or do we test while logged in?
Define the answer and the implementation.

### /test-notif page
Route: /test-notif
What it renders, what it reads from localStorage,
what the send form looks like, success/error feedback.

### Edge cases to handle
- User denies permission → can they re-enable? how?
- User is on unsupported browser → what do they see?
- iOS < 16.4 → push not supported → what message?
- localStorage cleared → token lost → what happens?
- OneSignal SDK fails to load → graceful degradation?
- User dismisses install modal → when does it reappear?

### Verification checklist
Every item that must pass before this sprint is considered done.

---

## STEP 2 — Implementation (only after plan is approved)

### Task A — OneSignal SDK setup

In `webapp/index.html`, add OneSignal SDK before closing </head>:

```html
<script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        defer></script>
```

Add VITE env var to .env.example:
```bash
VITE_ONESIGNAL_APP_ID=
```

---

### Task B — `webapp/src/hooks/usePWAInstall.ts`

```typescript
export type Platform =
  | "ios_safari"
  | "android_chrome"
  | "desktop_chrome"
  | "desktop_other"
  | "unsupported"

export type InstallState =
  | "standalone"        // already installed as PWA
  | "installable"       // browser tab, install prompt available
  | "manual_install"    // browser tab, no prompt (iOS or Firefox)
  | "not_applicable"    // desktop where install is optional

interface UsePWAInstallResult {
  platform: Platform
  installState: InstallState
  isStandalone: boolean
  isPushSupported: boolean
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">
  installModalDismissed: boolean
  dismissInstallModal: () => void
}
```

Detection logic:
```typescript
// Standalone detection
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as any).standalone === true

// iOS detection
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  && !(window as any).MSStream

// iOS version — push requires 16.4+
const iOSVersion = isIOS
  ? parseInt((navigator.userAgent.match(/OS (\d+)_/) ?? [])[1] ?? "0")
  : null

// Push supported
const isPushSupported =
  "Notification" in window &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  (!isIOS || (iOSVersion !== null && iOSVersion >= 16))

// Platform
const platform: Platform = isIOS
  ? "ios_safari"
  : /Android/.test(navigator.userAgent)
    ? "android_chrome"
    : "desktop_chrome"

// InstallState
const installState: InstallState = isStandalone
  ? "standalone"
  : capturedPrompt !== null     // BeforeInstallPromptEvent captured
    ? "installable"
    : isIOS
      ? "manual_install"
      : "not_applicable"
```

BeforeInstallPromptEvent capture:
```typescript
useEffect(() => {
  const handler = (e: Event) => {
    e.preventDefault()
    setCapturedPrompt(e as any)
  }
  window.addEventListener("beforeinstallprompt", handler)
  return () => window.removeEventListener("beforeinstallprompt", handler)
}, [])
```

dismissInstallModal persists to localStorage:
```typescript
const DISMISS_KEY = "medicoord_install_modal_dismissed"
const dismissInstallModal = () => {
  localStorage.setItem(DISMISS_KEY, "true")
  setDismissed(true)
}
// On mount: setDismissed(localStorage.getItem(DISMISS_KEY) === "true")
```

---

### Task C — `webapp/src/hooks/useNotificationPermission.ts`

```typescript
export type PermissionState = "unknown" | "default" | "granted" | "denied"

interface UseNotificationPermissionResult {
  permissionState: PermissionState
  playerId: string | null
  requesting: boolean
  requestPermission: () => Promise<void>
  clearToken: () => void
}
```

localStorage keys:
```typescript
const PLAYER_ID_KEY = "medicoord_onesignal_player_id"
const PLATFORM_KEY  = "medicoord_onesignal_platform"
const GRANTED_KEY   = "medicoord_push_granted"
```

requestPermission flow:
```typescript
const requestPermission = async () => {
  setRequesting(true)
  try {
    // OneSignal SDK handles permission dialog + subscription
    await window.OneSignal.push(() => {
      window.OneSignal.init({
        appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
        notifyButton: { enable: false },  // we use our own UI
        allowLocalhostAsSecureOrigin: true,
      })
    })

    // Get player_id after init
    window.OneSignal.push(() => {
      window.OneSignal.getUserId((userId: string | null) => {
        if (userId) {
          localStorage.setItem(PLAYER_ID_KEY, userId)
          localStorage.setItem(PLATFORM_KEY, platform)
          localStorage.setItem(GRANTED_KEY, "true")
          setPlayerId(userId)
          setPermissionState("granted")
        }
      })
    })
  } catch (err) {
    console.error("[OneSignal] init failed:", err)
  } finally {
    setRequesting(false)
  }
}
```

---

### Task D — `webapp/src/components/pwa/PWAInstallModal.tsx`

Shown when:
- `installState !== "standalone"`
- `!installModalDismissed`
- `isPushSupported`

Three visual variants — same modal shell, different content:

**iOS variant:**
```
Title: "Add MediCoord to your home screen"
Subtitle: "Push notifications require the app to be installed.
           Follow these steps in Safari:"

Step 1: [Share icon] Tap the Share button at the bottom of Safari
Step 2: [Plus-square icon] Tap "Add to Home Screen"
Step 3: [Check icon] Tap "Add" — then open from your home screen

Note: "Requires iOS 16.4 or later"

Button: "I've installed it" → dismisses modal, triggers permission flow
Button: "Maybe later" → dismisses modal, does not trigger permission
```

**Android variant:**
```
Title: "Install MediCoord for health alerts"
Subtitle: "Get emergency care recommendations sent directly
           to your device."

Button: "Install app" (primary) → calls promptInstall()
Button: "Not now" → dismisses modal
```

**Desktop variant (softer, optional):**
```
Title: "Enable health alerts"
Subtitle: "Get push notifications without installing.
           Push works in your browser on desktop."

Button: "Enable notifications" → skips to permission flow directly
Button: "Skip" → dismisses modal
```

Modal must NOT use position:fixed — use the faux viewport pattern
from the design system (min-height wrapper div).

All colors use CSS variables. No hardcoded hex in this component —
MediCoord's blue palette (#185FA5) via var(--color-background-info)
and related variables. Tabler icons throughout.

---

### Task E — `webapp/src/components/pwa/NotificationPermissionPrompt.tsx`

Shown after install confirmed (or on desktop where install not required).
A card at the bottom of the chat panel or a floating card —
NOT a full modal. Unobtrusive.

```
[Bell icon] "Enable health alerts"
"Get notified when emergency care recommendations are ready."
[Enable] [Not now]
```

"Enable" → calls requestPermission()
"Not now" → stores dismissal in localStorage, hides for 7 days

---

### Task F — `/test-notif` page

Route: `webapp/src/pages/TestNotifPage.tsx`
Add to router: `<Route path="/test-notif" element={<TestNotifPage />} />`

```
Page renders:
  Header: "Push notification test"
  Subtitle: "Test the full notification pipeline"

  Status card:
    player_id: [value from localStorage or "not registered"]
    platform:  [value from localStorage or "unknown"]
    permission: [Notification.permission value]

  If no player_id:
    Warning card: "No device registered. Go to the app and enable
    push notifications first, then return here."

  If player_id present:
    Form:
      Title input (default: "MediCoord Test")
      Body input (default: "Push notification pipeline working ✓")
      Send button

  On send → POST /notifications/send
    { player_id, title, body }

  Result card (shown after send):
    Success: notification_id + "Check your device"
    Error: error message
```

Backend — remove auth from /notifications/send for testing:
```python
# During testing phase: comment out get_current_user dependency
# Add a note: restore auth before production
@router.post("/send")
async def send_notification(body: SendNotificationRequest):
    # TODO: restore Depends(get_current_user) before production
```

Or keep auth and use it while logged in — flag the decision
in the outcome summary.

---

## Commits (max 5)

```bash
# Commit 1 — SDK + env
git add webapp/index.html \
        .env.example
git commit -m "feat(push): OneSignal Web Push SDK v16 in index.html, VITE_ONESIGNAL_APP_ID env var"

# Commit 2 — hooks
git add webapp/src/hooks/usePWAInstall.ts \
        webapp/src/hooks/useNotificationPermission.ts
git commit -m "feat(push): usePWAInstall detection hook, useNotificationPermission OneSignal token capture"

# Commit 3 — PWA install modal + permission prompt
git add webapp/src/components/pwa/PWAInstallModal.tsx \
        webapp/src/components/pwa/NotificationPermissionPrompt.tsx
git commit -m "feat(push): PWA install modal (iOS/Android/desktop variants), notification permission prompt"

# Commit 4 — test page + backend
git add webapp/src/pages/TestNotifPage.tsx \
        webapp/src/App.tsx \
        backend/routers/notifications.py
git commit -m "feat(push): /test-notif page, backend /notifications/send endpoint"

# Commit 5 — App wiring
git add webapp/src/App.tsx
git commit -m "feat(push): wire PWAInstallModal and NotificationPermissionPrompt into App.tsx"
```

---

## Verification checklist

- [ ] OneSignal SDK loads without console errors
- [ ] On Android Chrome (browser tab): install prompt appears
- [ ] On iOS Safari (browser tab): manual install instructions shown
- [ ] On desktop Chrome: permission prompt shown directly
- [ ] After granting permission: player_id appears in localStorage
- [ ] localStorage shows medicoord_onesignal_player_id with a UUID
- [ ] /test-notif page reads player_id correctly from localStorage
- [ ] Sending test notification: POST /notifications/send returns 200
- [ ] Notification appears on device within 5 seconds
- [ ] Denying permission: denied state shown, re-enable instructions visible
- [ ] iOS < 16.4: unsupported message shown, no permission prompt
- [ ] Dismissing install modal: does not reappear on refresh
- [ ] npx tsc --noEmit passes
