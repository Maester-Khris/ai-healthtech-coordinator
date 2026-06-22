# Landing Page + Legal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current behavior where `/` renders the app directly for every visitor with a real marketing landing page at `/`, move the app to `/app`, and add three legal pages (`/privacy`, `/cookies`, `/data-disclosure`).

**Architecture:** Pure React Router changes plus new page components — no new state management, no backend changes. `App.tsx` gains a `LandingRoute` wrapper that redirects authenticated users straight to `/app` and shows the new `LandingPage` otherwise. Three new legal pages share one layout component. `WebNavBar`/`MobileNavBar`'s logo links move from `/` to `/app` since `/` no longer means "the app."

**Tech Stack:** React 19 + react-router-dom v6 (already in use), Tailwind v4 design-system tokens from sub-project 1 (`stratum-*`, `severity-*`, `surface-card`, `shell-bezel` utilities — already in `webapp/src/index.css`).

## Global Constraints

- Reuse the existing `LoginModal` for Sign in / Get started — do not build a new auth UI.
- No fabricated stats, testimonials, or medical-authority claims ("diagnose") in landing copy — match the literal copy in Task 2 verbatim.
- Legal page content must accurately describe the app's actual current data flows (Supabase auth, browser geolocation, emergency contact, chat/triage storage, Sentry, OneSignal) — no invented data practices.
- No new npm dependencies.
- No blocking cookie-consent banner (per design spec: nothing collected today is optional/advertising, so a static disclosure page is the correct scope — do not add a consent banner or preference center).

---

### Task 1: Legal pages (shared layout + 3 pages + routes)

**Files:**
- Create: `webapp/src/components/legal/LegalPageLayout.tsx`
- Create: `webapp/src/pages/PrivacyPage.tsx`
- Create: `webapp/src/pages/CookiesPage.tsx`
- Create: `webapp/src/pages/DataDisclosurePage.tsx`
- Modify: `webapp/src/App.tsx` (add three routes only — no other changes in this task)

**Interfaces:**
- Produces: `LegalPageLayout` component with props `{ title: string; lastUpdated: string; children: ReactNode }`, rendering a centered content column with an `<h1>{title}</h1>`, a "Last updated: {lastUpdated}" line, a back-to-home link, and `{children}` as the body. Routes `/privacy`, `/cookies`, `/data-disclosure` — consumed by Task 2's footer links and Task 3's routing.

- [ ] **Step 1: Create the shared legal page layout**

