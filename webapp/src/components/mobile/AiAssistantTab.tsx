import { useState, useRef, useEffect, useCallback } from 'react'
import type {
  Message,
  Session,
  ConversationsCache,
  ChatMessageResponse,
  TriageResult,
  TriageUIState,
} from '@shared/types'
import { TriageCard } from '../triage/TriageCard'
import { ToolCallProgress } from '../triage/ToolCallProgress'
import { SymptomInput } from './SymptomInput'
import { QuickChips } from './QuickChips'

interface AuthUser {
  id: string
  email: string | undefined
}

interface GeoProps {
  coords: { lat: number; lng: number } | null
  requestOnce: () => Promise<{ lat: number; lng: number } | null>
}

interface ProfileProps {
  location_preference: 'always' | 'ask'
  emergency_contact_phone?: string | null
}

type ProgressStage = 'idle' | 'analyzing' | 'locating' | 'complete'

interface AiAssistantTabProps {
  user: AuthUser | null
  cache: ConversationsCache | null
  sendMessage: (
    sessionId: string,
    content: string,
    coords?: { lat: number; lng: number } | null
  ) => Promise<ChatMessageResponse | null>
  createSession: (firstMessage: string) => Promise<Session | null>
  loadOlderMessages: (sessionId: string, beforeId: string) => Promise<Message[]>
  geo: GeoProps
  profile: ProfileProps | null
  triage: TriageUIState
  onTriageResult: (
    result: TriageResult,
    coords: { lat: number; lng: number } | null
  ) => Promise<void>
  onNewConversation: () => void
  symptomValue: string
  onSymptomChange: (v: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

export function AiAssistantTab({
  user,
  cache,
  sendMessage,
  createSession,
  loadOlderMessages,
  geo,
  profile,
  triage,
  onTriageResult,
  onNewConversation,
  symptomValue,
  onSymptomChange,
}: AiAssistantTabProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [localMessages, setLocalMessages] = useState<Message[]>([])
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [progressStage, setProgressStage] = useState<ProgressStage>('idle')
  const [pastConvosOpen, setPastConvosOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages])

  const handleNewConversation = () => {
    setActiveSessionId(null)
    setLocalMessages([])
    onSymptomChange('')
    onNewConversation()
  }

  const handleSelectSession = (session: Session) => {
    setActiveSessionId(session.id)
    setLocalMessages(cache?.messages[session.id] ?? [])
  }

  const handleSend = async () => {
    if (!symptomValue.trim() || !user) return
    const text = symptomValue.trim()
    onSymptomChange('')

    let coords = geo.coords
    if (!coords) {
      if (profile?.location_preference === 'always') {
        coords = await geo.requestOnce()
      } else if (!activeSessionId) {
        coords = await geo.requestOnce()
      }
    }

    let sid = activeSessionId
    if (!sid) {
      const session = await createSession(text)
      if (!session) return
      sid = session.id
      setActiveSessionId(sid)
    }

    const optimisticMsg: Message = {
      id: crypto.randomUUID(),
      session_id: sid,
      user_id: user.id,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setLocalMessages(prev => [...prev, optimisticMsg])

    setProgressStage('analyzing')
    const response = await sendMessage(sid, text, coords)

    setProgressStage('locating')
    await new Promise(r => setTimeout(r, 500))
    setProgressStage('complete')

    if (response) {
      setLocalMessages(prev => [
        ...prev.filter(m => m.id !== optimisticMsg.id),
        optimisticMsg,
        response.assistant_message,
      ])
      if (response.triage) {
        await onTriageResult(response.triage, coords)
      }
    }

    setTimeout(() => setProgressStage('idle'), 800)
  }

  const handleScroll = useCallback(async () => {
    const el = scrollContainerRef.current
    if (!el || !activeSessionId || localMessages.length === 0) return
    // column-reverse: scrollTop=0 is the visual bottom (newest msgs).
    // Load older messages when near the visual top = scrollTop near its maximum.
    const distanceFromTop = el.scrollHeight - el.clientHeight - el.scrollTop
    if (distanceFromTop > 50) return
    if (loadMoreRef.current) return

    const oldest = localMessages[0]
    if (!oldest.created_at.includes('+')) return

    loadMoreRef.current = true
    setLoadingOlder(true)
    try {
      const older = await loadOlderMessages(activeSessionId, oldest.id)
      if (older.length > 0) setLocalMessages(prev => [...older, ...prev])
    } finally {
      setLoadingOlder(false)
      loadMoreRef.current = false
    }
  }, [activeSessionId, localMessages, loadOlderMessages])

  const sessions = cache?.sessions ?? []
  const recentSessions = sessions.slice(0, 2)
  const hasMessages = localMessages.length > 0
  const lastMsg = localMessages[localMessages.length - 1]
  const showTriageCard = triage.active && lastMsg?.role === 'assistant'

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* AI header */}
      <div
        className="flex-none flex items-center justify-between px-4 bg-white border-b border-gray-100"
        style={{ minHeight: 48, paddingTop: 10, paddingBottom: 10 }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-none animate-pulse" />
          <div>
            <p className="text-[13px] font-bold text-gray-900 leading-tight">AI health assistant</p>
            <p className="text-[10px] text-gray-400">Online · secure &amp; confidential</p>
          </div>
        </div>
        <button
          onClick={handleNewConversation}
          disabled={!user}
          className="px-3 py-1.5 text-[11px] font-semibold text-blue-600 border border-blue-300 rounded-[20px] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ minHeight: 32 }}
        >
          ＋ New
        </button>
      </div>

      {/* Scrollable content */}
      {hasMessages ? (
        // column-reverse anchors content to the bottom — newest messages stay visible
        // without programmatic scroll. DOM order is reversed from visual order:
        //   1st child (DOM) = past conversations → visual bottom, just above input bar
        //   2nd child (DOM) = message thread     → visual top, grows upward
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col-reverse"
        >
          {/* 1st in DOM → visual bottom */}
          {user && recentSessions.length > 0 && (
            <div className="px-4 mt-4 pt-4 pb-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Past conversations
                </span>
                <button
                  onClick={() => setPastConvosOpen(v => !v)}
                  className="text-[11px] font-semibold text-blue-600"
                >
                  {pastConvosOpen ? 'Hide' : 'See'}
                </button>
              </div>
              <div
                style={{
                  maxHeight: pastConvosOpen ? '400px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.25s ease',
                }}
              >
                <div className="flex flex-col gap-2">
                  {recentSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      className="w-full text-left px-3 py-2.5 border border-gray-200 rounded-xl bg-white"
                    >
                      <p className="text-[9px] font-semibold text-gray-700 leading-snug">
                        {session.title}
                      </p>
                      <p className="text-[8px] text-gray-400 mt-0.5">
                        {formatDate(session.updated_at)}
                      </p>
                    </button>
                  ))}
                </div>
                <button className="text-[11px] font-semibold text-blue-600 mt-2 block">See all</button>
              </div>
            </div>
          )}

          {/* 2nd in DOM → visual top (message thread, chronological column within) */}
          <div className="flex flex-col gap-3 px-4 py-4">
            {loadingOlder && (
              <p className="text-center text-[11px] text-gray-400 py-2">Loading older messages…</p>
            )}
            {localMessages.map((msg, idx) => {
              const isLastAssistant = msg.role === 'assistant' && idx === localMessages.length - 1
              return (
                <div key={msg.id}>
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] px-3 py-2 text-[13px] leading-snug ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                      }`}
                      style={{
                        borderRadius:
                          msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                  {isLastAssistant && showTriageCard && (
                    <div className="mt-1 max-w-[80%]">
                      <TriageCard
                        triage={triage}
                        emergencyContactPhone={profile?.emergency_contact_phone ?? null}
                      />
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      ) : (
        // Empty state — centered, no column-reverse needed
        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center justify-center gap-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white">
                <path
                  d="M8 10h8M8 14h4M21 12c0 4.97-4.03 9-9 9-2.07 0-3.98-.7-5.5-1.88L3 20l.88-3.5C2.7 14.98 2 13.07 2 12c0-4.97 4.03-9 9-9s9 4.03 9 9z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-[17px] font-bold text-gray-900">How are you feeling?</h3>
            <p className="text-[13px] text-gray-500 mt-1 max-w-[240px] mx-auto">
              Describe your symptoms or ask a health-related question.
            </p>
          </div>
          <QuickChips
            onSelect={v => { if (user) onSymptomChange(v) }}
            disabled={!user}
          />
          {user && recentSessions.length > 0 && (
            <div className="w-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Past conversations
                </span>
                <button
                  onClick={() => setPastConvosOpen(v => !v)}
                  className="text-[11px] font-semibold text-blue-600"
                >
                  {pastConvosOpen ? 'Hide' : 'See'}
                </button>
              </div>
              <div
                style={{
                  maxHeight: pastConvosOpen ? '400px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.25s ease',
                }}
              >
                <div className="flex flex-col gap-2">
                  {recentSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      className="w-full text-left px-3 py-2.5 border border-gray-200 rounded-xl bg-white"
                    >
                      <p className="text-[9px] font-semibold text-gray-700 leading-snug">
                        {session.title}
                      </p>
                      <p className="text-[8px] text-gray-400 mt-0.5">
                        {formatDate(session.updated_at)}
                      </p>
                    </button>
                  ))}
                </div>
                <button className="text-[11px] font-semibold text-blue-600 mt-2 block">See all</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress trace */}
      <ToolCallProgress stage={progressStage} />

      {/* Pinned input */}
      <div className="flex-none px-4 py-3 bg-white border-t border-gray-100">
        <SymptomInput
          value={symptomValue}
          onChange={onSymptomChange}
          onSend={handleSend}
          disabled={!user}
          className="bg-gray-50"
        />
        <p className="text-[10px] font-semibold text-center text-gray-400 mt-2 flex items-center justify-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Secure &amp; confidential
        </p>
      </div>
    </div>
  )
}
