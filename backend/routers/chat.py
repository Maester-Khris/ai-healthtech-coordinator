import logging
import json

from fastapi import APIRouter, Depends, Request, Header
from fastapi.responses import JSONResponse, Response

from middleware.auth import get_current_user
from models import CreateSessionRequest, SendMessageRequest
from services.chat import (
    generate_session_title, create_session, add_message,
    get_past_conversations, get_older_messages,
)
from cache_chat import (
    get_user_cache, set_user_cache,
    append_message_to_cache, append_session_to_cache,
)

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)


@router.get("/sessions")
async def past_conversations(
    request: Request,
    if_none_match: str = Header(default=""),
    current_user: object = Depends(get_current_user),
) -> Response:
    """
    Returns the 5 most recent sessions with their 20 latest messages each.
    Supports ETag conditional requests — returns 304 if data unchanged.
    """
    user_id = str(current_user.id)  # type: ignore[attr-defined]
    logger.info(
        "past_conversations requested",
        extra={"request_id": getattr(request.state, "request_id", None), "user_id": user_id},
    )

    cached, cached_etag = get_user_cache(user_id)

    if cached is None:
        sessions, messages = get_past_conversations(user_id)
        cached_etag = set_user_cache(user_id, sessions, messages)
        cached = {"sessions": sessions, "messages": messages}
        logger.info(
            "chat cache miss — fetched from Supabase",
            extra={"user_id": user_id, "session_count": len(sessions)},
        )
    else:
        logger.info("chat cache hit", extra={"user_id": user_id})

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
    current_user: object = Depends(get_current_user),
) -> dict:
    """Creates a new chat session. Title is derived from the first message."""
    user_id = str(current_user.id)  # type: ignore[attr-defined]
    title = generate_session_title(body.first_message)

    session = create_session(user_id=user_id, title=title)
    append_session_to_cache(user_id, session)

    logger.info(
        "session created",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "user_id": user_id,
            "session_id": session["id"],
            "title": title,
        },
    )
    return session


@router.post("/message")
async def send_message(
    body: SendMessageRequest,
    request: Request,
    current_user: object = Depends(get_current_user),
) -> dict:
    """
    Saves a user message, generates a stub assistant response,
    saves the assistant message, updates the in-memory cache.
    Returns both the user message and the assistant response.
    """
    user_id = str(current_user.id)  # type: ignore[attr-defined]
    session_id = str(body.session_id)
    request_id = getattr(request.state, "request_id", None)

    logger.info(
        "message received",
        extra={
            "request_id": request_id,
            "user_id": user_id,
            "session_id": session_id,
            "content_length": len(body.content),
        },
    )

    user_msg = add_message(
        session_id=session_id,
        user_id=user_id,
        role="user",
        content=body.content,
    )

    stub = body.content.strip()[:50] + ("..." if len(body.content.strip()) > 50 else "")
    assistant_msg = add_message(
        session_id=session_id,
        user_id=user_id,
        role="assistant",
        content=stub,
    )

    append_message_to_cache(user_id, session_id, user_msg)
    append_message_to_cache(user_id, session_id, assistant_msg)

    logger.info(
        "message pair written",
        extra={"request_id": request_id, "user_id": user_id, "session_id": session_id},
    )

    return {"user_message": user_msg, "assistant_message": assistant_msg}


@router.get("/sessions/{session_id}/messages")
async def load_older_messages(
    session_id: str,
    before_id: str,
    request: Request,
    current_user: object = Depends(get_current_user),
) -> dict:
    """
    Cursor-based pagination — returns messages older than `before_id`.
    Always hits Supabase; older messages are not cached.
    """
    user_id = str(current_user.id)  # type: ignore[attr-defined]
    messages = get_older_messages(session_id=session_id, before_id=before_id)

    cached, _ = get_user_cache(user_id)
    if cached:
        existing = cached["messages"].get(session_id, [])
        cached["messages"][session_id] = messages + existing

    logger.info(
        "older messages loaded",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "user_id": user_id,
            "session_id": session_id,
            "count": len(messages),
        },
    )
    return {"messages": messages}