Create `webapp/src/components/legal/LegalPageLayout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface LegalPageLayoutProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-stratum-bg">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link to="/" className="text-body-md text-stratum-text-muted no-underline hover:underline">
          ← Back to home
        </Link>
        <h1 className="text-display-md mt-6 mb-1 text-stratum-text">{title}</h1>
        <p className="text-body-md text-stratum-text-muted mb-8">Last updated: {lastUpdated}</p>
        <div className="text-body-md text-stratum-text space-y-6 [&_h2]:text-label-md [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-stratum-accent-2 [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_table]:w-full [&_table]:border-collapse [&_th]:text-label-md [&_th]:text-left [&_th]:border-b [&_th]:border-stratum-border [&_th]:py-2 [&_td]:border-b [&_td]:border-stratum-border [&_td]:py-2 [&_td]:align-top">
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the Privacy Policy page**

Create `webapp/src/pages/PrivacyPage.tsx`:

```tsx
import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="June 22, 2026">
      <p>
        MediCoord AI ("we", "us") helps you describe symptoms and find the
        right nearby healthcare facility. This policy explains what
        information we collect, why, and how it's handled.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information</strong> — your email address, and if you sign in with Google, the basic profile info Google shares with us.</li>
        <li><strong>What you describe in chat</strong> — the symptoms and messages you send, plus the severity assessment and facility recommendation generated in response.</li>
        <li><strong>Location</strong> — your device's location, only if you grant permission, used to find facilities near you and calculate travel time.</li>
        <li><strong>Emergency contact</strong> — a name and phone number you optionally provide, used only when you choose to message that contact yourself.</li>
        <li><strong>Device and usage data</strong> — basic error and performance data collected automatically to keep the app working (see "Error tracking" below).</li>
        <li><strong>Push notification subscription</strong> — if you enable notifications, a subscription identifier used to deliver them.</li>
      </ul>

      <h2>How we use your information</h2>
      <p>
        We use this information to assess the severity of what you describe,
        find and route you to an appropriate facility, maintain your
        conversation history so you can return to it, and keep the app
        secure and working reliably. Your symptom descriptions are sent to a
        third-party AI language model provider solely to generate the
        severity assessment and conversational response — they are not used
        to train any model on our behalf.
      </p>

      <h2>How we store your information</h2>
      <p>
        Your account, profile, and conversation data are stored in our
        database (Supabase) with row-level security, meaning only you (and
        our service backend) can access your records. We use Sentry for
        error tracking and session replay; session replay masks all text
        content, so it never captures what you typed.
      </p>

      <h2>Who we share information with</h2>
      <p>
        We do not sell your information or share it for advertising. We
        share data only with the service providers that make the app work:
        Supabase (database and authentication), Sentry (error tracking),
        OneSignal (push notifications), and the AI language model provider
        used for symptom triage. Each only receives what it needs to perform
        its function.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can disable location access at any time in your browser or device settings — the app will still work, but can't route you to nearby facilities.</li>
        <li>You can disable push notifications at any time in your browser or device settings.</li>
        <li>You can sign out at any time from the account menu.</li>
        <li>To request access to or deletion of your data, contact us using the details below.</li>
      </ul>

      <h2>Children's privacy</h2>
      <p>
        MediCoord AI is not directed at children under 16, and we do not
        knowingly collect information from them.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change how we collect or use information, we'll update this
        page and change the "Last updated" date above.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions about this policy or your data? Reach out through the
        contact details on our home page.
      </p>
    </LegalPageLayout>
  )
}
```

- [ ] **Step 3: Create the Cookie Policy page**

Create `webapp/src/pages/CookiesPage.tsx`:

```tsx
import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function CookiesPage() {
  return (
    <LegalPageLayout title="Cookie Policy" lastUpdated="June 22, 2026">
      <p>
        MediCoord AI does not use advertising or cross-site tracking
        cookies. We don't show you a cookie consent banner because
        everything we store today is functionally necessary for the app to
        work — there's nothing optional to ask your consent for. If that
        changes, we'll update this page and add a consent option.
      </p>

      <h2>What we store, and why</h2>
      <table>
        <thead>
          <tr><th>What</th><th>Purpose</th><th>Type</th></tr>
        </thead>
        <tbody>
          <tr><td>Supabase auth session</td><td>Keeps you signed in between visits</td><td>Necessary</td></tr>
          <tr><td>Sentry error &amp; session data</td><td>Detects and helps us fix bugs (text is always masked)</td><td>Necessary</td></tr>
          <tr><td>OneSignal push subscription ID</td><td>Delivers notifications, only if you opt in</td><td>Functional (opt-in)</td></tr>
          <tr><td>Local UI preferences (e.g. dismissed prompts)</td><td>Avoids re-showing the same prompt repeatedly</td><td>Necessary</td></tr>
        </tbody>
      </table>

      <h2>How to control this</h2>
      <p>
        You can clear cookies and local storage for this site at any time in
        your browser settings — you'll simply be signed out and prompts will
        reappear. Disabling push notifications removes the subscription
        identifier.
      </p>
    </LegalPageLayout>
  )
}
```

- [ ] **Step 4: Create the Data Disclosure page**

Create `webapp/src/pages/DataDisclosurePage.tsx`:

```tsx
import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function DataDisclosurePage() {
  return (
    <LegalPageLayout title="Data Disclosure" lastUpdated="June 22, 2026">
      <p>
        This page itemizes exactly what data MediCoord AI collects, in one
        place, for transparency. For the full narrative explanation of your
        rights and choices, see our <a href="/privacy">Privacy Policy</a>.
      </p>

      <table>
        <thead>
          <tr><th>Data</th><th>Why we collect it</th><th>Stored in</th><th>Shared with</th></tr>
        </thead>
        <tbody>
          <tr><td>Email address</td><td>Account creation and sign-in</td><td>Supabase</td><td>Supabase only</td></tr>
          <tr><td>Chat messages &amp; triage results</td><td>Symptom assessment and routing, conversation history</td><td>Supabase</td><td>AI language model provider (to generate the assessment), Supabase</td></tr>
          <tr><td>Device location</td><td>Finding nearby facilities and travel time, only if you grant permission</td><td>Not stored — used live, per request</td><td>Routing service (to calculate travel time)</td></tr>
          <tr><td>Emergency contact name &amp; phone</td><td>Only used when you choose to message that contact yourself</td><td>Supabase</td><td>Not shared — used only by you, in your browser</td></tr>
          <tr><td>Error &amp; performance data</td><td>Detecting and fixing bugs</td><td>Sentry</td><td>Sentry only</td></tr>
          <tr><td>Push notification subscription ID</td><td>Delivering notifications, only if you opt in</td><td>Supabase, OneSignal</td><td>OneSignal only</td></tr>
        </tbody>
      </table>

      <p>
        We do not sell any of the above, and we do not use it for
        advertising.
      </p>
    </LegalPageLayout>
  )
}
```

- [ ] **Step 5: Wire the three routes in `App.tsx`**

In `webapp/src/App.tsx`, add the import lines alongside the existing page imports (after the `SandboxPage` import):

```tsx
import PrivacyPage from './pages/PrivacyPage'
import CookiesPage from './pages/CookiesPage'
import DataDisclosurePage from './pages/DataDisclosurePage'
```

Then add three routes inside the `<Routes>` block, alongside the existing `<Route path="/sandbox" .../>` line:

```tsx
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cookies" element={<CookiesPage />} />
            <Route path="/data-disclosure" element={<DataDisclosurePage />} />
