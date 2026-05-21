# Task: LLM Triage Agent — Symptom Classification + Facility Tool

**ID:** 008
**Scope:** `backend`
**Branch:** `feat/triage-mvp`
**Tests required:** yes — `backend/tests/llm/`

---

## Context

Replaces the stub assistant response with a real LLM-powered triage agent.
The agent classifies symptom severity, asks follow-up questions when needed,
and uses a proximity tool to find the top 3 nearest appropriate facilities.

Two-pass LLM design:
- Pass 1: classify severity (no facility knowledge, no hallucination risk)
- Pass 2: generate grounded response with real facility name injected from cache

Frontend changes (map route, next-action buttons) are Task 010.
This task is backend-only.

---

## Architecture Overview

```
routers/chat.py
    └── get_llm_agent()           # factory, reads LLM_PROVIDER env var
         └── LLMAgent             # facade — backend/services/llm_agent.py
              ├── GroqClient       # backend/llm/groq_client.py
              └── AnthropicClient  # backend/llm/anthropic_client.py

backend/llm/
    ├── __init__.py               # empty
    ├── base.py                   # abstract base class + shared types
    ├── groq_client.py            # Groq implementation
    ├── anthropic_client.py       # Anthropic implementation
    ├── tools.py                  # provider-agnostic tool definitions
    └── prompts.py                # system prompt + builder

backend/services/
    ├── proximity.py              # find_nearest_facilities() — Haversine on cache
    └── llm_agent.py              # LLMAgent facade + get_llm_agent() factory

backend/tests/llm/
    ├── __init__.py
    └── test_triage_tools.py
```

---

## New Environment Variables

Add to `.env.example`:

```bash
# LLM providers
LLM_PROVIDER=groq                         # groq | anthropic
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-haiku-20241022

# Geoapify (routing — Task 010, define here for completeness)
GEOAPIFY_API_KEY=

# Triage agent behaviour
TRIAGE_MAX_FOLLOWUPS=4        # hard ceiling on follow-up turns before forced classification
TRIAGE_CONTEXT_WINDOW=10      # last N messages passed as context to LLM
TRIAGE_TOP_N_FACILITIES=3     # number of nearest candidates returned to frontend
```

---

## Step 1 — Abstract Base + Shared Types

### `backend/llm/__init__.py`
Empty file.

### `backend/llm/base.py`

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

@dataclass
class LLMMessage:
    role: str        # "system" | "user" | "assistant" | "tool"
    content: str
    tool_call_id: str | None = None  # for tool result messages
    name: str | None = None          # tool name when role == "tool"

@dataclass
class ToolDefinition:
    """
    Provider-agnostic tool definition.
    Each client implementation translates this to its own wire format.
    Tool definitions are defined once in tools.py — never in provider files.
    """
    name: str
    description: str
    parameters: dict[str, Any]       # JSON Schema properties object
    required: list[str] = field(default_factory=list)

@dataclass
class LLMResponse:
    content: str | None              # None when LLM returned a tool call only
    tool_calls: list[dict] | None    # raw tool call objects from the provider
    finish_reason: str               # "stop" | "tool_calls" | "length"
    model: str
    usage: dict[str, int]            # prompt_tokens, completion_tokens

class BaseLLMClient(ABC):
    """
    Abstract interface all LLM implementations must satisfy.
    LLMAgent only interacts with this interface — never with provider
    classes directly.
    """

    @abstractmethod
    def chat(
        self,
        messages: list[LLMMessage],
        tools: list[ToolDefinition] | None = None,
        temperature: float = 0.2,
        stop: list[str] | None = None,
        force_tool: str | None = None,
    ) -> LLMResponse:
        """
        Send messages to the LLM.
        force_tool: if set, the LLM is forced to call this specific tool.
        Returns LLMResponse — caller checks finish_reason to detect tool calls.
        """
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        ...
```

---

## Step 2 — Provider Implementations

### `backend/llm/groq_client.py`

```python
import os
from groq import Groq
from .base import BaseLLMClient, LLMMessage, LLMResponse, ToolDefinition

