import { useState } from 'react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { StepIndicator } from './StepIndicator'
import { LocationStep } from './steps/LocationStep'
import { PushStep } from './steps/PushStep'
import { EmergencyContactStep } from './steps/EmergencyContactStep'
import { MedicalProfileStep } from './steps/MedicalProfileStep'

const STEP_LABELS = ['Location', 'Push', 'Emergency', 'Medical']

export function OnboardingWizard() {
  const isMobile = useBreakpoint()
  const [stepIndex, setStepIndex] = useState(0)
  const [locationPref, setLocationPref] = useState<'always' | 'ask'>('ask')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [autoAlertOptIn, setAutoAlertOptIn] = useState(false)
  const [allergies, setAllergies] = useState('')
  const [conditions, setConditions] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [chatOptIn, setChatOptIn] = useState(false)

  const goNext = () => setStepIndex(i => Math.min(i + 1, STEP_LABELS.length - 1))

  const steps = [
    <LocationStep key="location" value={locationPref} onChange={setLocationPref} onNext={goNext} />,
    <PushStep key="push" enabled={pushEnabled} onEnable={() => setPushEnabled(true)} onNext={goNext} />,
    <EmergencyContactStep
      key="emergency"
      name={contactName}
      phone={contactPhone}
      autoAlertOptIn={autoAlertOptIn}
      onNameChange={setContactName}
      onPhoneChange={setContactPhone}
      onAutoAlertChange={setAutoAlertOptIn}
      onNext={goNext}
    />,
    <MedicalProfileStep
      key="medical"
      allergies={allergies}
      conditions={conditions}
      bloodType={bloodType}
      chatOptIn={chatOptIn}
      onAllergiesChange={setAllergies}
      onConditionsChange={setConditions}
      onBloodTypeChange={setBloodType}
      onChatOptInChange={setChatOptIn}
      onFinish={() => { /* wired to real submission in the workflow integration phase */ }}
    />,
  ]

  const card = (
    <div
      className="w-full flex flex-col gap-6"
      style={{
        maxWidth: isMobile ? undefined : 480,
        background: '#0A1D27',
        border: '1px solid rgba(28, 70, 89, 0.4)',
        borderRadius: isMobile ? 0 : 20,
        padding: isMobile ? '32px 20px' : 32,
        boxShadow: isMobile ? undefined : '0 20px 40px -15px rgba(3, 10, 14, 0.7)',
      }}
    >
      <StepIndicator steps={STEP_LABELS} currentIndex={stepIndex} />
      {steps[stepIndex]}
    </div>
  )

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#061219' }}>
        <div className="flex-none flex flex-col items-center justify-center py-8 px-6">
          <h1 className="text-[18px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
            MediCoord<span style={{ color: '#48F6C1' }}>AI</span>
          </h1>
        </div>
        <div className="flex-1 flex flex-col px-1">{card}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#061219' }}>
      {card}
    </div>
  )
}
