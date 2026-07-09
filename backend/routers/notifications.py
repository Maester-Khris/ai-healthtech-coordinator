import os
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])

ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications"


class SendNotificationRequest(BaseModel):
    player_id: str
    title: str
    body: str


@router.post("/send")
async def send_notification(
    body: SendNotificationRequest,
    _current_user: object = Depends(get_current_user),
) -> dict:
    app_id = os.environ.get("ONESIGNAL_APP_ID", "")
    api_key = os.environ.get("ONESIGNAL_API_KEY", "")

    if not app_id or not api_key:
        raise HTTPException(500, "OneSignal credentials not configured")

    payload = {
        "app_id": app_id,
        "include_player_ids": [body.player_id],
        "headings": {"en": body.title},
        "contents": {"en": body.body},
    }

    try:
        response = httpx.post(
            ONESIGNAL_API_URL,
            json=payload,
            headers={
                "Authorization": f"Basic {api_key}",
                "Content-Type": "application/json",
            },
            timeout=10.0,
        )
    except httpx.RequestError as exc:
        logger.error("onesignal_network_error", extra={"error": str(exc)})
        raise HTTPException(502, "Failed to reach OneSignal")

    if response.status_code != 200:
        error_body = response.json()
        logger.warning(
            "onesignal_error",
            extra={"status": response.status_code, "body": error_body},
        )
        raise HTTPException(502, f"OneSignal error: {error_body}")

    data = response.json()
    return {"notification_id": data.get("id")}


ONESIGNAL_APPS_URL = "https://onesignal.com/api/v1/apps"


def _device_type_name(raw_type: str | None) -> str:
    if not raw_type:
        return "web"
    return raw_type.removesuffix("Push").lower() or "web"


@router.get("/devices")
async def list_devices(current_user: object = Depends(get_current_user)) -> dict:
    app_id = os.environ.get("ONESIGNAL_APP_ID", "")
    api_key = os.environ.get("ONESIGNAL_API_KEY", "")
    if not app_id or not api_key:
        raise HTTPException(500, "OneSignal credentials not configured")

    user_id = str(current_user.id)  # type: ignore[attr-defined]

    try:
        response = httpx.get(
            f"{ONESIGNAL_APPS_URL}/{app_id}/users/by/external_id/{user_id}",
            headers={"Authorization": f"Basic {api_key}"},
            timeout=10.0,
        )
    except httpx.RequestError as exc:
        logger.error("onesignal_network_error", extra={"error": str(exc)})
        raise HTTPException(502, "Failed to reach OneSignal")

    if response.status_code == 404:
        return {"devices": []}
    if response.status_code != 200:
        logger.warning(
            "onesignal_error",
            extra={"status": response.status_code, "body": response.text},
        )
        raise HTTPException(502, f"OneSignal error: {response.text}")

    subscriptions = response.json().get("subscriptions", [])
    devices = [
        {
            "subscription_id": s["id"],
            "device_type": _device_type_name(s.get("type")),
            "active": s.get("enabled", True),
        }
        for s in subscriptions
        if s.get("id")
    ]
    return {"devices": devices}


@router.delete("/devices/{subscription_id}")
async def remove_device(
    subscription_id: str,
    _current_user: object = Depends(get_current_user),
) -> dict:
    app_id = os.environ.get("ONESIGNAL_APP_ID", "")
    api_key = os.environ.get("ONESIGNAL_API_KEY", "")
    if not app_id or not api_key:
        raise HTTPException(500, "OneSignal credentials not configured")

    try:
        response = httpx.delete(
            f"{ONESIGNAL_APPS_URL}/{app_id}/subscriptions/{subscription_id}",
            headers={"Authorization": f"Basic {api_key}"},
            timeout=10.0,
        )
    except httpx.RequestError as exc:
        logger.error("onesignal_network_error", extra={"error": str(exc)})
        raise HTTPException(502, "Failed to reach OneSignal")

    if response.status_code not in (200, 204):
        logger.warning(
            "onesignal_error",
            extra={"status": response.status_code, "body": response.text},
        )
        raise HTTPException(502, f"OneSignal error: {response.text}")

    return {"status": "removed"}

