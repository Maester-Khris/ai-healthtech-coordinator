import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.chat import create_session, add_message, get_past_conversations, get_older_messages


class TestCreateSession:
    @patch("services.chat.supabase_insert")
    def test_inserts_into_sessions_table(self, mock_insert):
        mock_insert.return_value = [{"id": "s1", "user_id": "u1", "title": "hi"}]

        result = create_session("u1", "hi")

        mock_insert.assert_called_once_with("sessions", [{"user_id": "u1", "title": "hi"}])
        assert result == {"id": "s1", "user_id": "u1", "title": "hi"}


class TestAddMessage:
    @patch("services.chat.supabase_insert")
    def test_inserts_into_messages_table(self, mock_insert):
        mock_insert.return_value = [{"id": "m1", "role": "user", "content": "hi"}]

        result = add_message("s1", "u1", "user", "hi")

        mock_insert.assert_called_once_with(
            "messages", [{"session_id": "s1", "user_id": "u1", "role": "user", "content": "hi"}]
        )
        assert result == {"id": "m1", "role": "user", "content": "hi"}


class TestGetPastConversations:
    @patch("services.chat.supabase_select")
    def test_fetches_sessions_then_messages_per_session(self, mock_select):
        def side_effect(table, params, single=False):
            if table == "sessions":
                return [{"id": "s1"}]
            if table == "messages":
                return [{"id": "m2", "created_at": "2"}, {"id": "m1", "created_at": "1"}]
            raise AssertionError(f"unexpected table {table}")

        mock_select.side_effect = side_effect

        sessions, messages = get_past_conversations("u1", session_limit=5, message_limit=20)

        assert sessions == [{"id": "s1"}]
        # messages come back oldest-first (reversed from the desc-ordered query)
        assert messages["s1"] == [{"id": "m1", "created_at": "1"}, {"id": "m2", "created_at": "2"}]

        sessions_call = mock_select.call_args_list[0]
        assert sessions_call.args[0] == "sessions"
        assert sessions_call.args[1]["user_id"] == "eq.u1"
        assert sessions_call.args[1]["order"] == "updated_at.desc"
        assert sessions_call.args[1]["limit"] == "5"


class TestGetOlderMessages:
    @patch("services.chat.supabase_select")
    def test_no_cursor_match_returns_empty_list(self, mock_select):
        mock_select.return_value = None  # cursor lookup found nothing

        result = get_older_messages("s1", "missing-id", limit=20)

        assert result == []

    @patch("services.chat.supabase_select")
    def test_cursor_found_fetches_older_messages(self, mock_select):
        def side_effect(table, params, single=False):
            if single:
                return {"created_at": "2024-01-15T10:00:00"}
            return [{"id": "m1", "created_at": "2024-01-14T10:00:00"}]

        mock_select.side_effect = side_effect

        result = get_older_messages("s1", "before-id", limit=20)

        assert result == [{"id": "m1", "created_at": "2024-01-14T10:00:00"}]
        messages_call = mock_select.call_args_list[1]
        assert messages_call.args[1]["created_at"] == "lt.2024-01-15T10:00:00"
