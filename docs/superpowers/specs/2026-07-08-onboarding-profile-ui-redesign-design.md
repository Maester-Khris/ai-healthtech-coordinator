# Onboarding + Profile UI Redesign — Design

**Branch:** `feat/onboarding-consolidation` · **Sprint:** 16 · **Date:** 2026-07-08

## Scope

This spec covers **static UI only** for two screens: the onboarding wizard (4 steps)
and a new `/profile` page. "Static" means: presentational components built to match
the visual design below, using local component state or hardcoded/mock values where
a field needs to show something — no Supabase calls, no `useProfile`/`useGeolocation`/
`useNotificationPermission` wiring, no OneSignal calls, no backend endpoints. Real
data, permissions, and persistence wiring is a separate, later implementation phase
governed by `2026-07-07-onboarding-flow-consolidation-design.md` — that spec owns the
data model, the `useOnboardingFlow` state machine, the migration, and the new
device-list backend endpoints. This one only owns what things look like.

## Why a redesign was needed

`GettingStartedModal.tsx` (desktop onboarding) still carries the light Stratum
classes from Sprint 7 (`stratum-accent`, `stratum-bg`, etc.). Everything adjacent to
it — `SetupPage.tsx`, `GpsPermissionModal.tsx`, `NotificationPermissionPrompt.tsx` —
already shipped on a different, newer dark "command center" system
(`design_document.md` / `design_document_app.md` / `design_document_mobile.md`,
2026-06-24/25), which explicitly names "Getting Started, Profile" as its target
screens. Both new surfaces are built on that dark system, since it's already in
production use — `GettingStartedModal` is the one being brought into line, not the
other way around.

Separately, `ui-design/DESIGN-SYSTEM.md` (2026-06-22, marked "approved") specs a
different, light Stratum palette and claims to be the single source of truth. It was
superseded in practice by the dark system shipped two days later, but the doc itself
was never updated. That reconciliation is out of scope here — flagged for a separate
pass, not blocking this work.

## Process

Two rounds of Google Stitch mockups (final images in `artifacts/profile_onboarding/`).
Round 1 defaulted to a generic clinical-SaaS template — a doctor's dashboard persona,
US-style insurance-network language, Silicon Valley placeholder geography. Round 2
corrected persona/copy/geography but reintroduced a narrower version of the same
mistake in new places (see Guardrails). Caught in review, not shipped — the
guardrails below exist specifically because these mistakes recurred once already.

## Visual system

Dark "command center" tokens, matching what's already in production:

| Token | Value |
|---|---|
| Background | `#061219` |
| Surface / card | `#0A1D27` at 80–92% opacity, `backdrop-blur` |
| Elevated / active surface | `#132E3C` |
| Border (subtle) | `#1C4659`, 30–65% opacity |
| Primary accent | `#48F6C1` (mint) — dark text `#061219` on solid fills |
| Secondary accent | `#35A7C4` (teal) |
| Tertiary accent | `#00D2FF` (cyan) |
| Severity (routine/moderate/urgent/emergent) | `#00D2FF` / `#F59E0B` / `#F59E0B` / `#FF7B93` |
| Text primary / muted | `#E2F1F5` / `#85A4B1` |
| Font | Inter (UI text), JetBrains Mono (small metadata only, e.g. status badges) |
| Material | Glassmorphism, 1px translucent borders, 12–24px radii, ambient shadow |

Product name in all copy and any header/wordmark: **MediCoordAI**. (Round-1 mockups
drifted to an invented "CareCommand" name — corrected, not real.)

## Screen A — Onboarding shell (4 steps, static)

Desktop: centered modal, ~480–520px wide, dark glass card, blurred backdrop.
Mobile: full-page layout, hero header with the MediCoordAI wordmark, step indicator
pinned near the top, primary CTA pinned to the bottom above the safe area.

4-dot progress indicator (labeled on mobile: Location / Push / Emergency / Medical).
**Same CTA label and body copy on both breakpoints for a given step** — round 1 had
step 1 read "Save and continue" on mobile but "Update Me" on desktop with different
supporting text; that must not recur. Every step but the last uses "Save and
continue"; the last uses "Finish setup." Buttons/toggles/inputs are wired to local
component state only (enough to demo interaction) — no submission goes anywhere.

