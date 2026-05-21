from db import get_supabase_client


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
    sessions_list: up to `session_limit` most recent sessions for the user.
    messages_dict: { session_id: [last `message_limit` messages, chronological] }
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
        messages[sid] = list(reversed(msgs_resp.data or []))

    return sessions, messages


def get_older_messages(session_id: str, before_id: str, limit: int = 20) -> list:
    """
    Cursor-based pagination — returns messages older than `before_id`.
    Always hits Supabase; older messages are not cached.
    """
    client = get_supabase_client()

    # maybe_single() returns None when the cursor message is not found
    # instead of raising PGRST116 like .single() does.
    cursor_resp = client.table("messages") \
        .select("created_at") \
        .eq("id", before_id) \
        .maybe_single() \
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
