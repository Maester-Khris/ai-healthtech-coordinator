import { Link } from 'react-router-dom'
import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function DataDisclosurePage() {
  const disclosureItems = [
    {
      data: 'Email address',
      why: 'Used for account creation, secure authentication, and profile identification.',
      stored: 'Supabase secure cloud database.',
      shared: 'Shared only with Supabase authentication servers.'
    },
    {
      data: 'Symptom descriptions & Triage history',
      why: 'Used to run symptom analysis, map patient speech to clinical protocols, and save consultation logs.',
      stored: 'Supabase secure cloud database.',
      shared: 'Transmitted securely to the clinical AI language model provider; never used for model training.'
    },
    {
      data: 'Device coordinates & GPS position',
      why: 'Used solely to find nearest emergency rooms and calculate live transit times.',
      stored: 'Not stored. Used in-memory during active requests and discarded.',
      shared: 'Sent to the OSRM/Geoapify routing services to calculate travel time ETAs.'
    },
    {
      data: 'Emergency contact metadata',
      why: 'Used only if you manually request the app to generate a shared message link for family contacts.',
      stored: 'Supabase secure cloud database.',
      shared: 'Never shared with any third party; processed only by you in your browser session.'
    },
    {
      data: 'Application diagnostic logs',
      why: 'Used to capture front-end rendering exceptions, software crashes, and connection failures.',
      stored: 'Sentry diagnostics registry.',
      shared: 'Shared only with Sentry monitoring servers. Content inputs are masked.'
    },
    {
      data: 'Notification device token',
      why: 'Used to route real-time travel alerts and queue updates to your device.',
      stored: 'Supabase database & OneSignal registry.',
      shared: 'Registered only with OneSignal push dispatch servers.'
    }
  ]

  return (
    <LegalPageLayout title="Data Disclosure" lastUpdated="June 24, 2026">
      <p className="text-sm md:text-body-md text-[#85A4B1] leading-relaxed">
        This page itemizes exactly what data MediCoord AI collects, where it is stored, and who it is shared with for absolute transparency.
        For a comprehensive legal explanation of your rights, please read our <Link to="/privacy">Privacy Policy</Link>.
      </p>

      {/* Prominent Canadian Sourcing Alert Card */}
      <div className="my-8 border border-[#48F6C1]/30 bg-[#48F6C1]/5 rounded-xl p-5 md:p-6 flex flex-col gap-3">
        <span className="text-[10px] font-mono font-bold text-[#48F6C1] uppercase tracking-widest">
          Canadian Clinical Data Integrations & Sources
        </span>
        <h3 className="text-white text-md font-bold leading-snug">
          Real Regional Telemetry Sourcing
        </h3>
        <p className="text-xs text-[#85A4B1] leading-relaxed">
          MediCoord AI relies entirely on authentic geographical and medical coordinates.
          All hospital locations, clinical resources, wait time estimations, and routing nodes are fetched directly from public Canadian sources, including:
        </p>
        <ul className="list-disc pl-5 text-xs text-[#E2F1F5] space-y-1 mt-1 font-sans">
          <li><strong>Health Ontario Directory</strong> (hospital capabilities, specialized care classifications)</li>
          <li><strong>City of Toronto Open Data Portal</strong> (emergency facilities, public medical centers)</li>
          <li><strong>Metropolitan Toronto Transit Telemetry</strong> (transit times, street routes, and traffic datasets)</li>
        </ul>
        <p className="text-xs text-[#7AA0B0] leading-relaxed italic mt-1">
          No coordinates, patient distributions, or facility parameters are simulated; they match real-world Canadian public healthcare configurations.
        </p>
      </div>

      <h2 className="text-white text-lg font-bold mt-10 mb-4 border-b border-[#1C4659]/30 pb-2">
        Data Collection Directory
      </h2>
      <p className="text-xs text-[#7AA0B0] mb-4">
        Below is the exhaustive directory of data elements processed by our application.
      </p>

      <div className="flex flex-col gap-4 my-6">
        {disclosureItems.map((item) => (
          <div key={item.data} className="border border-[#1C4659]/45 bg-[#061219]/60 rounded-xl p-5 md:p-6 flex flex-col gap-4 hover:border-[#1C4659]/80 transition-all">
            <div className="flex items-center justify-between border-b border-[#1C4659]/30 pb-2.5">
              <span className="text-sm font-bold text-white leading-snug">{item.data}</span>
              <span className="text-[9px] font-mono text-[#00D2FF] bg-[#00D2FF]/10 px-2 py-0.5 rounded border border-[#00D2FF]/20 font-bold uppercase tracking-wider">
                Active Category
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="flex flex-col gap-1">
                <span className="text-[#7AA0B0] text-[9.5px] uppercase tracking-wider">Purpose:</span>
                <span className="text-[#85A4B1] font-sans text-xs leading-relaxed">{item.why}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[#7AA0B0] text-[9.5px] uppercase tracking-wider">Storage Target:</span>
                <span className="text-white font-sans text-xs leading-relaxed">{item.stored}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[#7AA0B0] text-[9.5px] uppercase tracking-wider">Sharing Limit:</span>
                <span className="text-white font-sans text-xs leading-relaxed">{item.shared}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm md:text-body-md text-[#85A4B1] leading-relaxed mt-8">
        We do not sell any of the above metadata or telemetry, and we do not use it for commercial advertisement.
      </p>
    </LegalPageLayout>
  )
}
