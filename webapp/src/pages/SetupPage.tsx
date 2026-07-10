import { useNavigate } from 'react-router-dom'
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard'

export default function SetupPage() {
  const navigate = useNavigate()
  return <OnboardingWizard onComplete={() => navigate('/app')} />
}