1. **Location access** — two selectable cards, "Always allow" / "Ask each time"
   (default), radio-style selected state (mint border + tinted background). No
   stock photography — an abstract dotted-map graphic with a small status chip
   (e.g. "GPS ACTIVE") is the only illustration, if one is used at all.
2. **Push notifications** — one sentence on why ("Get notified the moment your care
   recommendation is ready"), primary "Enable notifications" button + muted "Not
   now." Any example notification preview shown here is a plain triage-ready
   message from the assistant, never framed as a person ("Dr. ___") reviewing
   anything.
3. **Emergency contact** — optional Name + Phone inputs, then the
   "Automatically alert this contact in urgent situations" toggle, captioned
   "Coming soon — opt in now."
4. **Medical profile** — optional Allergies, Pre-existing conditions, Blood type
   (select), then a second, visually distinct toggle: "Let the AI assistant use
   this during triage," captioned "Only shared with the assistant if enabled — see
   Privacy Policy."

## Screen B — Profile page shell (static)

Same dark system, same field/toggle components as the onboarding steps, arranged as
stacked editable sections with a single "Save changes" bar pinned at the bottom
(desktop) or page end (mobile, scrollable). No real save action — button exists,
visually responds to a click, does nothing yet.

- Account header: email + "Member since {date}" placeholder text in small muted
  mono, avatar initials circle (no headshot photo)
- Location preference (identical copy/options to onboarding step 1)
- Push notifications: status toggle + a **device list** — one static placeholder
  row per example device (e.g. "Chrome on Windows — active"), each with a "Remove"
  button (no-op for now). No wearable devices, no battery percentages, no
  "connected" health hardware of any kind.
- Emergency contact (identical fields/toggle to onboarding step 3) — copy stays
  scoped to "notify this contact," not "primary decision maker for medical care."
- Medical profile (identical fields/toggle to onboarding step 4)

No map card, no facility/campus assignment section — this product routes to the
nearest open facility fresh each session; it does not assign a patient to a
hospital or campus.

## Navigation (visual only)

`DrawerMenu.tsx` (mobile) keeps its current left-side slide-in, 260px width, dark
glass material. Visually trimmed to exactly 3 rows — Home, My profile, Sign out
(sign-out in the danger/rose accent) — with "My profile" pointing at wherever the
Profile page ends up living. (Whether that's a route change from `/setup`, and
whether "Test notifications" is actually removed from the live app, is a workflow
decision for the consolidation spec/plan — this file only specifies what the drawer
should look like.) No "Dashboard," "Health," or "Health Data" destinations anywhere
— round 1 invented these on both the desktop top nav and a mobile bottom tab bar;
the app has no such sections.

## Content guardrails

These are things round 1 and round 2 of the mockups got wrong at some point and must
not ship, listed so implementation doesn't reintroduce them from a stray copy/paste
of a mockup screen:

- No wearable/continuous-monitoring framing ("Apple Watch," "monitors your health
  markers 24/7," battery percentages).
- No clinician-in-the-loop copy — nothing implies a human doctor/nurse reviews the
  user's data; it is always "the AI assistant."
- No fabricated government/insurance integration (Ontario Health Card/OHIP sync,
  private insurance network preferences) — none of that exists in this product.
- No facility/campus assignment language.
- Emergency contact is an SMS-alert contact, not a medical power-of-attorney.
- Plain, reassuring, patient-facing tone throughout — this is an ordinary person
  using a self-triage chat tool, not clinical staff operating a dashboard. Existing
  reference for tone: "MediCoord uses your location to find nearby health
  facilities" (current `GettingStartedModal.tsx` copy).

## Open item (explicitly not resolved here)

`ui-design/DESIGN-SYSTEM.md`'s light Stratum system is not reconciled with the dark
system this redesign (and the rest of the shipped `/app` surface) actually uses. Two
"source of truth" docs currently disagree. Not blocking — worth its own pass.
