// webapp/src/hooks/useOnboardingFlow.test.ts
import { describe, it, expect } from 'vitest'
import {
  ONBOARDING_STEPS,
  INITIAL_ONBOARDING_DATA,
  nextStepIndex,
  prevStepIndex,
  buildSubmitPayload,
} from './useOnboardingFlow'

describe('onboarding step transitions', () => {
  it('advances one step at a time', () => {
    expect(nextStepIndex(0)).toBe(1)
    expect(nextStepIndex(1)).toBe(2)
  })

  it('clamps at the last step', () => {
    const last = ONBOARDING_STEPS.length - 1
    expect(nextStepIndex(last)).toBe(last)
  })

  it('goes back one step at a time', () => {
    expect(prevStepIndex(2)).toBe(1)
  })

  it('clamps at the first step', () => {
    expect(prevStepIndex(0)).toBe(0)
  })
})

describe('buildSubmitPayload', () => {
  it('marks onboarding done and preserves collected data', () => {
    const payload = buildSubmitPayload({
      ...INITIAL_ONBOARDING_DATA,
      allergies: 'Penicillin',
      medical_chat_opt_in: true,
    })
    expect(payload.getting_started_done).toBe(true)
    expect(payload.allergies).toBe('Penicillin')
    expect(payload.medical_chat_opt_in).toBe(true)
    expect(payload.location_preference).toBe('ask')
  })
})
