# Static Pages Content Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite copy on LandingPage, PrivacyPage, CookiesPage, and DataDisclosurePage to speak to patients first, drive sign-ups, and add SEO metadata — without touching styling, layout, or component structure.

**Architecture:** Pure text substitutions across 4 React components + index.html. No new components, no layout changes, no dependencies. DataDisclosurePage gets one new `<script type="application/ld+json">` block for FAQ structured data.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS (untouched)

## Global Constraints

- No styling changes — class names are untouched
- No layout changes — grid structures, component trees, and element counts stay the same
- No new npm packages
- No new files (except the FAQ schema is added inline in DataDisclosurePage.tsx)
- Commit style: conventional commits, no co-author trailer, one commit per task
- Never commit directly to main or preview

---

### Task 1: LandingPage — Hero & Parser Log Copy

**Files:**
- Modify: `webapp/src/pages/LandingPage.tsx`

**Note on testing:** These are copy-only changes. There are no meaningful unit tests for string content. Verification is visual — run the dev server and confirm the text renders correctly.

- [ ] **Step 1: Update the hero badge**

In `webapp/src/pages/LandingPage.tsx` around line 311, find and replace:
```tsx
// OLD
Agentic HealthTech System

// NEW
AI Health Routing · Toronto
```

- [ ] **Step 2: Update the hero subtext**

Around line 322, find and replace:
```tsx
// OLD
Describe symptoms in plain words. Watch our AI agent extract clinical intent, evaluate routing criteria, and verify secure arrival in real time.

// NEW
Describe your symptoms. We'll find the nearest clinic, urgent care, or ER that can help — with real wait times and directions.
```

- [ ] **Step 3: Update the parser log header label**

Around line 428, find and replace:
```tsx
// OLD
<span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Agent Parser Log</span>

// NEW
<span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Checking availability...</span>
```

- [ ] **Step 4: Update the parser log in-progress text**

Around line 444, find and replace:
```tsx
// OLD
<span>🤖 Agent parsing intent and mapping real-time availability queues...</span>

// NEW
<span>Checking nearby clinics, urgent cares, and wait times...</span>
```

- [ ] **Step 5: Update the parser log completion paragraph**

Around line 469, find and replace:
```tsx
// OLD
Matched coordinate location parameters successfully. Agent verified dispatch criteria: **Toronto Core Dispatch** &rarr; **HIPAA Secure Gateway**.

// NEW
Found nearby facilities matching your situation. Results are ready in MediCoord AI.
```

- [ ] **Step 6: Update the post-parse CTA button**

Around line 473, find and replace:
```tsx
// OLD
Launch Command Center

// NEW
Open MediCoord AI
```

- [ ] **Step 7: Update the success banner**

Around lines 740–747, find and replace:
```tsx
// OLD
<span className="text-[11px] font-bold text-white tracking-wide uppercase">Patient Confirmed</span>
<span className="text-[9.5px] font-mono text-[#48F6C1]">Secure HIPAA coordinate verification completed</span>

// NEW
<span className="text-[11px] font-bold text-white tracking-wide uppercase">Facility matched</span>
<span className="text-[9.5px] font-mono text-[#48F6C1]">Routed to the best available option near you</span>
```

- [ ] **Step 8: Verify visually**

```bash
cd webapp && doppler run -- npm run dev
```

Open `http://localhost:5173`. Confirm:
- Badge reads "AI Health Routing · Toronto"
- Hero subtext is the new patient-facing version
- Run the search demo (click a chip) — parser log reads "Checking availability..." and "Checking nearby clinics..."
- After parse completes, CTA reads "Open MediCoord AI"

- [ ] **Step 9: Commit**

```bash
git add webapp/src/pages/LandingPage.tsx
git commit -m "copy(landing): patient-first hero, parser log, and CTA copy"
```

---

### Task 2: LandingPage — Mid-Page Sections

**Files:**
- Modify: `webapp/src/pages/LandingPage.tsx`

**Note:** The two-card grid structure (`lg:grid-cols-2`) is preserved exactly. Only text content inside the cards changes.

