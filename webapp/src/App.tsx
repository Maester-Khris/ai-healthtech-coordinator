import * as Sentry from "@sentry/react"
import Home from './Menucomponents/Home'
import { AuthProvider } from './auth/AuthContext'
import { Notification } from './components/Notification'
import { useFacilities } from './hooks/useFacilities'
import { useConversations } from './hooks/useConversations'

function AppInner() {
  const { facilities, loading: facilitiesLoading } = useFacilities()
  const { cache, sendMessage, createSession, loadOlderMessages } = useConversations()

  return (
    <>
      <Notification />
      <Home
        facilities={facilities}
        facilitiesLoading={facilitiesLoading}
        conversationsCache={cache}
        sendMessage={sendMessage}
        createSession={createSession}
        loadOlderMessages={loadOlderMessages}
      />
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
        <AppInner />
      </AuthProvider>
    </Sentry.ErrorBoundary>
  )
}

export default App