```

- [ ] **Step 6: Build and manually verify routes resolve**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/components/legal webapp/src/pages/PrivacyPage.tsx webapp/src/pages/CookiesPage.tsx webapp/src/pages/DataDisclosurePage.tsx webapp/src/App.tsx
git commit -m "feat(legal): add privacy, cookie, and data disclosure pages"
```

---

### Task 2: Landing page

**Files:**
- Create: `webapp/src/pages/LandingPage.tsx`

**Interfaces:**
- Consumes: `LoginModal` (`webapp/src/components/auth/LoginModal.tsx`, props `{ isOpen, onClose, defaultTab? }`), design-system utilities from sub-project 1 (`bg-stratum-bg`, `text-stratum-text`, `surface-card`, `shell-bezel`, `text-display-lg`, `text-body-md`, etc.).
- Produces: default-exported `LandingPage` component — consumed by Task 3's routing.

- [ ] **Step 1: Create the landing page**

Create `webapp/src/pages/LandingPage.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoginModal } from '../components/auth/LoginModal'

const STEPS = [
  {
    title: 'Describe your symptoms',
    body: 'Tell us what’s going on in plain language. No forms, no symptom checklists.',
  },
  {
    title: 'Get an instant severity check',
    body: 'MediCoord AI reviews what you’ve described and determines how urgent it is.',
  },
  {
    title: 'Get routed to the right place',
    body: 'See the nearest facility equipped to treat you, with a live map and arrival time.',
  },
]

const FEATURES = [
  {
    title: 'One chat, one map',
    body: 'Describe your symptoms and watch your route appear on the same screen — no switching between a search engine and a directions app.',
  },
  {
    title: 'Severity-aware routing',
    body: 'MediCoord AI tells routine concerns apart from urgent ones, so you’re matched to a facility actually equipped to help — not just the closest one.',
  },
  {
    title: 'Stay in the loop',
    body: 'Get notified if your situation or facility status changes, so you’re not left checking back manually.',
  },
]

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'signin' | 'signup'>('signin')

  const openSignIn = () => { setModalTab('signin'); setIsModalOpen(true) }
  const openSignUp = () => { setModalTab('signup'); setIsModalOpen(true) }

  return (
    <div className="bg-stratum-bg min-h-screen">
      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} defaultTab={modalTab} />

      <header className="flex items-center justify-between px-8 h-16 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-stratum-md overflow-hidden flex-none">
            <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
          </div>
          <span className="text-label-md text-stratum-text">MediCoord AI</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={openSignIn} className="text-body-md text-stratum-text-muted hover:text-stratum-text">
            Sign in
          </button>
          <button
            onClick={openSignUp}
            className="px-5 py-2.5 text-label-md text-white rounded-stratum-control bg-stratum-accent hover:opacity-90 transition-opacity"
          >
            Get started
          </button>
        </div>
      </header>

      <main>
        <section className="max-w-3xl mx-auto px-8 pt-16 pb-20 text-center">
          <h1 className="text-display-lg text-stratum-text">Know where to go,<br />before you go.</h1>
          <p className="text-body-md text-stratum-text-muted mt-6 max-w-xl mx-auto">
            Describe how you’re feeling, and MediCoord AI matches your symptoms to the right nearby
            facility — with a live route and arrival time, not just a search result.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={openSignUp}
              className="px-6 py-3 text-label-md text-white rounded-stratum-control bg-stratum-accent hover:opacity-90 transition-opacity"
            >
              Get started
            </button>
            <button onClick={openSignIn} className="px-6 py-3 text-label-md text-stratum-text-muted hover:text-stratum-text">
              Sign in
            </button>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-8 py-16">
          <h2 className="text-label-md uppercase tracking-wide text-stratum-accent-2 text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.title} className="surface-card shell-bezel rounded-stratum-lg p-6">
                <span className="text-label-md text-stratum-accent-2">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="text-label-md text-stratum-text mt-2 mb-1">{step.title}</h3>
                <p className="text-body-md text-stratum-text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-8 py-16">
          <h2 className="text-label-md uppercase tracking-wide text-stratum-accent-2 text-center mb-10">What you get</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="surface-card shell-bezel rounded-stratum-lg p-6">
                <h3 className="text-label-md text-stratum-text mb-1">{feature.title}</h3>
                <p className="text-body-md text-stratum-text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-2xl mx-auto px-8 py-16 text-center">
          <p className="text-body-md text-stratum-text-muted">
            Your symptoms and location are used only to find you care — never sold, never shared for
            advertising. Read our <Link to="/privacy" className="text-stratum-accent-2 underline">Privacy Policy</Link> to
            see exactly what we store and why.
          </p>
        </section>
      </main>

      <footer className="border-t border-stratum-border">
        <div className="max-w-5xl mx-auto px-8 h-14 flex items-center justify-between text-body-md text-stratum-text-muted">
          <span>MediCoord AI · Health Tech Platform</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-stratum-text-muted hover:text-stratum-text no-underline">Privacy</Link>
            <Link to="/cookies" className="text-stratum-text-muted hover:text-stratum-text no-underline">Cookies</Link>
            <Link to="/data-disclosure" className="text-stratum-text-muted hover:text-stratum-text no-underline">Data Disclosure</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
```

