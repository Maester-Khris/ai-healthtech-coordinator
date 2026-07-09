"""
Tests for GET /notifications/devices and DELETE /notifications/devices/{subscription_id}.
OneSignal HTTP calls are mocked; no network required.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("ONESIGNAL_APP_ID", "test-app-id")
os.environ.setdefault("ONESIGNAL_API_KEY", "test-api-key")

from unittest.mock import patch, MagicMock
from uuid import UUID

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from routers.notifications import router as notif_router
from middleware.auth import get_current_user

FAKE_USER_ID = UUID("11111111-1111-1111-1111-111111111111")

class _FakeUser:
    id = FAKE_USER_ID

app = FastAPI()
app.include_router(notif_router)
app.dependency_overrides[get_current_user] = lambda: _FakeUser()
client = TestClient(app)


def test_list_devices_maps_subscriptions():
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "subscriptions": [
            {"id": "sub-1", "type": "ChromePush", "enabled": True},
            {"id": "sub-2", "type": "iOSPush", "enabled": False},
        ]
    }
    with patch("routers.notifications.httpx.get", return_value=mock_response):
        resp = client.get("/notifications/devices")
    assert resp.status_code == 200
    devices = resp.json()["devices"]
    assert devices == [
        {"subscription_id": "sub-1", "device_type": "chrome", "active": True},
        {"subscription_id": "sub-2", "device_type": "ios", "active": False},
    ]


def test_list_devices_returns_empty_on_404():
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 404
    with patch("routers.notifications.httpx.get", return_value=mock_response):
        resp = client.get("/notifications/devices")
    assert resp.status_code == 200
    assert resp.json() == {"devices": []}


def _mock_owned_devices_response():
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "subscriptions": [{"id": "sub-1", "type": "ChromePush", "enabled": True}]
    }
    return mock_response


def test_remove_device_success():
    mock_delete_response = MagicMock(spec=httpx.Response)
    mock_delete_response.status_code = 204
    with patch("routers.notifications.httpx.get", return_value=_mock_owned_devices_response()), \
         patch("routers.notifications.httpx.delete", return_value=mock_delete_response):
        resp = client.delete("/notifications/devices/sub-1")
    assert resp.status_code == 200
    assert resp.json() == {"status": "removed"}


def test_remove_device_network_error():
    with patch("routers.notifications.httpx.get", return_value=_mock_owned_devices_response()), \
         patch("routers.notifications.httpx.delete", side_effect=httpx.RequestError("timeout")):
        resp = client.delete("/notifications/devices/sub-1")
    assert resp.status_code == 502
    assert "Failed to reach OneSignal" in resp.json()["detail"]


def test_remove_device_rejects_unowned_subscription():
    with patch("routers.notifications.httpx.get", return_value=_mock_owned_devices_response()):
        resp = client.delete("/notifications/devices/sub-not-mine")
    assert resp.status_code == 404
