import { useState, useEffect } from 'react'
import type { Facility, Message, Session, ConversationsCache, ChatMessageResponse } from '@shared/types'
import { MapPanel } from './subcomponent/MapPanel'
import { ChatPanel } from './subcomponent/ChatPanel'
import { LoginModal } from '../components/auth/LoginModal'
import { UserMenu } from '../components/auth/UserMenu'
import { GettingStartedModal } from '../components/onboarding/GettingStartedModal'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useGeolocation } from '../hooks/useGeolocation'
import { useTriageState } from '../hooks/useTriageState'

interface HomeProps {
  facilities: Facility[]
  facilitiesLoading: boolean
  conversationsCache: ConversationsCache | null
  sendMessage: (sessionId: string, content: string, coords?: { lat: number; lng: number } | null) => Promise<ChatMessageResponse | null>
  createSession: (firstMessage: string) => Promise<Session | null>
  loadOlderMessages: (sessionId: string, beforeId: string) => Promise<Message[]>
}

export default function Home({ facilities, facilitiesLoading, conversationsCache, sendMessage, createSession, loadOlderMessages }: HomeProps) {
  const { user } = useAuth()
  const { profile, updateProfile } = useProfile()
  const geo = useGeolocation()
  const { triage, applyTriageResult, reset: triageReset } = useTriageState()
  const [sessionKey, setSessionKey] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<"signin" | "signup">("signin")
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  const handleNewConversation = () => {
    triageReset()
    setSessionKey(k => k + 1)  // remounts ChatPanel, clearing all local state
  }

  useEffect(() => {
    if (!user) geo.setCoords(null)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOnboardingComplete = async (data: {
    location_preference: 'always' | 'ask'
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
  }) => {
    await updateProfile({ ...data, getting_started_done: true })
  }

  const openSignIn = () => { setModalTab("signin"); setIsModalOpen(true) }
  const openSignUp = () => { setModalTab("signup"); setIsModalOpen(true) }

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} defaultTab={modalTab} />
      {user && profile && !profile.getting_started_done && !onboardingDismissed && (
        <GettingStartedModal
          onComplete={handleOnboardingComplete}
          onClose={() => setOnboardingDismissed(true)}
          geo={geo}
        />
      )}

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
          <MapPanel
            facilities={facilities}
            facilitiesLoading={facilitiesLoading}
            triage={triage}
            onClear={handleNewConversation}
          />
        </div>

        {/* Chat panel */}
        <div className="flex-[3] overflow-hidden rounded-2xl shadow-sm border border-gray-200 bg-white relative min-w-[320px]">
          <ChatPanel
            key={sessionKey}
            user={user}
            cache={conversationsCache}
            sendMessage={sendMessage}
            createSession={createSession}
            loadOlderMessages={loadOlderMessages}
            geo={geo}
            profile={profile}
            triage={triage}
            onTriageResult={applyTriageResult}
            onNewConversation={handleNewConversation}
          />
        </div>
      </div>
    </div>
  )
}
