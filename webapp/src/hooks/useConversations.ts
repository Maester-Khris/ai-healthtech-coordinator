import { useState, useEffect, useRef } from "react"
import { useAuth } from "../auth/useAuth"
import { apiFetch } from "../lib/apiClient"
import type { Message, Session, ConversationsCache } from "@shared/types"

export type { Message, Session, ConversationsCache }

interface UseConversationsResult {
  cache: ConversationsCache | null
  loading: boolean
  error: string | null
  sendMessage: (sessionId: string, content: string) => Promise<Message | null>
  createSession: (firstMessage: string) => Promise<Session | null>
  loadOlderMessages: (sessionId: string, beforeId: string) => Promise<Message[]>
}

export function useConversations(): UseConversationsResult {
  const { user } = useAuth()
  const [cache, setCache] = useState<ConversationsCache | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const etagRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) { setCache(null); etagRef.current = null; return }

    let cancelled = false
    async function prefetch() {
      setLoading(true)
      try {
        const res = await apiFetch("/chat/sessions", {
          headers: etagRef.current ? { "If-None-Match": etagRef.current } : {},
        })
        if (res.status === 304) { setLoading(false); return }
        if (!res.ok) throw new Error(`Failed to load conversations (${res.status})`)
        const etag = res.headers.get("ETag")
        if (etag) etagRef.current = etag
        const data: ConversationsCache = await res.json()
        if (!cancelled) setCache(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    prefetch()
    return () => { cancelled = true }
  }, [user])

  const createSession = async (firstMessage: string): Promise<Session | null> => {
    const res = await apiFetch("/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ first_message: firstMessage }),
    })
    if (!res.ok) return null
    const session: Session = await res.json()
    setCache((prev: ConversationsCache | null) => prev
      ? { sessions: [session, ...prev.sessions], messages: { ...prev.messages, [session.id]: [] } }
      : { sessions: [session], messages: { [session.id]: [] } }
    )
    return session
  }

  const sendMessage = async (sessionId: string, content: string): Promise<Message | null> => {
    const res = await apiFetch("/chat/message", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, content }),
    })
    if (!res.ok) return null
    const data: { user_message: Message; assistant_message: Message } = await res.json()
    setCache((prev: ConversationsCache | null) => {
      if (!prev) return prev
      const existing = prev.messages[sessionId] ?? []
      return {
        ...prev,
        messages: { ...prev.messages, [sessionId]: [...existing, data.user_message, data.assistant_message] },
      }
    })
    return data.assistant_message
  }

  const loadOlderMessages = async (sessionId: string, beforeId: string): Promise<Message[]> => {
    const res = await apiFetch(`/chat/sessions/${sessionId}/messages?before_id=${beforeId}`)
    if (!res.ok) return []
    const data: { messages: Message[] } = await res.json()
    setCache((prev: ConversationsCache | null) => {
      if (!prev) return prev
      const existing = prev.messages[sessionId] ?? []
      return {
        ...prev,
        messages: { ...prev.messages, [sessionId]: [...data.messages, ...existing] },
      }
    })
    return data.messages
  }

  return { cache, loading, error, sendMessage, createSession, loadOlderMessages }
}
