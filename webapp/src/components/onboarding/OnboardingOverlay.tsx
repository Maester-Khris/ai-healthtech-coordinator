// webapp/src/components/onboarding/OnboardingOverlay.tsx
import { OnboardingWizard } from './OnboardingWizard'

interface OnboardingOverlayProps {
  onComplete?: () => void
}

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.4)' }}
      className="flex items-center justify-center"
    >
      <OnboardingWizard embedded onComplete={onComplete} />
    </div>
  )
}
