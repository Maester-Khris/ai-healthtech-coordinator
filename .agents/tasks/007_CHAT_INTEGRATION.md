# Task: Chat — Backend API + Frontend Integration

**ID:** 008
**Scope:** `backend`, `frontend`
**Branch:** `feat/profile-chat` (same branch as task 007)
**Tests required:** no

---

## Context

Task 007 delivered the SQL migrations and frontend shell.
This task wires the backend API and integrates the frontend with it.

LLM integration is deferred — the assistant response is a stub:
first 50 characters of the user message, trimmed, with `...` appended
if the original message exceeds 50 characters.

Two-layer in-memory cache:
- FastAPI: per-user cache, populated lazily on first request, updated
  inline when messages are written (writer-updates-cache pattern)
- React: populated on login via silent prefetch, updated on new messages

---

## Part 1 — Backend

### New file: `backend/models.py` additions

Add to existing `models.py`:

```python
class SessionBase(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

class MessageBase(BaseModel):
    id: UUID
    session_id: UUID
    user_id: UUID
    role: str           # 'user' | 'assistant'
    content: str
    created_at: datetime

class SendMessageRequest(BaseModel):
    session_id: UUID
    content: str = Field(..., min_length=1, max_length=4000)

class CreateSessionRequest(BaseModel):
    first_message: str = Field(..., min_length=1, max_length=4000)

class SessionWithMessages(BaseModel):
    session: SessionBase
    messages: list[MessageBase]

class PastConversationsResponse(BaseModel):
    sessions: list[SessionWithMessages]
    etag: str
```

Update `shared/types.ts` to mirror these — flag in outcome summary
if `shared/types.ts` does not yet exist.

### New file: `backend/cache_chat.py`

Per-user chat cache. Separate from `cache.py` (facilities cache)
to keep concerns isolated.

```python
import hashlib
import json
from datetime import datetime
from typing import Any

# Structure:
# {
#   "user_uuid": {
#     "sessions": [...],
#     "messages": { "session_uuid": [...] },
#     "etag": "...",
#     "cached_at": datetime
#   }
# }
_chat_cache: dict[str, dict[str, Any]] = {}

def get_user_cache(user_id: str) -> tuple[dict | None, str | None]:
    entry = _chat_cache.get(user_id)
    if not entry:
        return None, None
    return entry, entry.get("etag")

def set_user_cache(user_id: str, sessions: list[dict], messages: dict[str, list[dict]]) -> str:
    payload = {"sessions": sessions, "messages": messages}
    serialized = json.dumps(payload, sort_keys=True, default=str)
    etag = f'"{hashlib.sha256(serialized.encode()).hexdigest()[:32]}"'
    _chat_cache[user_id] = {
        "sessions": sessions,
        "messages": messages,
        "etag": etag,
        "cached_at": datetime.utcnow(),
    }
    return etag

def append_message_to_cache(user_id: str, session_id: str, message: dict) -> None:
    """Called after every successful message write — keeps cache in sync."""
    entry = _chat_cache.get(user_id)
    if not entry:
        return
    msgs = entry["messages"].setdefault(session_id, [])
    msgs.append(message)
    # Recompute etag after mutation
    set_user_cache(user_id, entry["sessions"], entry["messages"])

def append_session_to_cache(user_id: str, session: dict) -> None:
    """Called after a new session is created."""
    entry = _chat_cache.get(user_id)
    if not entry:
        return
    entry["sessions"].insert(0, session)    # most recent first
    entry["messages"][session["id"]] = []   # empty message list for new session
    set_user_cache(user_id, entry["sessions"], entry["messages"])
```

### New file: `backend/services/chat.py`

