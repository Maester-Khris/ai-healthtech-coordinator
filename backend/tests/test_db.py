"""
Unit tests for db.py's Supabase REST helpers. All HTTP calls are mocked —
no network or real Supabase project required (env vars still need to be
set, even to dummy values, since db.py reads them at import time).
"""

import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import db


class TestSupabaseSelect:
    @patch("db.requests.get")
    def test_builds_correct_url_and_params(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, json=lambda: [{"id": "1"}])
        mock_get.return_value.raise_for_status = lambda: None

        result = db.supabase_select("facilities_clean", {"select": "*", "category": "eq.hospital"})

        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert args[0] == f"{db.SUPABASE_URL}/rest/v1/facilities_clean"
        assert kwargs["params"] == {"select": "*", "category": "eq.hospital"}
        assert kwargs["headers"]["apikey"] == db.SUPABASE_KEY
        assert result == [{"id": "1"}]

    @patch("db.requests.get")
    def test_single_true_sets_object_accept_header(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, json=lambda: {"id": "1"})
        mock_get.return_value.raise_for_status = lambda: None

        db.supabase_select("messages", {"select": "created_at"}, single=True)

        _, kwargs = mock_get.call_args
        assert kwargs["headers"]["Accept"] == "application/vnd.pgrst.object+json"

    @patch("db.requests.get")
    def test_single_true_404_returns_none(self, mock_get):
        mock_get.return_value = MagicMock(status_code=404)

        result = db.supabase_select("messages", {"select": "created_at"}, single=True)

        assert result is None

    @patch("db.requests.get")
    def test_single_true_406_returns_none(self, mock_get):
        mock_get.return_value = MagicMock(status_code=406)

        result = db.supabase_select("messages", {"select": "created_at"}, single=True)

        assert result is None


class TestSupabaseInsert:
    @patch("db.requests.post")
    def test_posts_with_return_representation_header(self, mock_post):
        mock_post.return_value = MagicMock(status_code=201, json=lambda: [{"id": "new-1"}])
        mock_post.return_value.raise_for_status = lambda: None

        result = db.supabase_insert("sessions", [{"user_id": "u1", "title": "t"}])

        args, kwargs = mock_post.call_args
        assert args[0] == f"{db.SUPABASE_URL}/rest/v1/sessions"
        assert kwargs["json"] == [{"user_id": "u1", "title": "t"}]
        assert kwargs["headers"]["Prefer"] == "return=representation"
        assert result == [{"id": "new-1"}]


class TestSupabaseRpc:
    @patch("db.requests.post")
    def test_posts_to_rpc_path(self, mock_post):
        mock_post.return_value = MagicMock(status_code=200, json=lambda: [{"facility_id": "a"}])
        mock_post.return_value.raise_for_status = lambda: None

        result = db.supabase_rpc("nearby_facilities", {"user_lat": 43.6, "user_lng": -79.4})

        args, kwargs = mock_post.call_args
        assert args[0] == f"{db.SUPABASE_URL}/rest/v1/rpc/nearby_facilities"
        assert kwargs["json"] == {"user_lat": 43.6, "user_lng": -79.4}
        assert result == [{"facility_id": "a"}]


class TestSupabaseAuthGetUser:
    @patch("db.requests.get")
    def test_uses_caller_token_as_bearer(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, json=lambda: {"id": "u1", "email": "a@b.com"})
        mock_get.return_value.raise_for_status = lambda: None

        result = db.supabase_auth_get_user("user-jwt-token")

        args, kwargs = mock_get.call_args
        assert args[0] == f"{db.SUPABASE_URL}/auth/v1/user"
        assert kwargs["headers"]["Authorization"] == "Bearer user-jwt-token"
        assert kwargs["headers"]["apikey"] == db.SUPABASE_KEY
        assert result == {"id": "u1", "email": "a@b.com"}
