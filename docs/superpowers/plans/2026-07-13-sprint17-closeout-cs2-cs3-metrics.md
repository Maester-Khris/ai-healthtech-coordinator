# Sprint 17 Closeout — CS2 + CS3 Real Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Sprint 17 by acquiring real, representative-sample metrics for case study 2 (`haversine-proximity-severity-gated-eligibility`) and case study 3 (`two-tier-facility-state-cache-redis-wait-times`), publish them into `caseStudies.ts`, and close out the Sprint 17 CHANGELOG entry. Case study 1 is already done (Sprint 17 Phase B, merged via PR #36).

**Architecture:** Two independent Prometheus-metric-driven load scripts, one per case study, both using `concurrent.futures.ThreadPoolExecutor` to fire a batch of real HTTP requests against the eval-project `preview` backend — the same pattern already used ad hoc for CS1/CS2's Verify-stage smoke test, now formalized into a committed script. Neither script calls JMeter or any external load-testing tool — per explicit decision, `ThreadPoolExecutor`-based firing (already proven during Phase A's Verify stage) is the load strategy for the rest of Sprint 17, not a new tool. CS2 needs one small new addition first: a Prometheus `Summary` metric (`routing_shadow_error_km`) on the already-shipped `log_routing_comparison()`, so the average routing error can be read directly off the already-protected `/metrics` endpoint — mirroring exactly how CS3's `WAIT_TIMES_CACHE_OUTCOME` counter already works — instead of scraping Grafana Loki logs (which would need new, unverified read-scoped credentials). CS3 needs no new instrumentation; its counter already exists and `/facilities` is unauthenticated, so its load script is pure GET traffic.

**Tech Stack:** Python 3.11, `requests` (already a dependency), `prometheus_client` (already a dependency), `concurrent.futures.ThreadPoolExecutor` (stdlib) — **zero new dependencies**.

## Global Constraints

