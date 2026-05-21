import hashlib
import json
from typing import Any

_cache: dict[str, Any] = {
    "facilities": None,
    "etag": None,
}


def get_cached_facilities() -> tuple[list[dict] | None, str | None]:
    return _cache["facilities"], _cache["etag"]


def set_cached_facilities(data: list[dict]) -> str:
    serialized = json.dumps(data, sort_keys=True, default=str)
    etag = f'"{hashlib.sha256(serialized.encode()).hexdigest()[:32]}"'
    _cache["facilities"] = data
    _cache["etag"] = etag
    return etag
