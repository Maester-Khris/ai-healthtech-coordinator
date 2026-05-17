import hashlib
import json
from datetime import datetime
from typing import Any

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
    set_user_cache(user_id, entry["sessions"], entry["messages"])


def append_session_to_cache(user_id: str, session: dict) -> None:
    """Called after a new session is created."""
    entry = _chat_cache.get(user_id)
    if not entry:
        return
    entry["sessions"].insert(0, session)
    entry["messages"][session["id"]] = []
    set_user_cache(user_id, entry["sessions"], entry["messages"])