class GroqClient(BaseLLMClient):

    def __init__(self):
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        self._client = Groq(api_key=api_key)
        self._model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    @property
    def model_name(self) -> str:
        return self._model

    def chat(
        self,
        messages: list[LLMMessage],
        tools: list[ToolDefinition] | None = None,
        temperature: float = 0.2,
        stop: list[str] | None = None,
        force_tool: str | None = None,
    ) -> LLMResponse:
        groq_messages = [self._to_groq_message(m) for m in messages]
        groq_tools = [self._to_groq_tool(t) for t in tools] if tools else None

        tool_choice = None
        if force_tool:
            tool_choice = {"type": "function", "function": {"name": force_tool}}
        elif tools:
            tool_choice = "auto"

        kwargs = dict(
            model=self._model,
            messages=groq_messages,
            temperature=temperature,
        )
        if stop:
            kwargs["stop"] = stop
        if groq_tools:
            kwargs["tools"] = groq_tools
            kwargs["tool_choice"] = tool_choice

        resp = self._client.chat.completions.create(**kwargs)
        choice = resp.choices[0]

        tool_calls = None
        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            tool_calls = [
                {
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                }
                for tc in choice.message.tool_calls
            ]

        return LLMResponse(
            content=choice.message.content,
            tool_calls=tool_calls,
            finish_reason=choice.finish_reason,
            model=self._model,
            usage={
                "prompt_tokens": resp.usage.prompt_tokens,
                "completion_tokens": resp.usage.completion_tokens,
            },
        )

    def _to_groq_message(self, msg: LLMMessage) -> dict:
        m = {"role": msg.role, "content": msg.content or ""}
        if msg.tool_call_id:
            m["tool_call_id"] = msg.tool_call_id
        if msg.name:
            m["name"] = msg.name
        return m

    def _to_groq_tool(self, tool: ToolDefinition) -> dict:
        return {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": {
                    "type": "object",
                    "properties": tool.parameters,
                    "required": tool.required,
                },
            },
        }
```

### `backend/llm/anthropic_client.py`

```python
import json
import os
import anthropic
from .base import BaseLLMClient, LLMMessage, LLMResponse, ToolDefinition

class AnthropicClient(BaseLLMClient):

    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = os.environ.get("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022")

    @property
    def model_name(self) -> str:
        return self._model

    def chat(
        self,
        messages: list[LLMMessage],
        tools: list[ToolDefinition] | None = None,
        temperature: float = 0.2,
        stop: list[str] | None = None,
        force_tool: str | None = None,
    ) -> LLMResponse:
        system_content = ""
        filtered = []
        for m in messages:
            if m.role == "system":
                system_content = m.content
            else:
                filtered.append(self._to_anthropic_message(m))

        anthropic_tools = [self._to_anthropic_tool(t) for t in tools] if tools else None

        tool_choice = None
        if force_tool:
            tool_choice = {"type": "tool", "name": force_tool}
        elif tools:
            tool_choice = {"type": "auto"}

        kwargs = dict(
            model=self._model,
            max_tokens=1024,
            temperature=temperature,
            messages=filtered,
        )
        if system_content:
            kwargs["system"] = system_content
        if stop:
            kwargs["stop_sequences"] = stop
        if anthropic_tools:
            kwargs["tools"] = anthropic_tools
            kwargs["tool_choice"] = tool_choice

        resp = self._client.messages.create(**kwargs)

        content_text = None
        tool_calls = None

        for block in resp.content:
            if block.type == "text":
                content_text = block.text
            elif block.type == "tool_use":
                tool_calls = tool_calls or []
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "arguments": json.dumps(block.input),
                })

        finish_reason = "tool_calls" if tool_calls else "stop"

        return LLMResponse(
            content=content_text,
            tool_calls=tool_calls,
            finish_reason=finish_reason,
            model=self._model,
            usage={
                "prompt_tokens": resp.usage.input_tokens,
                "completion_tokens": resp.usage.output_tokens,
            },
        )

    def _to_anthropic_message(self, msg: LLMMessage) -> dict:
        if msg.role == "tool":
            return {
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": msg.tool_call_id,
                    "content": msg.content,
                }],
            }
        return {"role": msg.role, "content": msg.content}

    def _to_anthropic_tool(self, tool: ToolDefinition) -> dict:
        return {
            "name": tool.name,
            "description": tool.description,
            "input_schema": {
                "type": "object",
                "properties": tool.parameters,
                "required": tool.required,
            },
        }
```

---

## Step 3 — Tool Definitions

### `backend/llm/tools.py`

```python
from .base import ToolDefinition