Note: the `‘`/`’`/`—`/`·` escapes above are literal typographic characters (curly apostrophes, em dash, middot) — write them as the actual Unicode characters in the file, not as the escape sequences.

- [ ] **Step 2: Build**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/pages/LandingPage.tsx
git commit -m "feat(landing): add marketing landing page"
```

---

### Task 3: Routing — landing at `/`, app moves to `/app`

**Files:**
- Modify: `webapp/src/App.tsx`
- Modify: `webapp/src/components/WebNavBar.tsx`
- Modify: `webapp/src/components/mobile/MobileNavBar.tsx`

**Interfaces:**
- Consumes: `LandingPage` (Task 2), `useAuth()` (`webapp/src/auth/useAuth.ts`, returns `{ user, loading, ... }`).

- [ ] **Step 1: Add the `LandingRoute` wrapper and rewire routes in `App.tsx`**

In `webapp/src/App.tsx`, add this import alongside the other page imports:

```tsx
import LandingPage from './pages/LandingPage'
import { Navigate } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
```

Add this component above `function App()`:

```tsx
function LandingRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/app" replace />
  return <LandingPage />
}
```

Replace the `<Routes>` block's catch-all and add the landing/app routes — the full block should read:

```tsx
          <Routes>
            <Route path="/" element={<LandingRoute />} />
            <Route path="/app" element={<AppInner />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/testlocation" element={<TestLocationPage />} />
            <Route path="/sandbox" element={<SandboxPage />} />
            <Route path="/test-notif" element={<TestNotifPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cookies" element={<CookiesPage />} />
            <Route path="/data-disclosure" element={<DataDisclosurePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
```

(`LandingRoute` must be used inside `<BrowserRouter>`/inside `<AuthProvider>` — both already wrap `<Routes>` in this file, so no structural change needed beyond the routes themselves.)

- [ ] **Step 2: Point `WebNavBar`'s logo link at `/app` instead of `/`**

In `webapp/src/components/WebNavBar.tsx`, find:

```tsx
      <Link to="/" className="flex items-center gap-3 no-underline">
```

Replace with:

```tsx
      <Link to="/app" className="flex items-center gap-3 no-underline">
```

(This is the only change in this file — `WebNavBar` is only ever rendered inside the authenticated app shell, so its logo should return to the app, not bounce the user out to the public landing page.)

- [ ] **Step 3: Point `MobileNavBar`'s logo link at `/app` instead of `/`**

In `webapp/src/components/mobile/MobileNavBar.tsx`, find:

```tsx
        <Link to="/" className="flex items-center gap-2 no-underline">
```

Replace with:

```tsx
        <Link to="/app" className="flex items-center gap-2 no-underline">
```

- [ ] **Step 4: Build**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/App.tsx webapp/src/components/WebNavBar.tsx webapp/src/components/mobile/MobileNavBar.tsx
git commit -m "feat(routing): move app to /app, add landing page at /"
```

---

### Task 4: SEO technical structure + final verification

**Files:**
- Modify: `webapp/index.html`
- Create: `webapp/public/llms.txt`

**Interfaces:** none (static head content + a static text file; no component interfaces produced or consumed).

This is a client-rendered SPA with no SSR/prerendering — the only content guaranteed visible to crawlers that don't execute JavaScript is what's statically present in `index.html`'s `<head>`. The JSON-LD block below is added there for exactly that reason. The actual landing page heading hierarchy (Task 2's single `<h1>`, `<h2>` section headers, `<h3>` per item) already satisfies the semantic-structure recommendation for crawlers that do execute JS — no further markup changes needed for that part.

- [ ] **Step 1: Update the document head**

In `webapp/index.html`, replace the `<title>` line:

```html
  <title>Health coordinator</title>
```

with:

```html
  <title>MediCoord AI — Find the Right Care, Right Now</title>
  <meta name="description" content="Describe your symptoms and MediCoord AI matches you to the nearest right-fit healthcare facility, with live directions and arrival time — no guesswork." />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "MediCoord AI",
    "applicationCategory": "HealthApplication",
    "description": "Describe your symptoms and get matched to the nearest right-fit healthcare facility, with live directions and arrival time.",
    "url": "https://medicoordai.com"
  }
  </script>
```

(The `url` field above is a placeholder production domain — per the changelog, the Vercel production domain isn't finalized yet. Leave it as written; update it once the real production domain is confirmed, it's a one-line JSON value.)

- [ ] **Step 2: Add `llms.txt`**

Create `webapp/public/llms.txt`:

```
# MediCoord AI

MediCoord AI is a healthtech web app. Users describe symptoms in a chat
interface; an AI model classifies the severity (routine, moderate, urgent,
or emergent) and the app routes the user to the nearest healthcare facility
equipped to treat them, showing a live map with driving directions and
arrival time. Push notifications are available for follow-up.

MediCoord AI does not provide medical diagnoses and is not a substitute for
emergency services — for life-threatening emergencies, users should call
emergency services directly.

## Key pages

- / — Landing page and product overview
- /privacy — Privacy Policy
- /cookies — Cookie Policy
- /data-disclosure — Itemized data disclosure
```

- [ ] **Step 3: Build**

Run: `cd webapp && npx tsc -b && npx vite build`
Expected: both succeed with no errors.

- [ ] **Step 4: Playwright verification of all new routes**

Use the `playwright-cli` skill (there is no Playwright MCP server in this environment — use the skill directly) against the dev server:

1. Navigate to `/` — confirm the page shows the landing hero headline "Know where to go, before you go." (not the map/chat app shell).
2. Click "Get started" — confirm the `LoginModal` opens with the signup tab active.
3. Close the modal, navigate to `/privacy`, `/cookies`, `/data-disclosure` — confirm each renders its own `<h1>` title and back-to-home link works.
4. Navigate to `/app` directly — confirm the existing map/chat app shell still renders (unchanged behavior).
5. Navigate to a nonsense path like `/this-does-not-exist` — confirm it redirects to `/`.

Take one screenshot of `/` for the record. No defects expected; if any step fails, treat it as a real bug in this task's routing/component code and fix it before reporting done.

- [ ] **Step 5: Commit (only if a fix was needed)**

If verification passed with no fixes needed, there is nothing to commit for this task.

---

## Self-Review Notes

- **Spec coverage:** Landing page (hero, how-it-works, features, trust note, footer) → Task 2. Three legal pages → Task 1. Routing change (`/` → landing, app → `/app`, redirect logged-in users) → Task 3. SEO technical structure → Task 4. Copy matches the copywriting-skill draft verbatim (Task 2). Legal content matches the spec's documented data flows exactly (Task 1).
- **Placeholder scan:** none, except the explicitly-flagged, intentional production-domain placeholder in Task 4 Step 1 (documented as such, with the reason and how to fix it later).
- **Type consistency:** `LegalPageLayout` props used identically across all three legal pages (Task 1). `LandingRoute`'s `useAuth()` usage matches the real `AuthContextValue` interface (`user`, `loading`) confirmed against `webapp/src/auth/AuthContext.tsx`. `WebNavBar`/`MobileNavBar` link changes don't alter either component's props or any caller.