- [ ] **Step 1: Update the positioning section header**

Around line 763–769, find and replace the section eyebrow, heading, and subtext:
```tsx
// OLD
<div className="text-xs font-bold uppercase tracking-widest text-[#00D2FF]">Platform Value</div>
<h2 className="text-3xl lg:text-4xl font-extrabold text-white">Strategic Positioning & Technical Edge</h2>
<p className="text-[#85A4B1] max-w-xl text-sm leading-relaxed">
  MediCoord AI sits at the intersection of real-time clinical triage and intelligent routing logistics.
</p>

// NEW
<div className="text-xs font-bold uppercase tracking-widest text-[#00D2FF]">Why MediCoord AI</div>
<h2 className="text-3xl lg:text-4xl font-extrabold text-white">The right care, without the guesswork</h2>
<p className="text-[#85A4B1] max-w-xl text-sm leading-relaxed">
  Most people don't know whether to go to urgent care, the ER, or their family doctor. MediCoord AI figures that out for you.
</p>
```

- [ ] **Step 2: Replace Card 1 content (was "Positioning & City-Wide Value")**

Around lines 778–796, find the card's inner text block and replace:
```tsx
// OLD — inside Card 1's flex flex-col gap-2 div
<h3 className="text-xl font-bold text-white">Positioning & City-Wide Value</h3>
<span className="text-xs font-mono font-bold text-[#00D2FF] uppercase tracking-wider">Toronto Healthcare Resource Optimization</span>
<p className="text-sm text-[#85A4B1] leading-relaxed mt-2">
  Toronto's emergency spaces suffer from fragmented and underutilized data (uncoordinated wait times, disconnected government datasets). We provide a unified coordination layer helping citizens locate the right facility for their specific needs, in the most convenient way—knowing exactly where to go before they leave their home.
</p>
<p className="text-sm text-[#85A4B1] leading-relaxed mt-1">
  Beyond individual convenience, we aim to better balance the load across the city's healthcare infrastructure. By leveraging a multi-user live triage model, we route patients dynamically based on severity, facility type, and active capacity queues.
</p>

// NEW
<h3 className="text-xl font-bold text-white">Real wait times, not estimates</h3>
<span className="text-xs font-mono font-bold text-[#00D2FF] uppercase tracking-wider">Live Queue Data · Toronto Facilities</span>
<p className="text-sm text-[#85A4B1] leading-relaxed mt-2">
  Live queue data from Toronto facilities so you know the best place to go right now — not just the nearest one.
</p>
<p className="text-sm text-[#85A4B1] leading-relaxed mt-1">
  The closest clinic isn't always the fastest option. We combine travel time and current wait queues to find the one where you'll be seen soonest.
</p>
```

Also update the card footer text around line 788:
```tsx
// OLD
<span className="text-xs text-[#7AA0B0] font-mono">Simulate multi-user capacity load:</span>
// (keep the "Launch Sandbox Mode" link as-is)

// NEW
<span className="text-xs text-[#7AA0B0] font-mono">See multi-facility load balancing:</span>
```

- [ ] **Step 3: Replace Card 2 content (was "Technical Architecture & Prowess")**

Around lines 804–819, find the card's inner text block and replace:
```tsx
// OLD
<h3 className="text-xl font-bold text-white">Technical Architecture & Prowess</h3>
<span className="text-xs font-mono font-bold text-[#48F6C1] uppercase tracking-wider">Clinical Intelligent Routing Layer</span>
<p className="text-sm text-[#85A4B1] leading-relaxed mt-2">
  We combine real-time proximity searches with near real-time cloud-integrated telemetry datasets. A dedicated, personal AI agent understands patient symptoms expressed in simple natural language and provides highly accurate recommendations without replacing human healthcare professionals.
</p>
<p className="text-sm text-[#85A4B1] leading-relaxed mt-1">
  Our engine uses custom-built Graph RAG systems optimized on Canadian clinical datasets and medical knowledge graphs. An internal custom severity classification engine maps user input to triage states, while customized MCP tools calculate driving, transit, cycling, and walking ETAs.
</p>

// NEW
<h3 className="text-xl font-bold text-white">Your symptoms stay private</h3>
<span className="text-xs font-mono font-bold text-[#48F6C1] uppercase tracking-wider">Session-Only · Never Stored · Never Trained</span>
<p className="text-sm text-[#85A4B1] leading-relaxed mt-2">
  Your descriptions are never stored beyond your session or used to train any AI model. No appointment, no referral, no account required to try it.
</p>
<p className="text-sm text-[#85A4B1] leading-relaxed mt-1">
  MediCoord AI is built on real Canadian public health data — real hospital locations, real facility types, and real routing times from Toronto's transit and road network.
</p>
```