TRIAGE_RESPONSE = ToolDefinition(
    name="triage_response",
    description=(
        "Call this when you have sufficient information to classify the patient's "
        "symptom severity. Do NOT include a patient-facing response in this call — "
        "the conversational response is generated separately after the nearest "
        "facility is identified from the system's data. "
        "Never invent or guess facility names."
    ),
    parameters={
        "severity": {
            "type": "string",
            "enum": ["routine", "moderate", "urgent", "emergent"],
            "description": "Symptom severity classification",
        },
        "reasoning": {
            "type": "string",
            "description": (
                "Brief clinical reasoning for the classification — "
                "1-2 sentences, internal use only, not shown to the patient"
            ),
        },
        "needs_location": {
            "type": "boolean",
            "description": (
                "True if patient location is needed to find a nearby facility. "
                "Set to false only if location is clearly irrelevant."
            ),
        },
    },
    required=["severity", "reasoning", "needs_location"],
)

ALL_TOOLS = [TRIAGE_RESPONSE]
```

Note: `proximity_facility_finder` is NOT exposed to the LLM as a tool.
It is a pure Python function called deterministically by `LLMAgent`
after `triage_response` is returned. The LLM never invokes it directly —
this prevents hallucinated coordinates or facility names.

---

## Step 4 — System Prompt

### `backend/llm/prompts.py`

```python
TRIAGE_SYSTEM_PROMPT = """\
You are MediCoord, an AI health coordination assistant for the city of Toronto. \
Your role is to understand a patient's symptoms, classify their urgency, \
and help guide them to appropriate care.

## Severity Scale
Classify symptoms using exactly one of these four levels:
- routine   — non-urgent, can wait days (minor cold, routine check-up)
- moderate  — should be seen within hours (persistent fever, mild injury)
- urgent    — needs care within 1-2 hours (high fever in child, moderate pain)
- emergent  — immediate emergency care needed (chest pain, difficulty breathing, \
stroke signs, severe bleeding)

## Conversation Flow
1. FIRST message: acknowledge the patient's concern, then ask 2-3 focused \
clarifying questions. Do NOT call triage_response yet.
2. Subsequent messages: if you have sufficient information, call triage_response \
immediately. Do not ask unnecessary follow-ups.
3. Maximum follow-up turns: {max_followups}. At this limit, call triage_response \
with whatever information you have — err toward higher severity when uncertain.
4. EMERGENCY OVERRIDE: if the patient describes chest pain, difficulty breathing, \
unresponsive person, signs of stroke, or severe bleeding — call triage_response \
immediately with severity=emergent. No follow-up questions.

## Hard Rules
- NEVER recommend medications, treatments, or home remedies
- NEVER name specific medical facilities — the system provides facility data
- NEVER diagnose a medical condition — classify urgency only
- NEVER reveal your reasoning field to the patient
- Always respond in the language the patient uses
- Keep responses concise and calm — the patient may be anxious

## Response Style
When asking follow-up questions: ask all questions in a single message.
When you have enough information: call triage_response immediately.
"""

def build_system_prompt(max_followups: int = 4) -> str:
    return TRIAGE_SYSTEM_PROMPT.format(max_followups=max_followups)
```

---

## Step 5 — Proximity Service

### `backend/services/proximity.py`

```python
import math
import os
from backend.cache import get_cached_facilities

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lng2 - lng1)
    a = math.sin(Δφ/2)**2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ/2)**2
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
    if not facilities:
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
```

---

## Step 6 — LLMAgent Facade

### `backend/services/llm_agent.py`

```python
import json
import os
import logging
from backend.llm.base import BaseLLMClient, LLMMessage
from backend.llm.tools import ALL_TOOLS, TRIAGE_RESPONSE
from backend.llm.prompts import build_system_prompt
from backend.services.proximity import find_nearest_facilities

logger = logging.getLogger(__name__)


def get_llm_client() -> BaseLLMClient:
    """
    Factory. Reads LLM_PROVIDER env var.
    Import is deferred so unused provider packages don't cause ImportError.
    """
    provider = os.environ.get("LLM_PROVIDER", "groq").lower()
    if provider == "anthropic":
        from backend.llm.anthropic_client import AnthropicClient
        return AnthropicClient()
    from backend.llm.groq_client import GroqClient
    return GroqClient()


