import { TextField } from '../fields/TextField'
import { SelectField } from '../fields/SelectField'
import { ToggleRow } from '../fields/ToggleRow'

export const BLOOD_TYPE_OPTIONS = [
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
  { value: 'unknown', label: 'Unknown' },
]

interface MedicalProfileStepProps {
  allergies: string
  conditions: string
  bloodType: string
  chatOptIn: boolean
  onAllergiesChange: (value: string) => void
  onConditionsChange: (value: string) => void
  onBloodTypeChange: (value: string) => void
  onChatOptInChange: (value: boolean) => void
  onFinish: () => void
}

export function MedicalProfileStep({
  allergies,
  conditions,
  bloodType,
  chatOptIn,
  onAllergiesChange,
  onConditionsChange,
  onBloodTypeChange,
  onChatOptInChange,
  onFinish,
}: MedicalProfileStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-2">
        <h2 className="text-[20px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
          Medical profile
        </h2>
        <p className="text-[13px] leading-snug" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
          Optional — helps the assistant give you more relevant recommendations.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <TextField label="Allergies" value={allergies} onChange={onAllergiesChange} placeholder="e.g. Penicillin, Peanuts" />
        <TextField
          label="Pre-existing conditions"
          value={conditions}
          onChange={onConditionsChange}
          placeholder="e.g. Type II Diabetes, Hypertension"
        />
        <SelectField label="Blood type" value={bloodType} onChange={onBloodTypeChange} options={BLOOD_TYPE_OPTIONS} placeholder="Select type" />
      </div>

      <div className="h-px" style={{ background: 'rgba(28, 70, 89, 0.4)' }} />

      <ToggleRow
        label="Let the AI assistant use this during triage"
        caption="Only shared with the assistant if enabled — see Privacy Policy."
        checked={chatOptIn}
        onChange={onChatOptInChange}
      />

      <button
        type="button"
        onClick={onFinish}
        className="w-full py-3.5 text-[14px] font-bold rounded-xl transition-all"
        style={{ background: '#48F6C1', color: '#061219', minHeight: 44 }}
      >
        Finish setup
      </button>
    </div>
  )
}
