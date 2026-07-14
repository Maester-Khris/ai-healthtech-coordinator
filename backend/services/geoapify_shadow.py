"""
Shadow-call measurement side-channel for the Haversine-vs-real-travel-time
comparison the routing case study needs. Never called on the live triage
path directly — dispatched via FastAPI BackgroundTasks after the response
is already sent (see routers/chat.py), and every failure mode here degrades
to a no-op log skip, never an exception.
"""
import logging
import os
import random

import httpx
from prometheus_client import Summary

from observability import _registry

logger = logging.getLogger(__name__)

GEOAPIFY_ROUTEMATRIX_URL = "https://api.geoapify.com/v1/routematrix"

ROUTING_SHADOW_ERROR_KM = Summary(
    "routing_shadow_error_km",
    "Absolute error between Haversine estimate and Geoapify real driving distance (km), sampled shadow calls",
    registry=_registry,
)


def should_sample() -> bool:
    raw_rate = os.environ.get("ROUTING_SHADOW_SAMPLE_RATE", "0.1")
    try:
        rate = float(raw_rate)
    except ValueError:
        logger.warning("routing_shadow_sample_rate_invalid", extra={"raw_rate": raw_rate})
        return False
    return random.random() < rate


async def fetch_travel_time_km(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
) -> dict | None:
    """
    Single origin/destination Route Matrix lookup. Returns
    {"distanceKm": float, "travelMinutes": float} or None on any failure —
    including a missing API key, which is treated as "not configured yet",
    not an error.
    """
    api_key = os.environ.get("GEOAPIFY_API_KEY")
    if not api_key:
        return None

    payload = {
        "mode": "drive",
        "sources": [{"location": [origin_lng, origin_lat]}],
        "targets": [{"location": [dest_lng, dest_lat]}],
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                GEOAPIFY_ROUTEMATRIX_URL,
                params={"apiKey": api_key},
                json=payload,
            )
        resp.raise_for_status()
        cell = resp.json()["sources_to_targets"][0][0]
        return {
            "distanceKm": round(cell["distance"] / 1000, 2),
            "travelMinutes": round(cell["time"] / 60, 2),
        }
    except Exception as exc:
        logger.warning("geoapify_shadow_call_failed", extra={"error": str(exc)})
        return None


async def log_routing_comparison(lat: float, lng: float, facility: dict) -> None:
    """
    Compares the Haversine distance already computed for `facility` against a
    live Geoapify Route Matrix lookup, logs the delta and records it on
    ROUTING_SHADOW_ERROR_KM so /metrics can report an average error across a
    load run without needing to scrape logs (Sprint 17 Phase B, case study 2).
    No-ops silently if the shadow call itself failed — there is nothing to
    compare in that case.
    """
    real = await fetch_travel_time_km(lat, lng, facility["lat"], facility["lng"])
    if real is None:
        return

    haversine_km = facility["distanceKm"]
    error_km = round(abs(real["distanceKm"] - haversine_km), 2)
    ROUTING_SHADOW_ERROR_KM.observe(error_km)
    logger.info(
        "routing_shadow_comparison",
        extra={
            "facility_id": facility["id"],
            "haversine_km": haversine_km,
            "geoapify_km": real["distanceKm"],
            "geoapify_minutes": real["travelMinutes"],
            "error_km": error_km,
        },
    )
