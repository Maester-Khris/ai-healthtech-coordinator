# System Evaluation — Phase A: Instrumentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the logging/counters/shadow-call instrumentation each of the 3 `/for-engineers` case studies needs, without touching any live request's behavior or latency, so Phase B (simulated-load run + evaluation) has real data to compute against.

**Architecture:** Three independent instrumentation additions, one per case study, each a pure/side-channel addition to an existing backend module — no new endpoints, no new request/response contracts, no frontend or `shared/types.ts` changes. Case study 1 gets a deterministic groundedness check logged inline (cheap, always runs). Case study 2 gets a sampled, fire-and-forget shadow call via FastAPI's built-in `BackgroundTasks` (never blocks the triage response). Case study 3 gets Prometheus counters on the existing cache-aside branches, reusing the registry already wired in `observability.py`.

**Tech Stack:** Python 3.11, FastAPI, `prometheus_client` (already a dependency), `httpx` (already a dependency), `starlette.concurrency.run_in_threadpool` (existing codebase pattern for blocking I/O) — **zero new dependencies**, nothing to add to `requirements.txt`.

## Global Constraints

- Type hints on all new function signatures (per `CLAUDE.md`).
- No new Python dependencies — confirmed `httpx` and `prometheus_client` are already in `backend/requirements.txt`.
- No new backend routes and no changes to any request/response shape — `shared/types.ts` is untouched by this plan.
- Branch: `feat/system-evaluation` (already created, cut from `preview`).
- Each task below ends with a prepared `git commit` step, but per this repo's rule, **commits always need explicit user approval** — stage and show the diff, then wait for a go-ahead before running the commit command, rather than committing automatically.
- Never modify the live triage/routing/cache decision logic — every addition here is read-only observation (log, count, or a side-channel network call), consistent with the "measurement side-channel, never allowed to affect the response" principle already used in this plan's design.

---

### Task 1: Deterministic facility-groundedness check (case study 1, part A)

**Files:**
- Create: `backend/services/triage_eval.py`
- Test: `backend/tests/test_triage_eval.py`

**Interfaces:**
- Produces: `check_facility_groundedness(response_text: str, facility: dict | None) -> dict` returning `{"grounded": bool | None, "facility_name": str | None}` — consumed by Task 2.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_triage_eval.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.triage_eval import check_facility_groundedness

FACILITY = {
    "id": "fac-001",
    "name": "Toronto General Hospital",
    "address": "200 Elizabeth St, Toronto",
    "distanceKm": 1.2,
}


class TestCheckFacilityGroundedness:
    def test_grounded_when_facility_name_present(self):
        text = "Please head to Toronto General Hospital right away."
        result = check_facility_groundedness(text, FACILITY)
        assert result == {"grounded": True, "facility_name": "Toronto General Hospital"}

    def test_not_grounded_when_facility_name_absent(self):
        text = "Please head to the nearest hospital right away."
        result = check_facility_groundedness(text, FACILITY)
        assert result == {"grounded": False, "facility_name": "Toronto General Hospital"}

    def test_case_insensitive_match(self):
        text = "please head to toronto general hospital right away."
        result = check_facility_groundedness(text, FACILITY)
        assert result["grounded"] is True

    def test_no_facility_returns_none_grounded(self):
        result = check_facility_groundedness("Call 211 or search online.", None)
        assert result == {"grounded": None, "facility_name": None}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_triage_eval.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'services.triage_eval'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/services/triage_eval.py
"""
Deterministic (no LLM judge) groundedness check for triage Pass-2 responses.

The facility name is injected into the model's context as a fact before Pass 2
generates its response (see LLMAgent._generate_grounded_response). If the model
followed that fact instead of inventing a different name, the real facility name
appears verbatim in the response. This check confirms that — no LLM call, no
cost, safe to run on every logged session.
"""


