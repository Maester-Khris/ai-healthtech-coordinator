import { useState } from "react"

interface GeoProps {
  requestOnce: () => Promise<{ lat: number; lng: number } | null>
  setCoords: (coords: { lat: number; lng: number } | null) => void
}

interface GettingStartedModalProps {
  onComplete: (data: {
    location_preference: 'always' | 'ask'
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
  }) => Promise<void>
  onClose: () => void
  geo: GeoProps
}

export function GettingStartedModal({ onComplete, onClose, geo }: GettingStartedModalProps) {
  const [locationPreference, setLocationPreference] = useState<'always' | 'ask'>('ask')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    await onComplete({
      location_preference: locationPreference,
      emergency_contact_name: contactName.trim() || null,
      emergency_contact_phone: contactPhone.trim() || null,
    })
    setSaving(false)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.4)' }}
      className="flex items-center justify-center"
    >
      <div className="surface-card shell-bezel rounded-stratum-lg w-full max-w-[480px] mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-stratum-border">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-stratum-control bg-stratum-accent flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4V20M4 12H20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-stratum-text tracking-tight">Welcome to MediCoord</h2>
                <p className="text-sm text-stratum-text-muted">Let's set up your profile</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-stratum-md text-stratum-text-muted hover:text-stratum-text hover:bg-stratum-bg transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-stratum-accent text-white text-xs font-bold">1</div>
            <div className="h-px flex-1 bg-stratum-border" />
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-stratum-bg text-stratum-text-muted text-xs font-bold">2</div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 flex flex-col gap-6">
          {/* Location preference */}
          <div>
            <h3 className="text-sm font-bold text-stratum-text mb-1">Location access</h3>
            <p className="text-sm text-stratum-text-muted mb-3">MediCoord uses your location to find nearby health facilities.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  setLocationPreference('always')
                  const position = await geo.requestOnce()
                  if (position) geo.setCoords(position)
                }}
                className={`flex items-start gap-3 px-4 py-3 rounded-stratum-md border text-left transition-all ${locationPreference === 'always'
                    ? 'border-stratum-accent bg-stratum-bg'
                    : 'border-stratum-border bg-white hover:border-stratum-accent-2'
                  }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-none flex items-center justify-center transition-colors ${locationPreference === 'always' ? 'border-stratum-accent' : 'border-stratum-border'
                  }`}>
                  {locationPreference === 'always' && (
                    <div className="w-2 h-2 rounded-full bg-stratum-accent" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stratum-text">Always allow</p>
                  <p className="text-xs text-stratum-text-muted mt-0.5">We'll use your saved location each time</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLocationPreference('ask')}
                className={`flex items-start gap-3 px-4 py-3 rounded-stratum-md border text-left transition-all ${locationPreference === 'ask'
                    ? 'border-stratum-accent bg-stratum-bg'
                    : 'border-stratum-border bg-white hover:border-stratum-accent-2'
                  }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-none flex items-center justify-center transition-colors ${locationPreference === 'ask' ? 'border-stratum-accent' : 'border-stratum-border'
                  }`}>
                  {locationPreference === 'ask' && (
                    <div className="w-2 h-2 rounded-full bg-stratum-accent" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stratum-text">Ask each time</p>
                  <p className="text-xs text-stratum-text-muted mt-0.5">You'll be prompted when you start a session</p>
                </div>
              </button>
            </div>
          </div>

          {/* Emergency contact */}
          <div>
            <h3 className="text-sm font-bold text-stratum-text mb-1">Emergency contact <span className="font-normal text-stratum-text-muted">(optional)</span></h3>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Name"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                className="w-full px-4 py-2.5 text-sm text-stratum-text border border-stratum-border rounded-stratum-md focus:outline-none focus:ring-2 focus:ring-stratum-accent/20 focus:border-stratum-accent placeholder-stratum-text-muted transition-all"
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                className="w-full px-4 py-2.5 text-sm text-stratum-text border border-stratum-border rounded-stratum-md focus:outline-none focus:ring-2 focus:ring-stratum-accent/20 focus:border-stratum-accent placeholder-stratum-text-muted transition-all"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 text-sm font-semibold text-white bg-stratum-accent hover:opacity-90 rounded-stratum-control transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
