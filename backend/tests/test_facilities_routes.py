"""
Unit tests for the /facilities and /facilities/nearby route handlers.
Called directly as plain async functions (bypassing the ASGI stack and
app lifespan) — only the filtering logic under test needs exercising.
"""

import asyncio
import json
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

import main


class TestFacilitiesRoute:
    def test_max_wait_minutes_filters_results(self):
        fake_data = [
            {"id": "a", "category": "hospital", "accepted_severity": ["urgent"]},
            {"id": "b", "category": "hospital", "accepted_severity": ["urgent"]},
        ]
        with patch("main.get_cached_facilities", return_value=(fake_data, None)), \
             patch("main.get_wait_minutes_map", return_value={"a": 10, "b": 60}):
            request = type("FakeRequest", (), {"headers": {}})()
            response = asyncio.run(main.facilities(request, max_wait_minutes=30))

        data = json.loads(response.body)
        ids = [r["id"] for r in data]
        assert ids == ["a"]

    def test_no_max_wait_minutes_returns_all(self):
        fake_data = [
            {"id": "a", "category": "hospital", "accepted_severity": ["urgent"]},
            {"id": "b", "category": "hospital", "accepted_severity": ["urgent"]},
        ]
        with patch("main.get_cached_facilities", return_value=(fake_data, None)), \
             patch("main.get_wait_minutes_map", return_value={"a": 10, "b": 60}):
            request = type("FakeRequest", (), {"headers": {}})()
            response = asyncio.run(main.facilities(request))

        data = json.loads(response.body)
        assert len(data) == 2


class TestFacilitiesNearbyRoute:
    def test_max_wait_minutes_filters_results(self):
        fake_rows = [
            {"facility_id": "a", "distance_m": 100},
            {"facility_id": "b", "distance_m": 200},
        ]
        with patch("main.supabase_rpc", return_value=fake_rows), \
             patch("main.get_wait_minutes_map", return_value={"a": 10, "b": 999}):
            result = asyncio.run(main.facilities_nearby(lat=43.6, lng=-79.4, max_wait_minutes=30))

        assert [r["facility_id"] for r in result] == ["a"]

    def test_rpc_failure_raises_500(self):
        from fastapi import HTTPException

        with patch("main.supabase_rpc", side_effect=Exception("rpc down")):
            with pytest.raises(HTTPException) as exc_info:
                asyncio.run(main.facilities_nearby(lat=43.6, lng=-79.4))
        assert exc_info.value.status_code == 500


from fastapi.testclient import TestClient


class TestFacilitiesNearbyAsgiStack:
    def test_valid_rpc_response_passes_response_model_validation(self):
        fake_rows = [{
            "facility_id": "11111111-1111-1111-1111-111111111111",
            "facility_name": "Test Hospital",
            "category": "hospital",
            "address": "123 Main St",
            "phone": None,
            "is_operational": True,
            "distance_m": 100,
            "eta_walk_min": 20,
            "eta_transit_min": 10,
            "eta_drive_min": 5,
        }]
        with patch("main.supabase_rpc", return_value=fake_rows), \
             patch("main.get_wait_minutes_map", return_value={}):
            with TestClient(main.app) as client:
                resp = client.get("/facilities/nearby", params={"lat": 43.6, "lng": -79.4})

        assert resp.status_code == 200
        body = resp.json()
        assert body[0]["facility_id"] == "11111111-1111-1111-1111-111111111111"
        assert body[0]["wait_minutes"] is None
