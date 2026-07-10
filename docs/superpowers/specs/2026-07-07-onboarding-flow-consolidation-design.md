# Onboarding Flow Consolidation — Design

**Branch:** `feat/onboarding-consolidation` · **Sprint:** 16 · **Date:** 2026-07-07

## Problem

Desktop and mobile each have their own hand-duplicated implementation of "getting
started": `GettingStartedModal.tsx` (desktop, auto-shown blocking modal) and
`SetupPage.tsx` (mobile, full-page route reached only via a menu link — not
auto-triggered on first login). Both collect the same two fields
(`location_preference`, `emergency_contact_name`/`phone`) with different styling and
no shared code.

Separately, GPS and push-notification permissions are handled by three more
components — `GpsPermissionModal`, `PWAInstallModal`, `NotificationPermissionPrompt` —
mounted app-wide, independent of the onboarding flow and of each other. None of them
persist anything to the `profile` table; push state lives only in OneSignal +
localStorage. Sprint 11's changelog explicitly flagged this gap ("GPS preference +
push opt-in as a 3rd step... scoped but paused mid-design").

The desktop modal's close ("X") button doesn't actually persist dismissal
(`onboardingDismissed` is unpersisted local state) — it only delays onboarding by one
page view, contradicting the original "no skip" intent from the task that built it.

## Goals

- One shared onboarding flow, presented as a modal on desktop and a full page on
  mobile, auto-triggered and non-dismissible on both platforms on first login.
- Persist location, push, emergency-contact, and medical-profile preferences to
  `profile` — all in one place, all through one write.
- Feed medical info into the triage chat's LLM context, gated behind its own
  separate opt-in (distinct from just collecting the data).
- Capture an emergency-contact auto-alert opt-in preference (sending itself is a
  follow-up, out of scope here).
- Update the privacy pages to disclose the new data collection.

## Non-goals (explicitly deferred)

- **Automated emergency-contact alert sending.** This requires a new backend
  subsystem (SMS/message provider integration, secrets, delivery/failure handling)
  and raises a CASL consent-to-receive question for the contact (who never
  themselves opted in) — worth a compliance check when that spec is written. This
  task only captures the user's opt-in preference.
- Changing `GpsPermissionModal` / `PWAInstallModal` / `NotificationPermissionPrompt`
  internals — they keep their current fallback behavior for users who deny during
  onboarding and change their mind later, or who dismissed the PWA install/push
  nudge. They're only suppressed *while onboarding is actively showing*, to avoid
  double-prompting the same permission twice in one session.
- Multiple emergency contacts — stays a single name+phone pair, matching what the
  existing Sprint 8 "Message emergency contact" action already consumes.

## Architecture

### Flow state

`webapp/src/hooks/useOnboardingFlow.ts` — a 4-step state machine:

```typescript
type OnboardingStep = 'location' | 'push' | 'emergency' | 'medical'

interface OnboardingData {
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
```

Owns: current step index, in-memory `OnboardingData`, `next()`/`back()`, and a single
`submit()` that calls `updateProfile({ ...data, getting_started_done: true })` once at
the end — matching today's one-shot save pattern. No partial persistence mid-flow.

### Step components

`webapp/src/components/onboarding/steps/`:
- `LocationStep.tsx` — unchanged UI, wraps `useGeolocation`
- `PushStep.tsx` — new, wraps existing `useNotificationPermission`; the "Enable"
  button triggers the same permission-request code path `NotificationPermissionPrompt`
  already uses; denial is a valid outcome (`push_enabled: false`), not an error
- `EmergencyContactStep.tsx` — existing two inputs + new `auto_alert_opt_in` toggle
  ("Automatically alert this contact in urgent situations — coming soon, opt in now")
- `MedicalProfileStep.tsx` — new; allergies/conditions/blood-type inputs (all
  optional, free text except blood type as a short select) + a separate
  `medical_chat_opt_in` toggle ("Let the AI assistant see this during triage")

All four are pure/presentational: props in (current values, setters), no data
fetching of their own.

### Shells

Correction from the original plan: the static-UI phase built these as **new**
standalone components — `webapp/src/components/onboarding/OnboardingWizard.tsx`
and `webapp/src/pages/ProfilePage.tsx` — reached via temporary `/preview/onboarding`
and `/preview/profile` routes, rather than modifying `GettingStartedModal.tsx` /
`SetupPage.tsx` in place. The workflow-integration work is therefore: wire
`OnboardingWizard.tsx` to `useOnboardingFlow()` and real hooks, then retire
`GettingStartedModal.tsx` / `SetupPage.tsx`'s old onboarding JSX in favor of it
(desktop keeps a modal wrapper, mobile keeps the full-page route — `OnboardingWizard`
already handles both via `useBreakpoint()` internally, so the two old components may
collapse to thin route/modal wrappers around it, or be deleted outright if
`OnboardingWizard` can mount directly at `/setup`). Same idea for `ProfilePage.tsx`
at the real `/profile` route. Not "build shells from scratch" — the shells already
exist; this is a wiring pass.

Both are non-dismissible: the desktop modal's `onClose`/`onboardingDismissed` escape
hatch is removed, since it didn't actually persist and only delayed the intended
"must complete" behavior.

### Trigger

`AppInner` (`App.tsx`) computes `showOnboarding = user && profile &&
!profile.getting_started_done` for both platforms. Desktop renders the modal in
place. Mobile redirects to `/setup` (existing route) instead of requiring the user to
find it via `DrawerMenu`/`UserMenu`. While `showOnboarding` is true, `GpsPermissionModal`,
`PWAInstallModal`, and `NotificationPermissionPrompt` are suppressed — onboarding is
the primary place these permissions get asked; the three popups resume their normal,
untouched fallback logic once onboarding completes.

