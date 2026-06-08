"""
Tests for POST /notifications/send — proxies to OneSignal REST API.
OneSignal HTTP call is mocked; no network required.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Provide dummy OneSignal credentials so the router guard doesn't 500 in tests
os.environ.setdefault("ONESIGNAL_APP_ID", "test-app-id")
os.environ.setdefault("ONESIGNAL_API_KEY", "test-api-key")

from unittest.mock import patch, MagicMock
from uuid import UUID

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from routers.notifications import router as notif_router
from middleware.auth import get_current_user

FAKE_USER_ID = UUID("00000000-0000-0000-0000-000000000001")

class _FakeUser:
    id = FAKE_USER_ID

app = FastAPI()
app.include_router(notif_router)
app.dependency_overrides[get_current_user] = lambda: _FakeUser()
client = TestClient(app)

VALID_PAYLOAD = {
    "player_id": "test-player-id-abc123",
    "title": "MediCoord Test",
    "body": "Push notification pipeline working ✓",
}

def test_send_notification_success():
    """Returns notification_id when OneSignal responds 200."""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {"id": "notif-id-xyz789"}

    with patch("routers.notifications.httpx.post", return_value=mock_response):
        res = client.post("/notifications/send", json=VALID_PAYLOAD)

    assert res.status_code == 200
    data = res.json()
    assert data["notification_id"] == "notif-id-xyz789"

def test_send_notification_onesignal_error():
    """Returns 502 when OneSignal returns an error."""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 400
    mock_response.json.return_value = {"errors": ["Invalid player_id"]}

    with patch("routers.notifications.httpx.post", return_value=mock_response):
        res = client.post("/notifications/send", json=VALID_PAYLOAD)

    assert res.status_code == 502
    assert "OneSignal error" in res.json()["detail"]

def test_send_notification_missing_player_id():
    """Returns 422 when player_id is missing."""
    res = client.post("/notifications/send", json={"title": "T", "body": "B"})
    assert res.status_code == 422

def test_send_notification_onesignal_network_error():
    """Returns 502 when the HTTP call to OneSignal raises."""
    with patch("routers.notifications.httpx.post", side_effect=httpx.RequestError("timeout")):
        res = client.post("/notifications/send", json=VALID_PAYLOAD)
    assert res.status_code == 502
    assert "Failed to reach OneSignal" in res.json()["detail"]
