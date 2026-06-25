# Product

## Register

product

## Users

Adults in an urban health emergency or seeking routine care — stressed, possibly unwell, often on a phone. Secondary user: developers/ops using the Sandbox for testing. Primary workflow: describe symptoms in plain language → get severity-aware facility routing on a live map.

## Product Purpose

MediCoord AI eliminates the friction between "I feel unwell" and "I know where to go." A single chat interface classifies symptom severity, queries live facility capacity, and surfaces the nearest appropriate clinic or ER on an interactive map — no switching between a search engine, maps app, and a phone directory.

## Brand Personality

Precise. Calm under pressure. Trustworthy.

The interface should feel like a composed, expert system — not a consumer chatbot or a generic SaaS tool. It is dark, sharp, and information-dense because it is a command center, not a comfort app. Urgency is communicated through the severity palette, not through loud chrome.

## Anti-references

- Generic SaaS dashboards (Notion, Linear, Vercel) — too playful, too product-focused
- Consumer health apps (Headspace, Calm) — wrong emotional register; we are not calming, we are routing
- Clinical EMR / hospital software (Epic, Meditech) — sterile, institutional gray; we are not an ops tool
- Dark-mode developer tools (VSCode, Fig) — too "dev", not enough "command center"

## Design Principles

1. **Severity palette is sacred.** The four triage colors (routine/moderate/urgent/emergent) are the only status communicators. Never use them decoratively.
2. **Information density earns trust.** Compact, precise readouts (coordinates, ETAs, facility names) make the AI feel capable. Empty white space reads as uncertainty.
3. **Motion serves state transitions.** Animations mark real state changes (routing locked, session started). No decorative loops.
4. **Dark command center, not dashboard.** The UI is a real-time coordination environment. The Aura/cyber dark palette is load-bearing: it makes the map and severity colors pop.
5. **Sandbox is explicitly alien.** The /sandbox amber accent and denser layout signal "this is not patient-facing" — a deliberate narrative break from the main app.

## Accessibility & Inclusion

WCAG AA minimum. Body text ≥ 4.5:1 against background. Severity indicators never rely on color alone (always paired with label). Touch targets ≥ 44px on mobile. Reduced-motion alternative for all animations.
