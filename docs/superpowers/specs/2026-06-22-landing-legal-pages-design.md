# Landing Page + Legal Pages — Design Spec

**Date:** 2026-06-22
**Sub-project:** 2 of 4 (Sprint 13 UI/product reframe)
**Depends on:** `ui-design/DESIGN-SYSTEM.md`

## Problem

`/` currently renders the app shell (`Home`, map+chat) directly for every
visitor, logged in or not. There is no marketing landing page and no privacy,
cookie, or data-disclosure page anywhere in the app.

## Routing changes

- `/` → new `LandingPage` component (marketing, logged-out-first)
- Logged-in users hitting `/` are redirected to `/app`
- Existing app shell (`Home`) moves from `/` to `/app` — behavior otherwise
  unchanged (still supports unauthenticated browsing)
- New static routes: `/privacy`, `/cookies`, `/data-disclosure`
- `Sign in` / `Get started` buttons on the landing page open the existing
  `LoginModal` (reused, not rebuilt)

## Landing page sections

1. **Hero** — headline, subhead, Sign in / Get started CTAs
2. **How it works** — 3 steps: describe symptoms → AI triage → routed to the
   right facility
3. **Feature highlights** — map+chat triage, severity-aware routing, push
   notifications for follow-up
4. **Trust/data note** — short paragraph, links to `/privacy`
5. **Footer** — legal links (`/privacy`, `/cookies`, `/data-disclosure`),
   sandbox link

Styled with the design-system tokens (Stratum material/color). Feature
highlight cards use the double-bezel/gradient card treatment; this is a
marketing context so cards can be slightly more decorative than the
functional app screens.

**Copy:** structural placeholder copy is fine for the implementation pass.
Final persuasive copy should go through the `copywriting` skill before this
ships — not part of this design spec.

## Legal pages

`/privacy`, `/cookies`, `/data-disclosure` — three separate routes (not one
combined page), sharing a single template: title, last-updated date,
sectioned body, back-to-home link.

**Styling:** uses design-system spacing/type tokens but intentionally low
on the skeuomorphic material treatment — legal text should read as plain and
trustworthy, not decorated.

**Cookie management approach:** static disclosure page, no blocking consent
banner or preference center. Rationale: there is no ad/analytics tracking
today — only functionally-necessary storage (Supabase auth session, Sentry
error+replay, OneSignal push subscription). Building a toggle UI for
categories that don't exist yet would be consent theater. Revisit if
analytics/ads are ever added.

**Content basis — actual current data flows (verified against codebase):**
- Supabase Auth: email/password and Google OAuth, session stored client-side
- Browser geolocation: opt-in, used only for facility routing
- Profile data: `location_preference`, `emergency_contact_name`,
  `emergency_contact_phone` — emergency contact used only for user-initiated
  SMS, never autonomous
- Chat/triage messages: stored in Supabase (`sessions`, `messages` tables)
- Sentry: error tracking + session replay with `maskAllText: true`
- OneSignal: push subscription + player ID, stored in localStorage and
  Supabase

**Compliance flag:** this is real legal copy for a health-adjacent product
(Canada PIPEDA-relevant). Draft accurate, plain-language disclosure from the
data flows above, but get real legal review before treating this as binding
compliance text — it should not be the only thing standing between the
product and regulatory exposure.

## Out of scope

- Actual legal review/sign-off (flagged above, not something this spec can
  resolve)
- Analytics/ad tracking infrastructure (none exists; cookie page reflects
  that, doesn't add it)
- Final marketing copywriting pass (separate, via `copywriting` skill, at
  implementation time)
