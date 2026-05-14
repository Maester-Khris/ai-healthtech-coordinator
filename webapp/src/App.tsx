import Home from './Menucomponents/Home'
import { AuthProvider } from './auth/AuthContext'
import { Notification } from './components/Notification'

function App() {
  return (
    <AuthProvider>
      <Notification />
      <Home />
    </AuthProvider>
  )
}

export default App
