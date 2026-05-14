import Home from './Menucomponents/Home'
import { AuthProvider } from './auth/AuthContext'

function App() {
  return (
    <AuthProvider>
      <Home />
    </AuthProvider>
  )
}

export default App