## Data model

New migration `migrations/013_profile_onboarding_extensions.sql`:

```sql
alter table public.profile
  add column if not exists push_enabled boolean not null default false,
  add column if not exists auto_alert_opt_in boolean not null default false,
  add column if not exists allergies text,
  add column if not exists conditions text,
  add column if not exists blood_type text,
  add column if not exists medical_chat_opt_in boolean not null default false;
```

All new columns nullable or defaulted — no backfill needed beyond the trigger already
creating rows for new users.

`webapp/src/hooks/useProfile.ts`'s `Profile` interface gains all six fields.

`shared/types.ts` gains a `Profile` interface mirrored to a new Pydantic model, since
the backend now reads this table directly (see below) — this is no longer purely a
client-side/RLS-only shape.

## Backend integration

`backend/services/chat.py`'s context-builder step (where the last-10-messages window
is assembled) fetches `profile` server-side via the existing service-role pattern
(same as sessions/messages) and, only when `medical_chat_opt_in` is true, appends
allergies/conditions/blood-type to the LLM's context before the triage call. When the
flag is false, or the fetch fails, the context is built exactly as it is today — no
medical data is added.

## Privacy pages

`PrivacyPage.tsx` and `DataDisclosurePage.tsx` get new sections:
- Medical info collection is optional and stored in `profile`.
- It is only visible to the AI assistant if the user separately opts in
  (`medical_chat_opt_in`); collecting the fields alone does not share them with the
  chat agent.
- Emergency-contact auto-alert is currently a stored preference only — no automated
  message is sent yet.

## Error handling

- Push/location permission denial during onboarding is a valid, expected outcome —
  no retry loop inside the flow; the existing standalone popups handle later re-asks.
- Final `submit()` failure (network/Supabase error): show an inline error and
  re-enable the "Save and continue" button, rather than leaving it stuck in
  "Saving…" — new behavior, since a 4-step flow makes a silent failure costlier than
  the old single-shot form.

## Testing

One assert-based test for `useOnboardingFlow`'s step transitions and the final
`OnboardingData` payload shape (it's now branching state, not a flat form — the repo's
existing bar for prior onboarding UI tasks was "no tests, verify via `tsc -b`" for
flat forms; this one has real branches worth one runnable check). No new backend
tests beyond the existing `pytest` suite's coverage of `chat.py`, extended with one
case asserting medical info is included/excluded based on `medical_chat_opt_in`.

## Addendum — new functional elements from UI redesign, 2026-07-08

Visual/copy decisions for the onboarding + profile redesign live in their own spec,
`docs/superpowers/specs/2026-07-08-onboarding-profile-ui-redesign-design.md`. Only
the new *functional* elements that spec surfaced are recorded here, since they change
this sprint's implementation scope:

- **New route `/profile`**, separate from `/setup`. `/setup` stays onboarding-only;
  `/profile` is a standalone, non-wizard settings page reachable any time post-login,
  reusing the onboarding step's field/toggle components. `DrawerMenu.tsx`'s "My
  profile" and the desktop user-menu equivalent repoint from `/setup` to `/profile`.
- **`DrawerMenu.tsx` drops its "Test notifications" row**, down to exactly 3 items
  (Home, My profile, Sign out) — device/push testing now happens on `/profile`
  directly.
- **Push device list on `/profile`**, powered by a live OneSignal query rather than a
  new Supabase table. Requires `useNotificationPermission.ts` to call
  `OneSignal.login(user.id)` when permission is granted (it currently only stores
  `player_id` in `localStorage`, with no server-side link to a MediCoord user — this
  is new). New backend endpoints in `backend/routers/notifications.py`:
  `GET /notifications/devices` (list by external id) and
  `DELETE /notifications/devices/{player_id}` (unsubscribe one), both auth-gated and
  proxying OneSignal's REST API alongside the existing `POST /notifications/send`.
  `profile.push_enabled` is unaffected — it still answers "opted in during
  onboarding," a separate question from the live device list.

## Known gaps from UI work, 2026-07-08 — not designed here

Three things the Profile page's static UI ended up with that have no design or
data model anywhere yet. Flagged, not solved — each needs its own scoping pass
before workflow-integration touches them:

- **"Delete my account."** Implies real Supabase auth-user deletion plus cleanup
  of `profile`, `sessions`, `messages`, and any wait-time/facility data tied to the
  user — and, since this is a Canadian product, a PIPEDA-style right-to-erasure
  angle worth a compliance look, not just an engineering task. No backend endpoint,
  no confirmation-flow design, no data-retention decision exists yet.
- **"Preferred facility."** Undecided whether this is a real stored preference
  (a `preferred_facility_id` a user explicitly picks) or just a live "nearest open
  facility" readout computed from the proximity-search feature that already exists
  (`GET /facilities/nearby`). The static UI shows a hardcoded example ("St.
  Michael's Hospital") that doesn't correspond to either yet — decide which one
  before wiring real data in.
- **The "+ Add device" button doesn't map to anything real.** OneSignal
  registers a device automatically when the browser grants push permission —
  there's no user-facing "add an arbitrary device" action in real push
  infrastructure. When wiring the device list to the live OneSignal query (see
  above), this button either gets dropped, or repurposed as something that *does*
  correspond to a real action (e.g. a "test notification" trigger, or a prompt
  that re-runs the permission request on the current device).