- [ ] **Step 4: Update the triage showcase section header**

Around lines 825–833, find and replace:
```tsx
// OLD
<div className="text-xs font-bold uppercase tracking-widest text-[#48F6C1]">How It Works</div>
<h2 className="text-3xl lg:text-4xl font-extrabold text-white">Interactive Triage Showcase</h2>
<p className="text-[#85A4B1] max-w-xl text-sm leading-relaxed">
  Click through the pipeline stages to inspect the real-time technical processing of a patient's request.
</p>

// NEW
<div className="text-xs font-bold uppercase tracking-widest text-[#48F6C1]">How it works</div>
<h2 className="text-3xl lg:text-4xl font-extrabold text-white">From symptom to facility in seconds</h2>
<p className="text-[#85A4B1] max-w-xl text-sm leading-relaxed">
  Every request goes through three steps — description, assessment, and routing — so you always get the most relevant recommendation.
</p>
```

- [ ] **Step 5: Update the step tab labels**

Around lines 837–858, find and replace the three step objects in the array:
```tsx
// OLD
{
  id: 1,
  title: "1. Multi-Turn Conversation",
  tagline: "Natural Language Triage",
  desc: "Graph RAG extracts medical entities from conversational speech and generates clinical follow-up questions.",
  icon: Sparkle
},
{
  id: 2,
  title: "2. Medical Interpretation",
  tagline: "Custom Classification Engine",
  desc: "Maps unstructured patient statements to specific clinical/medical scenarios using knowledge graph connections.",
  icon: Stethoscope
},
{
  id: 3,
  title: "3. Proximity & ETA Routing",
  tagline: "Advanced MCP Decision Layer",
  desc: "Calculates driving distance and wait queue durations, delivering total care recommendations.",
  icon: TrafficSign
}

// NEW
{
  id: 1,
  title: "1. You describe it",
  tagline: "Plain words, no medical jargon",
  desc: "Describe your situation in plain language. The AI asks follow-up questions to understand your symptoms fully.",
  icon: Sparkle
},
{
  id: 2,
  title: "2. We assess it",
  tagline: "Clinical context, understood",
  desc: "Your description is mapped to clinical severity and the right type of care — without replacing a doctor's judgment.",
  icon: Stethoscope
},
{
  id: 3,
  title: "3. We route you there",
  tagline: "Nearest care, fastest total time",
  desc: "Travel time plus live wait queue — so you arrive at the facility where you'll be seen soonest.",
  icon: TrafficSign
}
```

- [ ] **Step 6: Update the showcase panel status bar labels**

Around lines 893–896, find and replace:
```tsx
// OLD
{activeStep === 1 && "Graph RAG Triage Pipeline — ACTIVE"}
{activeStep === 2 && "Clinical Classifier Dashboard — ACTIVE"}
{activeStep === 3 && "MCP Dispatch Calculator — ACTIVE"}

// NEW
{activeStep === 1 && "Listening to your description — ACTIVE"}
{activeStep === 2 && "Assessing clinical context — ACTIVE"}
{activeStep === 3 && "Calculating routes and wait times — ACTIVE"}
```

- [ ] **Step 7: Verify visually**

```bash
cd webapp && doppler run -- npm run dev
```