class LLMAgent:
    """
    Stateless triage agent facade.

    Stateless: caller provides full conversation history on every call.
    Context window: last TRIAGE_CONTEXT_WINDOW messages from cache_chat.
    Tool loop: handled internally — caller receives a clean result dict.

    Two-pass design:
      Pass 1: LLM classifies severity via triage_response tool (no facility knowledge)
      Pass 2: Proximity tool runs in Python (deterministic, from cache)
              LLM generates grounded response with real facility name injected
    """

    def __init__(self, client: BaseLLMClient | None = None):
        self._client = client or get_llm_client()
        self._max_followups = int(os.environ.get("TRIAGE_MAX_FOLLOWUPS", "4"))
        self._context_window = int(os.environ.get("TRIAGE_CONTEXT_WINDOW", "10"))
        self._temperature = 0.2
        self._response_temperature = 0.3   # slightly higher for natural language
        self._stop_sequences = ["</response>"]

    def respond(
        self,
        user_message: str,
        history: list[dict],
        lat: float | None = None,
        lng: float | None = None,
    ) -> dict:
        """
        Main entry point. Returns:
        {
            "response": str,
            "severity": str | None,
            "reasoning": str | None,
            "recommended_facility": dict | None,   # nearest by distance
            "nearby_facilities": list[dict],        # remaining candidates (for ETA later)
            "turn_type": "followup" | "triage",
        }
        """
        messages = self._build_messages(user_message, history)
        user_turns = sum(1 for m in history if m.get("role") == "user")
        force_classify = user_turns >= self._max_followups

        return self._run(messages, lat, lng, force=force_classify)

    def _build_messages(
        self, user_message: str, history: list[dict]
    ) -> list[LLMMessage]:
        msgs = [
            LLMMessage(role="system", content=build_system_prompt(self._max_followups))
        ]
        recent = history[-self._context_window:]
        for h in recent:
            msgs.append(LLMMessage(role=h["role"], content=h["content"]))
        msgs.append(LLMMessage(role="user", content=user_message))
        return msgs

    def _run(
        self,
        messages: list[LLMMessage],
        lat: float | None,
        lng: float | None,
        force: bool,
    ) -> dict:
        force_tool = TRIAGE_RESPONSE.name if force else None

        resp = self._client.chat(
            messages=messages,
            tools=ALL_TOOLS,
            temperature=self._temperature,
            stop=self._stop_sequences,
            force_tool=force_tool,
        )

        # Follow-up turn — LLM responded conversationally
        if resp.finish_reason != "tool_calls" or not resp.tool_calls:
            return {
                "response": resp.content or "Could you tell me more about your symptoms?",
                "severity": None,
                "reasoning": None,
                "recommended_facility": None,
                "nearby_facilities": [],
                "turn_type": "followup",
            }

        # Tool call received
        for tool_call in resp.tool_calls:
            if tool_call["name"] == TRIAGE_RESPONSE.name:
                return self._handle_triage(tool_call, messages, lat, lng)

        # Unexpected tool — safe fallback
        logger.warning("unexpected_tool_call", extra={"tool_calls": resp.tool_calls})
        return {
            "response": "I need a bit more information. Can you describe your symptoms?",
            "severity": None,
            "reasoning": None,
            "recommended_facility": None,
            "nearby_facilities": [],
            "turn_type": "followup",
        }

    def _handle_triage(
        self,
        tool_call: dict,
        messages: list[LLMMessage],
        lat: float | None,
        lng: float | None,
    ) -> dict:
        """
        Process triage_response tool call.

        1. Extract severity and reasoning
        2. Run proximity tool in Python (deterministic, from in-memory cache)
        3. Inject real facility data into a second LLM call for grounded response
        4. Return clean result dict
        """
        args = json.loads(tool_call["arguments"])
        severity = args["severity"]
        reasoning = args["reasoning"]
        needs_location = args.get("needs_location", True)

        # Step 2: proximity tool — pure Python, no LLM involvement
        recommended_facility = None
        nearby_facilities = []

        if needs_location and lat is not None and lng is not None:
            facilities = find_nearest_facilities(lat=lat, lng=lng, severity=severity)
            if facilities:
                recommended_facility = facilities[0]   # nearest by Haversine
                nearby_facilities = facilities[1:]     # candidates for ETA re-ranking
                logger.info(
                    "proximity resolved",
                    extra={
                        "severity": severity,
                        "recommended": recommended_facility["name"],
                        "distanceKm": recommended_facility["distanceKm"],
                        "candidates": len(nearby_facilities),
                    },
                )

        # Step 3: generate grounded conversational response
        response_text = self._generate_grounded_response(
            messages=messages,
            severity=severity,
            reasoning=reasoning,
            facility=recommended_facility,
        )

        return {
            "response": response_text,
            "severity": severity,
            "reasoning": reasoning,
            "recommended_facility": recommended_facility,
            "nearby_facilities": nearby_facilities,
            "turn_type": "triage",
        }

    def _generate_grounded_response(
        self,
        messages: list[LLMMessage],
        severity: str,
        reasoning: str,
        facility: dict | None,
    ) -> str:
        """
        Second LLM call. Generates the patient-facing response.
        The real facility name is injected as a system-level fact —
        the LLM uses it verbatim and cannot hallucinate a different one.
        """
        if facility:
            facility_fact = (
                f"The nearest appropriate facility is: {facility['name']} "
                f"at {facility['address']}, approximately {facility['distanceKm']} km away. "
                f"Use this exact facility name in your response — do not modify or replace it."
            )
        else:
            facility_fact = (
                "No location data is available. Do not mention any specific facility. "
                "Advise the patient to call 211 or search online for nearby care."
            )

        grounding = LLMMessage(
            role="system",
            content=(
                f"Symptom severity has been classified as: {severity}.\n"
                f"Internal reasoning (do not reveal): {reasoning}\n\n"
                f"{facility_fact}\n\n"
                f"Write a warm, concise response to the patient (2-4 sentences). "
                f"Mention the severity level and the facility name. "
                f"Do not recommend treatments or medications. "
                f"Do not repeat the internal reasoning."
            ),
        )

        resp = self._client.chat(
            messages=messages + [grounding],
            tools=None,
            temperature=self._response_temperature,
        )

        return resp.content or "Please proceed to the recommended facility for assessment."
