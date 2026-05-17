# Task: Observability — Backend + Frontend

**ID:** 005
**Scope:** `backend`, `frontend`
**Branch:** `feat/observability`
**Tests required:** no

---

## Context

Platform configuration is already complete (Sentry, Grafana Cloud, Render Log Streams,
Doppler). This task is code-only. All environment variables are already in Doppler and
must be referenced by their exact names as defined in `.env.example`.

This task is split into two sequential parts. Each part ends with logical commits
(max 4 per part). Do not mix Part 1 and Part 2 files in the same commit.

---

## Environment variable names — use exactly as listed

Read from `.env.example`. Do not rename, alias, or invent new names.

```bash
# Runtime context
ENVIRONMENT=

# Sentry
SENTRY_DSN_BACKEND=
SENTRY_TRACES_SAMPLE_RATE=
SENTRY_DSN_FRONTEND=          # backend reads this? No — backend uses SENTRY_DSN_BACKEND only

# Grafana
GRAFANA_PROMETHEUS_REMOTE_WRITE_URL=
GRAFANA_PROMETHEUS_INSTANCE_ID=
GRAFANA_LOKI_PUSH_URL=
GRAFANA_LOKI_INSTANCE_ID=
GRAFANA_API_TOKEN=

# Metrics endpoint protection
METRICS_BEARER_TOKEN=

# Frontend (Vite — must have VITE_ prefix)
VITE_SENTRY_DSN_FRONTEND=
VITE_SENTRY_ENVIRONMENT=
```

---

---

# PART 1 — Backend Observability

---

## Files to create

### `backend/observability.py`

Central module. Initialises all three observability systems.
Imported once in `main.py` at startup. Contains:

**1. Sentry initialisation**

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
import os

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
        send_default_pii=False,   # never send PII to Sentry
    )
```

**2. Structured JSON logging**

Configure the root logger to emit JSON via `python-json-logger`.
Every log line must include: `timestamp`, `level`, `name`, `message`,
`environment`, and `request_id` when available.

```python
import logging
from pythonjsonlogger import jsonlogger

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
```

Render Log Streams already forwards stdout to Grafana Loki — no custom
LokiHandler needed. Structured JSON on stdout is sufficient.

**3. Request ID middleware**

Injects a UUID per request into `request.state.request_id`.
Propagates `X-Request-ID` header if sent by the client (useful for
frontend-to-backend tracing). Returns the ID in the response header.
Adds `request_id` to every log record in the request scope.

```python
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
```

**4. Prometheus metrics — push loop**

Use `prometheus-client` to define a metrics registry and push to
Grafana Cloud remote write every 30 seconds in a daemon thread.
`prometheus-fastapi-instrumentator` auto-instruments all routes.

```python
import threading
import time
from prometheus_client import CollectorRegistry, push_to_gateway
from prometheus_fastapi_instrumentator import Instrumentator

_registry = CollectorRegistry()

