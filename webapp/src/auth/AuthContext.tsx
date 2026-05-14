// Minimal context — will be fully implemented in Part 2
import { createContext, useContext, useState, ReactNode } from "react"

interface AuthUser {
  id: string
  email: string | undefined
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(false)

  // Stubbed — implemented in Part 2
  const signInWithEmail = async (_email: string, _password: string) => {}
  const signUpWithEmail = async (_email: string, _password: string) => {}
  const signInWithGoogle = async () => {}
  const signOut = async () => {}

  return (
    <AuthContext.Provider value={{
      user, loading,
      signInWithEmail, signUpWithEmail, signInWithGoogle, signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