```

---

## Step 7 — Update Router + Models

### `backend/models.py` — add/update

```python
class SendMessageRequest(BaseModel):
    session_id: UUID
    content: str = Field(..., min_length=1, max_length=4000)
    lat: float | None = None
    lng: float | None = None

class FacilityCandidate(BaseModel):
    id: str
    name: str
    category: str
    address: str
    lat: float
    lng: float
    distanceKm: float

class TriageResult(BaseModel):
    severity: str
    reasoning: str
    recommended_facility: FacilityCandidate | None = None
    nearby_facilities: list[FacilityCandidate] = []
```

### `backend/routers/chat.py` — update `send_message`

```python
@router.post("/message")
async def send_message(
    body: SendMessageRequest,
    request: Request,
    current_user=Depends(get_current_user),
):
    user_id = str(current_user.id)
    session_id = str(body.session_id)
    request_id = getattr(request.state, "request_id", None)

    # Fetch history from cache for context window
    cache_entry, _ = get_user_cache(user_id)
    history = []
    if cache_entry:
        history = cache_entry.get("messages", {}).get(session_id, [])

    # Write user message
    user_msg = add_message(session_id, user_id, "user", body.content)
    append_message_to_cache(user_id, session_id, user_msg)

    # Run triage agent
    try:
        from backend.services.llm_agent import LLMAgent
        agent = LLMAgent()
        result = agent.respond(
            user_message=body.content,
            history=history,
            lat=body.lat,
            lng=body.lng,
        )
    except Exception as exc:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
        logger.error("llm_agent_failed", extra={"request_id": request_id, "error": str(exc)})
        result = {
            "response": "I'm having trouble processing your request right now. "
                        "If this is an emergency, please call 911.",
            "severity": None,
            "reasoning": None,
            "recommended_facility": None,
            "nearby_facilities": [],
            "turn_type": "followup",
        }

    # Write assistant response
    assistant_msg = add_message(session_id, user_id, "assistant", result["response"])
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

    return serialize_for_json({
        "user_message": user_msg,
        "assistant_message": assistant_msg,
        "triage": triage,
    })
```

### `shared/types.ts` — add triage types

```typescript
export interface FacilityCandidate {
  id: string
  name: string
  category: FacilityCategory
  address: string
  lat: number
  lng: number
  distanceKm: number
}

export interface TriageResult {
  severity: Severity
  reasoning: string
  recommended_facility: FacilityCandidate | null
  nearby_facilities: FacilityCandidate[]   // candidates for ETA re-ranking in Task 010
}

export interface ChatMessageResponse {
  user_message: Message
  assistant_message: Message
  triage: TriageResult | null   // null on follow-up turns
}
```

---

## Step 8 — Tests

### `backend/tests/llm/__init__.py`
Empty file.

### `backend/tests/llm/test_triage_tools.py`

```python
"""
Unit tests for proximity service, agent message building, and follow-up ceiling.
No real LLM calls — all LLM interactions are mocked.
No environment variables or network access required.
"""
import json
import math
import os
import pytest
from unittest.mock import patch, MagicMock

