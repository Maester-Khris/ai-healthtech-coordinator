import * as Sentry from "@sentry/react"
import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './Menucomponents/Home'
import SetupPage from './pages/SetupPage'
import TestLocationPage from './pages/TestLocationPage'
import TestNotifPage from './pages/TestNotifPage'
import SandboxPage from './pages/SandboxPage'
import PrivacyPage from './pages/PrivacyPage'
import CookiesPage from './pages/CookiesPage'
import DataDisclosurePage from './pages/DataDisclosurePage'
import LandingPage from './pages/LandingPage'
import ForInvestorsPage from './pages/ForInvestorsPage'
import ForEngineersPage from './pages/ForEngineersPage'
import EngineeringCaseStudyPage from './pages/EngineeringCaseStudyPage'
import { OnboardingWizard } from './components/onboarding/OnboardingWizard'
import ProfilePage from './pages/ProfilePage'
import { MobileLayout } from './components/mobile/MobileLayout'
import { AuthProvider } from './auth/AuthContext'
import { Notification } from './components/Notification'
import { GpsPermissionModal } from './components/GpsPermissionModal'
import { PWAInstallModal } from './components/pwa/PWAInstallModal'
import { NotificationPermissionPrompt, shouldShowPermissionPrompt } from './components/pwa/NotificationPermissionPrompt'
import { useFacilities } from './hooks/useFacilities'
import { useConversations } from './hooks/useConversations'
import { useBreakpoint } from './hooks/useBreakpoint'
import { useGeolocation } from './hooks/useGeolocation'
import { usePWAInstall } from './hooks/usePWAInstall'
import { useNotificationPermission } from './hooks/useNotificationPermission'
import { useAuth } from './auth/useAuth'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  // ponytail: no loading guard — redirect on null, tolerate auth flash in phase 1
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function LandingRoute() {
  return <LandingPage />
}

function AppInner() {
  const isMobile = useBreakpoint()
  const { user } = useAuth()
  const { facilities, loading: facilitiesLoading } = useFacilities()
  const { cache, sendMessage, createSession, loadOlderMessages } = useConversations()
  const geo = useGeolocation()
  const [gpsModalDismissed, setGpsModalDismissed] = useState(false)

  const {
    platform,
    installState,
    isPushSupported,
    isIosVersionSupported,
    isIosNonSafari,
    promptInstall,
    installModalDismissed,
    dismissInstallModal,
  } = usePWAInstall()

  const {
    permissionState,
    requesting,
    requestPermission,
  } = useNotificationPermission(user?.id ?? null)

  const [permissionPromptDismissed, setPermissionPromptDismissed] = useState(false)
  const [installConfirmed, setInstallConfirmed] = useState(installState === "standalone")

  const showGpsModal = geo.permission === "denied" && !gpsModalDismissed

  const showInstallModal =
    !installModalDismissed &&
    installState !== "standalone" &&
    (platform === "ios_safari" || platform === "android_chrome" || isIosNonSafari) &&
    !installConfirmed

  const showPermissionPrompt =
    !showInstallModal &&
    isPushSupported &&
    permissionState !== "granted" &&
    permissionState !== "denied" &&
    !permissionPromptDismissed &&
    shouldShowPermissionPrompt()

  const sharedProps = {
    facilities,
    facilitiesLoading,
    conversationsCache: cache,
    sendMessage,
    createSession,
    loadOlderMessages,
  }

  return (
    <>
      <Notification />
      {showGpsModal && (
        <GpsPermissionModal onDismiss={() => setGpsModalDismissed(true)} />
      )}
      {showInstallModal && (
        <PWAInstallModal
          platform={platform}
          installState={installState}
          isIosVersionSupported={isIosVersionSupported}
          isIosNonSafari={isIosNonSafari}
          promptInstall={promptInstall}
          onInstalled={() => {
            dismissInstallModal()
            setInstallConfirmed(true)
          }}
          onDismiss={dismissInstallModal}
        />
      )}
      {showPermissionPrompt && (
        <NotificationPermissionPrompt
          requesting={requesting}
          onEnable={requestPermission}
          onDismiss={() => setPermissionPromptDismissed(true)}
        />
      )}
      {isMobile
        ? <MobileLayout {...sharedProps} />
        : <Home {...sharedProps} />
      }
    </>
  )
}

function App() {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error }) => (
        <div style={{ padding: 24 }}>
          <p>Something went wrong. Please refresh.</p>
          {import.meta.env.DEV && <pre>{String(error)}</pre>}
        </div>
      )}
    >
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingRoute />} />
            <Route path="/app" element={<AppInner />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/testlocation" element={<TestLocationPage />} />
            {/* TEMPORARY — static UI preview only, removed when the workflow-integration
                phase wires real /setup and /profile routing (see
                2026-07-07-onboarding-flow-consolidation-design.md) */}
            <Route path="/preview/onboarding" element={<OnboardingWizard />} />
            <Route path="/preview/profile" element={<ProfilePage />} />
            <Route path="/sandbox" element={<ProtectedRoute><SandboxPage /></ProtectedRoute>} />
            <Route path="/test-notif" element={<TestNotifPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cookies" element={<CookiesPage />} />
            <Route path="/data-disclosure" element={<DataDisclosurePage />} />
            <Route path="/for-investors" element={<ForInvestorsPage />} />
            <Route path="/for-engineers" element={<ForEngineersPage />} />
            <Route path="/for-engineers/:slug" element={<EngineeringCaseStudyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  )
}

export default App
