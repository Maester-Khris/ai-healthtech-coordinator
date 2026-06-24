import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function CookiesPage() {
  return (
    <LegalPageLayout title="Cookie Policy" lastUpdated="June 24, 2026">
      <p>
        MediCoord AI does not use advertising or cross-site tracking cookies.
        We use cookies and browser local storage to provide secure authentication sessions,
        track critical application performance, and remember your personalized map coordinate
        and triage preferences to optimize routing suggestions.
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
          <tr><td>Zoom coordinate preferences</td><td>Saves your last searched coordinate map zoom layer to avoid re-typing your region</td><td>Optional (preferences)</td></tr>
          <tr><td>Triage filter history</td><td>Remembers your triage filter parameters to prioritize nearest facilities</td><td>Optional (preferences)</td></tr>
          <tr><td>Anonymized transit ETAs</td><td>Improves AI routing suggestions using fully anonymized transit parameters</td><td>Optional (preferences)</td></tr>
        </tbody>
      </table>

      <h2>How to control this</h2>
      <p>
        You can clear cookies and local storage for this site at any time in
        your browser settings — you'll simply be signed out and your preferences will
        reset to default. Disabling push notifications removes the subscription
        identifier. Optional preferences can also be managed dynamically through the
        Privacy &amp; Performance preferences controller on our home page.
      </p>
    </LegalPageLayout>
  )
}

