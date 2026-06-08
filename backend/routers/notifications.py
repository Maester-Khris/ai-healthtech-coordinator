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