def check_facility_groundedness(response_text: str, facility: dict | None) -> dict:
    """
    Returns {"grounded": bool | None, "facility_name": str | None}.

    grounded is None when no facility was provided to the model at all (e.g. no
    location data) — there is nothing to check groundedness against in that case.
    """
    if facility is None:
        return {"grounded": None, "facility_name": None}

    name = facility["name"]
    return {
        "grounded": name.lower() in response_text.lower(),
        "facility_name": name,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_triage_eval.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit** (after explicit user approval)

```bash
git add backend/services/triage_eval.py backend/tests/test_triage_eval.py
git commit -m "feat(system-eval): add deterministic facility-groundedness check"
```

---

### Task 2: Log grounding + turn-count on every triage classification (case study 1, part B)

**Files:**
- Modify: `backend/services/llm_agent.py:98-211` (`_run` and `_handle_triage`)
- Modify: `backend/tests/llm/test_triage_tools.py` (append a new test class)

**Interfaces:**
- Consumes: `check_facility_groundedness(response_text, facility) -> dict` from Task 1.
- Produces: no new public interface — this task only adds a log call inside existing methods.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/llm/test_triage_tools.py`:

```python
# -----------------------------------------------------------------------
# LLMAgent — grounding check logging (Sprint 17 instrumentation)
# -----------------------------------------------------------------------

class TestTriageGroundingLogged:
    def test_grounding_checked_and_logged_when_facility_present(self, caplog):
        from services.llm_agent import LLMAgent
        from llm.tools import TRIAGE_RESPONSE

        mock_client = MagicMock()
        mock_client.chat.side_effect = [
            MagicMock(
                finish_reason="tool_calls",
                content=None,
                tool_calls=[{
                    "id": "tc1",
                    "name": TRIAGE_RESPONSE.name,
                    "arguments": json.dumps({
                        "severity": "urgent",
                        "reasoning": "High fever with pain",
                    }),
                }],
            ),
            MagicMock(
                finish_reason="stop",
                content="Please go to Bay Centre Walk-In Clinic.",
                tool_calls=None,
            ),
        ]

        history = [
            {"role": "user",      "content": "I feel unwell"},
            {"role": "assistant", "content": "Can you describe your symptoms?"},
            {"role": "user",      "content": "I have a headache and fever"},
            {"role": "assistant", "content": "How long have you had these symptoms?"},
            {"role": "user",      "content": "Since this morning"},
            {"role": "assistant", "content": "Any chills or nausea alongside the fever?"},
        ]
        agent = LLMAgent(client=mock_client)

        with caplog.at_level("INFO"):
            result = agent.respond("I have a high fever", history, lat=43.660, lng=-79.385)

        assert result["turn_type"] == "triage"
        grounding_records = [r for r in caplog.records if r.msg == "triage_grounding_checked"]
        assert len(grounding_records) == 1
        record = grounding_records[0]
        assert record.facility_provided is True
        assert record.user_turns == 3

    def test_grounding_logged_as_none_when_no_facility(self, caplog):
        from services.llm_agent import LLMAgent
        from llm.tools import TRIAGE_RESPONSE

        mock_client = MagicMock()
        mock_client.chat.side_effect = [
            MagicMock(
                finish_reason="tool_calls",
                content=None,
                tool_calls=[{
                    "id": "tc1",
                    "name": TRIAGE_RESPONSE.name,
                    "arguments": json.dumps({
                        "severity": "routine",
                        "reasoning": "Minor cold",
                    }),
                }],
            ),
            MagicMock(
                finish_reason="stop",
                content="See a walk-in when convenient.",
                tool_calls=None,
            ),
        ]

        agent = LLMAgent(client=mock_client)
        with caplog.at_level("INFO"):
            agent.respond("I have a cold", [], lat=None, lng=None)

        grounding_records = [r for r in caplog.records if r.msg == "triage_grounding_checked"]
        assert len(grounding_records) == 1
        assert grounding_records[0].facility_provided is False
        assert grounding_records[0].grounded is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/llm/test_triage_tools.py::TestTriageGroundingLogged -v`
Expected: FAIL — `AttributeError` or empty `grounding_records` list (no `triage_grounding_checked` log exists yet)

- [ ] **Step 3: Write minimal implementation**

In `backend/services/llm_agent.py`, add the import at the top (after the existing `services.proximity` import):

```python
from services.proximity import find_nearest_facilities
from services.triage_eval import check_facility_groundedness
```

Change the `_run` method's call site (was `return self._handle_triage(tool_call, messages, lat, lng)`):

```python
    def _run(
        self,
        messages: list[LLMMessage],
        lat: float | None,
        lng: float | None,
        force: bool,
        user_turns: int = 0,
    ) -> dict:
        force_tool = TRIAGE_RESPONSE.name if force else None

        resp = self._client.chat(
            messages=messages,
            tools=ALL_TOOLS,
            temperature=self._temperature,
            stop=self._stop_sequences,
            force_tool=force_tool,
        )

        # Tool call list is the authoritative signal — not finish_reason.
        # Groq Llama models may return both text content and tool_calls simultaneously;
        # when tool_calls is non-empty the tool call takes absolute precedence.
        if resp.tool_calls:
            for tool_call in resp.tool_calls:
                if tool_call["name"] == TRIAGE_RESPONSE.name:

                    args = json.loads(tool_call["arguments"])
                    is_emergency = args.get("severity") == "emergent"
                    below_min_turns = user_turns < self._min_turns_before_triage

                    # Emergency and ceiling-force both bypass the minimum turn gate
                    if below_min_turns and not is_emergency and not force:
                        logger.warning(
                            "triage_suppressed_below_min_turns",
                            extra={
                                "user_turns": user_turns,
                                "min_turns": self._min_turns_before_triage,
                                "severity": args.get("severity"),
                            },
                        )
                        return {
                            "response": resp.content or "Could you tell me more about your symptoms?",
                            "severity": None,
                            "reasoning": None,
                            "recommended_facility": None,
                            "nearby_facilities": [],
                            "turn_type": "followup",
                        }

                    return self._handle_triage(tool_call, messages, lat, lng, user_turns)
            logger.warning("unexpected_tool_call")
            return {
                "response": "I need a bit more information. Can you describe your symptoms?",
                "severity": None,
                "reasoning": None,
                "recommended_facility": None,
                "nearby_facilities": [],
                "turn_type": "followup",
            }

        # No tool call — conversational follow-up response
        return {
            "response": resp.content or "Could you tell me more about your symptoms?",
            "severity": None,
            "reasoning": None,
            "recommended_facility": None,
            "nearby_facilities": [],
            "turn_type": "followup",
        }
```

Replace `_handle_triage` with a version that accepts `user_turns` and logs the grounding check:

```python
    def _handle_triage(
        self,
        tool_call: dict,
        messages: list[LLMMessage],
        lat: float | None,
        lng: float | None,
        user_turns: int = 0,
    ) -> dict:
        args = json.loads(tool_call["arguments"])
        severity = args["severity"]
        reasoning = args["reasoning"]
        logger.info(
            "triage_called",
            extra={
                "severity": severity,
                "information_sufficient": args.get("information_sufficient"),
                "user_turns": user_turns,
            },
        )
        # Location is used whenever coordinates were provided by the client.
        # The LLM does not decide this — the backend knows from the request.
        needs_location = (lat is not None and lng is not None)

        recommended_facility = None
        nearby_facilities: list[dict] = []

        if needs_location:
            facilities = find_nearest_facilities(lat=lat, lng=lng, severity=severity)
            if facilities:
                recommended_facility = facilities[0]
                nearby_facilities = facilities[1:]

        response_text = self._generate_grounded_response(
            messages=messages,
            severity=severity,
            reasoning=reasoning,
            facility=recommended_facility,
        )

        grounding = check_facility_groundedness(response_text, recommended_facility)
        logger.info(
            "triage_grounding_checked",
            extra={
                "severity": severity,
                "facility_provided": recommended_facility is not None,
                "grounded": grounding["grounded"],
                "user_turns": user_turns,
            },
        )

        return {
            "response": response_text,
            "severity": severity,
            "reasoning": reasoning,
            "recommended_facility": recommended_facility,
            "nearby_facilities": nearby_facilities,
            "turn_type": "triage",
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/llm/test_triage_tools.py -v`
Expected: PASS (all tests, including the 2 new ones — the existing `TestTriageResultShape` tests are unaffected since `_handle_triage`'s new param has a default)

- [ ] **Step 5: Commit** (after explicit user approval)

```bash
git add backend/services/llm_agent.py backend/tests/llm/test_triage_tools.py
git commit -m "feat(system-eval): log facility-groundedness + turn count on every triage call"
```

---

### Task 3: Geoapify Route Matrix shadow client (case study 2, part A)

**Files:**
- Create: `backend/services/geoapify_shadow.py`
- Test: `backend/tests/test_geoapify_shadow.py`
- Modify: `backend/.env.example` (add `ROUTING_SHADOW_SAMPLE_RATE`)

**Interfaces:**
- Produces: `should_sample() -> bool`, `async fetch_travel_time_km(origin_lat, origin_lng, dest_lat, dest_lng) -> dict | None`, `async log_routing_comparison(lat, lng, facility) -> None` — consumed by Task 4.

**Note before implementing:** `GEOAPIFY_API_KEY` already has a placeholder in the repo's root `.env.example` (`# Geoapify (routing — Task 010)`) but is not currently read anywhere in `backend/`. Confirm the key is actually populated in Doppler's `preview` config before Task 4 ships (see Task 6's smoke-test checklist) — this task's code degrades to a no-op (`None`) if it's missing, so it's safe to merge either way, but the shadow data won't exist until the key is real.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_geoapify_shadow.py
import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from services.geoapify_shadow import (
    should_sample,
    fetch_travel_time_km,
    log_routing_comparison,
)


class TestShouldSample:
    def test_always_true_at_rate_one(self):
        with patch.dict(os.environ, {"ROUTING_SHADOW_SAMPLE_RATE": "1.0"}), \
             patch("services.geoapify_shadow.random.random", return_value=0.5):
            assert should_sample() is True

    def test_always_false_at_rate_zero(self):
        with patch.dict(os.environ, {"ROUTING_SHADOW_SAMPLE_RATE": "0.0"}), \
             patch("services.geoapify_shadow.random.random", return_value=0.0):
            assert should_sample() is False


class TestFetchTravelTimeKm:
    @pytest.mark.asyncio
    async def test_returns_none_when_no_api_key(self):
        with patch.dict(os.environ, {}, clear=True):
            result = await fetch_travel_time_km(43.66, -79.38, 43.65, -79.39)
        assert result is None

    @pytest.mark.asyncio
    async def test_parses_successful_response(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "sources_to_targets": [[{"distance": 2500, "time": 420}]]
        }
        mock_response.raise_for_status.return_value = None

        with patch.dict(os.environ, {"GEOAPIFY_API_KEY": "test-key"}), \
             patch("services.geoapify_shadow.httpx.post", return_value=mock_response):
            result = await fetch_travel_time_km(43.66, -79.38, 43.65, -79.39)

        assert result == {"distanceKm": 2.5, "travelMinutes": 7.0}

    @pytest.mark.asyncio
    async def test_returns_none_on_request_failure(self):
        with patch.dict(os.environ, {"GEOAPIFY_API_KEY": "test-key"}), \
             patch("services.geoapify_shadow.httpx.post", side_effect=Exception("network down")):
            result = await fetch_travel_time_km(43.66, -79.38, 43.65, -79.39)
        assert result is None


class TestLogRoutingComparison:
    @pytest.mark.asyncio
    async def test_logs_comparison_when_shadow_call_succeeds(self, caplog):
        facility = {"id": "fac-001", "lat": 43.65, "lng": -79.39, "distanceKm": 3.0}
        with patch(
            "services.geoapify_shadow.fetch_travel_time_km",
            return_value={"distanceKm": 3.4, "travelMinutes": 8.0},
        ), caplog.at_level("INFO"):
            await log_routing_comparison(43.66, -79.38, facility)

        records = [r for r in caplog.records if r.msg == "routing_shadow_comparison"]
        assert len(records) == 1
        assert records[0].haversine_km == 3.0
        assert records[0].geoapify_km == 3.4
        assert records[0].error_km == 0.4

    @pytest.mark.asyncio
    async def test_no_log_when_shadow_call_fails(self, caplog):
        facility = {"id": "fac-001", "lat": 43.65, "lng": -79.39, "distanceKm": 3.0}
        with patch("services.geoapify_shadow.fetch_travel_time_km", return_value=None), \
             caplog.at_level("INFO"):
            await log_routing_comparison(43.66, -79.38, facility)

        records = [r for r in caplog.records if r.msg == "routing_shadow_comparison"]
        assert len(records) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_geoapify_shadow.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'services.geoapify_shadow'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/services/geoapify_shadow.py
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
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

GEOAPIFY_ROUTEMATRIX_URL = "https://api.geoapify.com/v1/routematrix"


def should_sample() -> bool:
    rate = float(os.environ.get("ROUTING_SHADOW_SAMPLE_RATE", "0.1"))
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
        resp = await run_in_threadpool(
            httpx.post,
            GEOAPIFY_ROUTEMATRIX_URL,
            params={"apiKey": api_key},
            json=payload,
            timeout=10.0,
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
    live Geoapify Route Matrix lookup, logs the delta. No-ops silently if the
    shadow call itself failed — there is nothing to compare in that case.
    """
    real = await fetch_travel_time_km(lat, lng, facility["lat"], facility["lng"])
    if real is None:
        return

    haversine_km = facility["distanceKm"]
    error_km = round(abs(real["distanceKm"] - haversine_km), 2)
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

Add to `backend/.env.example` (new line, anywhere near `TRIAGE_MIN_TURNS=3`):

```
ROUTING_SHADOW_SAMPLE_RATE=0.1
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_geoapify_shadow.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit** (after explicit user approval)

```bash
git add backend/services/geoapify_shadow.py backend/tests/test_geoapify_shadow.py backend/.env.example
git commit -m "feat(system-eval): add Geoapify Route Matrix shadow-call client"
```

---

### Task 4: Dispatch the shadow call as a background task from `/chat/message` (case study 2, part B)

**Files:**
- Modify: `backend/routers/chat.py:1-19` (imports) and `:96-183` (`send_message`)
- Modify: `backend/tests/test_chat.py` (append a new test class)

**Interfaces:**
- Consumes: `should_sample() -> bool`, `log_routing_comparison(lat, lng, facility) -> None` from Task 3.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_chat.py`, inside the file after `TestSendMessage` (same module scope, new class):

```python
class TestSendMessageRoutingShadowDispatch:
    def _fake_msg(self, role: str, content: str) -> dict:
        return {
            "id": "00000000-0000-0000-0000-000000000003",
            "session_id": FAKE_SESSION_ID,
            "user_id": FAKE_USER_ID_STR,
            "role": role,
            "content": content,
            "created_at": "2024-01-15T10:00:00",
        }

    @pytest.fixture
    def client(self):
        return TestClient(_make_test_app(authenticated=True))

    def test_shadow_call_dispatched_when_sampled_and_facility_present(self, client):
        user_msg = self._fake_msg("user", "chest pain")
        assistant_msg = self._fake_msg("assistant", "Go to Toronto General immediately.")
        fake_facility = {
            "id": "fac-001", "name": "Toronto General Hospital",
            "category": "hospital", "address": "200 Elizabeth St",
            "lat": 43.659, "lng": -79.388, "distanceKm": 1.2,
        }

        with patch("routers.chat.add_message", side_effect=[user_msg, assistant_msg]), \
             patch("services.llm_agent.LLMAgent") as MockAgent, \
             patch("routers.chat.should_sample", return_value=True), \
             patch("routers.chat.log_routing_comparison") as mock_log:
            mock_instance = MagicMock()
            mock_instance.respond.return_value = {
                "response": "Go to Toronto General immediately.",
                "severity": "emergent",
                "reasoning": "Chest pain may indicate cardiac event.",
                "recommended_facility": fake_facility,
                "nearby_facilities": [],
                "turn_type": "triage",
            }
            MockAgent.return_value = mock_instance
            resp = client.post(
                "/chat/message",
                json={"session_id": FAKE_SESSION_ID, "content": "chest pain", "lat": 43.66, "lng": -79.38},
            )

        assert resp.status_code == 200
        mock_log.assert_called_once_with(43.66, -79.38, fake_facility)

    def test_shadow_call_not_dispatched_when_not_sampled(self, client):
        user_msg = self._fake_msg("user", "chest pain")
        assistant_msg = self._fake_msg("assistant", "Go to Toronto General immediately.")
        fake_facility = {
            "id": "fac-001", "name": "Toronto General Hospital",
            "category": "hospital", "address": "200 Elizabeth St",
            "lat": 43.659, "lng": -79.388, "distanceKm": 1.2,
        }

        with patch("routers.chat.add_message", side_effect=[user_msg, assistant_msg]), \
             patch("services.llm_agent.LLMAgent") as MockAgent, \
             patch("routers.chat.should_sample", return_value=False), \
             patch("routers.chat.log_routing_comparison") as mock_log:
            mock_instance = MagicMock()
            mock_instance.respond.return_value = {
                "response": "Go to Toronto General immediately.",
                "severity": "emergent",
                "reasoning": "Chest pain may indicate cardiac event.",
                "recommended_facility": fake_facility,
                "nearby_facilities": [],
                "turn_type": "triage",
            }
            MockAgent.return_value = mock_instance
            resp = client.post(
                "/chat/message",
                json={"session_id": FAKE_SESSION_ID, "content": "chest pain", "lat": 43.66, "lng": -79.38},
            )

        assert resp.status_code == 200
        mock_log.assert_not_called()

    def test_shadow_call_not_dispatched_on_followup_turn(self, client):
        user_msg = self._fake_msg("user", "hello")
        assistant_msg = self._fake_msg("assistant", "Can you tell me more?")

        with patch("routers.chat.add_message", side_effect=[user_msg, assistant_msg]), \
             patch("services.llm_agent.LLMAgent") as MockAgent, \
             patch("routers.chat.should_sample", return_value=True), \
             patch("routers.chat.log_routing_comparison") as mock_log:
            mock_instance = MagicMock()
            mock_instance.respond.return_value = {
                "response": "Can you tell me more?",
                "severity": None,
                "reasoning": None,
                "recommended_facility": None,
                "nearby_facilities": [],
                "turn_type": "followup",
            }
            MockAgent.return_value = mock_instance
            resp = client.post(
                "/chat/message",
                json={"session_id": FAKE_SESSION_ID, "content": "hello", "lat": 43.66, "lng": -79.38},
            )

        assert resp.status_code == 200
        mock_log.assert_not_called()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_chat.py::TestSendMessageRoutingShadowDispatch -v`
Expected: FAIL — `routers.chat` has no attribute `should_sample` / `log_routing_comparison`

- [ ] **Step 3: Write minimal implementation**

In `backend/routers/chat.py`, change the import block (lines 1-18):

```python
import logging
from datetime import datetime, date

from fastapi import APIRouter, Depends, Request, Header, BackgroundTasks
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool

from middleware.auth import get_current_user
from models import CreateSessionRequest, SendMessageRequest
from services.chat import (
    generate_session_title, create_session, add_message,
    get_past_conversations, get_older_messages,
)
from services.geoapify_shadow import should_sample, log_routing_comparison
from cache_chat import (
    get_user_cache, set_user_cache,
    append_message_to_cache, append_session_to_cache,
    invalidate_user_cache,
)
```

Change the `send_message` signature and add dispatch logic right before the `return` statement (full method, was lines 96-183):

```python
@router.post("/message")
async def send_message(
    body: SendMessageRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: object = Depends(get_current_user),
) -> dict:
    """
    Saves a user message, runs the LLM triage agent, saves the assistant response.
    Returns user message, assistant message, and triage result (null on follow-up turns).
    """
    user_id = str(current_user.id)  # type: ignore[attr-defined]
    session_id = str(body.session_id)
    request_id = getattr(request.state, "request_id", None)

    # Fetch history from cache for context window
    cache_entry, _ = get_user_cache(user_id)
    history: list[dict] = []
    if cache_entry:
        history = cache_entry.get("messages", {}).get(session_id, [])

    user_msg = add_message(session_id=session_id, user_id=user_id, role="user", content=body.content)
    append_message_to_cache(user_id, session_id, user_msg)

    try:
        from services.llm_agent import LLMAgent
        from db import supabase_select
        agent = LLMAgent()

        user_profile: dict | None = None
        try:
            user_profile = await run_in_threadpool(
                supabase_select,
                "profile",
                params={"user_id": f"eq.{user_id}", "select": "allergies,conditions,blood_type,medical_chat_opt_in"},
                single=True,
            )  # type: ignore[assignment]
        except Exception as exc:
            logger.warning("profile_fetch_failed", extra={"request_id": request_id, "error": str(exc)})

        result = agent.respond(
            user_message=body.content,
            history=history,
            lat=body.lat,
            lng=body.lng,
            user_profile=user_profile,
        )
    except Exception as exc:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
        logger.error("llm_agent_failed", extra={"request_id": request_id, "error": str(exc)})
        result = {
            "response": (
                "I'm having trouble processing your request right now. "
                "If this is an emergency, please call 911."
            ),
            "severity": None,
            "reasoning": None,
            "recommended_facility": None,
            "nearby_facilities": [],
            "turn_type": "followup",
        }

    assistant_msg = add_message(
        session_id=session_id, user_id=user_id, role="assistant", content=result["response"]
    )
    append_message_to_cache(user_id, session_id, assistant_msg)

    logger.info(
        "triage_agent_responded",
        extra={
            "request_id": request_id,
            "turn_type": result["turn_type"],
            "severity": result.get("severity"),
            "has_facility": result.get("recommended_facility") is not None,
            "nearby_count": len(result.get("nearby_facilities", [])),
        },
    )

    triage = None
    if result["turn_type"] == "triage":
        triage = {
            "severity": result["severity"],
            "reasoning": result["reasoning"],
            "recommended_facility": result["recommended_facility"],
            "nearby_facilities": result["nearby_facilities"],
        }

    if (
        triage
        and triage["recommended_facility"]
        and body.lat is not None
        and body.lng is not None
        and should_sample()
    ):
        background_tasks.add_task(
            log_routing_comparison, body.lat, body.lng, triage["recommended_facility"],
        )

    return _ser({"user_message": user_msg, "assistant_message": assistant_msg, "triage": triage})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_chat.py -v`
Expected: PASS (all tests, including the 3 new ones — `TestClient` runs `BackgroundTasks` synchronously before the request call returns, so `mock_log.assert_called_once_with(...)` observes it directly)

- [ ] **Step 5: Commit** (after explicit user approval)

```bash
git add backend/routers/chat.py backend/tests/test_chat.py
git commit -m "feat(system-eval): dispatch sampled routing shadow-call as a background task"
```

---

### Task 5: Prometheus counters on the wait-time cache-aside branches (case study 3)

**Files:**
- Modify: `backend/services/wait_times.py`
- Modify: `backend/tests/test_wait_times.py` (append a new test class)

**Interfaces:**
- Consumes: `_registry` from `backend/observability.py` (already exported, already imported by `main.py`).
- Produces: `WAIT_TIMES_CACHE_OUTCOME` (a `prometheus_client.Counter`), scraped automatically by the existing `/metrics` endpoint — no new endpoint needed.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_wait_times.py`:

```python
class TestCacheOutcomeMetrics:
    def _get_count(self, outcome: str) -> float:
        from services.wait_times import WAIT_TIMES_CACHE_OUTCOME
        return WAIT_TIMES_CACHE_OUTCOME.labels(outcome=outcome)._value.get()

    @patch("services.wait_times.redis_client")
    def test_redis_hit_increments_redis_hit_counter(self, mock_redis):
        mock_redis.hgetall.return_value = {
            "fac-1": json.dumps({"wait_minutes": 12, "source": "erstat"}),
        }
        before = self._get_count("redis_hit")

        get_wait_minutes_map()

        assert self._get_count("redis_hit") == before + 1

    @patch("services.wait_times.supabase_rpc")
    @patch("services.wait_times.redis_client")
    def test_supabase_fallback_increments_fallback_counter(self, mock_redis, mock_rpc):
        mock_redis.hgetall.return_value = {}
        mock_rpc.return_value = [
            {"facility_id": "fac-1", "wait_minutes": 20, "recorded_at": "2026-06-30T00:00:00Z"},
        ]
        before = self._get_count("supabase_fallback")

        get_wait_minutes_map()

        assert self._get_count("supabase_fallback") == before + 1

    @patch("services.wait_times.supabase_rpc", side_effect=Exception("supabase down"))
    @patch("services.wait_times.redis_client")
    def test_double_failure_increments_total_failure_counter(self, mock_redis, mock_rpc):
        mock_redis.hgetall.return_value = {}
        before = self._get_count("total_failure")

        get_wait_minutes_map()

        assert self._get_count("total_failure") == before + 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_wait_times.py::TestCacheOutcomeMetrics -v`
Expected: FAIL with `ImportError: cannot import name 'WAIT_TIMES_CACHE_OUTCOME' from 'services.wait_times'`

- [ ] **Step 3: Write minimal implementation**

In `backend/services/wait_times.py`, add imports and the counter definition after the existing imports (was lines 1-13):

```python
import json
import logging
import os

import redis
from prometheus_client import Counter

from db import supabase_rpc
from observability import _registry

logger = logging.getLogger(__name__)

REDIS_HASH_KEY = "wait_times:current"

redis_client = redis.from_url(os.environ["UPSTASH_REDIS_URL"].strip(), decode_responses=True)

WAIT_TIMES_CACHE_OUTCOME = Counter(
    "wait_times_cache_outcome_total",
    "Outcome of each wait-time cache read, by branch",
    ["outcome"],
    registry=_registry,
)
```

Replace `get_wait_minutes_map` (was lines 16-66) to increment the counter at each of the 3 branch outcomes:

```python
def get_wait_minutes_map() -> dict[str, int | None]:
    """
    Cache-aside read of current ER wait times, keyed by facility_id.

    1. Try the Redis hash workers/scraper.py writes every ~15 min. Each
       entry is parsed independently so one malformed value doesn't
       discard every other facility's good data for the request.
    2. On Redis error or an empty hash (cold start before the first scrape),
       fall back to the latest_wait_times Supabase RPC and best-effort
       populate Redis for the next read.
    3. If both Redis and the Supabase fallback fail, degrade to an empty
       map rather than raising — missing wait data always passes filters,
       same convention as the hours filters.

    Each of the 3 outcomes above increments WAIT_TIMES_CACHE_OUTCOME with a
    matching label, so /metrics can compute the cache hit rate and Redis
    fallback frequency the case study needs (Sprint 17).
    """
    try:
        raw = redis_client.hgetall(REDIS_HASH_KEY)
    except Exception:
        logger.warning("redis_unavailable_falling_back_to_supabase")
        raw = None

    if raw:
        wait_map: dict[str, int | None] = {}
        for fid, v in raw.items():
            try:
                wait_map[fid] = json.loads(v).get("wait_minutes")
            except (ValueError, AttributeError, TypeError):
                logger.warning("wait_times_entry_malformed", extra={"facility_id": fid})
        WAIT_TIMES_CACHE_OUTCOME.labels(outcome="redis_hit").inc()
        return wait_map

    try:
        rows = supabase_rpc("latest_wait_times", {})
    except Exception:
        logger.warning("wait_times_fallback_failed_returning_empty")
        WAIT_TIMES_CACHE_OUTCOME.labels(outcome="total_failure").inc()
        return {}

    wait_map = {r["facility_id"]: r["wait_minutes"] for r in rows}

    try:
        pipe = redis_client.pipeline()
        for r in rows:
            pipe.hset(REDIS_HASH_KEY, r["facility_id"], json.dumps({
                "wait_minutes": r["wait_minutes"],
                "raw_wait": r.get("raw_wait"),
                "source": r.get("source"),
                "updated_at": r.get("recorded_at"),
            }))
        pipe.execute()
    except Exception:
        logger.warning("redis_populate_failed")

    WAIT_TIMES_CACHE_OUTCOME.labels(outcome="supabase_fallback").inc()
    return wait_map
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_wait_times.py -v`
Expected: PASS (all existing tests plus the 3 new ones)

- [ ] **Step 5: Commit** (after explicit user approval)

```bash
git add backend/services/wait_times.py backend/tests/test_wait_times.py
git commit -m "feat(system-eval): add Prometheus counter for wait-time cache outcomes"
```

---

### Task 6: Verify on `preview` before Phase B (the "Verify" stage from the Sprint 17 process)

**Files:** none (operational verification only, no code changes)

- [ ] **Step 1: Confirm `GEOAPIFY_API_KEY` is populated in Doppler's `preview` config**

```bash
doppler secrets get GEOAPIFY_API_KEY --config preview --plain
```

Expected: a non-empty value. If empty, Task 3/4's shadow call will silently no-op (by design) — populate it before running Phase B, or case study 2 will have zero shadow-comparison data.

- [ ] **Step 2: Deploy Tasks 1-5 to `preview`**

Merge `feat/system-evaluation` → `preview` per the normal PR flow (`/end-sprint`), let the Render `preview` backend redeploy.

- [ ] **Step 3: Small-batch manual smoke test — triage groundedness (case study 1)**

Send 3-5 real chat messages through the deployed `preview` frontend with location enabled, at least one with enough turns to trigger classification. Then check Loki/Grafana logs for `preview`:

```bash
# via Render/Grafana Loki log search, or:
doppler run --config preview -- python -c "print('check Grafana Loki for: triage_grounding_checked')"
```

Expected: at least one `triage_grounding_checked` log entry with `facility_provided: true` and `grounded: true`.

- [ ] **Step 4: Small-batch manual smoke test — routing shadow call (case study 2)**

With `ROUTING_SHADOW_SAMPLE_RATE=0.1`, send ~15-20 triage messages with location enabled to reliably trigger at least one sampled call (expected ~1-2 at a 10% rate). Check Loki for `routing_shadow_comparison` log entries with non-null `geoapify_km`.

Expected: at least one entry with a populated `geoapify_km` and `error_km`. If entries are missing entirely (not just sparse), re-check Step 1 — the key is likely still unset.

- [ ] **Step 5: Manual smoke test — cache outcome counters (case study 3)**

```bash
curl -H "Authorization: Bearer $METRICS_BEARER_TOKEN" https://<preview-backend-url>/metrics | grep wait_times_cache_outcome_total
```

Expected: at least one `wait_times_cache_outcome_total{outcome="redis_hit"}` line with a nonzero value (wait-time reads happen on every `/facilities` and `/facilities/nearby` call per `main.py`, so this should populate quickly under normal preview traffic). To also confirm the fallback branch, temporarily point `UPSTASH_REDIS_URL` at an invalid host in a scratch Doppler config, hit the endpoint once, confirm `outcome="supabase_fallback"` increments, then revert.

- [ ] **Step 6: Only after Steps 3-5 all pass — proceed to Phase B**

Do not start the JMeter/Python simulated-load run against `preview` until every instrumentation path above has been observed producing correct data at small scale. Running the full load first and discovering a broken branch after the fact means re-running the whole collection window.

---

## Self-Review Notes

- **Spec coverage:** Task 1+2 cover case study 1 (groundedness + turn count), Task 3+4 cover case study 2 (Haversine-vs-real MAE data), Task 5 covers case study 3 (cache hit rate + fallback frequency), Task 6 covers the CHANGELOG's "Verify" stage. All 3 case studies' `METRIC PENDING` asks now have a concrete data source.
- **No new dependencies:** confirmed `httpx` and `prometheus_client` already in `requirements.txt` — nothing added.
- **No scope creep:** deliberately did not add a staleness gauge for case study 3 (only hit rate + fallback frequency are the case study's actual stated metrics) and did not touch DeepEval/JMeter here — those are Phase B, a separate plan once this one's data exists.
- **Type consistency:** `check_facility_groundedness` returns `{"grounded": bool | None, "facility_name": str | None}` consistently between Task 1's implementation and Task 2's consumption (`grounding["grounded"]`). `should_sample`/`log_routing_comparison` signatures match between Task 3's definition and Task 4's call site (`log_routing_comparison, body.lat, body.lng, triage["recommended_facility"]`).
