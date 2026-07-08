import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { MobileTopBar } from '../components/mobile/MobileTopBar'
import { WebNavBar } from '../components/WebNavBar'
import { UserMenu } from '../components/auth/UserMenu'
import { DrawerMenu } from '../components/mobile/DrawerMenu'
import { RadioCard } from '../components/onboarding/fields/RadioCard'
import { TextField } from '../components/onboarding/fields/TextField'
import { SelectField } from '../components/onboarding/fields/SelectField'
import { ToggleRow } from '../components/onboarding/fields/ToggleRow'
import { BLOOD_TYPE_OPTIONS } from '../components/onboarding/steps/MedicalProfileStep'

const PLACEHOLDER_DEVICES = [
  { id: 'device-1', label: 'Chrome on Windows — active' },
  { id: 'device-2', label: 'Safari on iPhone — active' },
]

const EMAIL = 'user@example.com'
const DISPLAY_NAME = EMAIL.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const INITIALS = EMAIL[0].toUpperCase()

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="flex flex-col gap-4"
      style={{ background: '#0A1D27', border: '1px solid rgba(28, 70, 89, 0.4)', borderRadius: 16, padding: 20 }}
    >
      <h2 className="text-[14px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

export default function ProfilePage() {
  const isMobile = useBreakpoint()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [locationPref, setLocationPref] = useState<'always' | 'ask'>('ask')
  const [pushEnabled, setPushEnabled] = useState(true)
  const [devices, setDevices] = useState(PLACEHOLDER_DEVICES)
  const [contactName, setContactName] = useState('Sarah Jenkins')
  const [contactPhone, setContactPhone] = useState('+1 (416) 555-0192')
  const [autoAlertOptIn, setAutoAlertOptIn] = useState(false)
  const [allergies, setAllergies] = useState('')
  const [conditions, setConditions] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [chatOptIn, setChatOptIn] = useState(false)

  const removeDevice = (id: string) => setDevices(current => current.filter(device => device.id !== id))

  return (
    <div className="min-h-screen flex flex-col text-[13px]" style={{ background: '#061219', color: '#E2F1F5' }}>
      {isMobile ? (
        <MobileTopBar mode="browse" severity={null} onMenuOpen={() => setDrawerOpen(true)} />
      ) : (
        <WebNavBar rightContent={<UserMenu />} />
      )}

      {isMobile && <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />}

      {!isMobile && (
        <div
          className="flex items-center gap-6 px-8"
          style={{ height: 44, borderBottom: '1px solid rgba(28, 70, 89, 0.4)' }}
        >
          <Link
            to="/app"
            className="text-[12px] font-semibold no-underline"
            style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}
          >
            ← Home
          </Link>
          <span
            className="text-[12px] font-bold"
            style={{ color: '#48F6C1', fontFamily: 'var(--font-sans)', borderBottom: '2px solid #48F6C1', paddingBottom: 13 }}
          >
            Profile
          </span>
        </div>
      )}

      <div
        className="mx-auto flex flex-col gap-5 w-full"
        style={{
          maxWidth: isMobile ? undefined : 640,
          padding: isMobile ? '24px 16px 120px' : '40px 24px 140px',
          marginTop: isMobile ? 56 : 0,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="rounded-full flex items-center justify-center flex-none"
              style={{ width: 64, height: 64, background: '#35A7C4', color: '#061219', fontWeight: 700, fontSize: 22 }}
            >
              {INITIALS}
            </div>
            <div>
              <p className="text-[16px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
                {DISPLAY_NAME}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
                Toronto, ON · {EMAIL}
              </p>
              <span
                className="inline-block mt-2 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(72, 246, 193, 0.1)', color: '#48F6C1', fontFamily: 'var(--font-mono)' }}
              >
                Privacy protected
              </span>
            </div>
          </div>
          <span
            className="text-[9px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full flex-none"
            style={{ background: 'rgba(28, 70, 89, 0.5)', color: '#85A4B1', fontFamily: 'var(--font-mono)' }}
          >
            Member since May 2024
          </span>
        </div>

        <SectionCard title="Location preference">
          <div className="flex flex-col gap-2">
            <RadioCard
              title="Always allow"
              description="We'll use your saved location each time."
              selected={locationPref === 'always'}
              onSelect={() => setLocationPref('always')}
            />
            <RadioCard
              title="Ask each time"
              description="You'll be prompted when you start a session."
              selected={locationPref === 'ask'}
              onSelect={() => setLocationPref('ask')}
            />
          </div>
        </SectionCard>

        <SectionCard title="Preferred facility">
          <p className="text-[12px] leading-snug" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
            Your default choice for everyday or over-the-counter care — used when we don't have a closer match from
            your location.
          </p>
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: 'rgba(19, 46, 60, 0.3)', border: '1px solid rgba(28, 70, 89, 0.4)' }}
          >
            <div>
              <p className="text-[13px] font-semibold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
                St. Michael's Hospital
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
                30 Bond St, Toronto, ON
              </p>
            </div>
            <button
              type="button"
              className="text-[11px] font-semibold flex-none"
              style={{ color: '#48F6C1', fontFamily: 'var(--font-sans)' }}
            >
              Get directions
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Push notifications">
          <ToggleRow label="Push notifications" checked={pushEnabled} onChange={setPushEnabled} />
          <div className="flex flex-col gap-2">
            {devices.map(device => (
              <div
                key={device.id}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                style={{ background: 'rgba(19, 46, 60, 0.3)', border: '1px solid rgba(28, 70, 89, 0.4)' }}
              >
                <span className="text-[12px]" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
                  {device.label}
                </span>
                <button
                  type="button"
                  onClick={() => removeDevice(device.id)}
                  className="text-[11px] font-semibold"
                  style={{ color: '#FF7B93', fontFamily: 'var(--font-sans)' }}
                >
                  Remove
                </button>
              </div>
            ))}
            {devices.length === 0 && (
              <p className="text-[12px]" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
                No devices registered.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Emergency contact">
          <TextField label="Name" value={contactName} onChange={setContactName} placeholder="Who are they to you?" />
          <TextField
            label="Phone number"
            value={contactPhone}
            onChange={setContactPhone}
            placeholder="+1 (416) 000-0000"
            type="tel"
          />
          <ToggleRow
            label="Automatically alert this contact"
            badge="Coming soon"
            caption="In urgent situations, we'll notify your contact with your status and location."
            checked={autoAlertOptIn}
            onChange={setAutoAlertOptIn}
          />
        </SectionCard>

        <SectionCard title="Medical profile">
          <TextField label="Allergies" value={allergies} onChange={setAllergies} placeholder="e.g. Penicillin, Peanuts" />
          <TextField
            label="Pre-existing conditions"
            value={conditions}
            onChange={setConditions}
            placeholder="e.g. Type II Diabetes, Hypertension"
          />
          <SelectField label="Blood type" value={bloodType} onChange={setBloodType} options={BLOOD_TYPE_OPTIONS} placeholder="Select type" />
          <ToggleRow
            label="Let the AI assistant use this during triage"
            caption="Only shared with the assistant if enabled — see Privacy Policy."
            checked={chatOptIn}
            onChange={setChatOptIn}
          />
        </SectionCard>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 flex flex-col items-center gap-2"
        style={{
          background: 'rgba(6, 18, 25, 0.95)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(28, 70, 89, 0.4)',
          padding: 16,
        }}
      >
        <button
          type="button"
          className="w-full font-bold rounded-xl transition-all"
          style={{ maxWidth: isMobile ? undefined : 640, background: '#48F6C1', color: '#061219', padding: '12px 0', minHeight: 44 }}
        >
          Save changes
        </button>
        <button
          type="button"
          className="text-[11px] font-semibold"
          style={{ color: '#FF7B93', fontFamily: 'var(--font-sans)' }}
        >
          Delete my account
        </button>
      </div>
    </div>
  )
}