```python
import os
from uuid import UUID
from backend.db import get_supabase_client

def generate_session_title(first_message: str) -> str:
    title = first_message.strip()
    return title[:50] + ("..." if len(title) > 50 else "")

def create_session(user_id: str, title: str) -> dict:
    client = get_supabase_client()
    response = client.table("sessions").insert({
        "user_id": user_id,
        "title": title,
    }).execute()
    return response.data[0]

def add_message(session_id: str, user_id: str, role: str, content: str) -> dict:
    client = get_supabase_client()
    response = client.table("messages").insert({
        "session_id": session_id,
        "user_id": user_id,
        "role": role,
        "content": content,
    }).execute()
    return response.data[0]

def get_past_conversations(user_id: str, session_limit: int = 5, message_limit: int = 20) -> tuple[list, dict]:
    """
    Returns (sessions_list, messages_dict).
    sessions_list: up to `session_limit` most recent sessions for the user
    messages_dict: { session_id: [last `message_limit` messages] }
    """
    client = get_supabase_client()

    sessions_resp = client.table("sessions") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("updated_at", desc=True) \
        .limit(session_limit) \
        .execute()

    sessions = sessions_resp.data or []
    messages: dict[str, list] = {}

    for session in sessions:
        sid = session["id"]
        msgs_resp = client.table("messages") \
            .select("*") \
            .eq("session_id", sid) \
            .order("created_at", desc=True) \
            .limit(message_limit) \
            .execute()
        # Reverse so messages are chronological (oldest first for display)
        messages[sid] = list(reversed(msgs_resp.data or []))

    return sessions, messages

def get_older_messages(session_id: str, before_id: str, limit: int = 20) -> list:
    """
    Cursor-based pagination — load messages older than `before_id`.
    Used when user scrolls up in a conversation.
    NOTE: this always hits Supabase — older messages are not cached.
    """
    client = get_supabase_client()

    # Get the created_at of the cursor message
    cursor_resp = client.table("messages") \
        .select("created_at") \
        .eq("id", before_id) \
        .single() \
        .execute()

    if not cursor_resp.data:
        return []

    cursor_ts = cursor_resp.data["created_at"]

    resp = client.table("messages") \
        .select("*") \
        .eq("session_id", session_id) \
        .lt("created_at", cursor_ts) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()

    return list(reversed(resp.data or []))
```

### New file: `backend/routers/chat.py`

All chat endpoints. Registered in `main.py` as a router.
All endpoints require authentication via `get_current_user` dependency.
All endpoints log `request_id` from `request.state`.

```python
from fastapi import APIRouter, Depends, Request, HTTPException, Header
from fastapi.responses import JSONResponse, Response
from backend.middleware.auth import get_current_user
from backend.models import CreateSessionRequest, SendMessageRequest
from backend.services.chat import (
    generate_session_title, create_session, add_message,
    get_past_conversations, get_older_messages
)
from backend.cache_chat import (
    get_user_cache, set_user_cache,
    append_message_to_cache, append_session_to_cache
)
import logging
import json
import hashlib

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)


@router.get("/sessions")
async def past_conversations(
    request: Request,
    if_none_match: str = Header(default=""),
    current_user=Depends(get_current_user),
):
    """
    Returns the 5 most recent sessions with their 20 latest messages each.
    Supports ETag conditional requests — returns 304 if data unchanged.
    """
    user_id = str(current_user.id)
    logger.info("past_conversations requested",
                extra={"request_id": getattr(request.state, "request_id", None),
                       "user_id": user_id})

    cached, cached_etag = get_user_cache(user_id)

    if cached is None:
        # Cache miss — fetch from Supabase
        sessions, messages = get_past_conversations(user_id)
        cached_etag = set_user_cache(user_id, sessions, messages)
        cached = {"sessions": sessions, "messages": messages}
        logger.info("chat cache miss — fetched from Supabase",
                    extra={"user_id": user_id, "session_count": len(sessions)})
    else:
        logger.info("chat cache hit",
                    extra={"user_id": user_id})

    if if_none_match == cached_etag:
        return Response(status_code=304)

    return JSONResponse(
        content=cached,
        headers={"ETag": cached_etag, "Cache-Control": "no-cache"},
    )


@router.post("/sessions")
async def create_new_session(
    body: CreateSessionRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """
    Creates a new chat session. Title is derived from the first message.
    Returns the created session object.
    """
    user_id = str(current_user.id)
    title = generate_session_title(body.first_message)

    session = create_session(user_id=user_id, title=title)
    append_session_to_cache(user_id, session)

    logger.info("session created",
                extra={"request_id": getattr(request.state, "request_id", None),
                       "user_id": user_id, "session_id": session["id"],
                       "title": title})
    return session


@router.post("/message")
async def send_message(
    body: SendMessageRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    """
    Saves a user message, generates a stub assistant response,
    saves the assistant message, updates the in-memory cache.
    Returns both the user message and the assistant response.
    """
    user_id = str(current_user.id)
    session_id = str(body.session_id)
    request_id = getattr(request.state, "request_id", None)

    logger.info("message received",
                extra={"request_id": request_id,
                       "user_id": user_id,
                       "session_id": session_id,
                       "content_length": len(body.content)})

    # Write user message
    user_msg = add_message(
        session_id=session_id,
        user_id=user_id,
        role="user",
        content=body.content,
    )

    # Stub assistant response — first 50 chars of user message
    stub = body.content.strip()[:50] + ("..." if len(body.content.strip()) > 50 else "")
    assistant_msg = add_message(
        session_id=session_id,
        user_id=user_id,
        role="assistant",
        content=stub,
    )

    # Update in-memory cache (writer-updates-cache pattern)
    append_message_to_cache(user_id, session_id, user_msg)
    append_message_to_cache(user_id, session_id, assistant_msg)

    logger.info("message pair written",
                extra={"request_id": request_id,
                       "user_id": user_id,
                       "session_id": session_id})

    return {"user_message": user_msg, "assistant_message": assistant_msg}


@router.get("/sessions/{session_id}/messages")
async def load_older_messages(
    session_id: str,
    before_id: str,
    request: Request,
    current_user=Depends(get_current_user),
):
    """
    Cursor-based pagination — returns messages older than `before_id`.
    Always hits Supabase (older messages are not cached).
    Updates the in-memory cache with the newly loaded messages.
    """
    user_id = str(current_user.id)
    messages = get_older_messages(session_id=session_id, before_id=before_id)

    # Prepend to cache for this session
    for msg in reversed(messages):
        entry = get_user_cache(user_id)[0]
        if entry:
            session_msgs = entry["messages"].get(session_id, [])
            entry["messages"][session_id] = [msg] + session_msgs

    return {"messages": messages}
```