Open `http://localhost:5173`. Confirm:
- Mid-page section reads "Why MediCoord AI" / "The right care, without the guesswork"
- Card 1 heading: "Real wait times, not estimates"
- Card 2 heading: "Your symptoms stay private"
- Triage section heading: "From symptom to facility in seconds"
- Step tabs show "You describe it", "We assess it", "We route you there"
- Click through all 3 steps and confirm status bar labels update correctly

- [ ] **Step 8: Commit**

```bash
git add webapp/src/pages/LandingPage.tsx
git commit -m "copy(landing): patient-first mid-page sections and triage showcase"
```

---

### Task 3: Legal Pages — PrivacyPage, CookiesPage, DataDisclosurePage

**Files:**
- Modify: `webapp/src/pages/PrivacyPage.tsx`
- Modify: `webapp/src/pages/CookiesPage.tsx`
- Modify: `webapp/src/pages/DataDisclosurePage.tsx`

- [ ] **Step 1: Update PrivacyPage opening paragraph**

In `webapp/src/pages/PrivacyPage.tsx`, line 7–9, find and replace:
```tsx
// OLD
<p>
  MediCoord AI ("we", "us") helps you describe symptoms and find the
  right nearby healthcare facility. This policy explains what
  information we collect, why, and how it's handled.
</p>

// NEW
<p>
  Your health information is yours. This policy explains exactly what
  MediCoord AI collects when you use the app, why we need it, and how
  it's protected — in plain language.
</p>
```

- [ ] **Step 2: Update PrivacyPage "Children's privacy" section**

Find and replace the heading and its body paragraph:
```tsx
// OLD
<h2>Children's privacy</h2>
<p>
  MediCoord AI is not directed at children under 16, and we do not
  knowingly collect information from them.
</p>

// NEW
<h2>Who this is for</h2>
<p>
  MediCoord AI is designed for adults 16 and over. We do not knowingly
  collect information from anyone under 16.
</p>
```

- [ ] **Step 3: Update CookiesPage opening paragraph**

In `webapp/src/pages/CookiesPage.tsx`, lines 58–61, find and replace:
```tsx
// OLD
<p className="text-sm md:text-body-md text-[#85A4B1] leading-relaxed">
  MediCoord AI does not use advertising, marketing, or cross-site tracking cookies.
  We utilize local browser storage and cloud service cookies solely to maintain secure sessions,
  ensure application stability, and save your coordinate configurations.
</p>

// NEW
<p className="text-sm md:text-body-md text-[#85A4B1] leading-relaxed">
  MediCoord AI uses cookies only for three things: keeping your session secure, keeping the app
  stable, and remembering your map preferences. No advertising. No cross-site tracking.
</p>
```

- [ ] **Step 4: Update CookiesPage "Telemetry" badge to "Analytics"**

In `webapp/src/pages/CookiesPage.tsx`, in the `remoteCookies` array, find and replace:
```tsx
// OLD
{
  name: 'Performance Telemetry',
  service: 'Internal Routing Analytics',
  badge: 'Telemetry',
  badgeClass: 'bg-[#00D2FF]/15 text-[#00D2FF] border-[#00D2FF]/25',
  desc: 'Aggregates completely anonymized routing parameters to analyze transit bottlenecks and improve dispatch suggestions.'
},

// NEW
{
  name: 'Performance Analytics',
  service: 'Internal Routing Analytics',
  badge: 'Analytics',
  badgeClass: 'bg-[#00D2FF]/15 text-[#00D2FF] border-[#00D2FF]/25',
  desc: 'Aggregates completely anonymized routing parameters to analyze transit bottlenecks and improve dispatch suggestions.'
},
```

- [ ] **Step 5: Update DataDisclosurePage opening paragraph**

