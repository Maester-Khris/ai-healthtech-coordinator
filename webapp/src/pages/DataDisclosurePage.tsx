import { Link } from 'react-router-dom'
import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function DataDisclosurePage() {
  return (
    <LegalPageLayout title="Data Disclosure" lastUpdated="June 24, 2026">
      <p>
        This page itemizes exactly what data MediCoord AI collects, in one
        place, for transparency. For the full narrative explanation of your
        rights and choices, see our <Link to="/privacy">Privacy Policy</Link>.
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

