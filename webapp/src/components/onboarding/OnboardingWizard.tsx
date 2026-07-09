import { useEffect } from 'react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useAuth } from '../../auth/useAuth'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useNotificationPermission } from '../../hooks/useNotificationPermission'
import { useOnboardingFlow } from '../../hooks/useOnboardingFlow'
import { StepIndicator } from './StepIndicator'
import { LocationStep } from './steps/LocationStep'
import { PushStep } from './steps/PushStep'
import { EmergencyContactStep } from './steps/EmergencyContactStep'
import { MedicalProfileStep } from './steps/MedicalProfileStep'

const STEP_LABELS = ['Location', 'Push', 'Emergency', 'Medical']

interface OnboardingWizardProps {
  embedded?: boolean
}

export function OnboardingWizard({ embedded = false }: OnboardingWizardProps) {
  const isMobile = useBreakpoint()
  const { user } = useAuth()
  const geo = useGeolocation()
  const { permissionState, requestPermission } = useNotificationPermission(user?.id ?? null)
  const flow = useOnboardingFlow()

  useEffect(() => {
    if (permissionState === 'granted') flow.setData({ push_enabled: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionState])

  const handleLocationChange = (value: 'always' | 'ask') => {
    flow.setData({ location_preference: value })
    if (value === 'always') {
      geo.requestOnce().then(coords => geo.setCoords(coords))
    }
  }

  const steps = [
    <LocationStep
      key="location"
      value={flow.data.location_preference}
      onChange={handleLocationChange}
      onNext={flow.next}
    />,
    <PushStep
      key="push"
      enabled={flow.data.push_enabled}
      onEnable={() => { requestPermission() }}
      onNext={flow.next}
    />,
    <EmergencyContactStep
      key="emergency"
      name={flow.data.emergency_contact_name ?? ''}
      phone={flow.data.emergency_contact_phone ?? ''}
      autoAlertOptIn={flow.data.auto_alert_opt_in}
      onNameChange={v => flow.setData({ emergency_contact_name: v.trim() || null })}
      onPhoneChange={v => flow.setData({ emergency_contact_phone: v.trim() || null })}
      onAutoAlertChange={v => flow.setData({ auto_alert_opt_in: v })}
      onNext={flow.next}
    />,
    <MedicalProfileStep
      key="medical"
      allergies={flow.data.allergies ?? ''}
      conditions={flow.data.conditions ?? ''}
      bloodType={flow.data.blood_type ?? ''}
      chatOptIn={flow.data.medical_chat_opt_in}
      onAllergiesChange={v => flow.setData({ allergies: v.trim() || null })}
      onConditionsChange={v => flow.setData({ conditions: v.trim() || null })}
      onBloodTypeChange={v => flow.setData({ blood_type: v || null })}
      onChatOptInChange={v => flow.setData({ medical_chat_opt_in: v })}
      onFinish={() => { flow.submit() }}
      submitting={flow.submitting}
      submitError={flow.submitError}
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
      <StepIndicator steps={STEP_LABELS} currentIndex={flow.stepIndex} />
      {steps[flow.stepIndex]}
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

  if (embedded) {
    return card
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#061219' }}>
      {card}
    </div>
  )
}
