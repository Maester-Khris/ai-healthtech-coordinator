import json
import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.wait_times import get_wait_minutes_map


class TestGetWaitMinutesMap:
    @patch("services.wait_times.redis_client")
    def test_redis_hit_returns_parsed_wait_minutes(self, mock_redis):
        mock_redis.hgetall.return_value = {
            "fac-1": json.dumps({"wait_minutes": 12, "source": "erstat"}),
            "fac-2": json.dumps({"wait_minutes": None, "source": "erstat"}),
        }

        result = get_wait_minutes_map()

        assert result == {"fac-1": 12, "fac-2": None}

    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_redis_empty_falls_back_to_supabase_rpc(self, mock_redis, mock_rpc):
        mock_redis.hgetall.return_value = {}
        mock_rpc.return_value = [
            {"facility_id": "fac-1", "wait_minutes": 20, "recorded_at": "2026-06-30T00:00:00Z"},
        ]

        result = get_wait_minutes_map()

        mock_rpc.assert_called_once_with("latest_wait_times", {})
        assert result == {"fac-1": 20}

    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_redis_connection_error_falls_back_to_supabase_rpc(self, mock_redis, mock_rpc):
        mock_redis.hgetall.side_effect = ConnectionError("redis down")
        mock_rpc.return_value = [
            {"facility_id": "fac-1", "wait_minutes": 30, "recorded_at": "2026-06-30T00:00:00Z"},
        ]

        result = get_wait_minutes_map()

        assert result == {"fac-1": 30}

    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_fallback_writes_back_to_redis(self, mock_redis, mock_rpc):
        mock_redis.hgetall.return_value = {}
        mock_rpc.return_value = [
            {"facility_id": "fac-1", "wait_minutes": 20, "recorded_at": "2026-06-30T00:00:00Z"},
        ]

        get_wait_minutes_map()

        mock_redis.hset.assert_called_once()
        args, _ = mock_redis.hset.call_args
        assert args[0] == "wait_times:current"
        assert args[1] == "fac-1"
        assert json.loads(args[2])["wait_minutes"] == 20

    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_redis_writeback_failure_does_not_raise(self, mock_redis, mock_rpc):
        mock_redis.hgetall.return_value = {}
        mock_redis.hset.side_effect = ConnectionError("redis down")
        mock_rpc.return_value = [
            {"facility_id": "fac-1", "wait_minutes": 20, "recorded_at": "2026-06-30T00:00:00Z"},
        ]

        result = get_wait_minutes_map()  # must not raise

        assert result == {"fac-1": 20}


class TestGetWaitMinutesMapDoubleFailure:
    @patch("services.wait_times.supabase_rpc", side_effect=Exception("supabase down"))
    @patch("services.wait_times.redis_client")
    def test_redis_and_supabase_both_down_returns_empty_map(self, mock_redis, mock_rpc):
        mock_redis.hgetall.return_value = {}

        result = get_wait_minutes_map()  # must not raise

        assert result == {}


class TestGetWaitMinutesMapWritebackShape:
    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_fallback_writeback_includes_raw_wait_and_source(self, mock_redis, mock_rpc):
        mock_redis.hgetall.return_value = {}
        mock_rpc.return_value = [
            {"facility_id": "fac-1", "wait_minutes": 20, "raw_wait": "20 min", "source": "erstat", "recorded_at": "2026-06-30T00:00:00Z"},
        ]

        get_wait_minutes_map()

        args, _ = mock_redis.hset.call_args
        payload = json.loads(args[2])
        assert payload["raw_wait"] == "20 min"
        assert payload["source"] == "erstat"
        assert payload["updated_at"] == "2026-06-30T00:00:00Z"
