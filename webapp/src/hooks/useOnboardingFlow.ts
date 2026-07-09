// webapp/src/hooks/useOnboardingFlow.ts
import { useState } from 'react'
import { useProfile } from './useProfile'

export type OnboardingStep = 'location' | 'push' | 'emergency' | 'medical'

export const ONBOARDING_STEPS: OnboardingStep[] = ['location', 'push', 'emergency', 'medical']

export interface OnboardingData {
  location_preference: 'always' | 'ask'
  push_enabled: boolean
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  auto_alert_opt_in: boolean
  allergies: string | null
  conditions: string | null
  blood_type: string | null
  medical_chat_opt_in: boolean
}

export const INITIAL_ONBOARDING_DATA: OnboardingData = {
  location_preference: 'ask',
  push_enabled: false,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  auto_alert_opt_in: false,
  allergies: null,
  conditions: null,
  blood_type: null,
  medical_chat_opt_in: false,
}

export function nextStepIndex(index: number): number {
  return Math.min(index + 1, ONBOARDING_STEPS.length - 1)
}

export function prevStepIndex(index: number): number {
  return Math.max(index - 1, 0)
}

export function buildSubmitPayload(
  data: OnboardingData
): OnboardingData & { getting_started_done: true } {
  return { ...data, getting_started_done: true }
}

export interface UseOnboardingFlowResult {
  step: OnboardingStep
  stepIndex: number
  steps: OnboardingStep[]
  data: OnboardingData
  setData: (updates: Partial<OnboardingData>) => void
  next: () => void
  back: () => void
  submitting: boolean
  submitError: string | null
  submit: () => Promise<void>
}

export function useOnboardingFlow(): UseOnboardingFlowResult {
  const { updateProfile } = useProfile()
  const [stepIndex, setStepIndex] = useState(0)
  const [data, setDataState] = useState<OnboardingData>(INITIAL_ONBOARDING_DATA)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const setData = (updates: Partial<OnboardingData>) =>
    setDataState(current => ({ ...current, ...updates }))

  const next = () => setStepIndex(nextStepIndex)
  const back = () => setStepIndex(prevStepIndex)

  const submit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await updateProfile(buildSubmitPayload(data))
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return {
    step: ONBOARDING_STEPS[stepIndex],
    stepIndex,
    steps: ONBOARDING_STEPS,
    data,
    setData,
    next,
    back,
    submitting,
    submitError,
    submit,
  }
}
