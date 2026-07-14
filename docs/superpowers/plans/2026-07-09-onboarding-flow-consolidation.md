# Onboarding Flow Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the already-shipped static onboarding wizard (`OnboardingWizard.tsx`) and profile page (`ProfilePage.tsx`) to real state — a shared 4-step onboarding state machine, Supabase persistence, OneSignal device linking, and LLM medical-context injection — replacing the two hand-duplicated legacy flows (`GettingStartedModal.tsx` desktop modal, `SetupPage.tsx` mobile page).

**Architecture:** A new `useOnboardingFlow` hook owns step index + in-memory `OnboardingData` + a single `submit()` that writes to `profile` via the existing `useProfile().updateProfile`. `OnboardingWizard` (already built, static) consumes that hook plus the existing `useGeolocation`/`useNotificationPermission` hooks and becomes the one onboarding UI for both platforms — mounted directly at `/setup` (mobile, full page) and inside a new thin `OnboardingOverlay` (desktop, non-dismissible modal). Backend gains one new profile-read service used by the LLM context builder, plus two new OneSignal-proxy endpoints for the profile page's live device list.

**Tech Stack:** React 18 + TypeScript (strict), Vite, Tailwind, Supabase (client-side RLS reads for `profile`), FastAPI + Pydantic, OneSignal REST API (Basic auth, same pattern as the existing `POST /notifications/send`), vitest, pytest.

## Global Constraints