- Type hints on all new function signatures (per `CLAUDE.md`).
- No new Python dependencies, no new npm packages.
- No new backend routes, no `shared/types.ts` changes — the routing-error metric rides on the existing `/metrics` endpoint, same as `WAIT_TIMES_CACHE_OUTCOME`.
- No load-testing tool (JMeter, Locust, k6, etc.) — `ThreadPoolExecutor`-based request firing only, per explicit decision.
- Never run against `main` or real user data — all synthetic traffic targets the dedicated eval Supabase project + `preview` backend, same as Sprint 17's existing eval scripts.
- Each task ends with a prepared `git commit` step, but per this repo's rule, **commits always need explicit user approval** — stage and show the diff, then wait for a go-ahead before running the commit command.
- Branch: cut a new branch `feat/sprint17-cs2-cs3-metrics` from `preview` before Task 1.
- Transparency requirement (Sprint 17's own CHANGELOG rule): every published number states methodology, sample size, environment, and date — never imply live prod traffic.

---

## File Structure

```
backend/
  scripts/
    eval_common/
      __init__.py                      # CREATE — empty, makes this a package
      metrics_client.py                # CREATE — fetch_metrics(), parse_metric_value(), shared by both load scripts
      tests/
        __init__.py                    # CREATE
        test_metrics_client.py         # CREATE
    routing_shadow_eval/
      __init__.py                      # CREATE
      run_load.py                      # CREATE — CS2: ThreadPoolExecutor-fired varied-coordinate triage requests + before/after /metrics diff
      tests/
        __init__.py                    # CREATE
        test_run_load.py               # CREATE — pure-function tests only, no network
    cache_load_eval/
      __init__.py                      # CREATE
      run_load.py                      # CREATE — CS3: ThreadPoolExecutor-fired GET /facilities + before/after /metrics diff
      tests/
        __init__.py                    # CREATE
        test_run_load.py               # CREATE
  services/
    geoapify_shadow.py                 # MODIFY — add ROUTING_SHADOW_ERROR_KM Summary metric
  tests/
    test_geoapify_shadow.py            # MODIFY — add test for the new metric observation
webapp/
  src/data/caseStudies.ts              # MODIFY — CS2 + CS3 result/methodology, real numbers (Task 6, after real runs)
CHANGELOG.md                            # MODIFY — close out Sprint 17 (Task 7)
```

No frontend component changes — same as the CS1 plan, `EngineeringCaseStudyPage.tsx` already renders arbitrary `MetricBullet[]`.

---

### Task 1: Shared metrics-client helper

**Files:**
- Create: `backend/scripts/eval_common/__init__.py`
- Create: `backend/scripts/eval_common/metrics_client.py`
- Test: `backend/scripts/eval_common/tests/__init__.py`
- Test: `backend/scripts/eval_common/tests/test_metrics_client.py`

**Interfaces:**
- Produces: `fetch_metrics(base_url: str, token: str) -> str` (raw Prometheus exposition text), `parse_metric_value(metrics_text: str, name: str, labels: dict[str, str] | None = None) -> float` — both consumed by Task 3 and Task 4's load scripts.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/eval_common/tests/test_metrics_client.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

import pytest

from scripts.eval_common.metrics_client import parse_metric_value

METRICS_TEXT = """\
# HELP routing_shadow_error_km Absolute error between Haversine estimate and Geoapify real driving distance (km)
# TYPE routing_shadow_error_km summary
routing_shadow_error_km_sum 12.34
routing_shadow_error_km_count 22.0
# HELP wait_times_cache_outcome_total Outcome of each wait-time cache read, by branch
# TYPE wait_times_cache_outcome_total counter
wait_times_cache_outcome_total{outcome="redis_hit"} 154.0
wait_times_cache_outcome_total{outcome="supabase_fallback"} 3.0
"""


class TestParseMetricValue:
    def test_parses_unlabeled_metric(self):
        assert parse_metric_value(METRICS_TEXT, "routing_shadow_error_km_sum") == 12.34

    def test_parses_labeled_metric(self):
        value = parse_metric_value(
            METRICS_TEXT, "wait_times_cache_outcome_total", {"outcome": "redis_hit"}
        )
        assert value == 154.0

    def test_raises_when_metric_missing(self):
        with pytest.raises(ValueError):
            parse_metric_value(METRICS_TEXT, "nonexistent_metric")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/eval_common/tests/test_metrics_client.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.eval_common.metrics_client'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/eval_common/__init__.py
```
(empty file)

```python
# backend/scripts/eval_common/metrics_client.py
"""
Shared helper for Sprint 17 Phase B load scripts (routing_shadow_eval,
cache_load_eval): fetch the protected /metrics endpoint and parse a
specific metric's current value out of Prometheus exposition-format text.

Reading a before/after snapshot and diffing is how both load scripts turn
a batch of fired requests into a metric, without any new backend endpoint
or Grafana/Loki read credentials.
"""
import requests


def fetch_metrics(base_url: str, token: str) -> str:
    resp = requests.get(
        f"{base_url}/metrics",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.text


def parse_metric_value(
    metrics_text: str, name: str, labels: dict[str, str] | None = None
) -> float:
    label_str = ""
    if labels:
        label_str = "{" + ",".join(f'{k}="{v}"' for k, v in labels.items()) + "}"
    prefix = f"{name}{label_str} "
    for line in metrics_text.splitlines():
        if line.startswith(prefix):
            return float(line.split()[-1])
    raise ValueError(f"metric {prefix!r} not found in metrics text")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/eval_common/tests/test_metrics_client.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/eval_common/__init__.py backend/scripts/eval_common/metrics_client.py backend/scripts/eval_common/tests/__init__.py backend/scripts/eval_common/tests/test_metrics_client.py
git commit -m "feat(system-eval): add shared Prometheus metrics-client helper for load scripts"
```

---

### Task 2: Routing shadow error Prometheus metric (case study 2, instrumentation addendum)

**Files:**
- Modify: `backend/services/geoapify_shadow.py`
- Modify: `backend/tests/test_geoapify_shadow.py`

**Interfaces:**
- Produces: `ROUTING_SHADOW_ERROR_KM` (a `prometheus_client.Summary`), observed inside the existing `log_routing_comparison()` — scraped automatically by the existing `/metrics` endpoint, consumed (read-only, via `/metrics`) by Task 3's load script.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_geoapify_shadow.py`, inside the existing `TestLogRoutingComparison` class:

```python
    @pytest.mark.asyncio
    async def test_records_error_km_on_summary_metric(self):
        from services.geoapify_shadow import ROUTING_SHADOW_ERROR_KM

        facility = {"id": "fac-001", "lat": 43.65, "lng": -79.39, "distanceKm": 3.0}
        before = ROUTING_SHADOW_ERROR_KM.collect()[0].samples
        before_count = next(s.value for s in before if s.name.endswith("_count"))

        with patch(
            "services.geoapify_shadow.fetch_travel_time_km",
            return_value={"distanceKm": 3.4, "travelMinutes": 8.0},
        ):
            await log_routing_comparison(43.66, -79.38, facility)

        after = ROUTING_SHADOW_ERROR_KM.collect()[0].samples
        after_count = next(s.value for s in after if s.name.endswith("_count"))
        after_sum = next(s.value for s in after if s.name.endswith("_sum"))

        assert after_count == before_count + 1
        assert after_sum >= 0.4
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_geoapify_shadow.py::TestLogRoutingComparison::test_records_error_km_on_summary_metric -v`
Expected: FAIL with `ImportError: cannot import name 'ROUTING_SHADOW_ERROR_KM' from 'services.geoapify_shadow'`

- [ ] **Step 3: Write minimal implementation**

In `backend/services/geoapify_shadow.py`, change the import block (was lines 1-13):

```python
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
```

Change `log_routing_comparison` (was the final function in the file) to observe the metric:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_geoapify_shadow.py -v`
Expected: PASS (all existing tests plus the new one)

- [ ] **Step 5: Commit**

```bash
git add backend/services/geoapify_shadow.py backend/tests/test_geoapify_shadow.py
git commit -m "feat(system-eval): add routing_shadow_error_km Prometheus metric"
```

---

### Task 3: CS2 load script — varied-coordinate triage requests via ThreadPoolExecutor

**Files:**
- Create: `backend/scripts/routing_shadow_eval/__init__.py`
- Create: `backend/scripts/routing_shadow_eval/run_load.py`
- Test: `backend/scripts/routing_shadow_eval/tests/__init__.py`
- Test: `backend/scripts/routing_shadow_eval/tests/test_run_load.py`

**Interfaces:**
- Consumes: `SYMPTOM_SCENARIOS` from `scripts.triage_deepeval.symptom_scenarios`; `load_accounts`, `login`, `create_session`, `send_message` from `scripts.triage_deepeval.generate_transcripts` (all already committed, reused as-is — same account pool, same 12 scattered-Toronto-coordinate scenarios); `fetch_metrics`, `parse_metric_value` from `scripts.eval_common.metrics_client` (Task 1).
- Produces: `compute_shadow_stats(before_text: str, after_text: str) -> dict` returning `{"shadow_samples": int, "mean_error_km": float}` — pure function, no network, this is what Task 6's real run reads to publish the case study numbers.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/routing_shadow_eval/tests/test_run_load.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.routing_shadow_eval.run_load import compute_shadow_stats

BEFORE_METRICS = """\
routing_shadow_error_km_sum 12.0
routing_shadow_error_km_count 20.0
"""

AFTER_METRICS = """\
routing_shadow_error_km_sum 32.0
routing_shadow_error_km_count 60.0
"""


class TestComputeShadowStats:
    def test_computes_delta_count_and_mean(self):
        stats = compute_shadow_stats(BEFORE_METRICS, AFTER_METRICS)
        assert stats == {"shadow_samples": 40, "mean_error_km": 0.5}

    def test_zero_new_samples_returns_zero_mean_not_a_crash(self):
        stats = compute_shadow_stats(BEFORE_METRICS, BEFORE_METRICS)
        assert stats == {"shadow_samples": 0, "mean_error_km": 0.0}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/routing_shadow_eval/tests/test_run_load.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.routing_shadow_eval.run_load'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/routing_shadow_eval/__init__.py
```
(empty file)

```python
# backend/scripts/routing_shadow_eval/run_load.py
"""
Sprint 17 Phase B, case study 2: fires a batch of real triage requests with
varied coordinates against the eval-project preview backend, so the
already-shipped 10%-sampled routing shadow-call (services/geoapify_shadow.py)
accumulates a representative spread of Haversine-vs-real-driving-distance
comparisons — replacing the earlier single-fixed-location smoke sample.

Uses concurrent.futures.ThreadPoolExecutor to fire requests, not a load
testing tool (JMeter/Locust/k6) — this repo's explicit decision for Sprint 17,
consistent with the volume actually needed (request-diversity, not
throughput/stress testing) and with zero new dependencies.

Reuses scripts/triage_deepeval's account pool and scenario list as-is: same
eval Supabase project, same 12 scattered-Toronto-coordinate messages.

Invocation:
    doppler run --config eval -- python scripts/routing_shadow_eval/run_load.py \
        --count 400 --base-url <eval-project preview Render URL>
"""
import argparse
import concurrent.futures
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scripts.eval_common.metrics_client import fetch_metrics, parse_metric_value  # noqa: E402
from scripts.triage_deepeval.generate_transcripts import (  # noqa: E402
    create_session,
    load_accounts,
    login,
    send_message,
)
from scripts.triage_deepeval.symptom_scenarios import SYMPTOM_SCENARIOS  # noqa: E402

logger = logging.getLogger(__name__)

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
POST_FIRE_SETTLE_SECONDS = 20  # lets in-flight background shadow calls finish before reading "after" metrics


def compute_shadow_stats(before_text: str, after_text: str) -> dict:
    before_count = parse_metric_value(before_text, "routing_shadow_error_km_count")
    after_count = parse_metric_value(after_text, "routing_shadow_error_km_count")
    before_sum = parse_metric_value(before_text, "routing_shadow_error_km_sum")
    after_sum = parse_metric_value(after_text, "routing_shadow_error_km_sum")

    shadow_samples = int(after_count - before_count)
    sum_delta = after_sum - before_sum
    mean_error_km = round(sum_delta / shadow_samples, 4) if shadow_samples > 0 else 0.0

    return {"shadow_samples": shadow_samples, "mean_error_km": mean_error_km}


def _fire_one(token: str, scenario: dict, base_url: str) -> bool:
    try:
        session_id = create_session(base_url, token, scenario["message"])
        send_message(base_url, token, session_id, scenario)
        return True
    except Exception as exc:
        logger.warning("routing_load_request_failed", extra={"error": str(exc)})
        return False


def run(count: int, base_url: str, workers: int) -> dict:
    accounts = load_accounts()
    if not accounts:
        raise RuntimeError("No eval test accounts found — run create_eval_test_accounts.py first.")

    tokens = [login(a["email"], a["password"]) for a in accounts]

    succeeded = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [
            pool.submit(
                _fire_one,
                tokens[i % len(tokens)],
                SYMPTOM_SCENARIOS[i % len(SYMPTOM_SCENARIOS)],
                base_url,
            )
            for i in range(count)
        ]
        for future in concurrent.futures.as_completed(futures):
            if future.result():
                succeeded += 1

    return {"requests_fired": count, "requests_succeeded": succeeded}


def write_results(fire_result: dict, stats: dict, window_start: str, window_end: str) -> str:
    os.makedirs(RESULTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(RESULTS_DIR, f"routing_shadow_results_{stamp}.json")
    payload = {**fire_result, **stats, "window_start": window_start, "window_end": window_end}
    with open(path, "w") as f:
        json.dump(payload, f, indent=2)
    return path


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=400)
    parser.add_argument("--workers", type=int, default=5)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("EVAL_API_BASE_URL"),
        help="Eval-project preview backend base URL (or set EVAL_API_BASE_URL)",
    )
    parser.add_argument(
        "--metrics-token",
        default=os.environ.get("METRICS_BEARER_TOKEN"),
        help="Bearer token for the protected /metrics endpoint (or set METRICS_BEARER_TOKEN)",
    )
    args = parser.parse_args()

    if not args.base_url:
        raise SystemExit("--base-url or EVAL_API_BASE_URL env var is required")
    if not args.metrics_token:
        raise SystemExit("--metrics-token or METRICS_BEARER_TOKEN env var is required")

    window_start = datetime.now(timezone.utc).isoformat()
    before_text = fetch_metrics(args.base_url, args.metrics_token)

    fire_result = run(args.count, args.base_url, args.workers)

    print(f"Settling {POST_FIRE_SETTLE_SECONDS}s for in-flight shadow calls...")
    time.sleep(POST_FIRE_SETTLE_SECONDS)

    after_text = fetch_metrics(args.base_url, args.metrics_token)
    window_end = datetime.now(timezone.utc).isoformat()

    stats = compute_shadow_stats(before_text, after_text)
    path = write_results(fire_result, stats, window_start, window_end)

    print(f"Fired {fire_result['requests_fired']} requests, {fire_result['requests_succeeded']} succeeded")
    print(f"Shadow samples observed: {stats['shadow_samples']}")
    print(f"Mean routing error: {stats['mean_error_km']} km")
    print(f"Full results written to {path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/routing_shadow_eval/tests/test_run_load.py -v`
Expected: PASS (2 passed) — no live network call is made; both tests exercise `compute_shadow_stats` directly against fixture metrics text.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/routing_shadow_eval/__init__.py backend/scripts/routing_shadow_eval/run_load.py backend/scripts/routing_shadow_eval/tests/__init__.py backend/scripts/routing_shadow_eval/tests/test_run_load.py
git commit -m "feat(system-eval): add ThreadPoolExecutor-based routing shadow load script"
```

---

### Task 4: CS3 load script — cache-read burst via ThreadPoolExecutor

**Files:**
- Create: `backend/scripts/cache_load_eval/__init__.py`
- Create: `backend/scripts/cache_load_eval/run_load.py`
- Test: `backend/scripts/cache_load_eval/tests/__init__.py`
- Test: `backend/scripts/cache_load_eval/tests/test_run_load.py`

**Interfaces:**
- Consumes: `fetch_metrics`, `parse_metric_value` from `scripts.eval_common.metrics_client` (Task 1).
- Produces: `compute_hit_rate_stats(before_text: str, after_text: str) -> dict` returning `{"redis_hit_delta": int, "supabase_fallback_delta": int, "total_failure_delta": int, "hit_rate": float}` — pure function, no network, consumed by Task 6's real run.

**Note:** `GET /facilities` requires no auth (`backend/main.py:86`), so this script needs no eval test accounts, unlike Task 3.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/cache_load_eval/tests/test_run_load.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.cache_load_eval.run_load import compute_hit_rate_stats

BEFORE_METRICS = """\
wait_times_cache_outcome_total{outcome="redis_hit"} 10.0
wait_times_cache_outcome_total{outcome="supabase_fallback"} 2.0
wait_times_cache_outcome_total{outcome="total_failure"} 0.0
"""

AFTER_METRICS = """\
wait_times_cache_outcome_total{outcome="redis_hit"} 305.0
wait_times_cache_outcome_total{outcome="supabase_fallback"} 3.0
wait_times_cache_outcome_total{outcome="total_failure"} 0.0
"""


class TestComputeHitRateStats:
    def test_computes_deltas_and_hit_rate(self):
        stats = compute_hit_rate_stats(BEFORE_METRICS, AFTER_METRICS)
        assert stats == {
            "redis_hit_delta": 295,
            "supabase_fallback_delta": 1,
            "total_failure_delta": 0,
            "hit_rate": round(295 / 296, 4),
        }

    def test_zero_new_calls_returns_zero_hit_rate_not_a_crash(self):
        stats = compute_hit_rate_stats(BEFORE_METRICS, BEFORE_METRICS)
        assert stats == {
            "redis_hit_delta": 0,
            "supabase_fallback_delta": 0,
            "total_failure_delta": 0,
            "hit_rate": 0.0,
        }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/cache_load_eval/tests/test_run_load.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.cache_load_eval.run_load'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/cache_load_eval/__init__.py
```
(empty file)

```python
# backend/scripts/cache_load_eval/run_load.py
"""
Sprint 17 Phase B, case study 3: fires a burst of unauthenticated GET
/facilities requests against the eval-project preview backend so the
already-shipped wait_times_cache_outcome_total counter (services/wait_times.py)
accumulates enough reads to report a real cache hit rate — replacing the
earlier 2-call correctness-only smoke check.

Uses concurrent.futures.ThreadPoolExecutor to fire requests, not a load
testing tool — same decision and rationale as routing_shadow_eval/run_load.py.

Invocation:
    doppler run --config eval -- python scripts/cache_load_eval/run_load.py \
        --count 300 --base-url <eval-project preview Render URL>
"""
import argparse
import concurrent.futures
import json
import logging
import os
import sys
from datetime import datetime, timezone

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scripts.eval_common.metrics_client import fetch_metrics, parse_metric_value  # noqa: E402

logger = logging.getLogger(__name__)

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")


def compute_hit_rate_stats(before_text: str, after_text: str) -> dict:
    outcomes = ("redis_hit", "supabase_fallback", "total_failure")
    deltas = {}
    for outcome in outcomes:
        before = parse_metric_value(
            before_text, "wait_times_cache_outcome_total", {"outcome": outcome}
        )
        after = parse_metric_value(
            after_text, "wait_times_cache_outcome_total", {"outcome": outcome}
        )
        deltas[f"{outcome}_delta"] = int(after - before)

    total = sum(deltas.values())
    hit_rate = round(deltas["redis_hit_delta"] / total, 4) if total > 0 else 0.0

    return {**deltas, "hit_rate": hit_rate}


def _fire_one(base_url: str) -> bool:
    try:
        resp = requests.get(f"{base_url}/facilities", timeout=10)
        resp.raise_for_status()
        return True
    except Exception as exc:
        logger.warning("cache_load_request_failed", extra={"error": str(exc)})
        return False


def run(count: int, base_url: str, workers: int) -> dict:
    succeeded = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_fire_one, base_url) for _ in range(count)]
        for future in concurrent.futures.as_completed(futures):
            if future.result():
                succeeded += 1
    return {"requests_fired": count, "requests_succeeded": succeeded}


def write_results(fire_result: dict, stats: dict, window_start: str, window_end: str) -> str:
    os.makedirs(RESULTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(RESULTS_DIR, f"cache_load_results_{stamp}.json")
    payload = {**fire_result, **stats, "window_start": window_start, "window_end": window_end}
    with open(path, "w") as f:
        json.dump(payload, f, indent=2)
    return path


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=300)
    parser.add_argument("--workers", type=int, default=10)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("EVAL_API_BASE_URL"),
        help="Eval-project preview backend base URL (or set EVAL_API_BASE_URL)",
    )
    parser.add_argument(
        "--metrics-token",
        default=os.environ.get("METRICS_BEARER_TOKEN"),
        help="Bearer token for the protected /metrics endpoint (or set METRICS_BEARER_TOKEN)",
    )
    args = parser.parse_args()

    if not args.base_url:
        raise SystemExit("--base-url or EVAL_API_BASE_URL env var is required")
    if not args.metrics_token:
        raise SystemExit("--metrics-token or METRICS_BEARER_TOKEN env var is required")

    window_start = datetime.now(timezone.utc).isoformat()
    before_text = fetch_metrics(args.base_url, args.metrics_token)

    fire_result = run(args.count, args.base_url, args.workers)

    after_text = fetch_metrics(args.base_url, args.metrics_token)
    window_end = datetime.now(timezone.utc).isoformat()

    stats = compute_hit_rate_stats(before_text, after_text)
    path = write_results(fire_result, stats, window_start, window_end)

    print(f"Fired {fire_result['requests_fired']} requests, {fire_result['requests_succeeded']} succeeded")
    print(f"Redis hit delta: {stats['redis_hit_delta']}, Supabase fallback delta: {stats['supabase_fallback_delta']}")
    print(f"Hit rate: {stats['hit_rate']:.1%}")
    print(f"Full results written to {path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/cache_load_eval/tests/test_run_load.py -v`
Expected: PASS (2 passed) — no live network call; both tests exercise `compute_hit_rate_stats` directly against fixture metrics text.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/cache_load_eval/__init__.py backend/scripts/cache_load_eval/run_load.py backend/scripts/cache_load_eval/tests/__init__.py backend/scripts/cache_load_eval/tests/test_run_load.py
git commit -m "feat(system-eval): add ThreadPoolExecutor-based cache-read load script"
```

---

### Task 5: Verify — small-batch smoke run for both scripts against the eval environment

Mirrors Phase A's own Task 6 "Verify" checkpoint and CS1's Task 4. No new code — confirm both scripts and the new metric actually work end-to-end before trusting a full-size run.

- [ ] **Step 1: Confirm `METRICS_BEARER_TOKEN` and `GEOAPIFY_API_KEY` are populated in Doppler's `eval` config**

```bash
doppler secrets get METRICS_BEARER_TOKEN --config eval --plain
doppler secrets get GEOAPIFY_API_KEY --config eval --plain
```

Expected: both non-empty. If `GEOAPIFY_API_KEY` is empty, CS2's shadow calls will silently no-op (by design, per `geoapify_shadow.py`) and `routing_shadow_error_km_count` will never increment.

- [ ] **Step 2: Deploy Tasks 1-4 to the eval environment**

Merge or push `feat/sprint17-cs2-cs3-metrics` so the eval-project `preview` backend redeploys with the new `ROUTING_SHADOW_ERROR_KM` metric live.

- [ ] **Step 3: Small-batch smoke run — CS2 (routing shadow)**

Run: `doppler run --config eval -- python backend/scripts/routing_shadow_eval/run_load.py --count 20 --workers 3 --base-url <eval-project preview Render URL>`
Expected: prints `Shadow samples observed: N` with `N >= 1` (20 requests × 10% sample rate ≈ 2 expected) and a `mean_error_km` between 0 and a few km, no exceptions. If `Shadow samples observed: 0`, re-check Step 1 before scaling up — the key is likely still unset.

- [ ] **Step 4: Small-batch smoke run — CS3 (cache hit rate)**

Run: `doppler run --config eval -- python backend/scripts/cache_load_eval/run_load.py --count 20 --workers 5 --base-url <eval-project preview Render URL>`
Expected: prints a `Hit rate` between 0% and 100%, `redis_hit_delta` close to 20 (facility directory cache is already warm after the first read), no exceptions.

- [ ] **Step 5: Sanity-check request volume against free-tier rate limits**

Check the Groq dashboard (CS2 fires real triage LLM calls) and Geoapify dashboard (shadow calls) for any 429s in the smoke batch. If either shows rate-limit errors at `--workers 3`/`--workers 5`, lower `--workers` before Task 6's full run rather than scaling count up on a bottlenecked concurrency setting.

No commit for this task — it's a manual verification checkpoint, not a code change.

---

### Task 6: Full runs + human review + publish measured results

**Files:**
- Modify: `webapp/src/data/caseStudies.ts` — case study 2 and case study 3 `result`/`methodology` arrays

- [ ] **Step 1: Run the full CS2 batch**

Run: `doppler run --config eval -- python backend/scripts/routing_shadow_eval/run_load.py --count 400 --workers 5 --base-url <eval-project preview Render URL>`

Record the printed `shadow_samples`, `mean_error_km`, and today's date from the actual output — do not fabricate these.

- [ ] **Step 2: Run the full CS3 batch**

Run: `doppler run --config eval -- python backend/scripts/cache_load_eval/run_load.py --count 300 --workers 10 --base-url <eval-project preview Render URL>`

Record the printed `hit_rate`, `redis_hit_delta`, `supabase_fallback_delta`, and today's date.

- [ ] **Step 3: Human review**

For CS2: sanity-check `mean_error_km` is in a plausible range for a mid-size city (well under the ~0.56 km ballpark from the earlier single-location sample would be surprising if it moved by an order of magnitude — investigate before publishing if it does). For CS3: confirm `redis_hit_delta` dominates (facility directory cache warms on the very first read of the run and should serve almost everything after), and that `supabase_fallback_delta` isn't unexpectedly high (would indicate the in-process cache isn't actually holding).

- [ ] **Step 4: Update case study 2's copy**

Edit `webapp/src/data/caseStudies.ts`, case study 2 (`slug: 'haversine-proximity-severity-gated-eligibility'`), replacing the existing `result`/`methodology` arrays (currently the single-fixed-location, 11-sample version):

```ts
    result: [
      { text: '<MEAN_ERROR_KM> km average routing error (Haversine vs. real driving distance) across <SHADOW_SAMPLES> shadow-call samples, spread across <COUNT> triage requests at varied Toronto coordinates.', bold: ['<MEAN_ERROR_KM> km', '<SHADOW_SAMPLES>', '<COUNT>'] },
    ],
    methodologyOrdered: true,
    methodology: [
      { text: "Sampled live shadow-call to Geoapify's Route Matrix API at a 10% rate, dispatched as a fire-and-forget background task after the response is already sent, never on the request's critical path.", bold: ['10%'] },
      { text: '<COUNT> triage requests fired via a ThreadPoolExecutor-based Python script against 12 scattered Toronto coordinates and eval test accounts — not a load-testing tool, request-volume for sample diversity, not throughput stress testing.', bold: ['<COUNT>'] },
      { text: '<SHADOW_SAMPLES> real Geoapify comparisons observed via the routing_shadow_error_km Prometheus summary metric (mean = sum/count, read directly off /metrics — no log scraping). Window: <DATE>, eval Supabase project.', bold: ['<SHADOW_SAMPLES>', '<DATE>'] },
    ],
```
(replace `<MEAN_ERROR_KM>`, `<SHADOW_SAMPLES>`, `<COUNT>`, `<DATE>` with the real values from Step 1's output)

Also update `updatedDate` on case study 2 to today's date.

- [ ] **Step 5: Update case study 3's copy**

Edit case study 3 (`slug: 'two-tier-facility-state-cache-redis-wait-times'`), replacing the existing `result`/`methodology` arrays (currently the 2-call correctness-only version):

```ts
    result: [
      { text: '<HIT_RATE_PCT> cache hit rate across <TOTAL_CALLS> wait-time reads (<REDIS_HIT_DELTA> redis_hit, <FALLBACK_DELTA> supabase_fallback) under a sustained read burst.', bold: ['<HIT_RATE_PCT>', '<TOTAL_CALLS>'] },
      { text: 'Cache-aside mechanism confirmed correct end-to-end in an earlier verification pass: 1st read after a cold Redis hash triggered supabase_fallback and repopulated Redis, 2nd read correctly hit redis_hit.', bold: ['1st', '2nd'] },
    ],
    methodologyOrdered: true,
    methodology: [
      { text: 'wait_times_cache_outcome_total: a Prometheus counter labeled by outcome (redis_hit, supabase_fallback, total_failure), incremented on the existing cache-aside branches inside get_wait_minutes_map(). Zero added latency, no new endpoint.', bold: [] },
      { text: '<COUNT> unauthenticated GET /facilities requests fired via a ThreadPoolExecutor-based Python script against the eval-project preview backend — not a load-testing tool, same approach as case study 2.', bold: ['<COUNT>'] },
      { text: 'Hit rate computed by diffing wait_times_cache_outcome_total before and after the burst, read directly off /metrics. Window: <DATE>, eval Supabase project.', bold: ['<DATE>'] },
    ],
```
(replace `<HIT_RATE_PCT>`, `<TOTAL_CALLS>`, `<REDIS_HIT_DELTA>`, `<FALLBACK_DELTA>`, `<COUNT>`, `<DATE>` with the real values from Step 2's output)

Also update `updatedDate` on case study 3 to today's date.

- [ ] **Step 6: Verify the frontend renders it**

Run: `cd webapp && npx tsc -b` — confirm no type errors. Then run the dev server and open `/for-engineers/haversine-proximity-severity-gated-eligibility` and `/for-engineers/two-tier-facility-state-cache-redis-wait-times` — confirm the updated bullets render under Result and Methodology.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/data/caseStudies.ts
git commit -m "docs(case-studies): publish real CS2 routing-error and CS3 cache-hit-rate metrics"
```

---

### Task 7: CHANGELOG Sprint 17 closeout

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update the Sprint 17 section**

In `CHANGELOG.md`, change the Sprint 17 header (currently `## [Sprint 17 — Active] · System Evaluation — Production Metrics for Case Studies`, started 2026-07-09) to `Closed`, and append a `### Delivered` section after the existing `### Process`/`### Out of scope` content, before the closing `---`, documenting what actually shipped (including the two deviations from the original scope: CS1 measuring groundedness/faithfulness instead of latency/tool-call-success-rate, and the JMeter→ThreadPoolExecutor pivot for Phase B's load generation, decided when JMeter wasn't available):

```markdown
### Delivered

**Closed — 2026-07-13.**

- Case study 1 (`two-pass-tool-orchestration-symptom-triage`): two independent evaluation tracks, published as Track A / Track B — an online deterministic groundedness check (0 hallucinated facilities / 106 checks / 100%) and an offline DeepEval Faithfulness LLM-as-judge pass (0.956 mean score, 96.6% pass rate, 89 facility-grounded responses). Deviates from the originally scoped metric (triage latency + tool-call success rate, never measured) in favor of groundedness/faithfulness — the more direct measure of this case study's own stated risk (hallucinated facilities), a conscious pivot made during Phase B, not silent drift.
- Case study 2 (`haversine-proximity-severity-gated-eligibility`): <MEAN_ERROR_KM> km average routing error across <SHADOW_SAMPLES> shadow-call samples, measured via the new `routing_shadow_error_km` Prometheus summary metric.
- Case study 3 (`two-tier-facility-state-cache-redis-wait-times`): <HIT_RATE_PCT> cache hit rate across <TOTAL_CALLS> wait-time reads under a sustained read burst.
- Load generation for Phase B ended up as a `concurrent.futures.ThreadPoolExecutor`-based Python script (`backend/scripts/routing_shadow_eval/`, `backend/scripts/cache_load_eval/`), not JMeter as originally planned — JMeter wasn't installed when Phase A's Verify stage needed a quick multi-request batch, and the ad hoc thread-based approach that unblocked Verify was kept and formalized for Phase B rather than introducing a new tool, since the actual need (request-volume for sample diversity against a free-tier backend) doesn't call for a dedicated load-testing tool's concurrency/throughput reporting.
- Sprint 9's separate prompt-evaluation DeepEval work (premature-classification rate) remains out of scope, as originally stated.
```

(replace `<MEAN_ERROR_KM>`, `<SHADOW_SAMPLES>`, `<HIT_RATE_PCT>`, `<TOTAL_CALLS>` with the real values recorded in Task 6)

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): close out Sprint 17 — system evaluation"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1-2 build the missing piece of instrumentation (CS2's aggregate metric, avoiding a Loki read-credential dependency that doesn't exist yet). Task 3-4 build the two load scripts, both `ThreadPoolExecutor`-based per the explicit decision to not introduce a load-testing tool. Task 5 is the Verify checkpoint (matches Sprint 17's own 4-stage process). Task 6 is Run + Publish for both remaining case studies. Task 7 closes the sprint in the CHANGELOG, including an honest note about the CS1 metric-scope deviation and the JMeter→ThreadPoolExecutor pivot — consistent with Sprint 17's own "transparency requirement" rule.
- **No new dependencies:** `requests` and `prometheus_client` already in `backend/requirements.txt`; `concurrent.futures` is stdlib. Nothing added.
- **No scope creep:** did not add a Grafana dashboard, did not touch Sprint 9's deferred prompt-evaluation work, did not re-litigate CS1 (already done, PR #36 merged).
- **Type consistency:** `compute_shadow_stats` (Task 3) and `compute_hit_rate_stats` (Task 4) both consume `parse_metric_value` exactly as defined in Task 1 (`metrics_text: str, name: str, labels: dict[str, str] | None = None) -> float`). `fetch_metrics(base_url: str, token: str) -> str` matches its two call sites in Task 3 and Task 4's `main()`.
- **Placeholder check:** Task 6 and Task 7's `<MEAN_ERROR_KM>`/`<SHADOW_SAMPLES>`/`<HIT_RATE_PCT>`/`<TOTAL_CALLS>`/`<COUNT>`/`<DATE>` placeholders are intentional — real numbers only exist after Task 6 Steps 1-2 run for real. Every other step has complete, runnable code.
