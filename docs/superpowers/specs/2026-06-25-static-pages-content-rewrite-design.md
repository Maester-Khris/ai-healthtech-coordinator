# Static Pages Content Rewrite — Design Spec
_Date: 2026-06-25_

## Goal

Rewrite the copy on four static pages to speak to the primary audience — patients and everyday Torontonians — and drive sign-ups as the primary conversion action. Styling, layout, and component structure are untouched; this spec covers text and SEO metadata only.

## Primary audience

Patients in Toronto who need to find the right clinic, urgent care, or ER quickly. They are often stressed and time-pressured. The register is **practical and informational** — not reassuring, not hyped.

## Primary conversion action

Sign up for MediCoord AI. Every piece of copy either supports that action or gets out of the way.

---

## Page 1 — LandingPage

### Messaging hierarchy

1. You have a symptom or a health situation.
2. Describe it in plain words.
3. MediCoord AI finds the nearest facility that can actually help, with real wait times and directions.
4. Sign up to use it.

### Element-by-element changes (copy only)

**Badge (hero)**
- Current: `Agentic HealthTech System`
- New: `AI Health Routing · Toronto`

**Hero headline** — keep as-is
- `Know where to go, before you go.`

**Hero subtext**
- Current: `Describe symptoms in plain words. Watch our AI agent extract clinical intent, evaluate routing criteria, and verify secure arrival in real time.`
- New: `Describe your symptoms. We'll find the nearest clinic, urgent care, or ER that can help — with real wait times and directions.`

**Search input placeholder** — keep as-is (already patient-aligned)

**Parser log header label**
- Current: `Agent Parser Log`
- New: `Checking availability...`

**Parser log in-progress text**
- Current: `🤖 Agent parsing intent and mapping real-time availability queues...`
- New: `Checking nearby clinics, urgent cares, and wait times...`

**Parser log completion text**
- Current: `Matched coordinate location parameters successfully. Agent verified dispatch criteria: **Toronto Core Dispatch** → **HIPAA Secure Gateway**.`
- New: `Found nearby facilities matching your situation. Results are ready in MediCoord AI.`

**Post-parse CTA button**
- Current: `Launch Command Center`
- New: `Open MediCoord AI`

**Mid-page section 1 — full replacement**

Replace the copy inside the "Strategic Positioning & Technical Edge" section, reusing the existing `lg:grid-cols-2` two-card grid exactly — no layout change.

- Section eyebrow: `Why MediCoord AI`
- Section heading: `The right care, without the guesswork`
- Section subtext: `Most people don't know whether to go to urgent care, the ER, or their family doctor. MediCoord AI figures that out for you.`
- Card 1: heading `Real wait times, not estimates`, body `Live queue data from Toronto facilities so you know the best place to go right now — not just the nearest one.`
- Card 2: heading `Your symptoms stay private`, body `Your descriptions are never stored beyond your session or used to train any AI model. No account required to try it.`

**Mid-page section 2 — "Interactive Triage Showcase"**

Keep structure and all interactive behavior. Rename step labels only:

| Current label | New label |
|---|---|
| "1. Multi-Turn Conversation" | "1. You describe it" |
| tagline "Natural Language Triage" | "Plain words, no medical jargon" |
| "2. Medical Interpretation" | "2. We assess it" |
| tagline "Custom Classification Engine" | "Clinical context, understood" |
| "3. Proximity & ETA Routing" | "3. We route you there" |
| tagline "Advanced MCP Decision Layer" | "Nearest care, fastest total time" |

Section eyebrow: `How it works`
Section heading: `From symptom to facility in seconds`
Section subtext: `Every request goes through three steps — description, assessment, and routing — so you always get the most relevant recommendation.`

**Status bar labels inside the showcase panel**
- Step 1: `Listening to your description — ACTIVE`
- Step 2: `Assessing clinical context — ACTIVE`
- Step 3: `Calculating routes and wait times — ACTIVE`

**Success banner**
- Current: `Patient Confirmed` / `Secure HIPAA coordinate verification completed`
- New: `Facility matched` / `Routed to the best available option near you`

### SEO metadata additions

