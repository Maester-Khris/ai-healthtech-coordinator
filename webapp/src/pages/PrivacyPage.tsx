import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="June 24, 2026">
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
