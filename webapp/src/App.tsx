import Home from './Menucomponents/Home'
import { AuthProvider } from './auth/AuthContext'
import { Notification } from './components/Notification'
import { useFacilities } from './hooks/useFacilities'

function App() {
  const { facilities, loading: facilitiesLoading } = useFacilities()

  return (
    <AuthProvider>
      <Notification />
      <Home facilities={facilities} facilitiesLoading={facilitiesLoading} />
    </AuthProvider>
  )
}

export default App
