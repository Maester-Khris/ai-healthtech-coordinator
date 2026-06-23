import { useEffect, useState } from "react"
import { useAuth } from "../../auth/useAuth"

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: "signin" | "signup"
}

export function LoginModal({ isOpen, onClose, defaultTab = "signin" }: LoginModalProps) {
  const { loading, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
  const [tab, setTab] = useState<"signin" | "signup">(defaultTab)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    if (isOpen) setTab(defaultTab)
  }, [isOpen, defaultTab])

  if (!isOpen) return null

  const handleEmailAction = async () => {
    if (tab === "signin") {
      await signInWithEmail(email, password)
    } else {
      await signUpWithEmail(email, password)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4 surface-card shell-bezel rounded-stratum-lg p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className="absolute top-4 right-4 text-stratum-text-muted hover:text-stratum-text transition-colors text-xl leading-none"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        {/* Logo + title */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-stratum-text">
            {tab === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-stratum-text-muted mt-1">
            {tab === "signin"
              ? "Sign in to your MediCoord account"
              : "Get started with MediCoord AI"}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-stratum-md bg-stratum-bg p-1 mb-6">
          <button
            className={`flex-1 py-2 text-sm font-semibold rounded-stratum-md transition-all ${
              tab === "signin"
                ? "bg-white text-stratum-text shadow-sm"
                : "text-stratum-text-muted hover:text-stratum-text"
            }`}
            onClick={() => setTab("signin")}
          >
            Sign in
          </button>
          <button
            className={`flex-1 py-2 text-sm font-semibold rounded-stratum-md transition-all ${
              tab === "signup"
                ? "bg-white text-stratum-text shadow-sm"
                : "text-stratum-text-muted hover:text-stratum-text"
            }`}
            onClick={() => setTab("signup")}
          >
            Sign up
          </button>
        </div>

        {/* Email + password fields */}
        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-stratum-text mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 text-sm border border-stratum-border rounded-stratum-md focus:outline-none focus:ring-2 focus:ring-stratum-accent focus:border-transparent"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stratum-text mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 text-sm border border-stratum-border rounded-stratum-md focus:outline-none focus:ring-2 focus:ring-stratum-accent focus:border-transparent"
              disabled={loading}
            />
          </div>
        </div>

        {/* Primary action button */}
        <button
          className="w-full py-2.5 text-sm font-semibold text-white rounded-stratum-control bg-stratum-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 mb-3"
          onClick={handleEmailAction}
          disabled={loading}
        >
          {loading
            ? "Please wait…"
            : tab === "signin"
            ? "Sign in"
            : "Create account"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-stratum-border" />
          <span className="text-xs text-stratum-text-muted font-medium">or</span>
          <div className="flex-1 h-px bg-stratum-border" />
        </div>

        {/* Google button */}
        <button
          className="w-full flex items-center justify-center gap-3 py-2.5 text-sm font-semibold text-stratum-text border border-stratum-border rounded-stratum-control hover:bg-stratum-bg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}