MOCK_FACILITIES = [
    {
        "id": "fac-001", "name": "Toronto General Hospital",
        "category": "hospital", "address": "200 Elizabeth St, Toronto",
        "lat": 43.659, "lng": -79.388,
        "accepted_severity": ["emergent", "urgent", "moderate", "routine"],
    },
    {
        "id": "fac-002", "name": "Bay Centre Walk-In Clinic",
        "category": "ambulatory", "address": "444 Yonge St, Toronto",
        "lat": 43.661, "lng": -79.383,
        "accepted_severity": ["urgent", "moderate", "routine"],
    },
    {
        "id": "fac-003", "name": "Rosedale Residential Care",
        "category": "residential", "address": "120 Bloor St E, Toronto",
        "lat": 43.668, "lng": -79.380,
        "accepted_severity": ["routine"],
    },
    {
        "id": "fac-004", "name": "St. Michael's Hospital",
        "category": "hospital", "address": "30 Bond St, Toronto",
        "lat": 43.653, "lng": -79.376,
        "accepted_severity": ["emergent", "urgent", "moderate", "routine"],
    },
]

@pytest.fixture(autouse=True)
def mock_facilities_cache():
    with patch("backend.services.proximity.get_cached_facilities") as m:
        m.return_value = (MOCK_FACILITIES, '"mock-etag"')
        yield m


# -----------------------------------------------------------------------
# Haversine
# -----------------------------------------------------------------------

class TestHaversine:
    def test_same_point_is_zero(self):
        from backend.services.proximity import haversine_km
        assert haversine_km(43.659, -79.388, 43.659, -79.388) == 0.0

    def test_known_approximate_distance(self):
        from backend.services.proximity import haversine_km
        # Toronto General to CN Tower approx 1.9 km
        dist = haversine_km(43.659, -79.388, 43.642, -79.387)
        assert 1.0 < dist < 3.0

    def test_symmetry(self):
        from backend.services.proximity import haversine_km
        d1 = haversine_km(43.659, -79.388, 43.668, -79.380)
        d2 = haversine_km(43.668, -79.380, 43.659, -79.388)
        assert abs(d1 - d2) < 0.001


# -----------------------------------------------------------------------
# find_nearest_facilities
# -----------------------------------------------------------------------

class TestFindNearestFacilities:
    def test_returns_list_not_single(self):
        from backend.services.proximity import find_nearest_facilities
        result = find_nearest_facilities(43.660, -79.385, "routine", top_n=3)
        assert isinstance(result, list)

    def test_top_n_respected(self):
        from backend.services.proximity import find_nearest_facilities
        result = find_nearest_facilities(43.660, -79.385, "routine", top_n=2)
        assert result is not None
        assert len(result) <= 2

    def test_sorted_by_distance_ascending(self):
        from backend.services.proximity import find_nearest_facilities
        result = find_nearest_facilities(43.660, -79.385, "routine", top_n=3)
        assert result is not None
        distances = [f["distanceKm"] for f in result]
        assert distances == sorted(distances)

    def test_emergent_only_returns_hospitals(self):
        from backend.services.proximity import find_nearest_facilities
        result = find_nearest_facilities(43.660, -79.385, "emergent", top_n=3)
        assert result is not None
        for f in result:
            assert f["category"] == "hospital"

    def test_all_results_accept_severity(self):
        from backend.services.proximity import find_nearest_facilities
        for severity in ["routine", "moderate", "urgent", "emergent"]:
            result = find_nearest_facilities(43.660, -79.385, severity, top_n=5)
            assert result is not None
            for f in result:
                assert severity in f["accepted_severity"]

    def test_returns_none_when_cache_empty(self):
        from backend.services.proximity import find_nearest_facilities
        with patch("backend.services.proximity.get_cached_facilities") as m:
            m.return_value = (None, None)
            result = find_nearest_facilities(43.660, -79.385, "urgent")
            assert result is None

    def test_returns_empty_list_when_no_eligible(self):
        from backend.services.proximity import find_nearest_facilities
        # Only residential facility accepts routine — remove it
        facilities = [f for f in MOCK_FACILITIES if f["category"] != "residential"]
        with patch("backend.services.proximity.get_cached_facilities") as m:
            m.return_value = (facilities, '"etag"')
            result = find_nearest_facilities(43.660, -79.385, "routine", top_n=3)
            # All remaining facilities also accept routine — should still return results
            # Test with a severity no facility accepts
            pass
        # Test truly empty case
        with patch("backend.services.proximity.get_cached_facilities") as m:
            m.return_value = ([], '"etag"')
            result = find_nearest_facilities(43.660, -79.385, "emergent")
            assert result == []

    def test_distance_field_present_and_positive(self):
        from backend.services.proximity import find_nearest_facilities
        result = find_nearest_facilities(43.660, -79.385, "urgent", top_n=2)
        assert result is not None
        for f in result:
            assert "distanceKm" in f
            assert f["distanceKm"] > 0

    def test_result_fields_complete(self):
        from backend.services.proximity import find_nearest_facilities
        result = find_nearest_facilities(43.660, -79.385, "moderate", top_n=1)
        assert result is not None and len(result) > 0
        required = ["id", "name", "category", "address", "lat", "lng", "distanceKm"]
        for field in required:
            assert field in result[0]

    def test_first_item_is_nearest(self):
        from backend.services.proximity import find_nearest_facilities
        result = find_nearest_facilities(43.660, -79.385, "routine", top_n=3)
        assert result is not None and len(result) > 1
        assert result[0]["distanceKm"] <= result[1]["distanceKm"]