### Update `backend/main.py`

Register the chat router:
```python
from backend.routers.chat import router as chat_router
app.include_router(chat_router)
```

---

## Part 2 — Frontend Integration

### New file: `webapp/src/hooks/useConversations.ts`

Silent prefetch hook. Fires after login. Same ETag pattern as `useFacilities`.

```typescript
import { useState, useEffect, useRef } from "react"
import { useAuth } from "../auth/AuthContext"
import { apiFetch } from "../lib/apiClient"

export interface Message {
  id: string
  session_id: string
  user_id: string
  role: "user" | "assistant"
  content: string
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ConversationsCache {
  sessions: Session[]
  messages: Record<string, Message[]>
}

interface UseConversationsResult {
  cache: ConversationsCache | null
  loading: boolean
  error: string | null
  sendMessage: (sessionId: string, content: string) => Promise<Message | null>
  createSession: (firstMessage: string) => Promise<Session | null>
  loadOlderMessages: (sessionId: string, beforeId: string) => Promise<Message[]>
  appendToCache: (sessionId: string, userMsg: Message, assistantMsg: Message) => void
}

export function useConversations(): UseConversationsResult {
  const { user } = useAuth()
  const [cache, setCache] = useState<ConversationsCache | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const etagRef = useRef<string | null>(null)

  // Silent prefetch on login
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
  }, [user?.id])

  const createSession = async (firstMessage: string): Promise<Session | null> => {
    const res = await apiFetch("/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ first_message: firstMessage }),
    })
    if (!res.ok) return null
    const session: Session = await res.json()
    // Append to React cache
    setCache(prev => prev ? {
      sessions: [session, ...prev.sessions],
      messages: { ...prev.messages, [session.id]: [] },
    } : { sessions: [session], messages: { [session.id]: [] } })
    return session
  }

  const sendMessage = async (sessionId: string, content: string): Promise<Message | null> => {
    const res = await apiFetch("/chat/message", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, content }),
    })
    if (!res.ok) return null
    const data: { user_message: Message; assistant_message: Message } = await res.json()
    // Append both messages to React cache
    setCache(prev => {
      if (!prev) return prev
      const existing = prev.messages[sessionId] ?? []
      return {
        ...prev,
        messages: {
          ...prev.messages,
          [sessionId]: [...existing, data.user_message, data.assistant_message],
        },
      }
    })
    return data.assistant_message
  }

  const loadOlderMessages = async (sessionId: string, beforeId: string): Promise<Message[]> => {
    const res = await apiFetch(`/chat/sessions/${sessionId}/messages?before_id=${beforeId}`)
    if (!res.ok) return []
    const data: { messages: Message[] } = await res.json()
    // Prepend to React cache for this session
    setCache(prev => {
      if (!prev) return prev
      const existing = prev.messages[sessionId] ?? []
      return {
        ...prev,
        messages: {
          ...prev.messages,
          [sessionId]: [...data.messages, ...existing],
        },
      }
    })
    return data.messages
  }

  const appendToCache = (sessionId: string, userMsg: Message, assistantMsg: Message) => {
    setCache(prev => {
      if (!prev) return prev
      const existing = prev.messages[sessionId] ?? []
      return {
        ...prev,
        messages: {
          ...prev.messages,
          [sessionId]: [...existing, userMsg, assistantMsg],
        },
      }
    })
  }

  return { cache, loading, error, sendMessage, createSession, loadOlderMessages, appendToCache }
}
```

