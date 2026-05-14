import { createContext, useContext, useState, useEffect } from "react"
import type { ReactNode } from "react"
import { supabase } from "../lib/supabaseClient"
import { authService } from "./authService"

interface AuthUser {
  id: string
  email: string | undefined
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  error: string | null
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    const { error: err } = await authService.signInWithEmail(email, password)
    if (err) setError(err.message)
    setLoading(false)
  }

  const signUpWithEmail = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    const { error: err } = await authService.signUpWithEmail(email, password)
    if (err) setError(err.message)
    setLoading(false)
  }

  const signInWithGoogle = async () => {
    setError(null)
    await authService.signInWithGoogle()
  }

  const signOut = async () => {
    setError(null)
    await authService.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user, loading, error,
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
