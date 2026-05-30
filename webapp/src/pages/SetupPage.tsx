import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { MobileNavBar } from '../components/mobile/MobileNavBar'

export default function SetupPage() {
  const navigate = useNavigate()
  const { updateProfile } = useProfile()
  const [locationPref, setLocationPref] = useState<'always' | 'ask'>('ask')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    await updateProfile({
      location_preference: locationPref,
      emergency_contact_name: contactName.trim() || null,
      emergency_contact_phone: contactPhone.trim() || null,
      getting_started_done: true,
    })
    setSaving(false)
    navigate('/')
  }

  const locationOptions = [
    {
      value: 'always' as const,
      label: 'Always allow',
      sub: "We'll use your saved location each time",
    },
    {
      value: 'ask' as const,
      label: 'Ask each time',
      sub: "You'll be prompted when you start a session",
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MobileNavBar />

      {/* Hero */}
      <div
        className="flex-none flex flex-col items-center justify-center py-8 px-6"
        style={{ background: '#1a3a5c' }}
      >
        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 4V20M4 12H20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle
              cx="12"
              cy="12"
              r="8"
              stroke="white"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          </svg>
        </div>
        <h1 className="text-[20px] font-bold text-white text-center leading-tight">
          Welcome to MediCoord<span style={{ color: '#60a5fa' }}>AI</span>
        </h1>
        <p className="text-[13px] text-white/70 mt-1 text-center">
          Smart health routing for your city
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex-none flex items-center justify-center px-8 py-5 bg-white border-b border-gray-100">
        {/* Step 1 — Account (done) */}
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6L9 17l-5-5"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-[10px] text-gray-500 mt-1 font-medium">Account</span>
        </div>

        <div className="w-8 h-[2px] bg-blue-500 mb-4" />

        {/* Step 2 — Location (active) */}
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white text-[11px] font-bold">2</span>
          </div>
          <span className="text-[10px] text-blue-600 mt-1 font-semibold">Location</span>
        </div>

        <div className="w-8 h-[2px] bg-gray-200 mb-4" />

        {/* Step 3 — Emergency (pending) */}
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-[11px] font-bold">3</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-1 font-medium">Emergency</span>
        </div>
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
        {/* Location access */}
        <div>
          <h2 className="text-[14px] font-bold text-gray-900 mb-0.5">Location access</h2>
          <p className="text-[12px] text-gray-500 mb-3">
            Choose how we use your location for routing.
          </p>
          <div className="flex flex-col gap-2">
            {locationOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setLocationPref(opt.value)}
                className="w-full text-left px-4 py-3 rounded-xl border-2 transition-all"
                style={{
                  borderColor: locationPref === opt.value ? '#2563eb' : '#e5e7eb',
                  background: locationPref === opt.value ? '#eff6ff' : '#fff',
                  minHeight: 44,
                }}
              >
                <p className="text-[13px] font-semibold text-gray-900">{opt.label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Emergency contact */}
        <div>
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <h2 className="text-[14px] font-bold text-gray-900">Emergency contact</h2>
            <span className="text-[11px] text-gray-400">(optional)</span>
          </div>
          <p className="text-[12px] text-gray-500 mb-3">
            Notify a trusted contact in urgent situations.
          </p>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Name"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              style={{ minHeight: 44 }}
            />
            <input
              type="tel"
              placeholder="Phone number"
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              style={{ minHeight: 44 }}
            />
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3.5 text-[14px] font-bold text-white rounded-xl transition-opacity disabled:opacity-60"
          style={{ background: '#1a3a5c', minHeight: 44 }}
        >
          {saving ? 'Saving…' : 'Save and continue'}
        </button>

        {/* Privacy note */}
        <div className="flex items-start gap-2 pb-4">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="flex-none mt-0.5 text-gray-400"
          >
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-[11px] text-gray-400 leading-snug">
            Your location is handled confidentially and never shared with third parties. All data is
            encrypted in transit.
          </p>
        </div>
      </div>
    </div>
  )
}
