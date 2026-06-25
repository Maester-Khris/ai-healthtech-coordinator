import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { MobileTopBar } from '../components/mobile/MobileTopBar'
import { WebNavBar } from '../components/WebNavBar'
import { UserMenu } from '../components/auth/UserMenu'
import { DrawerMenu } from '../components/mobile/DrawerMenu'

export default function SetupPage() {
  const navigate = useNavigate()
  const isMobile = useBreakpoint()
  const { updateProfile } = useProfile()
  const [locationPref, setLocationPref] = useState<'always' | 'ask'>('ask')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    await updateProfile({
      location_preference: locationPref,
      emergency_contact_name: contactName.trim() || null,
      emergency_contact_phone: contactPhone.trim() || null,
      getting_started_done: true,
    })
    setSaving(false)
    navigate('/app')
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
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: '#061219',
        fontFamily: 'var(--font-sans)',
        color: '#E2F1F5',
      }}
    >
      {/* Navbar */}
      {isMobile ? (
        <MobileTopBar
          mode="browse"
          severity={null}
          onMenuOpen={() => setDrawerOpen(true)}
        />
      ) : (
        <WebNavBar rightContent={<UserMenu />} />
      )}

      {/* Drawer Menu for Mobile */}
      {isMobile && (
        <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      )}

      {/* Body — on desktop: scrollable area with centered card */}
      <div className={`flex-1 flex flex-col ${isMobile ? 'pt-[56px] overflow-y-auto' : 'overflow-y-auto py-10 px-4'}`}>
        <div
          className={isMobile ? 'flex-1 flex flex-col' : 'max-w-2xl mx-auto w-full rounded-2xl overflow-hidden'}
          style={
            !isMobile
              ? {
                  background: 'rgba(10, 29, 39, 0.95)',
                  border: '1px solid rgba(28, 70, 89, 0.40)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
                }
              : undefined
          }
        >
          {/* Hero */}
          <div
            className="flex-none flex flex-col items-center justify-center py-8 px-6"
            style={{
              background: 'linear-gradient(180deg, rgba(28, 70, 89, 0.25) 0%, rgba(10, 29, 39, 0.6) 100%)',
              borderBottom: '1px solid rgba(28, 70, 89, 0.3)',
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
              style={{ background: 'rgba(72, 246, 193, 0.1)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 4V20M4 12H20" stroke="#48F6C1" strokeWidth="2.5" strokeLinecap="round" />
                <circle
                  cx="12"
                  cy="12"
                  r="8"
                  stroke="#48F6C1"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              </svg>
            </div>
            <h1 className="text-[20px] font-bold text-[#E2F1F5] text-center leading-tight">
              Welcome to MediCoord<span style={{ color: '#48F6C1' }}>AI</span>
            </h1>
            <p className="text-[13px] text-[#85A4B1] mt-1 text-center">
              Smart health routing for your city
            </p>
          </div>

          {/* Step indicator */}
          <div
            className="flex-none flex items-center justify-center px-8 py-5 border-b"
            style={{
              background: 'rgba(13, 34, 45, 0.6)',
              borderColor: 'rgba(28, 70, 89, 0.3)',
            }}
          >
            {/* Step 1 — Account (done) */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-[#48F6C1] flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="#061219"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-[10px] text-[#85A4B1] mt-1 font-medium">Account</span>
            </div>

            <div className="w-8 h-[2px] mb-4" style={{ background: '#35A7C4' }} />

            {/* Step 2 — Location (active) */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-[#35A7C4] flex items-center justify-center">
                <span className="text-[#061219] text-[11px] font-bold">2</span>
              </div>
              <span className="text-[10px] text-[#35A7C4] mt-1 font-semibold">Location</span>
            </div>

            <div className="w-8 h-[2px] mb-4" style={{ background: 'rgba(28, 70, 89, 0.4)' }} />

            {/* Step 3 — Emergency (pending) */}
            <div className="flex flex-col items-center">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(28, 70, 89, 0.3)', border: '1px solid rgba(28, 70, 89, 0.4)' }}
              >
                <span className="text-[#85A4B1] text-[11px] font-bold">3</span>
              </div>
              <span className="text-[10px] text-[#85A4B1] mt-1 font-medium">Emergency</span>
            </div>
          </div>

          {/* Form content */}
          <div
            className={`px-5 py-6 flex flex-col gap-6 ${isMobile ? 'flex-1 overflow-y-auto' : ''}`}
            style={{ background: 'rgba(10, 29, 39, 0.4)' }}
          >
            {/* Location access */}
            <div>
              <h2 className="text-[14px] font-bold text-[#E2F1F5] mb-0.5">Location access</h2>
              <p className="text-[12px] text-[#85A4B1] mb-3">
                Choose how we use your location for routing.
              </p>
              <div className="flex flex-col gap-2">
                {locationOptions.map(opt => {
                  const isSelected = locationPref === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setLocationPref(opt.value)}
                      className="w-full text-left px-4 py-3 rounded-xl border-2 transition-all cursor-pointer"
                      style={{
                        borderColor: isSelected ? '#48F6C1' : 'rgba(28, 70, 89, 0.40)',
                        background: isSelected ? 'rgba(72, 246, 193, 0.08)' : 'rgba(19, 46, 60, 0.3)',
                        minHeight: 44,
                      }}
                    >
                      <p className="text-[13px] font-bold text-[#E2F1F5]">{opt.label}</p>
                      <p className="text-[11px] text-[#85A4B1] mt-0.5">{opt.sub}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Emergency contact */}
            <div>
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <h2 className="text-[14px] font-bold text-[#E2F1F5]">Emergency contact</h2>
                <span className="text-[11px] text-[#85A4B1]">(optional)</span>
              </div>
              <p className="text-[12px] text-[#85A4B1] mb-3">
                Notify a trusted contact in urgent situations.
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-[13px] text-[#E2F1F5] placeholder-[#567482] focus:outline-none focus:border-[#48F6C1] transition-all"
                  style={{
                    minHeight: 44,
                    background: 'rgba(19, 46, 60, 0.3)',
                    border: '1px solid rgba(28, 70, 89, 0.4)',
                  }}
                />
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-[13px] text-[#E2F1F5] placeholder-[#567482] focus:outline-none focus:border-[#48F6C1] transition-all"
                  style={{
                    minHeight: 44,
                    background: 'rgba(19, 46, 60, 0.3)',
                    border: '1px solid rgba(28, 70, 89, 0.4)',
                  }}
                />
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-3.5 text-[14px] font-bold rounded-xl transition-all disabled:opacity-60 cursor-pointer"
              style={{
                background: '#48F6C1',
                color: '#061219',
                minHeight: 44,
              }}
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
                className="flex-none mt-0.5 text-[#85A4B1]"
              >
                <path
                  d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-[11px] text-[#85A4B1] leading-snug">
                Your location is handled confidentially and never shared with third parties. All data is
                encrypted in transit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
