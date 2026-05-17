import logging
import os
import threading
import time
import uuid

import sentry_sdk
from fastapi import Header, HTTPException
from prometheus_client import CollectorRegistry, push_to_gateway
from prometheus_fastapi_instrumentator import Instrumentator
from pythonjsonlogger import jsonlogger
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

_registry = CollectorRegistry()


def init_logging() -> None:
    env = os.environ.get("ENVIRONMENT", "staging")
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level"},
        static_fields={"environment": env, "service": "medicoord-api"},
    )
    handler.setFormatter(formatter)
    root = logging.getLogger()
    root.handlers = []
    root.addHandler(handler)
    root.setLevel(logging.INFO)


def init_sentry() -> None:
    dsn = os.environ.get("SENTRY_DSN_BACKEND")
    if not dsn:
        print("WARN: SENTRY_DSN_BACKEND not set — Sentry disabled")
        return
    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("ENVIRONMENT", "staging"),
        traces_sample_rate=float(
            os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.2")
        ),
        integrations=[StarletteIntegration(), FastApiIntegration()],
        send_default_pii=False,
    )


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


def init_metrics(app) -> Instrumentator:  # type: ignore[type-arg]
    instrumentator = Instrumentator(registry=_registry)
    instrumentator.instrument(app)

    remote_write_url = os.environ.get("GRAFANA_PROMETHEUS_REMOTE_WRITE_URL")
    instance_id = os.environ.get("GRAFANA_PROMETHEUS_INSTANCE_ID")
    api_token = os.environ.get("GRAFANA_API_TOKEN")

    if not all([remote_write_url, instance_id, api_token]):
        print("WARN: Grafana Prometheus vars not set — metrics push disabled")
        return instrumentator

    def push_loop() -> None:
        while True:
            try:
                push_to_gateway(
                    remote_write_url,
                    job="medicoord-api",
                    registry=_registry,
                    handler=lambda url, method, timeout, headers, data: (
                        __import__("requests").request(
                            method,
                            url,
                            data=data,
                            headers={
                                **dict(headers),
                                "Authorization": "Bearer " + api_token,  # type: ignore[operator]
                            },
                            timeout=timeout,
                        )
                    ),
                )
            except Exception as exc:
                logging.getLogger(__name__).warning(
                    "Metrics push failed", extra={"error": str(exc)}
                )
            time.sleep(30)

    thread = threading.Thread(target=push_loop, daemon=True)
    thread.start()
    return instrumentator


def verify_metrics_token(authorization: str = Header(default="")) -> None:
    token = os.environ.get("METRICS_BEARER_TOKEN")
    if token and authorization != f"Bearer {token}":
        raise HTTPException(status_code=403, detail="Forbidden")


def init_observability(app) -> None:  # type: ignore[type-arg]
    init_logging()
    init_sentry()
    init_metrics(app)