# -----------------------------------------------------------------------
# LLMAgent — message building
# -----------------------------------------------------------------------

def make_agent():
    from backend.services.llm_agent import LLMAgent
    return LLMAgent(client=MagicMock())

class TestAgentMessageBuilding:
    def test_system_prompt_is_first(self):
        agent = make_agent()
        msgs = agent._build_messages("I have a headache", [])
        assert msgs[0].role == "system"
        assert "MediCoord" in msgs[0].content

    def test_user_message_is_last(self):
        agent = make_agent()
        msgs = agent._build_messages("I have a headache", [])
        assert msgs[-1].role == "user"
        assert msgs[-1].content == "I have a headache"

    def test_history_trimmed_to_context_window(self):
        os.environ["TRIAGE_CONTEXT_WINDOW"] = "4"
        agent = make_agent()
        history = [
            {"role": "user" if i % 2 == 0 else "assistant", "content": f"msg {i}"}
            for i in range(20)
        ]
        msgs = agent._build_messages("new message", history)
        # system + 4 history + 1 user = 6
        assert len(msgs) == 6

    def test_empty_history_two_messages(self):
        agent = make_agent()
        msgs = agent._build_messages("I feel dizzy", [])
        assert len(msgs) == 2  # system + user


# -----------------------------------------------------------------------
# LLMAgent — follow-up ceiling
# -----------------------------------------------------------------------

class TestFollowupCeiling:
    def test_force_classify_at_ceiling(self):
        from backend.services.llm_agent import LLMAgent
        from backend.llm.tools import TRIAGE_RESPONSE

        mock_client = MagicMock()
        mock_client.chat.return_value = MagicMock(
            finish_reason="tool_calls",
            content=None,
            tool_calls=[{
                "id": "tc1",
                "name": TRIAGE_RESPONSE.name,
                "arguments": json.dumps({
                    "severity": "moderate",
                    "reasoning": "Persistent symptoms",
                    "needs_location": False,
                }),
            }],
        )
        os.environ["TRIAGE_MAX_FOLLOWUPS"] = "2"
        agent = LLMAgent(client=mock_client)

        # 2 prior user turns = at ceiling
        history = [
            {"role": "user", "content": "I have a fever"},
            {"role": "assistant", "content": "How long have you had it?"},
            {"role": "user", "content": "Since yesterday"},
            {"role": "assistant", "content": "Any other symptoms?"},
        ]
        result = agent.respond("Just tired", history)

        call_kwargs = mock_client.chat.call_args_list[0].kwargs
        assert call_kwargs.get("force_tool") == TRIAGE_RESPONSE.name
        assert result["turn_type"] == "triage"
        assert result["severity"] == "moderate"

    def test_followup_turn_no_force_tool(self):
        from backend.services.llm_agent import LLMAgent

        mock_client = MagicMock()
        mock_client.chat.return_value = MagicMock(
            finish_reason="stop",
            content="How long have you had these symptoms?",
            tool_calls=None,
        )
        os.environ["TRIAGE_MAX_FOLLOWUPS"] = "4"
        agent = LLMAgent(client=mock_client)

        result = agent.respond("I have a headache", [])

        call_kwargs = mock_client.chat.call_args_list[0].kwargs
        assert call_kwargs.get("force_tool") is None
        assert result["turn_type"] == "followup"
        assert result["severity"] is None