In `webapp/src/pages/DataDisclosurePage.tsx`, lines 46–49, find and replace:
```tsx
// OLD
<p className="text-sm md:text-body-md text-[#85A4B1] leading-relaxed">
  This page itemizes exactly what data MediCoord AI collects, where it is stored, and who it is shared with for absolute transparency.
  For a comprehensive legal explanation of your rights, please read our <Link to="/privacy">Privacy Policy</Link>.
</p>

// NEW
<p className="text-sm md:text-body-md text-[#85A4B1] leading-relaxed">
  MediCoord AI is built on real Canadian public health data — no simulated locations, no synthetic wait times.
  This page shows exactly what we collect, where it lives, and who can see it. For your legal rights, see our <Link to="/privacy">Privacy Policy</Link>.
</p>
```

- [ ] **Step 6: Update DataDisclosurePage "Active Category" badges**

In `webapp/src/pages/DataDisclosurePage.tsx`, update the `disclosureItems` array. Replace the entire array:
```tsx
// OLD
const disclosureItems = [
  {
    data: 'Email address',
    why: '...',
    stored: '...',
    shared: '...'
  },
  // ... (6 items, all with no badge field — badge is hardcoded in JSX)
]
```

The badge is currently hardcoded in JSX as `Active Category` (around line 86). Find and replace the hardcoded badge span:
```tsx
// OLD
<span className="text-[9px] font-mono text-[#00D2FF] bg-[#00D2FF]/10 px-2 py-0.5 rounded border border-[#00D2FF]/20 font-bold uppercase tracking-wider">
  Active Category
</span>

// NEW — add a badge field to each disclosureItem and render it
```

Add a `badge` field to each item in the `disclosureItems` array:
```tsx
const disclosureItems = [
  {
    data: 'Email address',
    badge: 'Account',
    why: 'Used for account creation, secure authentication, and profile identification.',
    stored: 'Supabase secure cloud database.',
    shared: 'Shared only with Supabase authentication servers.'
  },
  {
    data: 'Symptom descriptions & Triage history',
    badge: 'Sensitive',
    why: 'Used to run symptom analysis, map patient speech to clinical protocols, and save consultation logs.',
    stored: 'Supabase secure cloud database.',
    shared: 'Transmitted securely to the clinical AI language model provider; never used for model training.'
  },
  {
    data: 'Device coordinates & GPS position',
    badge: 'In-session only',
    why: 'Used solely to find nearest emergency rooms and calculate live transit times.',
    stored: 'Not stored. Used in-memory during active requests and discarded.',
    shared: 'Sent to the OSRM/Geoapify routing services to calculate travel time ETAs.'
  },
  {
    data: 'Emergency contact metadata',
    badge: 'Optional',
    why: 'Used only if you manually request the app to generate a shared message link for family contacts.',
    stored: 'Supabase secure cloud database.',
    shared: 'Never shared with any third party; processed only by you in your browser session.'
  },
  {
    data: 'Application diagnostic logs',
    badge: 'Operational',
    why: 'Used to capture front-end rendering exceptions, software crashes, and connection failures.',
    stored: 'Sentry diagnostics registry.',
    shared: 'Shared only with Sentry monitoring servers. Content inputs are masked.'
  },
  {
    data: 'Notification device token',
    badge: 'Optional',
    why: 'Used to route real-time travel alerts and queue updates to your device.',
    stored: 'Supabase database & OneSignal registry.',
    shared: 'Registered only with OneSignal push dispatch servers.'
  }
]
```

Update the type annotation at the top of the component to include `badge`:
```tsx
// The disclosureItems array items now have shape:
// { data: string, badge: string, why: string, stored: string, shared: string }
```

Replace the hardcoded badge span in JSX with the dynamic one:
```tsx
// OLD
<span className="text-[9px] font-mono text-[#00D2FF] bg-[#00D2FF]/10 px-2 py-0.5 rounded border border-[#00D2FF]/20 font-bold uppercase tracking-wider">
  Active Category
</span>

// NEW
<span className="text-[9px] font-mono text-[#00D2FF] bg-[#00D2FF]/10 px-2 py-0.5 rounded border border-[#00D2FF]/20 font-bold uppercase tracking-wider">
  {item.badge}
</span>
```

- [ ] **Step 7: Verify visually**

```bash
cd webapp && doppler run -- npm run dev
```

