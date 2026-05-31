import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { DrawerMenu } from './DrawerMenu'
import { LoginModal } from '../auth/LoginModal'

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18M3 12h18M3 18h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Shared mobile nav bar — 56px tall. Manages its own drawer and login modal state. */
export function MobileNavBar() {
  const { user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  const initials = user?.email ? user.email[0].toUpperCase() : '?'

  return (
    <>
      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} defaultTab="signin" />

      <header
        className="flex-none flex items-center justify-between px-4 bg-white border-b border-gray-200 z-10 shadow-sm"
        style={{ height: 56 }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 no-underline">
          <div className="w-7 h-7 rounded-lg overflow-hidden shadow-sm flex-none">
            <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
          </div>
          <span className="text-[15px] font-bold text-gray-900 tracking-tight">
            MediCoord<span className="text-blue-600">AI</span>
          </span>
        </Link>

        {/* Right side */}
        {user ? (
          <div className="flex items-center gap-1 flex-none">
            {/* Avatar — identity indicator, not interactive */}
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold select-none">
              {initials}
            </div>
            {/* Hamburger — opens drawer */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center justify-center text-gray-700 rounded-md"
              style={{ minWidth: 36, minHeight: 36 }}
              aria-label="Open menu"
            >
              <HamburgerIcon />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setLoginOpen(true)}
            className="text-[12px] font-semibold text-blue-600 px-3 py-1.5"
            style={{ minHeight: 36 }}
          >
            Sign in
          </button>
        )}
      </header>
    </>
  )
}
