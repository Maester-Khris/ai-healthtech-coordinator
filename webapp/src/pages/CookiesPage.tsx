import { LegalPageLayout } from '../components/legal/LegalPageLayout'

export default function CookiesPage() {
  const remoteCookies = [
    {
      name: 'Secure Session Token',
      service: 'Supabase',
      badge: 'Essential',
      badgeClass: 'bg-[#FF7B93]/15 text-[#FF7B93] border-[#FF7B93]/25',
      desc: 'Keeps your user session authenticated and logged in securely between visits.'
    },
    {
      name: 'Stability & Bug Diagnostics',
      service: 'Sentry',
      badge: 'Essential',
      badgeClass: 'bg-[#FF7B93]/15 text-[#FF7B93] border-[#FF7B93]/25',
      desc: 'Monitors software stability and isolates code crashes. All input parameters and messages are fully masked.'
    },
    {
      name: 'Performance Analytics',
      service: 'Internal Routing Analytics',
      badge: 'Analytics',
      badgeClass: 'bg-[#00D2FF]/15 text-[#00D2FF] border-[#00D2FF]/25',
      desc: 'Aggregates completely anonymized routing parameters to analyze transit bottlenecks and improve dispatch suggestions.'
    },
    {
      name: 'Alert Subscriptions',
      service: 'OneSignal',
      badge: 'Optional',
      badgeClass: 'bg-[#7AA0B0]/15 text-[#7AA0B0] border-[#7AA0B0]/25',
      desc: 'Saves your anonymous device credentials to deliver real-time dispatch alerts (only active if notifications are allowed).'
    }
  ]

  const localCookies = [
    {
      name: 'App Configuration Preferences',
      badge: 'Functional',
      badgeClass: 'bg-[#48F6C1]/15 text-[#48F6C1] border-[#48F6C1]/25',
      desc: 'Remembers interactive state choices, such as dismissed tutorials and menu states, so you are not asked repeatedly.'
    },
    {
      name: 'Triage Assessment History',
      badge: 'Functional',
      badgeClass: 'bg-[#48F6C1]/15 text-[#48F6C1] border-[#48F6C1]/25',
      desc: 'Caches your active symptom check inputs locally so you can review options without starting over.'
    },
    {
      name: 'Map Focus Settings',
      badge: 'Functional',
      badgeClass: 'bg-[#48F6C1]/15 text-[#48F6C1] border-[#48F6C1]/25',
      desc: 'Stores your preferred map coordinates and zoom perspective to load your home city immediately on launch.'
    }
  ]

  return (
    <LegalPageLayout
      title="Cookie Policy"
      description="What cookies and similar technologies MediCoord AI uses, what each one does, and how to control them."
      lastUpdated="June 24, 2026"
    >
      <p className="text-sm md:text-body-md text-[#85A4B1] leading-relaxed">
        MediCoord AI uses cookies only for three things: keeping your session secure, keeping the app
        stable, and remembering your map preferences. No advertising. No cross-site tracking.
      </p>

      <h2 className="text-white text-lg font-bold mt-10 mb-4 border-b border-[#1C4659]/30 pb-2">
        Remote Cloud Services
      </h2>
      <p className="text-xs text-[#7AA0B0] mb-4">
        These tokens connect securely to cloud services to enable live authentication, stability tracking, and alerting features.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        {remoteCookies.map((item) => (
          <div key={item.name} className="border border-[#1C4659]/45 bg-[#061219]/60 rounded-xl p-5 flex flex-col gap-3 shadow-md hover:border-[#1C4659]/80 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-white leading-snug">{item.name}</span>
                <span className="text-[10px] font-mono text-[#7AA0B0]">{`Service: ${item.service}`}</span>
              </div>
              <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${item.badgeClass}`}>
                {item.badge}
              </span>
            </div>
            <p className="text-xs text-[#85A4B1] leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <h2 className="text-white text-lg font-bold mt-10 mb-4 border-b border-[#1C4659]/30 pb-2">
        Local Browser Memory
      </h2>
      <p className="text-xs text-[#7AA0B0] mb-4">
        These parameters reside strictly within your local browser storage and do not get transmitted to any cloud servers.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        {localCookies.map((item) => (
          <div key={item.name} className="border border-[#1C4659]/45 bg-[#061219]/60 rounded-xl p-5 flex flex-col gap-3 shadow-md hover:border-[#1C4659]/80 transition-all">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-bold text-white leading-snug">{item.name}</span>
              <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${item.badgeClass}`}>
                {item.badge}
              </span>
            </div>
            <p className="text-xs text-[#85A4B1] leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <h2 className="text-white text-lg font-bold mt-10 mb-4 border-b border-[#1C4659]/30 pb-2">
        How to control this
      </h2>
      <p className="text-sm md:text-body-md text-[#85A4B1] leading-relaxed">
        You can clear cookies and local storage for this site at any time in
        your browser settings — you'll simply be signed out and your preferences will
        reset to default. Disabling push notifications removes the subscription
        identifier. Optional preferences can also be managed dynamically through the
        Privacy &amp; Performance settings controller on our landing page.
      </p>
    </LegalPageLayout>
  )
}