Navigate to:
- `http://localhost:5173/privacy` — confirm new opening paragraph and "Who this is for" section heading
- `http://localhost:5173/cookies` — confirm new opening paragraph and "Analytics" badge
- `http://localhost:5173/data-disclosure` — confirm new opening paragraph and per-row badge labels (Account, Sensitive, In-session only, Optional, Operational, Optional)

- [ ] **Step 8: Commit**

```bash
git add webapp/src/pages/PrivacyPage.tsx webapp/src/pages/CookiesPage.tsx webapp/src/pages/DataDisclosurePage.tsx
git commit -m "copy(legal): patient-first copy for privacy, cookies, and data disclosure pages"
```

---

### Task 4: SEO — index.html Meta Tags + DataDisclosurePage FAQ Schema

**Files:**
- Modify: `webapp/index.html`
- Modify: `webapp/src/pages/DataDisclosurePage.tsx`

- [ ] **Step 1: Update index.html title**

In `webapp/index.html`, line 29, find and replace:
```html
<!-- OLD -->
<title>MediCoord AI — Find the Right Care, Right Now</title>

<!-- NEW -->
<title>Find Urgent Care &amp; ERs Near You — MediCoord AI Toronto</title>
```

- [ ] **Step 2: Update index.html meta description**

In `webapp/index.html`, line 30, find and replace:
```html
<!-- OLD -->
<meta name="description" content="Describe your symptoms and MediCoord AI matches you to the nearest right-fit healthcare facility, with live directions and arrival time — no guesswork." />

<!-- NEW -->
<meta name="description" content="Describe your symptoms and MediCoord AI finds the nearest clinic, urgent care, or ER in Toronto with real wait times. Know where to go before you go." />
```

- [ ] **Step 3: Add Open Graph tags to index.html**

After the meta description line, add:
```html
<meta property="og:title" content="Find Urgent Care &amp; ERs Near You — MediCoord AI Toronto" />
<meta property="og:description" content="Describe your symptoms and MediCoord AI finds the nearest clinic, urgent care, or ER in Toronto with real wait times. Know where to go before you go." />
<meta property="og:type" content="website" />
```

- [ ] **Step 4: Add FAQ structured data to DataDisclosurePage**

In `webapp/src/pages/DataDisclosurePage.tsx`, add the following FAQ schema at the bottom of the `LegalPageLayout` content, after the final closing paragraph. Add it as a React fragment with a `<script>` tag:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
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
        },
        {
          "@type": "Question",
          "name": "Can MediCoord AI see my symptom descriptions?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Your symptom descriptions are transmitted securely to an AI language model to generate the triage assessment. They are stored in your conversation history in our database but are never used to train any AI model."
          }
        },
        {
          "@type": "Question",
          "name": "Who can see my MediCoord AI data?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Only you and our service backend can access your records. Data is shared only with the service providers that make the app work: Supabase for storage, Sentry for error tracking, OneSignal for push notifications, and the AI provider for symptom triage."
          }
        },
        {
          "@type": "Question",
          "name": "Is my emergency contact shared with anyone?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. Emergency contact metadata is never shared with any third party. It is processed only by you in your browser session when you choose to generate a message link."
          }
        },
        {
          "@type": "Question",
          "name": "Does MediCoord AI sell my data?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. MediCoord AI does not sell any data and does not use it for commercial advertisement."
          }
        }
      ]
    })
  }}
/>
```

- [ ] **Step 5: Verify**

```bash
cd webapp && doppler run -- npm run dev
```

- Open browser DevTools → Elements, confirm the `<title>` in `<head>` reads "Find Urgent Care & ERs Near You — MediCoord AI Toronto"
- Navigate to `http://localhost:5173/data-disclosure`, open DevTools → Elements, confirm a `<script type="application/ld+json">` with FAQ schema appears inside the page

- [ ] **Step 6: Commit**

```bash
git add webapp/index.html webapp/src/pages/DataDisclosurePage.tsx
git commit -m "seo: update meta tags and add FAQ structured data to data disclosure page"
```
