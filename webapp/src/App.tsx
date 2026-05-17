import * as Sentry from "@sentry/react"
import Home from './Menucomponents/Home'
import { AuthProvider } from './auth/AuthContext'
import { Notification } from './components/Notification'
import { useFacilities } from './hooks/useFacilities'

function App() {
  const { facilities, loading: facilitiesLoading } = useFacilities()

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
        <Notification />
        <Home facilities={facilities} facilitiesLoading={facilitiesLoading} />
      </AuthProvider>
    </Sentry.ErrorBoundary>
  )
}

export default App
