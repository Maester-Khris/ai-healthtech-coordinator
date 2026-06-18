import * as Sentry from "@sentry/react"
import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './Menucomponents/Home'
import SetupPage from './pages/SetupPage'
import TestLocationPage from './pages/TestLocationPage'
import TestNotifPage from './pages/TestNotifPage'
import SandboxPage from './pages/SandboxPage'
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

function AppInner() {
  const isMobile = useBreakpoint()
  const { facilities, loading: facilitiesLoading } = useFacilities()
  const { cache, sendMessage, createSession, loadOlderMessages } = useConversations()
  const geo = useGeolocation()
  const [gpsModalDismissed, setGpsModalDismissed] = useState(false)

  const {
    platform,
    installState,
    isPushSupported,
    isIosNonSafari,
    promptInstall,
    installModalDismissed,
    dismissInstallModal,
  } = usePWAInstall()

  const {
    permissionState,
    requesting,
    requestPermission,
  } = useNotificationPermission()

  const [permissionPromptDismissed, setPermissionPromptDismissed] = useState(false)
  const [installConfirmed, setInstallConfirmed] = useState(installState === "standalone")

  const showGpsModal = geo.permission === "denied" && !gpsModalDismissed

  const showInstallModal =
    !installModalDismissed &&
    installState !== "standalone" &&
    (isPushSupported || platform === "ios_safari" || isIosNonSafari) &&
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
          isPushSupported={isPushSupported}
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
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/testlocation" element={<TestLocationPage />} />
            <Route path="/sandbox" element={<SandboxPage />} />
            <Route path="/test-notif" element={<TestNotifPage />} />
            <Route path="*" element={<AppInner />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  )
}

export default App
