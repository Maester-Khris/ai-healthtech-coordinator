import { TextField } from '../fields/TextField'
import { ToggleRow } from '../fields/ToggleRow'

interface EmergencyContactStepProps {
  name: string
  phone: string
  autoAlertOptIn: boolean
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onAutoAlertChange: (value: boolean) => void
  onNext: () => void
}

export function EmergencyContactStep({
  name,
  phone,
  autoAlertOptIn,
  onNameChange,
  onPhoneChange,
  onAutoAlertChange,
  onNext,
}: EmergencyContactStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-2">
        <h2 className="text-[20px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
          Emergency contact
        </h2>
        <p className="text-[13px] leading-snug" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
          Who should we notify if you need urgent assistance? (optional)
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <TextField label="Name" value={name} onChange={onNameChange} placeholder="Who are they to you?" />
        <TextField label="Phone number" value={phone} onChange={onPhoneChange} placeholder="+1 (416) 000-0000" type="tel" />
      </div>

      <div className="h-px" style={{ background: 'rgba(28, 70, 89, 0.4)' }} />

      <ToggleRow
        label="Automatically alert this contact"
        badge="Coming soon"
        caption="In urgent situations, we'll notify your contact with your status and location — opt in now to be notified when it's ready."
        checked={autoAlertOptIn}
        onChange={onAutoAlertChange}
      />

      <button
        type="button"
        onClick={onNext}
        className="w-full py-3.5 text-[14px] font-bold rounded-xl transition-all"
        style={{ background: '#48F6C1', color: '#061219', minHeight: 44 }}
      >
        Save and continue
      </button>
    </div>
  )
}
