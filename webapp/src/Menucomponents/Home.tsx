import { useState } from 'react'
import type { Facility } from '../../../shared/types'
import { MapPanel } from './subcomponent/MapPanel'
import { ChatPanel } from './subcomponent/ChatPanel'
import { LoginModal } from '../components/auth/LoginModal'
import { UserMenu } from '../components/auth/UserMenu'
import { useAuth } from '../auth/AuthContext'

interface HomeProps {
  facilities: Facility[]
  facilitiesLoading: boolean
}

export default function Home({ facilities, facilitiesLoading }: HomeProps) {
  const { user } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<"signin" | "signup">("signin")

  const openSignIn = () => { setModalTab("signin"); setIsModalOpen(true) }
  const openSignUp = () => { setModalTab("signup"); setIsModalOpen(true) }

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} defaultTab={modalTab} />

      {/* Header */}
      <header className="h-[64px] flex-none flex items-center justify-between px-8 border-b border-gray-200 bg-white z-10 shadow-sm">
        {/* Logo + wordmark */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl flex-none overflow-hidden shadow-md"
          >
            <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
          </div>
          <div className="leading-tight flex flex-col">
            <span className="text-lg font-bold text-gray-900 tracking-tight">MediCoord<span className="text-blue-600">AI</span></span>
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Health Tech Platform</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex items-center justify-center gap-8">
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {user ? (
            <UserMenu />
          ) : (
            <>
              <button
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                onClick={openSignIn}
              >
                Sign in
              </button>
              <button
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 transition-all active:scale-95"
                onClick={openSignUp}
              >
                Get started
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Body — 70/30 split */}
      <div className="flex flex-1 overflow-hidden p-5 gap-5">
        {/* Map panel */}
        <div className="flex-[7] overflow-hidden rounded-2xl shadow-sm border border-gray-200 bg-white relative">
          <MapPanel facilities={facilities} facilitiesLoading={facilitiesLoading} />
        </div>

        {/* Chat panel */}
        <div className="flex-[3] overflow-hidden rounded-2xl shadow-sm border border-gray-200 bg-white relative min-w-[320px]">
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}
