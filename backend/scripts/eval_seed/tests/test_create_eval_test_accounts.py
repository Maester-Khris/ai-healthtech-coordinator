import json
import os
import sys
from unittest.mock import patch, MagicMock

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.eval_seed.create_eval_test_accounts import (
    generate_test_email,
    create_test_account,
    write_accounts,
    main,
)


class TestGenerateTestEmail:
    def test_deterministic_per_index(self):
        assert generate_test_email(0) == "eval-test-0@medicoord-eval.test"
        assert generate_test_email(7) == "eval-test-7@medicoord-eval.test"


class TestCreateTestAccount:
    @patch("scripts.eval_seed.create_eval_test_accounts.requests.post")
    def test_calls_gotrue_admin_endpoint_with_email_confirm(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "user-uuid-1"}
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        result = create_test_account("eval-test-0@medicoord-eval.test", "s3cret-pass")

        assert result == {
            "id": "user-uuid-1",
            "email": "eval-test-0@medicoord-eval.test",
            "password": "s3cret-pass",
        }
        call_kwargs = mock_post.call_args.kwargs
        assert call_kwargs["json"]["email"] == "eval-test-0@medicoord-eval.test"
        assert call_kwargs["json"]["email_confirm"] is True


class TestWriteAccounts:
    def test_writes_valid_json(self, tmp_path):
        target = str(tmp_path / "accounts.json")
        accounts = [{"id": "1", "email": "a@b.test", "password": "x"}]

        written_path = write_accounts(accounts, target)

        assert written_path == target
        with open(target) as f:
            assert json.load(f) == accounts


class TestMainPartialFailure:
    def test_mid_loop_failure_does_not_discard_earlier_successes(self, tmp_path, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["create_eval_test_accounts.py", "--count", "3"])
        accounts_path = tmp_path / "accounts.json"
        monkeypatch.setattr(
            "scripts.eval_seed.create_eval_test_accounts.ACCOUNTS_PATH", str(accounts_path)
        )

        error_response = MagicMock()
        error_response.raise_for_status.side_effect = requests.HTTPError("409 duplicate")

        ok_response_0 = MagicMock()
        ok_response_0.raise_for_status.return_value = None
        ok_response_0.json.return_value = {"id": "user-0"}

        ok_response_2 = MagicMock()
        ok_response_2.raise_for_status.return_value = None
        ok_response_2.json.return_value = {"id": "user-2"}

        with patch(
            "scripts.eval_seed.create_eval_test_accounts.requests.post",
            side_effect=[ok_response_0, error_response, ok_response_2],
        ):
            main()

        with open(accounts_path) as f:
            written = json.load(f)

        assert [a["id"] for a in written] == ["user-0", "user-2"]
