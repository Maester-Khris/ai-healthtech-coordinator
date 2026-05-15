import os
import hashlib
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from services.facilities import get_all_facilities
from middleware.auth import AuthMiddleware, get_current_user
from cache import get_cached_facilities, set_cached_facilities


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        data = get_all_facilities()
        set_cached_facilities(data)
        print(f"Cache warm: {len(data)} facilities loaded")
    except Exception as exc:
        print(f"WARN: Cache warm failed — {exc}. First request will hit Supabase.")
    yield


app = FastAPI(title="MediCoord AI API", version="0.1.0", lifespan=lifespan)

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)
app.add_middleware(AuthMiddleware)


@app.get("/")
def root() -> dict:
    return {
        "service": "MediCoord AI API",
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "llmProvider": os.environ.get("LLM_PROVIDER", "groq"),
    }


@app.get("/me")
async def me(current_user: object = Depends(get_current_user)) -> dict:
    return {"user_id": current_user.id, "email": current_user.email}  # type: ignore[attr-defined]


@app.get("/facilities")
async def facilities(
    request: Request,
    category: str | None = None,
    severity: str | None = None,
) -> Response:
    cached_data, _ = get_cached_facilities()

    if cached_data is None:
        raw = get_all_facilities(category=None, severity=None)
        cached_etag = set_cached_facilities(raw)
        cached_data = raw

    data: list[dict] = cached_data
    if category:
        data = [r for r in data if r["category"] == category]
    if severity:
        data = [r for r in data if severity in r.get("accepted_severity", [])]

    filtered_etag = f'"{hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()[:32]}"'

    if request.headers.get("If-None-Match", "") == filtered_etag:
        return Response(status_code=304)

    return JSONResponse(
        content=data,
        headers={"ETag": filtered_etag, "Cache-Control": "no-cache"},
    )