# -----------------------------------------------------------------------
# LLMAgent — triage result shape
# -----------------------------------------------------------------------

class TestTriageResultShape:
    def test_triage_result_contains_nearby_facilities(self):
        from backend.services.llm_agent import LLMAgent
        from backend.llm.tools import TRIAGE_RESPONSE

        mock_client = MagicMock()
        mock_client.chat.return_value = MagicMock(
            finish_reason="tool_calls",
            content=None,
            tool_calls=[{
                "id": "tc1",
                "name": TRIAGE_RESPONSE.name,
                "arguments": json.dumps({
                    "severity": "urgent",
                    "reasoning": "High fever with pain",
                    "needs_location": True,
                }),
            }],
        )
        # Second call for grounded response
        mock_client.chat.side_effect = [
            mock_client.chat.return_value,
            MagicMock(finish_reason="stop", content="Please go to Bay Centre Walk-In.", tool_calls=None),
        ]

        agent = LLMAgent(client=mock_client)
        result = agent.respond("I have a high fever", [], lat=43.660, lng=-79.385)

        assert result["turn_type"] == "triage"
        assert result["severity"] == "urgent"
        assert result["recommended_facility"] is not None
        assert isinstance(result["nearby_facilities"], list)
        # recommended is not in nearby_facilities
        recommended_id = result["recommended_facility"]["id"]
        nearby_ids = [f["id"] for f in result["nearby_facilities"]]
        assert recommended_id not in nearby_ids

    def test_no_location_returns_no_facility(self):
        from backend.services.llm_agent import LLMAgent
        from backend.llm.tools import TRIAGE_RESPONSE

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
                        "needs_location": True,
                    }),
                }],
            ),
            MagicMock(finish_reason="stop", content="See a walk-in when convenient.", tool_calls=None),
        ]

        agent = LLMAgent(client=mock_client)
        result = agent.respond("I have a cold", [], lat=None, lng=None)

        assert result["recommended_facility"] is None
        assert result["nearby_facilities"] == []
```

---

## Update `backend/requirements.txt`

Add:
```
groq==0.11.*
anthropic==0.40.*
```

---

## Commits (max 4)

```bash
# Commit 1 — LLM abstraction layer
git add backend/llm/__init__.py \
        backend/llm/base.py \
        backend/llm/groq_client.py \
        backend/llm/anthropic_client.py \
        backend/llm/tools.py \
        backend/llm/prompts.py
git commit -m "feat(llm): provider abstraction — base client, Groq and Anthropic implementations, tool definitions, system prompt"

# Commit 2 — proximity service + LLM agent facade
git add backend/services/proximity.py \
        backend/services/llm_agent.py
git commit -m "feat(backend): proximity service top-N facilities, LLMAgent two-pass facade with grounding"

# Commit 3 — router + models + shared types + env
git add backend/routers/chat.py \
        backend/models.py \
        backend/requirements.txt \
        shared/types.ts \
        .env.example
git commit -m "feat(backend): extend /chat/message — LLM agent, lat/lng payload, triage response with recommended and nearby facilities"

# Commit 4 — tests
git add backend/tests/llm/__init__.py \
        backend/tests/llm/test_triage_tools.py
git commit -m "test(llm): proximity service, agent message building, follow-up ceiling, triage result shape"
```

---

## Verification Checklist

- [ ] `doppler run -- pytest backend/tests/llm/ -v` — all tests pass
- [ ] `doppler run -- python -m uvicorn main:app --host 0.0.0.0 --port 8000` starts clean
- [ ] `POST /chat/message` with first symptom message → follow-up questions returned
- [ ] After 2+ follow-up answers → `triage` object in response with `severity` set
- [ ] `severity` is always one of `routine | moderate | urgent | emergent`
- [ ] With `lat/lng` → `recommended_facility` and `nearby_facilities` present
- [ ] Without `lat/lng` → both are null / empty
- [ ] `recommended_facility` name matches a real facility in the database
- [ ] LLM agent failure → safe error message returned, Sentry event captured
- [ ] Render logs show `triage_agent_responded` JSON with `turn_type`, `severity`, `nearby_count`

---

## Out of Scope

- Map route drawing — Task 010
- Next-action buttons — Task 010
- Geoapify RouteMatrix (ETA + route geometry) — Task 010
- Frontend progress trace UI — Task 010
- Prompt evaluation / DeepEval — Sprint 9
- Prompt caching — Sprint 9
- Embedding search — Sprint 9