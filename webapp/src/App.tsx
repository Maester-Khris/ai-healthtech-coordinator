import * as Sentry from "@sentry/react"
import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './Menucomponents/Home'
import SetupPage from './pages/SetupPage'
import { MobileLayout } from './components/mobile/MobileLayout'
import { AuthProvider } from './auth/AuthContext'
import { Notification } from './components/Notification'
import { GpsPermissionModal } from './components/GpsPermissionModal'
import { useFacilities } from './hooks/useFacilities'
import { useConversations } from './hooks/useConversations'
import { useBreakpoint } from './hooks/useBreakpoint'
import { useGeolocation } from './hooks/useGeolocation'

function AppInner() {
  const isMobile = useBreakpoint()
  const { facilities, loading: facilitiesLoading } = useFacilities()
  const { cache, sendMessage, createSession, loadOlderMessages } = useConversations()
  const geo = useGeolocation()
  const [gpsModalDismissed, setGpsModalDismissed] = useState(false)

  const showGpsModal = geo.permission === "denied" && !gpsModalDismissed

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
      {isMobile
        ? <MobileLayout {...sharedProps} />
        : <Home {...sharedProps} />
      }
    </>
  )
}

import TestLocationPage from './pages/TestLocationPage'

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
            <Route path="*" element={<AppInner />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  )
}

export default App
