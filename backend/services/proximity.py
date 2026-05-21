import math
import os
from cache import get_cached_facilities


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lng2 - lng1)
    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_nearest_facilities(
    lat: float,
    lng: float,
    severity: str,
    top_n: int | None = None,
) -> list[dict] | None:
    """
    Returns up to top_n nearest facilities that accept the given severity,
    sorted by Haversine distance ascending.

    - First item is always the nearest by straight-line distance.
    - All items include a computed `distanceKm` field.
    - Returns None if the facilities cache is empty.
    - Returns empty list if no facility accepts this severity.
    - top_n defaults to TRIAGE_TOP_N_FACILITIES env var (default 3).

    The full list is returned to the frontend so that Task 010 can later
    re-rank by Geoapify ETA without any backend change.
    """
    if top_n is None:
        top_n = int(os.environ.get("TRIAGE_TOP_N_FACILITIES", "3"))

    facilities, _ = get_cached_facilities()
    if facilities is None:
        return None

    eligible = [
        f for f in facilities
        if severity in f.get("accepted_severity", [])
    ]
    if not eligible:
        return []

    def with_distance(f: dict) -> dict:
        d = haversine_km(lat, lng, f["lat"], f["lng"])
        return {**f, "distanceKm": round(d, 2)}

    ranked = sorted(
        [with_distance(f) for f in eligible],
        key=lambda x: x["distanceKm"],
    )
    return ranked[:top_n]
