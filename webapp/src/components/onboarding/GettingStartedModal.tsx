import { useState } from "react"

interface GettingStartedModalProps {
  onComplete: (data: {
    location_preference: 'always' | 'ask'
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
  }) => Promise<void>
  onClose: () => void
}

export function GettingStartedModal({ onComplete, onClose }: GettingStartedModalProps) {
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/25">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4V20M4 12H20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">Welcome to MediCoord</h2>
                <p className="text-sm text-gray-500">Let's set up your profile</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">1</div>
            <div className="h-px flex-1 bg-gray-200" />
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-xs font-bold">2</div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 flex flex-col gap-6">
          {/* Location preference */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Location access</h3>
            <p className="text-sm text-gray-500 mb-3">MediCoord uses your location to find nearby health facilities.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setLocationPreference('always')}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  locationPreference === 'always'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-none flex items-center justify-center transition-colors ${
                  locationPreference === 'always' ? 'border-blue-500' : 'border-gray-300'
                }`}>
                  {locationPreference === 'always' && (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Always allow</p>
                  <p className="text-xs text-gray-500 mt-0.5">We'll use your saved location each time</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLocationPreference('ask')}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  locationPreference === 'ask'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-none flex items-center justify-center transition-colors ${
                  locationPreference === 'ask' ? 'border-blue-500' : 'border-gray-300'
                }`}>
                  {locationPreference === 'ask' && (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Ask each time</p>
                  <p className="text-xs text-gray-500 mt-0.5">You'll be prompted when you start a session</p>
                </div>
              </button>
            </div>
          </div>

          {/* Emergency contact */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Emergency contact <span className="font-normal text-gray-400">(optional)</span></h3>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Name"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                className="w-full px-4 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder-gray-400 transition-all"
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                className="w-full px-4 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder-gray-400 transition-all"
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
            className="w-full py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