### Update `webapp/src/components/chat/ChatPanel.tsx`

Wire real data from `useConversations`. Pass hook results as props from `App.tsx`.

**New conversation button:**
```typescript
const handleNewConversation = () => {
  setActiveSessionId(null)
  setLocalMessages([])
}
```

**Send button:**
```typescript
const handleSend = async () => {
  if (!content.trim() || !user) return
  const text = content.trim()
  setContent("")

  let sid = activeSessionId
  if (!sid) {
    // First message in a new session
    const session = await createSession(text)
    if (!session) return
    sid = session.id
    setActiveSessionId(sid)
  }

  // Optimistic update — show user message immediately
  const optimisticUserMsg: Message = {
    id: crypto.randomUUID(), session_id: sid,
    user_id: user.id, role: "user", content: text,
    created_at: new Date().toISOString(),
  }
  setLocalMessages(prev => [...prev, optimisticUserMsg])

  const assistantMsg = await sendMessage(sid, text)
  if (assistantMsg) {
    setLocalMessages(prev => [...prev, assistantMsg])
  }
}
```

**Past conversations dropdown:**
Replace the hardcoded stubs from task 007 with real data from `cache.sessions`.
Each item shows `session.title` and formatted `session.updated_at`.
On click: set `activeSessionId`, load `cache.messages[session.id]`
into `localMessages`.

**Load older messages:**
When the user scrolls to the top of the message list and `localMessages`
has at least one message:
```typescript
const oldest = localMessages[0]
const older = await loadOlderMessages(activeSessionId, oldest.id)
setLocalMessages(prev => [...older, ...prev])
```

### Update `webapp/src/App.tsx`

- Call `useConversations()` at app level (alongside `useFacilities`, `useProfile`)
- Pass `{ cache, loading, sendMessage, createSession, loadOlderMessages }` to `ChatPanel`
- `useConversations` fires silently after login — no loading state shown to the user

---

## Part 2 — Commits (max 4)

```bash
# Commit 1 — backend models + cache
git add backend/models.py \
        backend/cache_chat.py
git commit -m "feat(backend): chat models and per-user in-memory cache"

# Commit 2 — chat service + router
git add backend/services/chat.py \
        backend/routers/chat.py \
        backend/main.py
git commit -m "feat(backend): chat endpoints — sessions, messages, past conversations with ETag"

# Commit 3 — frontend hook
git add webapp/src/hooks/useConversations.ts
git commit -m "feat(frontend): useConversations hook — prefetch, ETag, send, create session, load older"

# Commit 4 — frontend integration
git add webapp/src/components/chat/ChatPanel.tsx \
        webapp/src/App.tsx \
        shared/types.ts
git commit -m "feat(frontend): chat panel wired to backend — real conversations, optimistic updates, session creation"
```

---

## Verification checklist

- [ ] `doppler run -- python -m uvicorn main:app --host 0.0.0.0 --port 8000` starts clean
- [ ] `GET /chat/sessions` without auth returns 401
- [ ] `GET /chat/sessions` with valid Bearer token returns 200 with ETag
- [ ] Second `GET /chat/sessions` with matching `If-None-Match` returns 304
- [ ] `POST /chat/sessions` creates a session with truncated title
- [ ] `POST /chat/message` returns user + assistant messages (stub response)
- [ ] Render logs show JSON entries for each chat endpoint call with `request_id`
- [ ] `npx tsc --noEmit` passes
- [ ] After login: browser Network tab shows `GET /chat/sessions` firing silently
- [ ] Typing a message and clicking Send: session created, messages appear in chat
- [ ] Past conversations dropdown shows real session titles
- [ ] Clicking a past conversation loads its cached messages
- [ ] Scrolling to top loads older messages from backend

---

## Out of Scope

- LLM integration — stub response only (`first 50 chars + ...`)
- Map updates on message send — triage sprint
- Geolocation on message send — triage sprint
- WebSockets / Supabase Realtime — deferred
- Message search — deferred
- Session deletion — deferred