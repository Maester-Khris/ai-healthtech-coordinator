import os
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from backend.models import Facility, FacilityCategory, Severity
from backend.services.facilities import get_all_facilities

app = FastAPI(title="MediCoord AI API", version="0.1.0")

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


@app.get("/facilities", response_model=list[Facility])
def facilities(
    category: FacilityCategory | None = Query(default=None),
    severity: Severity | None = Query(default=None),
) -> list[Facility]:
    raw = get_all_facilities(
        category=category.value if category else None,
        severity=severity.value if severity else None,
    )
    return [Facility(**row) for row in raw]
