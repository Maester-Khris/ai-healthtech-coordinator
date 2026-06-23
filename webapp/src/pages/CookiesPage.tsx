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