These are new — add to `index.html` or via React Helmet / head management:

- `<title>` — `Find Urgent Care & ERs Near You — MediCoord AI Toronto`
- `<meta name="description">` — `Describe your symptoms and MediCoord AI finds the nearest clinic, urgent care, or ER in Toronto with real wait times. Know where to go before you go.`
- `<meta property="og:title">` — same as title
- `<meta property="og:description">` — same as description
- Semantic heading hierarchy: confirm `<h1>` is the hero headline, `<h2>` for each section heading, `<h3>` for card headings

---

## Page 2 — PrivacyPage

Light copywriting pass only. Layout and structure unchanged.

**Opening paragraph** — lead with user benefit before policy mechanics:
- Current: `MediCoord AI ("we", "us") helps you describe symptoms and find the right nearby healthcare facility. This policy explains what information we collect, why, and how it's handled.`
- New: `Your health information is yours. This policy explains exactly what MediCoord AI collects when you use the app, why we need it, and how it's protected — in plain language.`

**"Children's privacy" section heading**
- Current: `Children's privacy`
- New: `Who this is for`

**"Children's privacy" body** — update to match the new heading:
- Current: `MediCoord AI is not directed at children under 16, and we do not knowingly collect information from them.`
- New: `MediCoord AI is designed for adults 16 and over. We do not knowingly collect information from anyone under 16.`

All other sections — no changes.

---

## Page 3 — CookiesPage

Light copywriting pass only. Layout and structure unchanged.

**Opening paragraph** — reframe from negative to positive:
- Current: `MediCoord AI does not use advertising, marketing, or cross-site tracking cookies. We utilize local browser storage and cloud service cookies solely to maintain secure sessions, ensure application stability, and save your coordinate configurations.`
- New: `MediCoord AI uses cookies only for three things: keeping your session secure, keeping the app stable, and remembering your map preferences. No advertising. No cross-site tracking.`

**"Performance Telemetry" badge label**
- Current: `Telemetry`
- New: `Analytics`

All card descriptions — no changes (already clear).

---

## Page 4 — DataDisclosurePage

Copywriting pass + SEO structured data.

**Opening paragraph** — surface the Canadian sourcing angle upfront:
- Current: `This page itemizes exactly what data MediCoord AI collects, where it is stored, and who it is shared with for absolute transparency. For a comprehensive legal explanation of your rights, please read our Privacy Policy.`
- New: `MediCoord AI is built on real Canadian public health data — no simulated locations, no synthetic wait times. This page shows exactly what we collect, where it lives, and who can see it. For your legal rights, see our Privacy Policy.`

**"Active Category" badge on each data row**

Rename to reflect actual data sensitivity, so the badge communicates trust rather than noise:

| Data row | Current badge | New badge |
|---|---|---|
| Email address | Active Category | Account |
| Symptom descriptions & Triage history | Active Category | Sensitive |
| Device coordinates & GPS position | Active Category | In-session only |
| Emergency contact metadata | Active Category | Optional |
| Application diagnostic logs | Active Category | Operational |
| Notification device token | Active Category | Optional |

**FAQ structured data** — add `<script type="application/ld+json">` to the page with FAQ schema covering the six data rows. This targets searches like "does MediCoord AI store my location" and "who can see my symptoms". Implementation: inline script in the component or injected via Helmet.

Example schema shape (not exhaustive):
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Does MediCoord AI store my GPS location?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. Your device location is used in-memory during an active request to calculate travel times and is discarded immediately after. It is never stored in our database."
      }
    }
  ]
}
```

---

## Skills execution order

1. **product-marketing** — validate and sharpen the trust signal copy and messaging hierarchy for LandingPage section 1 replacement
2. **copywriting** — apply all copy changes across all four pages per this spec
3. **ai-seo** — add LandingPage meta tags + DataDisclosurePage FAQ schema

## Out of scope

- Any layout, component, or styling change
- PrivacyPage and CookiesPage SEO metadata (low priority, no search intent for these pages)
- programmatic-seo (YAGNI — applicable when content scales to multiple routes, not 4 static pages)
- Backend or routing changes
