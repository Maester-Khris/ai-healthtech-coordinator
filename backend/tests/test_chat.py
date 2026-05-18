"""
Unit tests for chat logic, serialisation, cache, and endpoints.
All Supabase calls are mocked — no env vars or network required.
"""

import os
import sys

# Ensure backend/ is on sys.path regardless of how pytest is invoked
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, date
from unittest.mock import patch, MagicMock
from uuid import UUID

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from services.chat import generate_session_title
from routers.chat import _ser, router as chat_router
from middleware.auth import get_current_user
import cache_chat
from cache_chat import (
    set_user_cache,
    get_user_cache,
    append_message_to_cache,
    append_session_to_cache,
    invalidate_user_cache,
)

# ── Shared test fixtures ──────────────────────────────────────────────────────

FAKE_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
FAKE_USER_ID_STR = str(FAKE_USER_ID)
FAKE_SESSION_ID = "00000000-0000-0000-0000-000000000002"


class _FakeUser:
    id = FAKE_USER_ID
    email = "test@example.com"


def _make_test_app(authenticated: bool = True) -> FastAPI:
    app = FastAPI()
    if authenticated:
        app.dependency_overrides[get_current_user] = lambda: _FakeUser()
    app.include_router(chat_router)
    return app


@pytest.fixture(autouse=True)
def _clear_cache():
    """Reset module-level chat cache before and after every test."""
    cache_chat._chat_cache.clear()
    yield
    cache_chat._chat_cache.clear()


# ── 1. generate_session_title ─────────────────────────────────────────────────

class TestGenerateSessionTitle:
    def test_exactly_50_chars_no_ellipsis(self):
        msg = "a" * 50
        assert generate_session_title(msg) == "a" * 50

    def test_51_chars_truncated_with_ellipsis(self):
        msg = "a" * 51
        assert generate_session_title(msg) == "a" * 50 + "..."

    def test_shorter_than_50_returned_as_is(self):
        assert generate_session_title("hello") == "hello"

    def test_leading_trailing_whitespace_stripped_before_truncation(self):
        msg = "  " + "a" * 50 + "  "
        assert generate_session_title(msg) == "a" * 50

    def test_empty_string_returns_empty(self):
        assert generate_session_title("") == ""


# ── 2. _ser (serialize_for_json) ──────────────────────────────────────────────

class TestSer:
    def test_dict_with_datetime_value(self):
        dt = datetime(2024, 1, 15, 10, 30, 0)
        assert _ser({"created_at": dt}) == {"created_at": "2024-01-15T10:30:00"}

    def test_nested_dict_with_datetime_all_converted(self):
        dt = datetime(2024, 1, 15, 10, 30, 0)
        result = _ser({"session": {"created_at": dt, "title": "test"}})
        assert result == {"session": {"created_at": "2024-01-15T10:30:00", "title": "test"}}

    def test_list_of_dicts_with_datetimes_all_converted(self):
        dt = datetime(2024, 1, 15, 10, 30, 0)
        result = _ser([{"created_at": dt}, {"created_at": dt}])
        assert result == [
            {"created_at": "2024-01-15T10:30:00"},
            {"created_at": "2024-01-15T10:30:00"},
        ]

    def test_dict_without_datetimes_returned_unchanged(self):
        data = {"id": "abc", "title": "test", "count": 5}
        assert _ser(data) == data

    def test_date_object_also_converted(self):
        d = date(2024, 1, 15)
        assert _ser({"day": d}) == {"day": "2024-01-15"}


# ── 3. cache_chat ─────────────────────────────────────────────────────────────

class TestCacheChat:
    def test_set_user_cache_returns_quoted_etag(self):
        etag = set_user_cache("u1", [], {})
        assert etag.startswith('"') and etag.endswith('"')

    def test_set_user_cache_same_data_same_etag(self):
        assert set_user_cache("u1", [], {}) == set_user_cache("u1", [], {})

    def test_set_user_cache_different_data_different_etag(self):
        etag1 = set_user_cache("u1", [], {})
        etag2 = set_user_cache("u1", [{"id": "s1"}], {})
        assert etag1 != etag2

    def test_get_user_cache_empty_returns_none_none(self):
        data, etag = get_user_cache("nobody")
        assert data is None and etag is None

    def test_get_user_cache_after_set_returns_stored_data(self):
        sessions = [{"id": "s1", "title": "t"}]
        messages = {"s1": []}
        set_user_cache("u1", sessions, messages)
        data, etag = get_user_cache("u1")
        assert data["sessions"] == sessions
        assert etag is not None

    def test_append_message_appended_and_etag_changes(self):
        set_user_cache("u1", [], {"s1": []})
        _, etag_before = get_user_cache("u1")
        msg = {"id": "m1", "role": "user", "content": "hi"}
        append_message_to_cache("u1", "s1", msg)
        data, etag_after = get_user_cache("u1")
        assert data["messages"]["s1"] == [msg]
        assert etag_before != etag_after

    def test_append_message_noop_when_user_not_in_cache(self):
        append_message_to_cache("ghost", "s1", {"id": "m1"})  # must not raise
        assert get_user_cache("ghost") == (None, None)

    def test_invalidate_removes_entry(self):
        set_user_cache("u1", [], {})
        invalidate_user_cache("u1")
        assert get_user_cache("u1") == (None, None)

    def test_append_session_prepended_and_message_list_created(self):
        set_user_cache("u1", [{"id": "old"}], {"old": []})
        append_session_to_cache("u1", {"id": "new", "title": "new"})
        data, _ = get_user_cache("u1")
        assert data["sessions"][0]["id"] == "new"
        assert data["messages"]["new"] == []


