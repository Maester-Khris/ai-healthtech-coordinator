# Sprint 16 — Onboarding Flow Consolidation — Code Review Findings

Generated: 2026-07-09
Branch: `feat/onboarding-consolidation`
Source: `/code-review high` (8 finder angles → 1-vote verify), run against the full sprint diff — committed history (`dfa577b...HEAD`, static UI) plus the uncommitted workflow-integration implementation (tracked modifications + new untracked files) that another agent wrote from `docs/superpowers/plans/2026-07-09-onboarding-flow-consolidation.md`.
Status: **not fixed yet** — implementation is uncommitted on the branch. Pass this file directly to the next implementation session; no additional context should be needed to act on each item.

All 10 findings below survived independent verification (each re-checked against the actual current file contents, not just the finder's claim). All are **CONFIRMED**.

---

## CONFIRMED — must fix before this sprint merges to `preview`

---

### F1 — CRITICAL (security) · `backend/routers/notifications.py:116-143`

**Problem:** `DELETE /notifications/devices/{subscription_id}` requires a valid JWT but never checks that `subscription_id` belongs to the calling user before proxying the delete to OneSignal. `list_devices` (the sibling endpoint) correctly scopes by the caller's own id via `/users/by/external_id/{user_id}`; `remove_device` takes `subscription_id` straight from the URL path with no ownership check at all. Any authenticated user can unsubscribe any other user's device.

**Current code:**
```python
@router.delete("/devices/{subscription_id}")
async def remove_device(
    subscription_id: str,
    _current_user: object = Depends(get_current_user),   # ← id never used
) -> dict:
    ...
    response = httpx.delete(
        f"{ONESIGNAL_APPS_URL}/{app_id}/subscriptions/{subscription_id}",
        headers={"Authorization": f"Basic {api_key}"},
        timeout=10.0,
    )
```

**Fix:** Before deleting, fetch the caller's own device list (same call `list_devices` makes) and confirm `subscription_id` is in it; 403/404 otherwise:
```python
@router.delete("/devices/{subscription_id}")
async def remove_device(
    subscription_id: str,
    current_user: object = Depends(get_current_user),
) -> dict:
    app_id = os.environ.get("ONESIGNAL_APP_ID", "")
    api_key = os.environ.get("ONESIGNAL_API_KEY", "")
    if not app_id or not api_key:
        raise HTTPException(500, "OneSignal credentials not configured")

    user_id = str(current_user.id)  # type: ignore[attr-defined]
    owned = await list_devices(current_user)  # or inline the same lookup
    if subscription_id not in {d["subscription_id"] for d in owned["devices"]}:
        raise HTTPException(404, "Device not found")
    # ... existing delete call unchanged
```

---

### F2 — HIGH · `webapp/src/App.tsx:133` + `webapp/src/Menucomponents/Home.tsx:52`

**Problem:** The onboarding trigger is computed and rendered independently in two places. `AppInner` (App.tsx) renders `OnboardingOverlay` when `!isMobile && showOnboarding`, immediately before rendering `<Home>`. `Home.tsx` *also* renders `OnboardingOverlay` off its own separate `useProfile()` call, gated on the same underlying condition. Since `Home` is unconditionally rendered as `AppInner`'s child on desktop, both are true at once for any desktop user who hasn't finished onboarding: **two independent `OnboardingWizard` instances mount stacked on top of each other**, each with its own `useOnboardingFlow`, `useGeolocation`, and `useNotificationPermission` state (i.e. two independent OneSignal permission-request flows can fire).

**Current code:**
```tsx
// App.tsx:133-137 (AppInner)
{!isMobile && showOnboarding && <OnboardingOverlay />}
{isMobile
  ? <MobileLayout {...sharedProps} />
  : <Home {...sharedProps} />
}
```
```tsx
// Home.tsx:34, 52
const { profile } = useProfile()
...
{user && profile && !profile.getting_started_done && <OnboardingOverlay />}
```

**Fix:** Delete the onboarding trigger from `Home.tsx` entirely (both the `<OnboardingOverlay />` JSX at line 52 and the now-unused `useProfile()` call at line 34, unless `profile` is needed elsewhere in the file — it currently isn't). `AppInner` already owns `showOnboarding` and is the single source of truth; `Home` shouldn't re-derive it.

---

### F3 — HIGH · `webapp/src/pages/SetupPage.tsx`

**Problem:** Mobile onboarding never navigates back to `/app` after a successful submit. `SetupPage.tsx` is now a 4-line wrapper with no `navigate()` call, and `useOnboardingFlow.submit()` only awaits `updateProfile(...)` with no redirect. Mobile users are routed to `/setup` specifically because onboarding is incomplete (`App.tsx`: `if (isMobile && showOnboarding) return <Navigate to="/setup" replace />`); once they finish, `getting_started_done` flips to `true` in Supabase, but nothing re-routes them — they're stuck looking at the completed wizard's last step.

**Current code:**
```tsx
// SetupPage.tsx — entire file
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard'

export default function SetupPage() {
  return <OnboardingWizard />
}
```

**Fix:** Two options — pick whichever fits the intended UX:
1. Add a `useNavigate()` + `useEffect` in `SetupPage.tsx` that watches `profile?.getting_started_done` (via `useProfile()`) and navigates to `/app` once it flips true.
2. Give `OnboardingWizard` an optional `onComplete?: () => void` prop, called at the end of `flow.submit()` on success, and have `SetupPage.tsx` pass `onComplete={() => navigate('/app')}`.
Either way, confirm the fix doesn't reintroduce a redirect loop with `AppInner`'s own `if (isMobile && showOnboarding) return <Navigate to="/setup" replace />` (there's a brief window between `updateProfile` resolving and `profile` re-fetching where this could double-fire — test it manually on a real device or the dev server, not just by reading the code).

---

### F4 — HIGH · `webapp/src/components/onboarding/OnboardingWizard.tsx:56-57, 67-68`

**Problem:** Emergency-contact and medical-profile fields trim on every keystroke, not just at save time, making it impossible to type multi-word values. The `TextField` underneath is a fully controlled input whose `value` prop is fed directly from this trimmed state (`flow.data.emergency_contact_name ?? ''`, etc.) — there's no local uncontrolled draft. Typing `"John Smith"`: after `"John "` (trailing space), the very next render trims it back to `"John"`, so the space is stripped before the next character can be typed after it. A user cannot type a two-word name, allergy, or condition into these fields at all.

**Current code:**
```tsx
onNameChange={v => flow.setData({ emergency_contact_name: v.trim() || null })}
onPhoneChange={v => flow.setData({ emergency_contact_phone: v.trim() || null })}
...
onAllergiesChange={v => flow.setData({ allergies: v.trim() || null })}
onConditionsChange={v => flow.setData({ conditions: v.trim() || null })}
```

**Fix:** Store the raw (untrimmed) value in `OnboardingData` while typing; trim only inside `buildSubmitPayload` (in `useOnboardingFlow.ts`) at submit time — mirroring what `ProfilePage.tsx`'s `handleSaveChanges` already does correctly (trims in the save handler, not in each field's onChange):
```tsx
onNameChange={v => flow.setData({ emergency_contact_name: v })}
onPhoneChange={v => flow.setData({ emergency_contact_phone: v })}
onAllergiesChange={v => flow.setData({ allergies: v })}
onConditionsChange={v => flow.setData({ conditions: v })}
```
```typescript
// useOnboardingFlow.ts — buildSubmitPayload
export function buildSubmitPayload(data: OnboardingData) {
  return {
    ...data,
    emergency_contact_name: data.emergency_contact_name?.trim() || null,
    emergency_contact_phone: data.emergency_contact_phone?.trim() || null,
    allergies: data.allergies?.trim() || null,
    conditions: data.conditions?.trim() || null,
    getting_started_done: true as const,
  }
}
```
(Note: `OnboardingData`'s field types would need to allow storing the untrimmed working value — either keep them `string | null` and only null-coalesce at submit, or track drafts as plain `string` and convert to `string | null` in `buildSubmitPayload`. Existing `useOnboardingFlow.test.ts` assertions on `buildSubmitPayload`'s output shape should still pass unchanged since the final payload shape is the same.)

---

### F5 — HIGH · `backend/routers/chat.py:130-131` + `migrations/README.md:23`

**Problem:** The new medical-context profile fetch is wrapped in a bare `except Exception: pass` with no logging — contrast with the outer handler a few lines below in the same function, which does call `sentry_sdk.capture_exception` + `logger.error`. Compounding this: `migrations/README.md` still lists `013_profile_onboarding_extensions.sql` (the migration that adds the `allergies`/`conditions`/`blood_type`/`medical_chat_opt_in` columns this fetch selects) as **`pending`**. If that migration hasn't actually been applied in a given environment yet, this fetch raises on every single chat request — and fails completely silently, with zero signal that the medical-context feature isn't working.

**Current code:**
```python
# backend/routers/chat.py:123-131
user_profile: dict | None = None
try:
    user_profile = supabase_select(
        "profile",
        params={"user_id": f"eq.{user_id}", "select": "allergies,conditions,blood_type,medical_chat_opt_in"},
        single=True,
    )
except Exception:
    pass  # profile fetch failure must not block triage
```
```markdown
<!-- migrations/README.md:23 -->
| 013_profile_onboarding_extensions.sql | push_enabled, auto_alert_opt_in, allergies, conditions, blood_type, medical_chat_opt_in columns on profile | pending |
```

**Fix:**
1. Apply `migrations/013_profile_onboarding_extensions.sql` in the Supabase SQL editor and flip its README status to `applied — YYYY-MM-DD`, before this sprint ships.
2. Log the swallowed exception instead of silently passing:
```python
except Exception as exc:
    logger.warning("profile_fetch_failed", extra={"request_id": request_id, "error": str(exc)})
```

---

## CONFIRMED — should fix, lower urgency

---

### F6 — MEDIUM · `webapp/src/pages/ProfilePage.tsx:97-100`

**Problem:** `removeDevice` optimistically strips the device from UI state *before* the DELETE request fires, then swallows any failure (`.catch(() => {})`, no `res.ok` check). `apiFetch` only throws on a 401; any other failure (e.g. a 500 from OneSignal, or the F1 IDOR fix above correctly returning 404) resolves normally and is silently discarded. A failed removal leaves the device permanently gone from the UI with the backend subscription still active, and the user has no way to know it didn't work.

**Current code:**
```tsx
const removeDevice = async (subscriptionId: string) => {
  setDevices(current => current.filter(d => d.subscription_id !== subscriptionId))
  await apiFetch(`/notifications/devices/${subscriptionId}`, { method: 'DELETE' }).catch(() => {})
}
```

**Fix:** Check the response and roll back optimistic state (with a visible error) on failure:
```tsx
const removeDevice = async (subscriptionId: string) => {
  const previous = devices
  setDevices(current => current.filter(d => d.subscription_id !== subscriptionId))
  try {
    const res = await apiFetch(`/notifications/devices/${subscriptionId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`Failed to remove device (${res.status})`)
  } catch {
    setDevices(previous)
    setSaveError('Could not remove that device. Please try again.')
  }
}
```

---

### F7 — MEDIUM · `webapp/src/Menucomponents/Home.tsx`

**Problem:** The sign-out effect that used to clear cached GPS coordinates (`useEffect(() => { if (!user) geo.setCoords(null) }, [user])`) was removed from `Home.tsx` with nothing reproducing it — confirmed via direct search: zero occurrences of `useEffect`/`setCoords` remain anywhere in the file. `MobileLayout.tsx` still has its own copy of this effect (mobile is unaffected). But `Home.tsx` (the desktop path, rendered whenever `!isMobile`) is never unmounted just because a user signs out — its `geo` state is a stable hook instance across sign-out/sign-in in the same tab. Two different users signing in/out on the same desktop browser tab can have the first user's cached GPS coordinates persist into the second user's session until a fresh geolocation request happens to overwrite them.

**Fix:** Re-add the effect to `Home.tsx`:
```tsx
useEffect(() => {
  if (!user) geo.setCoords(null)
}, [user]) // eslint-disable-line react-hooks/exhaustive-deps
```

---

### F8 — MEDIUM (efficiency) · `backend/routers/notifications.py:85, 127`

**Problem:** The two new endpoints (`list_devices`, `remove_device`) are `async def` but call the blocking `httpx.get`/`httpx.delete` client (not an async client, not wrapped in a threadpool), so a slow OneSignal response (up to the 10s timeout) blocks the whole event loop for other concurrent requests. This isn't novel — the pre-existing `send_notification` in the same file already does this — but it extends the same anti-pattern into two more endpoints, and Sprint 14 (commit `c6cf570`) already fixed this exact class of bug for `facilities.py` by wrapping blocking calls in `run_in_threadpool`.

**Fix:** Wrap each blocking call the same way Sprint 14 did:
```python
from starlette.concurrency import run_in_threadpool
...
response = await run_in_threadpool(
    httpx.get,
    f"{ONESIGNAL_APPS_URL}/{app_id}/users/by/external_id/{user_id}",
    headers={"Authorization": f"Basic {api_key}"},
    timeout=10.0,
)
```
(Apply the same wrapping to `remove_device`'s `httpx.delete` call, and — while touching this file — consider doing the same for the pre-existing `send_notification`'s `httpx.post`, since it has the identical issue.)

---

### F9 — LOW (efficiency) · `backend/routers/chat.py:123-131` / `backend/services/llm_agent.py:81`

**Problem:** The profile fetch for medical context runs unconditionally on every chat message, before `medical_chat_opt_in` is ever checked (the check only happens later, inside `llm_agent.py`'s `_build_messages`). A user who has never opted in still pays a full Supabase network round-trip on every single message they send, for a result (`user_profile`) that gets fetched and then simply discarded.

**Fix:** Cheapest fix — cache `medical_chat_opt_in` on the session/cache entry so it's not re-fetched every turn; or, minimally, keep the current per-message fetch but skip the two extra fields when not needed (`select=medical_chat_opt_in` only, then a second fetch for `allergies,conditions,blood_type` only when true) — worth doing only if this endpoint's latency becomes a measured problem, since it's one extra indexed point-select, not a heavy query.

---

### F10 — LOW (reuse) · `webapp/src/pages/ProfilePage.tsx:102-104`

**Problem:** The email → display-name/initials transform is now duplicated a third time, byte-for-byte identical (differing only in quote style) to existing copies in `webapp/src/components/auth/UserMenu.tsx:81` and `webapp/src/components/mobile/DrawerMenu.tsx:92`.

**Current code (all three, effectively identical):**
```tsx
email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
```

**Fix:** Extract to `webapp/src/lib/formatDisplayName.ts`:
```typescript
export function formatDisplayName(email: string): string {
  return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
```
Import and use it in all three files.

---

## Process note

Several review subagents flagged this repo's `graphify`-mandatory `PreToolUse` hook messages as suspicious injected instructions during their investigation and disregarded them (one noted the installed `graphify` CLI has no `query` subcommand at all in this environment). This is a legitimate project hook, not an attack, but worth someone checking whether `graphify query` is actually functional here — subagents without full repo context can't tell the difference, and defaulting to disregarding it is the correct call for them to make in that position.
