import { useState, useRef, useEffect, useCallback } from "react"
import type { Message, Session, ConversationsCache } from "@shared/types"

interface AuthUser {
  id: string
  email: string | undefined
}

interface ChatPanelProps {
  user: AuthUser | null
  cache: ConversationsCache | null
  sendMessage: (sessionId: string, content: string) => Promise<Message | null>
  createSession: (firstMessage: string) => Promise<Session | null>
  loadOlderMessages: (sessionId: string, beforeId: string) => Promise<Message[]>
}

const SUGGESTIONS = [
  "I have a fever and sore throat",
  "Chest pain and shortness of breath",
  "Twisted my ankle — it's swollen",
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
}

export function ChatPanel({ user, cache, sendMessage, createSession, loadOlderMessages }: ChatPanelProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [localMessages, setLocalMessages] = useState<Message[]>([])
  const [content, setContent] = useState("")
  const [pastConversationsOpen, setPastConversationsOpen] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [localMessages])

  const handleNewConversation = () => {
    setActiveSessionId(null)
    setLocalMessages([])
    setContent("")
    setPastConversationsOpen(false)
  }

  const handleSelectSession = (session: Session) => {
    setActiveSessionId(session.id)
    setLocalMessages(cache?.messages[session.id] ?? [])
    setPastConversationsOpen(false)
  }

  const handleSend = async () => {
    if (!content.trim() || !user) return
    const text = content.trim()
    setContent("")

    let sid = activeSessionId
    if (!sid) {
      const session = await createSession(text)
      if (!session) return
      sid = session.id
      setActiveSessionId(sid)
    }

    const optimisticUserMsg: Message = {
      id: crypto.randomUUID(),
      session_id: sid,
      user_id: user.id,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    }
    setLocalMessages(prev => [...prev, optimisticUserMsg])

    const assistantMsg = await sendMessage(sid, text)
    if (assistantMsg) {
      setLocalMessages(prev => {
        // replace optimistic user msg with nothing — keep it, just append assistant
        return [...prev, assistantMsg]
      })
    }
  }

  const handleScroll = useCallback(async () => {
    const el = scrollContainerRef.current
    if (!el || !activeSessionId || loadingOlder || localMessages.length === 0) return
    if (el.scrollTop > 40) return

    setLoadingOlder(true)
    const oldest = localMessages[0]
    const older = await loadOlderMessages(activeSessionId, oldest.id)
    if (older.length > 0) {
      setLocalMessages(prev => [...older, ...prev])
    }
    setLoadingOlder(false)
  }, [activeSessionId, loadingOlder, localMessages, loadOlderMessages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const sessions = cache?.sessions ?? []
  const hasMessages = localMessages.length > 0

  return (
    <div className="flex flex-col h-full bg-slate-50/50 relative">
      {/* Panel header */}
      <div className="flex-none px-6 py-4 border-b border-gray-100 bg-white shadow-sm z-20 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4V20M4 12H20" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="12" cy="12" r="8" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900 tracking-tight leading-tight">AI Health Assistant</h2>
              <p className="text-xs font-semibold text-blue-600 mt-0.5">Ready to assist you</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewConversation}
              disabled={!user}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                user
                  ? "text-gray-600 border-gray-200 bg-white hover:border-gray-300 hover:text-gray-900"
                  : "text-gray-300 border-gray-100 bg-gray-50 cursor-not-allowed"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              New conversation
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100/50 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-emerald-700 tracking-wide uppercase">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Past conversations — only when logged in */}
      {user && sessions.length > 0 && (
        <div className="flex-none border-b border-gray-100 bg-white z-10">
          <button
            onClick={() => setPastConversationsOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>Past conversations</span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
              className={`transition-transform ${pastConversationsOpen ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {pastConversationsOpen && (
            <div className="border-t border-gray-100">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className="w-full flex items-center justify-between px-6 py-2.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-700 truncate">{session.title}</span>
                  <span className="text-xs text-gray-400 flex-none ml-2">{formatDate(session.updated_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message area / empty state */}
      {hasMessages ? (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          <div className="flex flex-col justify-end min-h-full gap-3">
            {loadingOlder && (
              <div className="text-center text-xs text-gray-400 py-2">Loading older messages…</div>
            )}
            {localMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
          <div className="text-center z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 text-white">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 10h8M8 14h4M21 12c0 4.97-4.03 9-9 9-2.07 0-3.98-.7-5.5-1.88L3 20l.88-3.5C2.7 14.98 2 13.07 2 12c0-4.97 4.03-9 9-9s9 4.03 9 9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">How are you feeling?</h3>
            <p className="text-sm font-medium text-gray-500 mt-2 max-w-[240px]">
              Describe your symptoms or ask a health-related question.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full z-10 mt-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => { if (user) setContent(s) }}
                className="group w-full flex items-center gap-3 text-left px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all shadow-sm"
              >
                <div className="w-7 h-7 rounded-full bg-gray-100 group-hover:bg-white flex items-center justify-center flex-none text-gray-400 group-hover:text-blue-500 transition-colors shadow-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="truncate">{s}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-none bg-white px-4 py-3 z-20 border-t border-gray-100 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.03)] relative">
        <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all shadow-sm">
          <div className="pl-2.5 pr-1 text-blue-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21h6m-3-18c-3.866 0-7 3.134-7 7 0 2.21 1.028 4.185 2.632 5.487C9.28 16.035 9.8 16.924 9.8 17.9V19a2 2 0 002 2h4a2 2 0 002-2v-1.1c0-.976.52-1.865 1.168-2.413C20.972 14.185 22 12.21 22 10c0-3.866-3.134-7-7-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <textarea
            disabled={!user}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent resize-none text-[13px] font-medium text-gray-900 px-2 py-2 focus:outline-none placeholder-gray-400 disabled:cursor-not-allowed"
            placeholder={user ? "Describe how you feel…" : "Sign in to start a conversation"}
            rows={1}
          />
          <div className="pr-1 pl-1">
            <button
              disabled={!user || !content.trim()}
              onClick={handleSend}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all shadow-md active:scale-95 ${
                user && content.trim()
                  ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                  : "bg-gray-200 cursor-not-allowed shadow-none"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-[10px] font-semibold text-center text-gray-400 mt-2 flex items-center justify-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Secure & confidential. Location requested on first message.
        </p>
      </div>
    </div>
  )
}