# ── 4. GET /chat/sessions ─────────────────────────────────────────────────────

_FAKE_SESSION_DICT = {
    "id": FAKE_SESSION_ID,
    "user_id": FAKE_USER_ID_STR,
    "title": "Test session",
    "created_at": "2024-01-15T10:00:00",
    "updated_at": "2024-01-15T10:00:00",
}


class TestGetSessions:
    @pytest.fixture
    def client(self):
        return TestClient(_make_test_app(authenticated=True))

    @pytest.fixture
    def raw_client(self):
        """Client with no dependency override — real get_current_user runs."""
        return TestClient(_make_test_app(authenticated=False))

    def test_malformed_auth_header_returns_401(self, raw_client):
        # "not-bearer" does not start with "Bearer " → HTTPException(401)
        resp = raw_client.get("/chat/sessions", headers={"Authorization": "not-bearer"})
        assert resp.status_code == 401

    def test_invalid_token_returns_401(self, raw_client):
        with patch("middleware.auth.verify_token", side_effect=HTTPException(401, "bad token")):
            resp = raw_client.get(
                "/chat/sessions", headers={"Authorization": "Bearer invalid"}
            )
        assert resp.status_code == 401

    def test_valid_auth_cold_cache_returns_200_with_etag(self, client):
        with patch("routers.chat.get_past_conversations", return_value=([_FAKE_SESSION_DICT], {})):
            resp = client.get("/chat/sessions")
        assert resp.status_code == 200
        assert "ETag" in resp.headers

    def test_matching_if_none_match_returns_304(self, client):
        with patch("routers.chat.get_past_conversations", return_value=([], {})):
            resp1 = client.get("/chat/sessions")
            etag = resp1.headers["ETag"]
            resp2 = client.get("/chat/sessions", headers={"If-None-Match": etag})
        assert resp2.status_code == 304

    def test_different_if_none_match_returns_200(self, client):
        with patch("routers.chat.get_past_conversations", return_value=([], {})):
            resp = client.get("/chat/sessions", headers={"If-None-Match": '"stale"'})
        assert resp.status_code == 200

    def test_response_body_has_no_datetime_objects(self, client):
        session_with_dt = {**_FAKE_SESSION_DICT, "created_at": datetime(2024, 1, 15, 10, 0, 0)}
        with patch("routers.chat.get_past_conversations", return_value=([session_with_dt], {})):
            resp = client.get("/chat/sessions")
        assert resp.status_code == 200
        for session in resp.json()["sessions"]:
            for val in session.values():
                assert not isinstance(val, datetime)


# ── 5. POST /chat/message ─────────────────────────────────────────────────────

class TestSendMessage:
    def _fake_msg(self, role: str, content: str) -> dict:
        return {
            "id": "00000000-0000-0000-0000-000000000003",
            "session_id": FAKE_SESSION_ID,
            "user_id": FAKE_USER_ID_STR,
            "role": role,
            "content": content,
            "created_at": "2024-01-15T10:00:00",
        }

    def _post(self, client: TestClient, content: str):
        return client.post(
            "/chat/message",
            json={"session_id": FAKE_SESSION_ID, "content": content},
        )

    @pytest.fixture
    def client(self):
        return TestClient(_make_test_app(authenticated=True))

    @pytest.fixture
    def raw_client(self):
        return TestClient(_make_test_app(authenticated=False))

    def test_invalid_token_returns_401(self, raw_client):
        with patch("middleware.auth.verify_token", side_effect=HTTPException(401, "bad")):
            resp = raw_client.post(
                "/chat/message",
                headers={"Authorization": "Bearer bad"},
                json={"session_id": FAKE_SESSION_ID, "content": "hello"},
            )
        assert resp.status_code == 401

    def test_short_content_no_ellipsis_in_assistant_reply(self, client):
        user_msg = self._fake_msg("user", "hello")
        assistant_msg = self._fake_msg("assistant", "hello")
        with patch("routers.chat.add_message", side_effect=[user_msg, assistant_msg]):
            resp = self._post(client, "hello")
        assert resp.status_code == 200
        assert resp.json()["assistant_message"]["content"] == "hello"

    def test_60_char_content_truncated_to_50_plus_ellipsis(self, client):
        long_content = "x" * 60
        expected_stub = "x" * 50 + "..."
        user_msg = self._fake_msg("user", long_content)
        assistant_msg = self._fake_msg("assistant", expected_stub)
        with patch("routers.chat.add_message", side_effect=[user_msg, assistant_msg]) as mock_add:
            resp = self._post(client, long_content)
        assert resp.status_code == 200
        # Verify the stub was computed and passed as the assistant content
        assert mock_add.call_args_list[1].kwargs["content"] == expected_stub

    def test_response_contains_both_user_and_assistant_messages(self, client):
        user_msg = self._fake_msg("user", "hi")
        assistant_msg = self._fake_msg("assistant", "hi")
        with patch("routers.chat.add_message", side_effect=[user_msg, assistant_msg]):
            resp = self._post(client, "hi")
        body = resp.json()
        assert "user_message" in body
        assert "assistant_message" in body

    def test_cache_append_called_twice(self, client):
        user_msg = self._fake_msg("user", "hi")
        assistant_msg = self._fake_msg("assistant", "hi")
        with patch("routers.chat.add_message", side_effect=[user_msg, assistant_msg]), \
             patch("routers.chat.append_message_to_cache") as mock_append:
            self._post(client, "hi")
        assert mock_append.call_count == 2
