import { useState, useEffect } from 'react'
import type {
  Facility,
  Message,
  Session,
  ConversationsCache,
  ChatMessageResponse,
  TriageResult,
} from '@shared/types'
import { MapTab } from './MapTab'
import { AiAssistantTab } from './AiAssistantTab'
import { MobileNavBar } from './MobileNavBar'
import { useAuth } from '../../auth/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useTriageState } from '../../hooks/useTriageState'

interface MobileLayoutProps {
  facilities: Facility[]
  facilitiesLoading: boolean
  conversationsCache: ConversationsCache | null
  sendMessage: (
    sessionId: string,
    content: string,
    coords?: { lat: number; lng: number } | null
  ) => Promise<ChatMessageResponse | null>
  createSession: (firstMessage: string) => Promise<Session | null>
  loadOlderMessages: (sessionId: string, beforeId: string) => Promise<Message[]>
}

type Tab = 'map' | 'ai'

function MapIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function MobileLayout({
  facilities,
  facilitiesLoading,
  conversationsCache,
  sendMessage,
  createSession,
  loadOlderMessages,
}: MobileLayoutProps) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const geo = useGeolocation()
  const { triage, applyTriageResult, reset: triageReset } = useTriageState()

  const [activeTab, setActiveTab] = useState<Tab>('map')
  const [sessionKey, setSessionKey] = useState(0)
  const [symptomValue, setSymptomValue] = useState('')

  useEffect(() => {
    if (!user) geo.setCoords(null)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewConversation = () => {
    triageReset()
    setSessionKey(k => k + 1)
    setSymptomValue('')
  }

  const handleApplyTriage = async (
    result: TriageResult,
    coords: { lat: number; lng: number } | null
  ) => {
    await applyTriageResult(result, coords)
    if (result.recommended_facility) {
      setTimeout(() => setActiveTab('map'), 1200)
    }
  }

  const handleMapSend = () => {
    if (symptomValue.trim()) setActiveTab('ai')
  }

  return (
    <div className="flex flex-col bg-[#F8FAFC]" style={{ height: '100dvh' }}>
      <MobileNavBar />

      {/* Tab bar — 36px */}
      <div
        className="flex-none flex bg-white border-b border-gray-100 z-10"
        style={{ height: 46 }}
      >
        {(['map', 'ai'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold transition-colors border-b-2 ${activeTab === tab
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-400 border-transparent'
              }`}
          >
            {tab === 'map' ? <MapIcon /> : <ChatIcon />}
            {tab === 'map' ? 'Map view' : 'AI assistant'}
          </button>
        ))}
      </div>

      {/* Tab content — both mounted to keep Leaflet alive */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className="absolute inset-0"
          style={{ display: activeTab === 'map' ? 'block' : 'none' }}
        >
          <MapTab
            facilities={facilities}
            facilitiesLoading={facilitiesLoading}
            triage={triage}
            symptomValue={symptomValue}
            onSymptomChange={setSymptomValue}
            onSymptomSend={handleMapSend}
            inputDisabled={!user}
            visible={activeTab === 'map'}
            onClear={handleNewConversation}
          />
        </div>

        <div
          className="absolute inset-0 flex flex-col"
          style={{ display: activeTab === 'ai' ? 'flex' : 'none' }}
        >
          <AiAssistantTab
            key={sessionKey}
            user={user}
            cache={conversationsCache}
            sendMessage={sendMessage}
            createSession={createSession}
            loadOlderMessages={loadOlderMessages}
            geo={geo}
            profile={profile}
            triage={triage}
            onTriageResult={handleApplyTriage}
            onNewConversation={handleNewConversation}
            symptomValue={symptomValue}
            onSymptomChange={setSymptomValue}
          />
        </div>
      </div>
    </div>
  )
}