def init_metrics(app) -> Instrumentator:
    """
    Instruments the FastAPI app and starts the background push loop.
    Returns the Instrumentator so main.py can expose /metrics if desired.
    """
    instrumentator = Instrumentator(registry=_registry)
    instrumentator.instrument(app)

    remote_write_url = os.environ.get("GRAFANA_PROMETHEUS_REMOTE_WRITE_URL")
    instance_id      = os.environ.get("GRAFANA_PROMETHEUS_INSTANCE_ID")
    api_token        = os.environ.get("GRAFANA_API_TOKEN")

    if not all([remote_write_url, instance_id, api_token]):
        print("WARN: Grafana Prometheus vars not set — metrics push disabled")
        return instrumentator

    def push_loop():
        from prometheus_client.exposition import basic_auth_handler
        import base64
        auth = (str(instance_id), api_token)
        while True:
            try:
                push_to_gateway(
                    remote_write_url,
                    job="medicoord-api",
                    registry=_registry,
                    handler=lambda url, method, timeout, headers, data: (
                        __import__('requests').request(
                            method, url,
                            data=data,
                            headers={**dict(headers),
                                     "Authorization": "Bearer " + api_token},
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
```

**5. Protected `/metrics` endpoint helper**

```python
from fastapi import Header, HTTPException

def verify_metrics_token(authorization: str = Header(default="")) -> None:
    token = os.environ.get("METRICS_BEARER_TOKEN")
    if token and authorization != f"Bearer {token}":
        raise HTTPException(status_code=403, detail="Forbidden")
```

**6. Single init function called from `main.py`**

```python
def init_observability(app) -> None:
    init_logging()    # first — so all subsequent logs are structured
    init_sentry()
    init_metrics(app)
```

---

### Update `backend/main.py`

Add the following in order — order matters:

```python
# At top of imports
from .observability import init_observability, verify_metrics_token, RequestIDMiddleware

# Inside lifespan, before yield — after existing cache warm
init_observability(app)

# Register RequestIDMiddleware — must be before AuthMiddleware
app.add_middleware(RequestIDMiddleware)

# Add protected /metrics endpoint
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from fastapi import Depends
from fastapi.responses import Response as FastAPIResponse

@app.get("/metrics")
async def metrics(_: None = Depends(verify_metrics_token)):
    return FastAPIResponse(
        content=generate_latest(_registry),
        media_type=CONTENT_TYPE_LATEST,
    )
```

Note: import `_registry` from `observability.py` for the `/metrics` endpoint.

---

### Update `backend/requirements.txt`

Add:
```
prometheus-client==0.20.*
prometheus-fastapi-instrumentator==7.*
python-json-logger==2.*
sentry-sdk[fastapi]==2.*
requests==2.*          # used by metrics push loop if not already present
```

---

### Update `.env.example`

Confirm all observability vars are present with inline comments:

```bash
# Observability — runtime context
ENVIRONMENT=staging

# Sentry — backend
SENTRY_DSN_BACKEND=
SENTRY_TRACES_SAMPLE_RATE=0.2

# Grafana Cloud — metrics push (Prometheus remote write)
GRAFANA_PROMETHEUS_REMOTE_WRITE_URL=
GRAFANA_PROMETHEUS_INSTANCE_ID=
GRAFANA_API_TOKEN=

# Grafana Cloud — log forwarding handled by Render Log Streams (no code needed)
# These are kept here for reference / manual push fallback only
GRAFANA_LOKI_PUSH_URL=
GRAFANA_LOKI_INSTANCE_ID=

# Metrics endpoint protection
METRICS_BEARER_TOKEN=
```

---

## Part 1 — Verification checklist

- [ ] `doppler run -- python -m uvicorn main:app --host 0.0.0.0 --port 8000` starts
      without errors
- [ ] Startup logs are JSON format in terminal
- [ ] `GET /health` response includes `X-Request-ID` header
- [ ] `GET /metrics` with no token returns 403
- [ ] `GET /metrics` with correct Bearer token returns Prometheus text format
- [ ] Sentry dashboard receives a test event:
      add a temporary `raise Exception("sentry test")` in `/health`,
      hit it once, confirm event appears in Sentry, then remove the line
- [ ] `mypy backend/` passes (or flag type errors found)

---

## Part 1 — Commits (max 4, logical grouping)

```bash
# Commit 1 — packages
git add backend/requirements.txt .env.example
git commit -m "chore(backend): add observability dependencies — sentry, prometheus, json-logger"

# Commit 2 — observability module
git add backend/observability.py
git commit -m "feat(backend): observability module — sentry init, json logging, request ID middleware, metrics push"

# Commit 3 — main.py integration
git add backend/main.py
git commit -m "feat(backend): integrate observability into FastAPI — /metrics endpoint, middleware registration"
```

Use a 4th commit only if unrelated files were necessarily touched.
Do not bundle Part 1 and Part 2 files together.

---

---

# PART 2 — Frontend Observability

---

## Files to create

### `webapp/src/lib/sentry.ts`

Sentry initialisation for React. Called once before the app renders.

```typescript
import * as Sentry from "@sentry/react"

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN_FRONTEND
  if (!dsn) {
    console.warn("VITE_SENTRY_DSN_FRONTEND not set — Sentry disabled")
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? "staging",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,       // HIPAA-conscious default
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.0,    // off by default — enable manually
    replaysOnErrorSampleRate: 0.5,    // capture replay on error only
    sendDefaultPii: false,
  })
}
```

`maskAllText: true` is non-negotiable for a health app — symptom text
entered by users must never appear in Sentry session replays.

### Update `webapp/src/main.tsx`

Call `initSentry()` before `ReactDOM.createRoot`:

```typescript
import { initSentry } from "./lib/sentry"
initSentry()
// existing ReactDOM.createRoot(...) call follows
```

### Update `webapp/src/lib/apiClient.ts`

Add `X-Request-ID` header to every outbound request so backend logs
can be correlated with frontend Sentry transactions:

```typescript
import * as Sentry from "@sentry/react"

// Inside apiFetch, add to headers:
const traceHeader = Sentry.getActiveSpan()
  ? { "X-Request-ID": Sentry.spanToTraceHeader(Sentry.getActiveSpan()!) }
  : { "X-Request-ID": crypto.randomUUID() }

headers = { ...headers, ...traceHeader }
```

If Sentry span is not active (Sentry disabled or not sampled), fall back
to a random UUID so the backend still has a request ID to log.

### Update `webapp/src/App.tsx`

Wrap the app in `Sentry.ErrorBoundary` for unhandled React render errors:

```typescript
import * as Sentry from "@sentry/react"

// Wrap the return value:
return (
  <Sentry.ErrorBoundary
    fallback={({ error }) => (
      <div style={{ padding: 24 }}>
        <p>Something went wrong. Please refresh.</p>
        {import.meta.env.DEV && <pre>{String(error)}</pre>}
      </div>
    )}
  >
    <AuthProvider>
      {/* existing app tree */}
    </AuthProvider>
  </Sentry.ErrorBoundary>
)
```

---

## New frontend package

```bash
npm install @sentry/react
```

Add to `webapp/package.json`. Note in outcome summary.

---

## Update `.env.example`

Add frontend vars:

```bash
# Sentry — frontend (Vite requires VITE_ prefix)
VITE_SENTRY_DSN_FRONTEND=
VITE_SENTRY_ENVIRONMENT=staging
```

Note: `SENTRY_DSN_FRONTEND` (no VITE_ prefix) is stored in Doppler
for reference but is not used in code — only `VITE_SENTRY_DSN_FRONTEND`
is read by the browser bundle. Both are intentional, same value.

---

## Web Vitals — no extra package needed

`@sentry/react` with `browserTracingIntegration()` automatically captures:
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)
- TTFB (Time to First Byte)
- FCP (First Contentful Paint)

These appear in Sentry → Performance → Web Vitals automatically.
No manual instrumentation needed.

---

## Part 2 — Verification checklist

- [ ] `doppler run -- npm run dev` starts without console errors
- [ ] Sentry initialised message visible in browser console (dev mode):
      `Sentry SDK initialized`  — or no error
- [ ] Navigate to a page that throws: ErrorBoundary fallback renders
      and event appears in Sentry frontend project
- [ ] Open browser DevTools → Network → filter `sentry` —
      confirm events are being sent to ingest endpoint
- [ ] In Sentry frontend project: Performance → Web Vitals shows data
      after a few page loads
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No user-entered text visible in Sentry (maskAllText enforced)

---

## Part 2 — Commits (max 4, logical grouping)

```bash
# Commit 1 — package
git add webapp/package.json webapp/package-lock.json
git commit -m "chore(frontend): add @sentry/react package"

# Commit 2 — sentry init + main.tsx
git add webapp/src/lib/sentry.ts webapp/src/main.tsx
git commit -m "feat(frontend): Sentry initialisation — browser tracing, error replay, PII masking"

# Commit 3 — app integration
git add webapp/src/App.tsx webapp/src/lib/apiClient.ts .env.example
git commit -m "feat(frontend): Sentry ErrorBoundary, X-Request-ID correlation header in apiClient"
```

Use a 4th commit only if additional files were necessarily touched.

---

## Out of Scope

- Grafana dashboard creation — done in platform config, not in code
- Alert rule configuration — done in Grafana UI, not in code
- Render Log Streams config — done in Render dashboard, not in code
- Custom Sentry performance transactions for triage chat flow —
  deferred until the triage loop is implemented (sprint 7+)
- Loki custom handler in app code — Render Log Streams handles forwarding
- OpenTelemetry migration — deferred, evaluate when distributed tracing
  across multiple services becomes necessary