import os
import sys
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from services.geoapify_shadow import (
    should_sample,
    fetch_travel_time_km,
    log_routing_comparison,
)


class TestShouldSample:
    def test_always_true_at_rate_one(self):
        with patch.dict(os.environ, {"ROUTING_SHADOW_SAMPLE_RATE": "1.0"}), \
             patch("services.geoapify_shadow.random.random", return_value=0.5):
            assert should_sample() is True

    def test_always_false_at_rate_zero(self):
        with patch.dict(os.environ, {"ROUTING_SHADOW_SAMPLE_RATE": "0.0"}), \
             patch("services.geoapify_shadow.random.random", return_value=0.0):
            assert should_sample() is False

    def test_false_on_malformed_rate(self):
        with patch.dict(os.environ, {"ROUTING_SHADOW_SAMPLE_RATE": "not-a-number"}):
            assert should_sample() is False


class TestFetchTravelTimeKm:
    @pytest.mark.asyncio
    async def test_returns_none_when_no_api_key(self):
        with patch.dict(os.environ, {}, clear=True):
            result = await fetch_travel_time_km(43.66, -79.38, 43.65, -79.39)
        assert result is None

    @pytest.mark.asyncio
    async def test_parses_successful_response(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "sources_to_targets": [[{"distance": 2500, "time": 420}]]
        }
        mock_response.raise_for_status.return_value = None

        mock_client = MagicMock()
        mock_client.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        with patch.dict(os.environ, {"GEOAPIFY_API_KEY": "test-key"}), \
             patch("services.geoapify_shadow.httpx.AsyncClient", return_value=mock_client):
            result = await fetch_travel_time_km(43.66, -79.38, 43.65, -79.39)

        assert result == {"distanceKm": 2.5, "travelMinutes": 7.0}

    @pytest.mark.asyncio
    async def test_returns_none_on_request_failure(self):
        mock_client = MagicMock()
        mock_client.__aenter__.return_value.post = AsyncMock(side_effect=Exception("network down"))

        with patch.dict(os.environ, {"GEOAPIFY_API_KEY": "test-key"}), \
             patch("services.geoapify_shadow.httpx.AsyncClient", return_value=mock_client):
            result = await fetch_travel_time_km(43.66, -79.38, 43.65, -79.39)
        assert result is None


class TestLogRoutingComparison:
    @pytest.mark.asyncio
    async def test_logs_comparison_when_shadow_call_succeeds(self, caplog):
        facility = {"id": "fac-001", "lat": 43.65, "lng": -79.39, "distanceKm": 3.0}
        with patch(
            "services.geoapify_shadow.fetch_travel_time_km",
            return_value={"distanceKm": 3.4, "travelMinutes": 8.0},
        ), caplog.at_level("INFO"):
            await log_routing_comparison(43.66, -79.38, facility)

        records = [r for r in caplog.records if r.msg == "routing_shadow_comparison"]
        assert len(records) == 1
        assert records[0].haversine_km == 3.0
        assert records[0].geoapify_km == 3.4
        assert records[0].error_km == 0.4

    @pytest.mark.asyncio
    async def test_no_log_when_shadow_call_fails(self, caplog):
        facility = {"id": "fac-001", "lat": 43.65, "lng": -79.39, "distanceKm": 3.0}
        with patch("services.geoapify_shadow.fetch_travel_time_km", return_value=None), \
             caplog.at_level("INFO"):
            await log_routing_comparison(43.66, -79.38, facility)

        records = [r for r in caplog.records if r.msg == "routing_shadow_comparison"]
        assert len(records) == 0
