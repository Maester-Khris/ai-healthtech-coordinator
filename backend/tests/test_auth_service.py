import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi import HTTPException

from services.auth import verify_token


class TestVerifyToken:
    @patch("services.auth.supabase_auth_get_user")
    def test_valid_token_returns_object_with_id_and_email(self, mock_get_user):
        mock_get_user.return_value = {"id": "u1", "email": "a@b.com"}

        user = verify_token("good-token")

        assert user.id == "u1"
        assert user.email == "a@b.com"

    @patch("services.auth.supabase_auth_get_user")
    def test_response_missing_id_raises_401(self, mock_get_user):
        mock_get_user.return_value = {}

        with pytest.raises(HTTPException) as exc_info:
            verify_token("bad-token")
        assert exc_info.value.status_code == 401

    @patch("services.auth.supabase_auth_get_user", side_effect=Exception("network error"))
    def test_request_failure_raises_401(self, mock_get_user):
        with pytest.raises(HTTPException) as exc_info:
            verify_token("expired-token")
        assert exc_info.value.status_code == 401