- TypeScript strict mode, no `any`, all props get interfaces.
- Python: type hints on all signatures, Pydantic models for request/response bodies.
- No new npm or pip dependencies — everything below uses packages already in `webapp/package.json` / `requirements.txt`.
- Severity schema (`routine | moderate | urgent | emergent`) is untouched by this plan.
- Non-dismissible: no close ("X") button, no skip option, anywhere in the new onboarding flow — this was the explicit bug being fixed (`GettingStartedModal`'s old `onClose` only delayed onboarding by one page view).
- Content guardrails from `docs/superpowers/specs/2026-07-08-onboarding-profile-ui-redesign-design.md` carry over: no clinician-in-the-loop language, no fabricated OHIP/insurance integration, no "assigned to a hospital" language, emergency contact is an SMS-alert contact not a medical power of attorney.
- Out of scope (explicitly deferred per the design's "Known gaps" section — do not build these): real "Delete my account" flow, resolving whether "Preferred facility" is a stored preference vs. a live nearest-facility lookup, and automated emergency-contact alert sending. Leave the Preferred-facility card and Delete-account link exactly as shipped (static/no-op).
- One commit per task, conventional commit style, no Claude co-author trailer (per repo `CLAUDE.md`).

---

### Task 1: Profile data model — migration, shared types, backend model

**Files:**
- Create: `migrations/013_profile_onboarding_extensions.sql`
- Modify: `migrations/README.md`
- Modify: `shared/types.ts`
- Modify: `backend/models.py`
- Modify: `webapp/src/hooks/useProfile.ts`

**Interfaces:**
- Produces: `Profile` interface (in `@shared/types`) with fields `id, user_id, getting_started_done, location_preference, push_enabled, emergency_contact_name, emergency_contact_phone, auto_alert_opt_in, allergies, conditions, blood_type, medical_chat_opt_in`. Every later frontend task imports this type. `useProfile().updateProfile(updates: Partial<Profile>): Promise<void>` now throws on failure instead of silently swallowing errors.

- [ ] **Step 1: Write the migration**

```sql
-- migrations/013_profile_onboarding_extensions.sql
-- =============================================================
-- Onboarding flow consolidation: push/emergency-alert/medical columns
-- =============================================================

alter table public.profile
  add column if not exists push_enabled boolean not null default false,
  add column if not exists auto_alert_opt_in boolean not null default false,
  add column if not exists allergies text,
  add column if not exists conditions text,
  add column if not exists blood_type text,
  add column if not exists medical_chat_opt_in boolean not null default false;
```

- [ ] **Step 2: Register it in the migrations README**

Add a row to the table in `migrations/README.md`:

```markdown
| 013_profile_onboarding_extensions.sql | push_enabled, auto_alert_opt_in, allergies, conditions, blood_type, medical_chat_opt_in columns on profile | pending |
```

- [ ] **Step 3: Add the shared `Profile` type**

In `shared/types.ts`, add after the `ChatMessageResponse` interface:

```typescript
// ── Profile ────────────────────────────────────────────────────────────────

export interface Profile {
  id:                       string
  user_id:                  string
  getting_started_done:     boolean
  location_preference:      'always' | 'ask'
  push_enabled:              boolean
  emergency_contact_name:   string | null
  emergency_contact_phone:  string | null
  auto_alert_opt_in:        boolean
  allergies:                string | null
  conditions:               string | null
  blood_type:               string | null
  medical_chat_opt_in:      boolean
}
```

- [ ] **Step 4: Add the mirrored Pydantic model**

In `backend/models.py`, add near the other `Base` models:

```python
class Profile(BaseModel):
    id:                      UUID
    user_id:                 UUID
    getting_started_done:    bool
    location_preference:     str
    push_enabled:             bool
    emergency_contact_name:  str | None = None
    emergency_contact_phone: str | None = None
    auto_alert_opt_in:       bool
    allergies:               str | None = None
    conditions:              str | None = None
    blood_type:              str | None = None
    medical_chat_opt_in:     bool
```

- [ ] **Step 5: Update `useProfile.ts` to use the shared type and throw on update failure**

Replace the full contents of `webapp/src/hooks/useProfile.ts`:

```typescript
import { useState, useEffect } from "react"
import { supabase } from "../lib/supabaseClient"
import { useAuth } from "../auth/useAuth"
import type { Profile } from "@shared/types"

export type { Profile }

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) { setProfile(null); return }
    setLoading(true)
    supabase
      .from('profile')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setProfile(data)
        setLoading(false)
      })
  }, [user])

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return
    const { data, error } = await supabase
      .from('profile')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setProfile(data)
  }

  return { profile, loading, updateProfile }
}
```

- [ ] **Step 6: Verify**

Run: `cd webapp && npx tsc -b`
Expected: no type errors. (No test added here — matches this repo's existing bar for flat data-typing changes; the one required test for this sprint covers `useOnboardingFlow`'s branching state in Task 3.)

- [ ] **Step 7: Commit**

```bash
git add migrations/013_profile_onboarding_extensions.sql migrations/README.md \
        shared/types.ts backend/models.py webapp/src/hooks/useProfile.ts
git commit -m "feat(profile): extend profile schema for push/emergency-alert/medical fields"
```

---

### Task 2: Device list — OneSignal external-id linking + backend endpoints

**Files:**
- Modify: `webapp/src/hooks/useNotificationPermission.ts`
- Modify: `backend/routers/notifications.py`
- Modify: `shared/types.ts`

**Interfaces:**
- Consumes: none from prior tasks.
- Produces: `useNotificationPermission(externalUserId: string | null): UseNotificationPermissionResult` (new required param — every call site must pass a user id or `null`). Backend `GET /notifications/devices` → `{ devices: NotificationDevice[] }`, `DELETE /notifications/devices/{subscription_id}` → `{ status: "removed" }`. `NotificationDevice = { subscription_id: string, device_type: string, active: boolean }` in `@shared/types`.

- [ ] **Step 1: Add `NotificationDevice` types**

In `shared/types.ts`, in the `── Notifications ──` section, add after `SendNotificationResponse`:

```typescript
export interface NotificationDevice {
  subscription_id: string
  device_type:     string
  active:          boolean
}

export interface ListDevicesResponse {
  devices: NotificationDevice[]
}
```

- [ ] **Step 2: Add the backend device-list endpoints**

In `backend/routers/notifications.py`, add after the existing `send_notification` route:

```python
ONESIGNAL_APPS_URL = "https://onesignal.com/api/v1/apps"


def _device_type_name(raw_type: str | None) -> str:
    if not raw_type:
        return "web"
    return raw_type.removesuffix("Push").lower() or "web"


@router.get("/devices")
async def list_devices(current_user: object = Depends(get_current_user)) -> dict:
    app_id = os.environ.get("ONESIGNAL_APP_ID", "")
    api_key = os.environ.get("ONESIGNAL_API_KEY", "")
    if not app_id or not api_key:
        raise HTTPException(500, "OneSignal credentials not configured")

    user_id = str(current_user.id)  # type: ignore[attr-defined]

    try:
        response = httpx.get(
            f"{ONESIGNAL_APPS_URL}/{app_id}/users/by/external_id/{user_id}",
            headers={"Authorization": f"Basic {api_key}"},
            timeout=10.0,
        )
    except httpx.RequestError as exc:
        logger.error("onesignal_network_error", extra={"error": str(exc)})
        raise HTTPException(502, "Failed to reach OneSignal")

    if response.status_code == 404:
        return {"devices": []}
    if response.status_code != 200:
        logger.warning(
            "onesignal_error",
            extra={"status": response.status_code, "body": response.text},
        )
        raise HTTPException(502, f"OneSignal error: {response.text}")

    subscriptions = response.json().get("subscriptions", [])
    devices = [
        {
            "subscription_id": s["id"],
            "device_type": _device_type_name(s.get("type")),
            "active": s.get("enabled", True),
        }
        for s in subscriptions
        if s.get("id")
    ]
    return {"devices": devices}


@router.delete("/devices/{subscription_id}")
async def remove_device(
    subscription_id: str,
    _current_user: object = Depends(get_current_user),
) -> dict:
    app_id = os.environ.get("ONESIGNAL_APP_ID", "")
    api_key = os.environ.get("ONESIGNAL_API_KEY", "")
    if not app_id or not api_key:
        raise HTTPException(500, "OneSignal credentials not configured")

    try:
        response = httpx.delete(
            f"{ONESIGNAL_APPS_URL}/{app_id}/subscriptions/{subscription_id}",
            headers={"Authorization": f"Basic {api_key}"},
            timeout=10.0,
        )
    except httpx.RequestError as exc:
        logger.error("onesignal_network_error", extra={"error": str(exc)})
        raise HTTPException(502, "Failed to reach OneSignal")

    if response.status_code not in (200, 204):
        logger.warning(
            "onesignal_error",
            extra={"status": response.status_code, "body": response.text},
        )
        raise HTTPException(502, f"OneSignal error: {response.text}")

    return {"status": "removed"}
```

- [ ] **Step 3: Write a backend test**

Create `backend/tests/test_notification_devices.py`:

```python
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


def _client():
    from main import app
    return TestClient(app)


class FakeUser:
    id = "11111111-1111-1111-1111-111111111111"


@patch("routers.notifications.get_current_user", return_value=FakeUser())
@patch("routers.notifications.httpx.get")
def test_list_devices_maps_subscriptions(mock_get, _mock_user, monkeypatch):
    monkeypatch.setenv("ONESIGNAL_APP_ID", "app-1")
    monkeypatch.setenv("ONESIGNAL_API_KEY", "key-1")
    mock_get.return_value = MagicMock(
        status_code=200,
        json=lambda: {
            "subscriptions": [
                {"id": "sub-1", "type": "ChromePush", "enabled": True},
                {"id": "sub-2", "type": "iOSPush", "enabled": False},
            ]
        },
    )
    resp = _client().get(
        "/notifications/devices", headers={"Authorization": "Bearer t"}
    )
    assert resp.status_code == 200
    devices = resp.json()["devices"]
    assert devices == [
        {"subscription_id": "sub-1", "device_type": "chrome", "active": True},
        {"subscription_id": "sub-2", "device_type": "ios", "active": False},
    ]


@patch("routers.notifications.get_current_user", return_value=FakeUser())
@patch("routers.notifications.httpx.get")
def test_list_devices_returns_empty_on_404(mock_get, _mock_user, monkeypatch):
    monkeypatch.setenv("ONESIGNAL_APP_ID", "app-1")
    monkeypatch.setenv("ONESIGNAL_API_KEY", "key-1")
    mock_get.return_value = MagicMock(status_code=404)
    resp = _client().get(
        "/notifications/devices", headers={"Authorization": "Bearer t"}
    )
    assert resp.status_code == 200
    assert resp.json() == {"devices": []}
```

Run: `cd backend && pytest tests/test_notification_devices.py -v`
Expected: both tests pass. (If `get_current_user` auth wiring makes direct `TestClient` calls 401 in this repo's existing test setup, follow the override pattern used in `backend/tests/test_notifications.py` instead of the `@patch` shown here — check that file for the established convention before adjusting.)

- [ ] **Step 4: Add `OneSignal.login` and thread an external id through `useNotificationPermission`**

Replace the full contents of `webapp/src/hooks/useNotificationPermission.ts`:

```typescript
import { useState, useEffect, useRef } from "react"
import { detectPlatform } from "./usePWAInstall"

export type PermissionState = "unknown" | "default" | "granted" | "denied"

export interface UseNotificationPermissionResult {
  permissionState: PermissionState
  playerId: string | null
  requesting: boolean
  requestPermission: () => Promise<void>
  clearToken: () => void
}

export const PLAYER_ID_KEY_PREFIX = "medicoord_onesignal_player_id_"
const PLATFORM_KEY  = "medicoord_onesignal_platform"
const GRANTED_KEY   = "medicoord_push_granted"

declare global {
  interface Window {
    OneSignalDeferred: Array<(oneSignal: Window["OneSignal"]) => Promise<void>>
    OneSignal: {
      init: (config: {
        appId: string
        notifyButton?: { enable: boolean }
        allowLocalhostAsSecureOrigin?: boolean
      }) => Promise<void>
      login: (externalId: string) => Promise<void>
      Notifications: {
        requestPermission: () => Promise<boolean>
      }
      User: {
        PushSubscription: {
          id: string | null | undefined
          optedIn: boolean
        }
      }
    }
  }
}

export function useNotificationPermission(
  externalUserId: string | null
): UseNotificationPermissionResult {
  const [permissionState, setPermissionState] = useState<PermissionState>("unknown")
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    const stored = localStorage.getItem(PLAYER_ID_KEY_PREFIX + detectPlatform())
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
    if (!window.OneSignal?.Notifications) {
      console.warn("[OneSignal] SDK not ready")
      return
    }
    if (!("Notification" in window)) {
      return
    }
    if (Notification.permission === "denied") {
      setPermissionState("denied")
      return
    }
    initialized.current = true
    setRequesting(true)
    try {
      await window.OneSignal.Notifications.requestPermission()
      const subscriptionId = window.OneSignal.User.PushSubscription.id ?? null

      if (subscriptionId) {
        localStorage.setItem(PLAYER_ID_KEY_PREFIX + detectPlatform(), subscriptionId)
        localStorage.setItem(PLATFORM_KEY, detectPlatform())
        localStorage.setItem(GRANTED_KEY, "true")
        setPlayerId(subscriptionId)
        setPermissionState("granted")
        if (externalUserId) {
          await window.OneSignal.login(externalUserId)
        }
      } else {
        setPermissionState(Notification.permission as PermissionState)
      }
    } catch (err) {
      console.error("[OneSignal] init failed:", err)
    } finally {
      setRequesting(false)
    }
  }

  const clearToken = () => {
    localStorage.removeItem(PLAYER_ID_KEY_PREFIX + detectPlatform())
    localStorage.removeItem(PLATFORM_KEY)
    localStorage.removeItem(GRANTED_KEY)
    setPlayerId(null)
    setPermissionState("default")
    initialized.current = false
  }

  return { permissionState, playerId, requesting, requestPermission, clearToken }
}
```

- [ ] **Step 5: Fix the one existing call site**

`webapp/src/App.tsx` calls `useNotificationPermission()` with no argument (`AppInner`, around line 61-65). Update it to pass the current user's id:

```typescript
const { user } = useAuth() // already imported/used elsewhere in AppInner — add if not already destructured here
const {
  permissionState,
  requesting,
  requestPermission,
} = useNotificationPermission(user?.id ?? null)
```

(`useAuth` is already imported in `App.tsx`; if `AppInner` doesn't already destructure `user` from it at this point, add `const { user } = useAuth()` near the top of `AppInner`.)

- [ ] **Step 6: Verify**

Run: `cd webapp && npx tsc -b`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/hooks/useNotificationPermission.ts webapp/src/App.tsx \
        backend/routers/notifications.py backend/tests/test_notification_devices.py \
        shared/types.ts
git commit -m "feat(notifications): link OneSignal devices to user via external id, add device-list endpoints"
```

---

### Task 3: `useOnboardingFlow` hook + test

**Files:**
- Create: `webapp/src/hooks/useOnboardingFlow.ts`
- Test: `webapp/src/hooks/useOnboardingFlow.test.ts`

**Interfaces:**
- Consumes: `useProfile().updateProfile` (Task 1).
- Produces: `useOnboardingFlow(): UseOnboardingFlowResult` with `{ step, stepIndex, steps, data, setData, next, back, submitting, submitError, submit }`. `OnboardingData` type consumed by Task 4.

This repo has no React-hook-testing library installed (`webapp/package.json` has no `@testing-library/react`), and per `CLAUDE.md` no new npm packages should be added without flagging it. Following the existing pattern in `webapp/src/hooks/useAnchor.ts` (a hook that wraps and exports pure, directly-testable functions), the step-transition and payload logic is written as plain exported functions the hook calls internally — testable with plain `vitest`, no rendering required.

- [ ] **Step 1: Write the failing test**

```typescript
// webapp/src/hooks/useOnboardingFlow.test.ts
import { describe, it, expect } from 'vitest'
import {
  ONBOARDING_STEPS,
  INITIAL_ONBOARDING_DATA,
  nextStepIndex,
  prevStepIndex,
  buildSubmitPayload,
} from './useOnboardingFlow'

describe('onboarding step transitions', () => {
  it('advances one step at a time', () => {
    expect(nextStepIndex(0)).toBe(1)
    expect(nextStepIndex(1)).toBe(2)
  })

  it('clamps at the last step', () => {
    const last = ONBOARDING_STEPS.length - 1
    expect(nextStepIndex(last)).toBe(last)
  })

  it('goes back one step at a time', () => {
    expect(prevStepIndex(2)).toBe(1)
  })

  it('clamps at the first step', () => {
    expect(prevStepIndex(0)).toBe(0)
  })
})

describe('buildSubmitPayload', () => {
  it('marks onboarding done and preserves collected data', () => {
    const payload = buildSubmitPayload({
      ...INITIAL_ONBOARDING_DATA,
      allergies: 'Penicillin',
      medical_chat_opt_in: true,
    })
    expect(payload.getting_started_done).toBe(true)
    expect(payload.allergies).toBe('Penicillin')
    expect(payload.medical_chat_opt_in).toBe(true)
    expect(payload.location_preference).toBe('ask')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd webapp && npx vitest run src/hooks/useOnboardingFlow.test.ts`
Expected: FAIL — `useOnboardingFlow.ts` does not exist yet.

- [ ] **Step 3: Write the hook**

```typescript
// webapp/src/hooks/useOnboardingFlow.ts
import { useState } from 'react'
import { useProfile } from './useProfile'

export type OnboardingStep = 'location' | 'push' | 'emergency' | 'medical'

export const ONBOARDING_STEPS: OnboardingStep[] = ['location', 'push', 'emergency', 'medical']

export interface OnboardingData {
  location_preference: 'always' | 'ask'
  push_enabled: boolean
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  auto_alert_opt_in: boolean
  allergies: string | null
  conditions: string | null
  blood_type: string | null
  medical_chat_opt_in: boolean
}

export const INITIAL_ONBOARDING_DATA: OnboardingData = {
  location_preference: 'ask',
  push_enabled: false,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  auto_alert_opt_in: false,
  allergies: null,
  conditions: null,
  blood_type: null,
  medical_chat_opt_in: false,
}

export function nextStepIndex(index: number): number {
  return Math.min(index + 1, ONBOARDING_STEPS.length - 1)
}

export function prevStepIndex(index: number): number {
  return Math.max(index - 1, 0)
}

export function buildSubmitPayload(
  data: OnboardingData
): OnboardingData & { getting_started_done: true } {
  return { ...data, getting_started_done: true }
}

export interface UseOnboardingFlowResult {
  step: OnboardingStep
  stepIndex: number
  steps: OnboardingStep[]
  data: OnboardingData
  setData: (updates: Partial<OnboardingData>) => void
  next: () => void
  back: () => void
  submitting: boolean
  submitError: string | null
  submit: () => Promise<void>
}

export function useOnboardingFlow(): UseOnboardingFlowResult {
  const { updateProfile } = useProfile()
  const [stepIndex, setStepIndex] = useState(0)
  const [data, setDataState] = useState<OnboardingData>(INITIAL_ONBOARDING_DATA)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const setData = (updates: Partial<OnboardingData>) =>
    setDataState(current => ({ ...current, ...updates }))

  const next = () => setStepIndex(nextStepIndex)
  const back = () => setStepIndex(prevStepIndex)

  const submit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await updateProfile(buildSubmitPayload(data))
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return {
    step: ONBOARDING_STEPS[stepIndex],
    stepIndex,
    steps: ONBOARDING_STEPS,
    data,
    setData,
    next,
    back,
    submitting,
    submitError,
    submit,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd webapp && npx vitest run src/hooks/useOnboardingFlow.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add webapp/src/hooks/useOnboardingFlow.ts webapp/src/hooks/useOnboardingFlow.test.ts
git commit -m "feat(onboarding): add useOnboardingFlow state machine hook"
```

---

### Task 4: Wire `OnboardingWizard` to real hooks

**Files:**
- Modify: `webapp/src/components/onboarding/OnboardingWizard.tsx`
- Modify: `webapp/src/components/onboarding/steps/MedicalProfileStep.tsx`

**Interfaces:**
- Consumes: `useOnboardingFlow()` (Task 3), `useNotificationPermission(externalUserId)` (Task 2), `useGeolocation()`, `useAuth()`.
- Produces: `OnboardingWizard({ embedded }: { embedded?: boolean })` — when `embedded` is true, renders just the centered card (no full-viewport background), for use inside `OnboardingOverlay` (Task 5). Default (`embedded` falsy) keeps today's full-page rendering, used at `/setup` (Task 6).

- [ ] **Step 1: Add `submitting`/`submitError` props to `MedicalProfileStep`**

In `webapp/src/components/onboarding/steps/MedicalProfileStep.tsx`, update the props interface and the finish button:

```typescript
interface MedicalProfileStepProps {
  allergies: string
  conditions: string
  bloodType: string
  chatOptIn: boolean
  onAllergiesChange: (value: string) => void
  onConditionsChange: (value: string) => void
  onBloodTypeChange: (value: string) => void
  onChatOptInChange: (value: boolean) => void
  onFinish: () => void
  submitting: boolean
  submitError: string | null
}
```

Replace the `export function MedicalProfileStep` signature to destructure the two new props, and replace the closing button + wrapper:

```typescript
export function MedicalProfileStep({
  allergies,
  conditions,
  bloodType,
  chatOptIn,
  onAllergiesChange,
  onConditionsChange,
  onBloodTypeChange,
  onChatOptInChange,
  onFinish,
  submitting,
  submitError,
}: MedicalProfileStepProps) {
```

And replace the final button block (everything from the `<button type="button" onClick={onFinish}` line to the end of the component) with:

```typescript
      <button
        type="button"
        onClick={onFinish}
        disabled={submitting}
        className="w-full py-3.5 text-[14px] font-bold rounded-xl transition-all disabled:opacity-60"
        style={{ background: '#48F6C1', color: '#061219', minHeight: 44 }}
      >
        {submitting ? 'Saving…' : 'Finish setup'}
      </button>

      {submitError && (
        <p className="text-[12px] text-center" style={{ color: '#FF7B93', fontFamily: 'var(--font-sans)' }}>
          {submitError}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `OnboardingWizard.tsx`**

Replace the full contents:

```typescript
import { useEffect } from 'react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useAuth } from '../../auth/useAuth'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useNotificationPermission } from '../../hooks/useNotificationPermission'
import { useOnboardingFlow } from '../../hooks/useOnboardingFlow'
import { StepIndicator } from './StepIndicator'
import { LocationStep } from './steps/LocationStep'
import { PushStep } from './steps/PushStep'
import { EmergencyContactStep } from './steps/EmergencyContactStep'
import { MedicalProfileStep } from './steps/MedicalProfileStep'

const STEP_LABELS = ['Location', 'Push', 'Emergency', 'Medical']

interface OnboardingWizardProps {
  embedded?: boolean
}

export function OnboardingWizard({ embedded = false }: OnboardingWizardProps) {
  const isMobile = useBreakpoint()
  const { user } = useAuth()
  const geo = useGeolocation()
  const { permissionState, requestPermission } = useNotificationPermission(user?.id ?? null)
  const flow = useOnboardingFlow()

  useEffect(() => {
    if (permissionState === 'granted') flow.setData({ push_enabled: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionState])

  const handleLocationChange = (value: 'always' | 'ask') => {
    flow.setData({ location_preference: value })
    if (value === 'always') {
      geo.requestOnce().then(coords => geo.setCoords(coords))
    }
  }

  const steps = [
    <LocationStep
      key="location"
      value={flow.data.location_preference}
      onChange={handleLocationChange}
      onNext={flow.next}
    />,
    <PushStep
      key="push"
      enabled={flow.data.push_enabled}
      onEnable={() => { requestPermission() }}
      onNext={flow.next}
    />,
    <EmergencyContactStep
      key="emergency"
      name={flow.data.emergency_contact_name ?? ''}
      phone={flow.data.emergency_contact_phone ?? ''}
      autoAlertOptIn={flow.data.auto_alert_opt_in}
      onNameChange={v => flow.setData({ emergency_contact_name: v.trim() || null })}
      onPhoneChange={v => flow.setData({ emergency_contact_phone: v.trim() || null })}
      onAutoAlertChange={v => flow.setData({ auto_alert_opt_in: v })}
      onNext={flow.next}
    />,
    <MedicalProfileStep
      key="medical"
      allergies={flow.data.allergies ?? ''}
      conditions={flow.data.conditions ?? ''}
      bloodType={flow.data.blood_type ?? ''}
      chatOptIn={flow.data.medical_chat_opt_in}
      onAllergiesChange={v => flow.setData({ allergies: v.trim() || null })}
      onConditionsChange={v => flow.setData({ conditions: v.trim() || null })}
      onBloodTypeChange={v => flow.setData({ blood_type: v || null })}
      onChatOptInChange={v => flow.setData({ medical_chat_opt_in: v })}
      onFinish={() => { flow.submit() }}
      submitting={flow.submitting}
      submitError={flow.submitError}
    />,
  ]

  const card = (
    <div
      className="w-full flex flex-col gap-6"
      style={{
        maxWidth: isMobile ? undefined : 480,
        background: '#0A1D27',
        border: '1px solid rgba(28, 70, 89, 0.4)',
        borderRadius: isMobile ? 0 : 20,
        padding: isMobile ? '32px 20px' : 32,
        boxShadow: isMobile ? undefined : '0 20px 40px -15px rgba(3, 10, 14, 0.7)',
      }}
    >
      <StepIndicator steps={STEP_LABELS} currentIndex={flow.stepIndex} />
      {steps[flow.stepIndex]}
    </div>
  )

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#061219' }}>
        <div className="flex-none flex flex-col items-center justify-center py-8 px-6">
          <h1 className="text-[18px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
            MediCoord<span style={{ color: '#48F6C1' }}>AI</span>
          </h1>
        </div>
        <div className="flex-1 flex flex-col px-1">{card}</div>
      </div>
    )
  }

  if (embedded) {
    return card
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#061219' }}>
      {card}
    </div>
  )
}
```

Note: the "Save and continue" side effect that calls the browser's real geolocation permission prompt (`geo.requestOnce()`) uses its own `useGeolocation()` instance local to the wizard. This is intentional, not an oversight — its only job is to trigger the OS permission prompt during onboarding; whichever screen renders after onboarding (`Home.tsx` desktop or `MobileLayout.tsx`) has its own independent `useGeolocation()` instance that will successfully read the now-granted permission on its own next request. No coordinate needs to be threaded between the two.

- [ ] **Step 3: Verify**

Run: `cd webapp && npx tsc -b`
Expected: no type errors.

Run: `cd webapp && npx vitest run`
Expected: all existing tests plus Task 3's still pass.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/onboarding/OnboardingWizard.tsx \
        webapp/src/components/onboarding/steps/MedicalProfileStep.tsx
git commit -m "feat(onboarding): wire OnboardingWizard to useOnboardingFlow and real permission hooks"
```

---

### Task 5: Non-dismissible desktop overlay + trigger wiring

**Files:**
- Create: `webapp/src/components/onboarding/OnboardingOverlay.tsx`
- Modify: `webapp/src/Menucomponents/Home.tsx`
- Modify: `webapp/src/App.tsx`
- Delete: `webapp/src/components/onboarding/GettingStartedModal.tsx`

**Interfaces:**
- Consumes: `OnboardingWizard({ embedded: true })` (Task 4).
- Produces: `OnboardingOverlay()` — desktop-only, no props, no dismiss handler.

- [ ] **Step 1: Create `OnboardingOverlay.tsx`**

```typescript
// webapp/src/components/onboarding/OnboardingOverlay.tsx
import { OnboardingWizard } from './OnboardingWizard'

export function OnboardingOverlay() {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.4)' }}
      className="flex items-center justify-center"
    >
      <OnboardingWizard embedded />
    </div>
  )
}
```

- [ ] **Step 2: Delete `GettingStartedModal.tsx`**

```bash
git rm webapp/src/components/onboarding/GettingStartedModal.tsx
```

- [ ] **Step 3: Update `Home.tsx`**

In `webapp/src/Menucomponents/Home.tsx`:
- Replace the import `import { GettingStartedModal } from '../components/onboarding/GettingStartedModal'` with `import { OnboardingOverlay } from '../components/onboarding/OnboardingOverlay'`.
- Remove the `const [onboardingDismissed, setOnboardingDismissed] = useState(false)` line.
- Replace the JSX block that renders `GettingStartedModal` (currently gated on `user && profile && !profile.getting_started_done && !onboardingDismissed`, passing `onComplete`, `onClose`, `geo`) with:

```tsx
      {user && profile && !profile.getting_started_done && <OnboardingOverlay />}
```

`profile` and `updateProfile` from `useProfile()` are already destructured in `Home.tsx` for other uses — if `updateProfile` is no longer referenced anywhere else in the file after this change, leave the destructure as `const { profile } = useProfile()` (drop the unused `updateProfile`) so the build has no unused-variable warnings.

- [ ] **Step 4: Update `App.tsx` — suppress permission popups and redirect mobile during onboarding**

In `webapp/src/App.tsx`'s `AppInner`:
- Add imports: `import { useProfile } from './hooks/useProfile'` and `import { OnboardingOverlay } from './components/onboarding/OnboardingOverlay'`.
- Add, near the top of `AppInner` (alongside the other hooks):

```typescript
const { user } = useAuth()
const { profile } = useProfile()
const showOnboarding = Boolean(user && profile && !profile.getting_started_done)
```

- Update the three visibility booleans to also require `!showOnboarding`:

```typescript
const showGpsModal = geo.permission === "denied" && !gpsModalDismissed && !showOnboarding

const showInstallModal =
  !installModalDismissed &&
  installState !== "standalone" &&
  (platform === "ios_safari" || platform === "android_chrome" || isIosNonSafari) &&
  !installConfirmed &&
  !showOnboarding

const showPermissionPrompt =
  !showInstallModal &&
  isPushSupported &&
  permissionState !== "granted" &&
  permissionState !== "denied" &&
  !permissionPromptDismissed &&
  shouldShowPermissionPrompt() &&
  !showOnboarding
```

- Add a mobile redirect right before the final `return`, and render the desktop overlay alongside `Home`:

```typescript
  if (isMobile && showOnboarding) {
    return <Navigate to="/setup" replace />
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
          isIosVersionSupported={isIosVersionSupported}
          isIosNonSafari={isIosNonSafari}
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
      {!isMobile && showOnboarding && <OnboardingOverlay />}
      {isMobile
        ? <MobileLayout {...sharedProps} />
        : <Home {...sharedProps} />
      }
    </>
  )
```

(`Navigate` is already imported from `react-router-dom` in `App.tsx` for the `ProtectedRoute` component — no new import needed for it.)

- [ ] **Step 4: Verify**

Run: `cd webapp && npx tsc -b`
Expected: no type errors, no unused-import errors (double check `Home.tsx` no longer imports `GettingStartedModal`, and `App.tsx`'s `AppInner` doesn't declare `user` twice if it already had a `useAuth()` call elsewhere in the component).

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/onboarding/OnboardingOverlay.tsx \
        webapp/src/Menucomponents/Home.tsx webapp/src/App.tsx
git rm webapp/src/components/onboarding/GettingStartedModal.tsx
git commit -m "feat(onboarding): non-dismissible desktop overlay, suppress permission popups during onboarding"
```

---

### Task 6: Real `/setup` and `/profile` routing

**Files:**
- Modify: `webapp/src/pages/SetupPage.tsx`
- Modify: `webapp/src/App.tsx`

**Interfaces:**
- Consumes: `OnboardingWizard` (Task 4), `ProfilePage` (already exists, static).

- [ ] **Step 1: Collapse `SetupPage.tsx` to a thin wrapper**

Replace the full contents of `webapp/src/pages/SetupPage.tsx`:

```typescript
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard'

export default function SetupPage() {
  return <OnboardingWizard />
}
```

This intentionally drops the old page's `MobileTopBar`/`DrawerMenu` chrome: onboarding must be non-dismissible, and the drawer's "Home" link was an escape hatch that let a user leave onboarding incomplete.

- [ ] **Step 2: Update routing in `App.tsx`**

- Remove the `OnboardingWizard` import (no longer used directly in `App.tsx` — `SetupPage` now owns it) if nothing else in the file references it.
- Remove the temporary preview routes and their comment:

```tsx
{/* TEMPORARY — static UI preview only, removed when the workflow-integration
    phase wires real /setup and /profile routing (see
    2026-07-07-onboarding-flow-consolidation-design.md) */}
<Route path="/preview/onboarding" element={<OnboardingWizard />} />
<Route path="/preview/profile" element={<ProfilePage />} />
```

- Wrap `/setup` in `ProtectedRoute` (it wasn't before — onboarding requires a signed-in user to have anything to persist), and add the real `/profile` route:

```tsx
<Route path="/setup" element={<ProtectedRoute><SetupPage /></ProtectedRoute>} />
<Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
```

- [ ] **Step 3: Verify**

Run: `cd webapp && npx tsc -b`
Expected: no type errors, no unused imports.

Run: `cd webapp && npm run dev`, then in a browser sign in and confirm:
- A brand-new user is redirected to `/setup` on mobile widths and sees the non-dismissible wizard full-page.
- On desktop widths, the same new user sees `Home` behind a modal overlay wizard with no close button.
- After finishing the wizard, `/app` loads normally with no onboarding overlay.
- Navigating to `/profile` directly (as a user who has completed onboarding) loads `ProfilePage`.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/pages/SetupPage.tsx webapp/src/App.tsx
git commit -m "feat(onboarding): wire real /setup and /profile routes, retire preview routes"
```

---

### Task 7: `DrawerMenu` — drop Test notifications, repoint My profile

**Files:**
- Modify: `webapp/src/components/mobile/DrawerMenu.tsx`

- [ ] **Step 1: Repoint "My profile" and remove "Test notifications"**

In `webapp/src/components/mobile/DrawerMenu.tsx`:
- Change `handleProfile`'s `navigate('/setup')` to `navigate('/profile')`.
- Delete the `handleTestNotifications` function entirely.
- Delete the `BellIcon` function entirely (only used by the removed row).
- Delete the "Test notifications" `<button>` block and its preceding `<div style={{ height: 1, ... }} />` divider, so the drawer goes directly from "My profile" to "Sign out" (3 items total: Home, My profile, Sign out).

- [ ] **Step 2: Verify**

Run: `cd webapp && npx tsc -b`
Expected: no type errors, no unused-function lint issues.

Run: `cd webapp && npm run dev`, open the mobile drawer, confirm exactly 3 rows and "My profile" navigates to `/profile`.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/DrawerMenu.tsx
git commit -m "feat(profile): repoint drawer's My profile to /profile, drop Test notifications row"
```

---

### Task 8: Wire `ProfilePage` to real profile data and live device list

**Files:**
- Modify: `webapp/src/pages/ProfilePage.tsx`

**Interfaces:**
- Consumes: `useProfile()` (Task 1), `useNotificationPermission(externalUserId)` (Task 2), `apiFetch` (`webapp/src/lib/apiClient.ts`, pre-existing), `NotificationDevice`/`ListDevicesResponse` (Task 2).

Per the design's "Known gaps" section, three pieces of the shipped static UI stay exactly as-is in this task: the "Preferred facility" card (undecided whether it's a stored preference or a live lookup — out of scope here), the "Delete my account" link (no backend exists), and the map card. Only location, push/devices, emergency contact, and medical profile become real.

- [ ] **Step 1: Replace local state with real profile + device-list data**

In `webapp/src/pages/ProfilePage.tsx`, remove the `PLACEHOLDER_DEVICES` constant, the `EMAIL`/`DISPLAY_NAME`/`INITIALS` constants (replaced by real `user.email`), and all of the component's local `useState` fields except `drawerOpen`. Add these imports:

```typescript
import { useState, useEffect } from 'react'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useNotificationPermission } from '../hooks/useNotificationPermission'
import { apiFetch } from '../lib/apiClient'
import type { NotificationDevice } from '@shared/types'
```

Add, at the top of `ProfilePage()`:

```typescript
const { user } = useAuth()
const { profile, updateProfile } = useProfile()
const { permissionState, requesting, requestPermission } = useNotificationPermission(user?.id ?? null)

const [locationPref, setLocationPref] = useState<'always' | 'ask'>('ask')
const [contactName, setContactName] = useState('')
const [contactPhone, setContactPhone] = useState('')
const [autoAlertOptIn, setAutoAlertOptIn] = useState(false)
const [allergies, setAllergies] = useState('')
const [conditions, setConditions] = useState('')
const [bloodType, setBloodType] = useState('')
const [chatOptIn, setChatOptIn] = useState(false)
const [devices, setDevices] = useState<NotificationDevice[]>([])
const [saving, setSaving] = useState(false)
const [saveError, setSaveError] = useState<string | null>(null)

useEffect(() => {
  if (!profile) return
  setLocationPref(profile.location_preference)
  setContactName(profile.emergency_contact_name ?? '')
  setContactPhone(profile.emergency_contact_phone ?? '')
  setAutoAlertOptIn(profile.auto_alert_opt_in)
  setAllergies(profile.allergies ?? '')
  setConditions(profile.conditions ?? '')
  setBloodType(profile.blood_type ?? '')
  setChatOptIn(profile.medical_chat_opt_in)
}, [profile])

useEffect(() => {
  if (!user) return
  apiFetch('/notifications/devices')
    .then(res => res.ok ? res.json() : { devices: [] })
    .then(data => setDevices(data.devices ?? []))
    .catch(() => setDevices([]))
}, [user])

const removeDevice = async (subscriptionId: string) => {
  setDevices(current => current.filter(d => d.subscription_id !== subscriptionId))
  await apiFetch(`/notifications/devices/${subscriptionId}`, { method: 'DELETE' }).catch(() => {})
}

const displayName = user?.email
  ? user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  : ''
const initials = user?.email ? user.email[0].toUpperCase() : '?'

const handleSaveChanges = async () => {
  setSaving(true)
  setSaveError(null)
  try {
    await updateProfile({
      location_preference: locationPref,
      emergency_contact_name: contactName.trim() || null,
      emergency_contact_phone: contactPhone.trim() || null,
      auto_alert_opt_in: autoAlertOptIn,
      allergies: allergies.trim() || null,
      conditions: conditions.trim() || null,
      blood_type: bloodType || null,
      medical_chat_opt_in: chatOptIn,
    })
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : 'Failed to save changes.')
  } finally {
    setSaving(false)
  }
}
```

- [ ] **Step 2: Replace hardcoded email/name references**

Everywhere the component currently renders the literal `EMAIL`, `DISPLAY_NAME`, `INITIALS` module constants (mobile header block) or the hardcoded `"Patient User"` / `"user@health.ca"` / `"PU"` (desktop header + sidebar), swap in `user?.email ?? ''`, `displayName`, and `initials` respectively.

- [ ] **Step 3: Replace the push-notifications toggle and device list (both mobile and desktop sections)**

Replace `<ToggleRow label="Push notifications" checked={pushEnabled} onChange={setPushEnabled} />` with:

```tsx
<ToggleRow
  label="Push notifications"
  checked={permissionState === 'granted'}
  onChange={() => { if (permissionState !== 'granted') requestPermission() }}
/>
```

Replace every `devices.map(device => ...)` block's key/label references — `device.id` → `device.subscription_id`, `device.label` → `` `${device.device_type} — ${device.active ? 'active' : 'inactive'}` `` — and every `removeDevice(device.id)` call → `removeDevice(device.subscription_id)`.

Replace both "+ Add device" buttons (`onClick={addDevice}`) — delete the now-unused `addDevice` function and instead repurpose the button to re-run the permission request on the current device, per the design's resolved option for this gap:

```tsx
<button
  type="button"
  onClick={() => requestPermission()}
  disabled={requesting || permissionState === 'granted'}
  className="flex items-center justify-center gap-1.5 text-[12px] font-semibold py-2.5 rounded-xl disabled:opacity-50"
  style={{ border: '1px dashed rgba(28, 70, 89, 0.6)', color: '#85A4B1', fontFamily: 'var(--font-sans)' }}
>
  <Plus size={14} />
  {permissionState === 'granted' ? 'This device connected' : 'Enable on this device'}
</button>
```

- [ ] **Step 4: Wire the remaining fields and both "Save changes" buttons**

Replace every remaining `setLocationPref`/`setContactName`/`setContactPhone`/`setAutoAlertOptIn`/`setAllergies`/`setConditions`/`setBloodType`/`setChatOptIn` usages — these are unchanged, since the local state now seeds from and saves back to the real profile.

Replace both "Save changes" buttons' (mobile fixed-bottom-bar and desktop sticky-footer "Update Me") `onClick` with `handleSaveChanges`, `disabled={saving}`, and label `{saving ? 'Saving…' : 'Save changes'}` (desktop's "Update Me" copy becomes "Save changes" for consistency). Add a small error line beneath each, shown when `saveError` is set:

```tsx
{saveError && (
  <p className="text-[11px]" style={{ color: '#FF7B93' }}>{saveError}</p>
)}
```

Leave "Delete my account" (both platforms) exactly as shipped — no `onClick`, still a no-op — this is explicitly out of scope per the design's "Known gaps" section.

- [ ] **Step 5: Verify**

Run: `cd webapp && npx tsc -b`
Expected: no type errors, no unused variables (`PLACEHOLDER_DEVICES`, `EMAIL`, `DISPLAY_NAME`, `INITIALS`, `addDevice`, and the old `pushEnabled` state must all be gone).

Run: `cd webapp && npm run dev`, sign in as a user who has completed onboarding, navigate to `/profile`, and confirm:
- Location preference, emergency contact, and medical fields reflect the values saved during onboarding.
- Editing a field and clicking "Save changes" persists (reload the page and confirm it stuck).
- The device list reflects `GET /notifications/devices`'s response (empty list if OneSignal isn't configured locally — this is fine, don't block on it).

- [ ] **Step 6: Commit**

```bash
git add webapp/src/pages/ProfilePage.tsx
git commit -m "feat(profile): wire ProfilePage to real profile data and live OneSignal device list"
```

---

### Task 9: Backend — medical info in the LLM triage context

**Files:**
- Create: `backend/services/profile.py`
- Modify: `backend/services/llm_agent.py`
- Modify: `backend/routers/chat.py`
- Modify: `backend/tests/llm/test_triage_tools.py`

**Interfaces:**
- Produces: `get_profile_medical_context(user_id: str) -> dict | None` in `backend/services/profile.py`. `LLMAgent.respond(user_message, history, lat=None, lng=None, user_id=None)` and `LLMAgent._build_messages(user_message, history, user_id=None)` gain an optional `user_id` parameter.

The design doc names `backend/services/chat.py`'s "context-builder step" as the integration point; the actual last-N-messages window assembly lives in `backend/services/llm_agent.py`'s `LLMAgent._build_messages` (confirmed by reading both files) — that is where this task makes the change.

- [ ] **Step 1: Write the profile-read service**

```python
# backend/services/profile.py
import logging

from db import supabase_select

logger = logging.getLogger(__name__)


def get_profile_medical_context(user_id: str) -> dict | None:
    """
    Returns {"allergies", "conditions", "blood_type"} when the user has
    medical_chat_opt_in enabled, else None. Never raises — a fetch failure
    is treated the same as opted-out (context builds exactly as it does today).
    """
    try:
        row = supabase_select(
            "profile",
            {
                "select": "allergies,conditions,blood_type,medical_chat_opt_in",
                "user_id": f"eq.{user_id}",
            },
            single=True,
        )
    except Exception as exc:
        logger.warning("profile_fetch_failed", extra={"error": str(exc)})
        return None

    if not row or not row.get("medical_chat_opt_in"):
        return None

    return {
        "allergies": row.get("allergies"),
        "conditions": row.get("conditions"),
        "blood_type": row.get("blood_type"),
    }
```

- [ ] **Step 2: Thread `user_id` through `LLMAgent` and append the medical context message**

In `backend/services/llm_agent.py`, update `respond` and `_build_messages`:

```python
    def respond(
        self,
        user_message: str,
        history: list[dict],
        lat: float | None = None,
        lng: float | None = None,
        user_id: str | None = None,
    ) -> dict:
        """
        Main entry point. Returns:
        {
            "response": str,
            "severity": str | None,
            "reasoning": str | None,
            "recommended_facility": dict | None,
            "nearby_facilities": list[dict],
            "turn_type": "followup" | "triage",
        }
        """
        messages = self._build_messages(user_message, history, user_id)
        user_turns = sum(1 for m in history if m.get("role") == "user")
        force_classify = user_turns >= self._max_followups

        return self._run(
            messages, lat, lng,
            force=force_classify,
            user_turns=user_turns,
        )

    def _build_messages(
        self, user_message: str, history: list[dict], user_id: str | None = None
    ) -> list[LLMMessage]:
        msgs = [
            LLMMessage(role="system", content=build_system_prompt(self._max_followups))
        ]
        if user_id:
            from services.profile import get_profile_medical_context
            medical = get_profile_medical_context(user_id)
            if medical:
                parts = [f"{k}: {v}" for k, v in medical.items() if v]
                if parts:
                    msgs.append(LLMMessage(
                        role="system",
                        content=(
                            "The patient has opted to share the following medical "
                            "information for this conversation: " + "; ".join(parts)
                        ),
                    ))
        recent = history[-self._context_window:]
        for h in recent:
            msgs.append(LLMMessage(role=h["role"], content=h["content"]))
        msgs.append(LLMMessage(role="user", content=user_message))
        return msgs
```

- [ ] **Step 3: Pass `user_id` from the chat router**

In `backend/routers/chat.py`'s `send_message`, update the `agent.respond(...)` call:

```python
        result = agent.respond(
            user_message=body.content,
            history=history,
            lat=body.lat,
            lng=body.lng,
            user_id=user_id,
        )
```

(`user_id` is already computed at the top of `send_message` as `str(current_user.id)`.)

- [ ] **Step 4: Write the failing test**

In `backend/tests/llm/test_triage_tools.py`, add to the `TestAgentMessageBuilding` class:

```python
    def test_medical_context_included_when_opted_in(self):
        with patch("services.profile.get_profile_medical_context") as mock_ctx:
            mock_ctx.return_value = {"allergies": "Penicillin", "conditions": None, "blood_type": "O+"}
            agent = make_agent()
            msgs = agent._build_messages("I have a headache", [], user_id="user-1")
            assert any("Penicillin" in m.content for m in msgs if m.role == "system")

    def test_medical_context_excluded_when_not_opted_in(self):
        with patch("services.profile.get_profile_medical_context") as mock_ctx:
            mock_ctx.return_value = None
            agent = make_agent()
            msgs = agent._build_messages("I have a headache", [], user_id="user-1")
            assert not any("Penicillin" in m.content for m in msgs)

    def test_no_user_id_skips_profile_lookup(self):
        with patch("services.profile.get_profile_medical_context") as mock_ctx:
            agent = make_agent()
            agent._build_messages("I have a headache", [])
            mock_ctx.assert_not_called()
```

- [ ] **Step 5: Run test to verify it fails, then passes**

Run: `source /home/niki/Documents/workenv/pydev/bin/activate && cd backend && pytest tests/llm/test_triage_tools.py -v`
Expected: first run FAILs (`_build_messages` doesn't accept `user_id` yet if Step 2 isn't applied — apply Step 2 first, then this should PASS). After Steps 1-3 are in place, all tests in the file pass, including the 3 new ones.

- [ ] **Step 6: Commit**

```bash
git add backend/services/profile.py backend/services/llm_agent.py \
        backend/routers/chat.py backend/tests/llm/test_triage_tools.py
git commit -m "feat(chat): include opted-in medical profile info in LLM triage context"
```

---

### Task 10: Privacy page disclosures

**Files:**
- Modify: `webapp/src/pages/PrivacyPage.tsx`
- Modify: `webapp/src/pages/DataDisclosurePage.tsx`

- [ ] **Step 1: Update `PrivacyPage.tsx`**

Add a bullet to the existing "Information we collect" list (after the "Emergency contact" bullet):

```tsx
<li><strong>Medical profile</strong> — allergies, pre-existing conditions, and blood type you optionally provide. Collecting these fields does not share them with the AI assistant by itself; that only happens if you separately opt in during onboarding or on your profile page.</li>
```

Add a bullet to "Your choices":

```tsx
<li>Medical profile fields are optional, and sharing them with the AI assistant during triage is a separate opt-in from providing them — you can turn either off at any time on your profile page.</li>
<li>The emergency-contact "automatically alert this contact" option is currently a stored preference only — no automated message is sent yet.</li>
```

- [ ] **Step 2: Update `DataDisclosurePage.tsx`**

Add a row to the `disclosureItems` array (matching the existing shape of the array's other entries):

```typescript
{
  data: 'Medical profile (allergies, conditions, blood type)',
  badge: 'Optional',
  why: 'Optionally shared with the AI assistant during triage, only if you separately opt in — collecting the fields alone does not share them.',
  stored: 'Supabase secure cloud database.',
  shared: 'Sent to the AI language model provider only during a triage conversation, and only when the AI-assistant opt-in is enabled.'
},
```

- [ ] **Step 3: Verify**

Run: `cd webapp && npx tsc -b`
Expected: no type errors.

Run: `cd webapp && npm run dev`, visit `/privacy` and `/data-disclosure`, confirm the new copy renders.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/pages/PrivacyPage.tsx webapp/src/pages/DataDisclosurePage.tsx
git commit -m "docs(privacy): disclose medical profile collection and AI-assistant opt-in"
```

---

## Self-Review

**Spec coverage:** Problem/Goals → Tasks 1-8 (shared flow, persistence, trigger, non-dismissible). Non-goals → untouched (no alert-sending code, no GpsPermissionModal/PWAInstallModal/NotificationPermissionPrompt internals changed, single contact pair unchanged). Architecture/Flow state → Task 3. Step components → Task 4 (kept presentational; only `MedicalProfileStep` gained 2 props for the error-handling requirement). Shells → Tasks 5-6 (collapsed to thin wrappers, matching the design's own 2026-07-08 correction). Trigger → Task 5. Data model → Task 1. Backend integration → Task 9 (redirected to the actual file, `llm_agent.py`, not `chat.py`, with a note explaining the correction). Privacy pages → Task 10. Error handling → Task 4 (submit) / Task 8 (save). Testing → Task 3 (frontend) / Task 9 (backend). Addendum (routes, DrawerMenu, device list) → Tasks 2, 6, 7, 8. Known gaps → explicitly called out as out-of-scope in the Global Constraints and Task 8.

**Placeholder scan:** no TBD/TODO markers; every step has runnable code.

**Type consistency:** `OnboardingData` (Task 3) fields match the columns added in Task 1's migration and `Profile` interface exactly; `buildSubmitPayload`'s output shape matches what `updateProfile: (updates: Partial<Profile>) => Promise<void>` expects. `NotificationDevice.subscription_id`/`device_type`/`active` used consistently in Task 2's backend response, Task 2's shared type, and Task 8's `ProfilePage` consumption. `useNotificationPermission`'s new required `externalUserId` param is updated at its only two call sites (`App.tsx` in Task 2, `OnboardingWizard.tsx` in Task 4, `ProfilePage.tsx` in Task 8).
