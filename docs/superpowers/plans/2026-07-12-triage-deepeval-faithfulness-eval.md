# System Evaluation — Phase B: DeepEval Faithfulness Complement (Case Study 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DeepEval-judged Faithfulness/G-Eval check that runs offline over synthetic triage transcripts, as a semantic complement to case study 1's existing deterministic groundedness check, and publish the measured result into the `two-pass-tool-orchestration-symptom-triage` case study.

**Architecture:** Two-stage offline pipeline, mirroring Sprint 17's own Phase A/Phase B split: (1) a transcript generator authenticates as disposable eval-project test accounts (from Sprint 17's `eval_seed` work) and drives real `/chat/sessions` + `/chat/message` calls against the `preview` backend with emergent-sounding synthetic symptom messages, saving each conversation's response and recommended facility to a JSON file; (2) a scoring pass reads that JSON offline, reconstructs the same facility fact the model was actually given (from `llm_agent.py`'s grounding message), and runs DeepEval's `FaithfulnessMetric` (OpenAI-judged) against it — checking whether the full response is faithful to the injected fact, not just whether the facility name appears verbatim. This catches a class of hallucination the existing regex check cannot: fabricated details (wrong hours, invented services, wrong distance) that coexist with a correctly-spelled facility name.

**Tech Stack:** Python 3.11, `requests` (already a dependency, matches `eval_seed`'s synchronous style), `deepeval` (new dependency), OpenAI as the judge model (`gpt-4o-mini` — cost-bounded, per the existing $5-credit constraint noted in the Sprint 17 discussion notes).

## Global Constraints

- Type hints on all new function signatures (per `CLAUDE.md`).
- New Python dependency `deepeval` — must be added to `backend/requirements.txt` (per `CLAUDE.md`'s "no new dependencies without adding to requirements.txt").
- No changes to any request/response shape, no new backend routes — `shared/types.ts` is untouched. This plan only adds offline scripts plus a documentation-only update to `webapp/src/data/caseStudies.ts` (`result`/`methodology` arrays, no schema change).
- Never run against `main` or real user data — all synthetic traffic targets the dedicated eval Supabase project + `preview` backend, using the disposable test accounts from `backend/scripts/eval_seed/create_eval_test_accounts.py`.
- **Scope boundary (explicit decision for this plan):** this DeepEval pass measures **Faithfulness only**, as a complement to the already-published deterministic groundedness metric. It does **not** attempt premature-classification rate — that remains scoped to Sprint 9's prompt-evaluation work per the case study's own published copy and Sprint 17's CHANGELOG "out of scope" line. Do not add ground-truth labeling or a premature-classification metric in this plan.
- Each task ends with a prepared `git commit` step, but per this repo's rule, **commits always need explicit user approval** — stage and show the diff, then wait for a go-ahead before running the commit command.
- Branch: cut a new branch `feat/triage-deepeval-eval` from `preview` before Task 1 (this plan does not touch `feat/system-evaluation`, which is presumably already merged given the case-study copy is already live on `preview`/`main`).

---

## File Structure

```
backend/
  requirements.txt                                    # MODIFY — add deepeval
  .env.example                                        # (root .env.example) MODIFY — add OPENAI_API_KEY, EVAL_API_BASE_URL
  scripts/
    triage_deepeval/
      __init__.py                                     # CREATE — empty, makes this a package (matches eval_seed/__init__.py)
      symptom_scenarios.py                             # CREATE — synthetic emergent-sounding scenario fixtures
      generate_transcripts.py                          # CREATE — Stage 1: drive real /chat calls, save transcripts
      run_faithfulness_eval.py                         # CREATE — Stage 2: offline DeepEval Faithfulness pass
      tests/
        __init__.py                                    # CREATE — empty
        test_symptom_scenarios.py                       # CREATE
        test_generate_transcripts.py                    # CREATE — pure-function tests only, no network
        test_run_faithfulness_eval.py                   # CREATE — pure-function tests, DeepEval metric call mocked
webapp/
  src/data/caseStudies.ts                              # MODIFY — case study 1: new methodology bullet + result bullet with real measured score (Task 5, after a real run)
.gitignore                                             # MODIFY — ignore generated transcripts/results JSON
```

No new frontend components: `EngineeringCaseStudyPage.tsx`'s `Result`/`Methodology` sections already render arbitrary `MetricBullet[]` (confirmed at `webapp/src/pages/EngineeringCaseStudyPage.tsx:321-338`) — appending bullets to the existing arrays is enough.

---

### Task 1: Synthetic symptom scenario fixtures

**Files:**
- Create: `backend/scripts/triage_deepeval/__init__.py`
- Create: `backend/scripts/triage_deepeval/symptom_scenarios.py`
- Test: `backend/scripts/triage_deepeval/tests/__init__.py`
- Test: `backend/scripts/triage_deepeval/tests/test_symptom_scenarios.py`

**Interfaces:**
- Produces: `SYMPTOM_SCENARIOS: list[dict]`, each `{"message": str, "lat": float, "lng": float}` — consumed by Task 2's transcript generator.

Emergent-sounding, single-turn messages are used deliberately: an `emergent` classification bypasses the `TRIAGE_MIN_TURNS` gate (`backend/services/llm_agent.py:126-129`), so one message per session reliably produces an immediate `triage_response` tool call with a recommended facility — the same "single-thread synthetic conversation" pattern the case study's existing methodology already describes for the deterministic-check run.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/triage_deepeval/tests/test_symptom_scenarios.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.triage_deepeval.symptom_scenarios import SYMPTOM_SCENARIOS

TORONTO_LAT_RANGE = (43.58, 43.85)
TORONTO_LNG_RANGE = (-79.64, -79.12)


class TestSymptomScenarios:
    def test_has_multiple_scenarios(self):
        assert len(SYMPTOM_SCENARIOS) >= 10

    def test_every_scenario_has_required_keys(self):
        for scenario in SYMPTOM_SCENARIOS:
            assert set(scenario.keys()) == {"message", "lat", "lng"}
            assert isinstance(scenario["message"], str) and scenario["message"]

    def test_coordinates_are_within_toronto_bounds(self):
        for scenario in SYMPTOM_SCENARIOS:
            assert TORONTO_LAT_RANGE[0] <= scenario["lat"] <= TORONTO_LAT_RANGE[1]
            assert TORONTO_LNG_RANGE[0] <= scenario["lng"] <= TORONTO_LNG_RANGE[1]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/triage_deepeval/tests/test_symptom_scenarios.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.triage_deepeval.symptom_scenarios'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/triage_deepeval/__init__.py
```
(empty file)

```python
# backend/scripts/triage_deepeval/symptom_scenarios.py
"""
Emergent-sounding, single-turn synthetic symptom messages used to drive Phase B's
DeepEval Faithfulness pass (see docs/superpowers/plans/2026-07-12-triage-deepeval-faithfulness-eval.md).

Emergent severity bypasses TRIAGE_MIN_TURNS (llm_agent.py), so a single message
reliably produces a triage_response tool call with a recommended facility on the
first turn — no multi-turn conversation state needed.

Coordinates are jittered around downtown Toronto (CN Tower reference point),
matching the facility data's coverage area.
"""

SYMPTOM_SCENARIOS: list[dict] = [
    {"message": "I have crushing chest pain radiating to my left arm and I can't catch my breath.", "lat": 43.6426, "lng": -79.3871},
    {"message": "My face is drooping on one side and I can't lift my right arm, this started 10 minutes ago.", "lat": 43.6511, "lng": -79.3470},
    {"message": "I'm having a severe allergic reaction, my throat is closing up and my face is swelling.", "lat": 43.6629, "lng": -79.3957},
    {"message": "I was in a car accident and there's heavy bleeding from a deep cut on my leg that won't stop.", "lat": 43.6205, "lng": -79.5132},
    {"message": "My child is unconscious and not responding after falling down the stairs.", "lat": 43.7000, "lng": -79.4163},
    {"message": "I suddenly can't see out of one eye and have the worst headache of my life.", "lat": 43.6890, "lng": -79.4507},
    {"message": "I'm having a seizure right now, this is the third one in an hour.", "lat": 43.7615, "lng": -79.4111},
    {"message": "I'm coughing up blood and have severe difficulty breathing that's getting worse.", "lat": 43.6435, "lng": -79.5656},
    {"message": "My baby has a fever of 40C and is limp and won't wake up.", "lat": 43.7532, "lng": -79.3832},
    {"message": "I took too much of my medication by accident and I'm feeling dizzy and confused.", "lat": 43.6677, "lng": -79.4200},
    {"message": "I have sudden severe abdominal pain and I've been vomiting blood.", "lat": 43.7042, "lng": -79.3550},
    {"message": "I burned myself badly with boiling water and the skin is blistering over a large area.", "lat": 43.6108, "lng": -79.4849},
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/triage_deepeval/tests/test_symptom_scenarios.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/triage_deepeval/__init__.py backend/scripts/triage_deepeval/symptom_scenarios.py backend/scripts/triage_deepeval/tests/__init__.py backend/scripts/triage_deepeval/tests/test_symptom_scenarios.py
git commit -m "feat(system-eval): add synthetic symptom scenarios for Phase B transcript generation"
```

---

### Task 2: Transcript generator — drive real `/chat` calls, save conversation transcripts

**Files:**
- Create: `backend/scripts/triage_deepeval/generate_transcripts.py`
- Test: `backend/scripts/triage_deepeval/tests/test_generate_transcripts.py`
- Modify: `.env.example` (root) — add `EVAL_API_BASE_URL`
- Modify: `.gitignore` — ignore generated transcript output

**Interfaces:**
- Consumes: `SYMPTOM_SCENARIOS` from Task 1 (`scripts.triage_deepeval.symptom_scenarios`); `backend/scripts/eval_seed/eval_test_accounts.json` (produced by the already-shipped `create_eval_test_accounts.py`, format `[{"id":, "email":, "password":}, ...]`).
- Produces: `build_transcript_row(scenario: dict, chat_response: dict) -> dict` returning
  `{"message": str, "response_text": str, "severity": str | None, "recommended_facility": dict | None}`
  — consumed by Task 3's `score_transcript`.
- Produces: a JSON file at `backend/scripts/triage_deepeval/transcripts/transcripts_<UTC-timestamp>.json` containing `list[dict]` in the shape above.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/triage_deepeval/tests/test_generate_transcripts.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.triage_deepeval.generate_transcripts import build_transcript_row

SCENARIO = {"message": "chest pain", "lat": 43.6426, "lng": -79.3871}

CHAT_RESPONSE_WITH_TRIAGE = {
    "user_message": {"id": "m1", "role": "user", "content": "chest pain"},
    "assistant_message": {"id": "m2", "role": "assistant", "content": "Please go to Toronto General Hospital immediately."},
    "triage": {
        "severity": "emergent",
        "reasoning": "chest pain radiating to arm",
        "recommended_facility": {
            "id": "fac-001",
            "name": "Toronto General Hospital",
            "category": "hospital",
            "address": "200 Elizabeth St, Toronto",
            "lat": 43.6577,
            "lng": -79.3877,
            "distanceKm": 1.4,
        },
        "nearby_facilities": [],
    },
}

CHAT_RESPONSE_FOLLOWUP = {
    "user_message": {"id": "m3", "role": "user", "content": "not feeling well"},
    "assistant_message": {"id": "m4", "role": "assistant", "content": "Can you tell me more about your symptoms?"},
    "triage": None,
}


class TestBuildTranscriptRow:
    def test_extracts_response_and_facility_when_triage_present(self):
        row = build_transcript_row(SCENARIO, CHAT_RESPONSE_WITH_TRIAGE)
        assert row == {
            "message": "chest pain",
            "response_text": "Please go to Toronto General Hospital immediately.",
            "severity": "emergent",
            "recommended_facility": CHAT_RESPONSE_WITH_TRIAGE["triage"]["recommended_facility"],
        }

    def test_facility_and_severity_none_on_followup_turn(self):
        row = build_transcript_row(SCENARIO, CHAT_RESPONSE_FOLLOWUP)
        assert row["severity"] is None
        assert row["recommended_facility"] is None
        assert row["response_text"] == "Can you tell me more about your symptoms?"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/triage_deepeval/tests/test_generate_transcripts.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.triage_deepeval.generate_transcripts'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/triage_deepeval/generate_transcripts.py
"""
Phase B, stage 1: authenticates as disposable eval-project test accounts
(created by scripts/eval_seed/create_eval_test_accounts.py) and drives real
/chat/sessions + /chat/message calls against the eval-project preview backend
with synthetic emergent-sounding symptom messages. Saves each conversation's
response and recommended facility for stage 2's offline DeepEval pass.

Never targets main or real user data — eval Supabase project + preview
backend only.

Invocation:
    doppler run --config eval -- python scripts/triage_deepeval/generate_transcripts.py --count 20
"""
import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from db import SUPABASE_URL, SUPABASE_KEY  # noqa: E402
from scripts.triage_deepeval.symptom_scenarios import SYMPTOM_SCENARIOS  # noqa: E402

logger = logging.getLogger(__name__)

ACCOUNTS_PATH = os.path.join(
    os.path.dirname(__file__), "..", "eval_seed", "eval_test_accounts.json"
)
TRANSCRIPTS_DIR = os.path.join(os.path.dirname(__file__), "transcripts")


def load_accounts() -> list[dict]:
    with open(ACCOUNTS_PATH) as f:
        return json.load(f)


def login(email: str, password: str) -> str:
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def create_session(base_url: str, token: str, first_message: str) -> str:
    resp = requests.post(
        f"{base_url}/chat/sessions",
        headers={"Authorization": f"Bearer {token}"},
        json={"first_message": first_message},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["id"]


def send_message(base_url: str, token: str, session_id: str, scenario: dict) -> dict:
    resp = requests.post(
        f"{base_url}/chat/message",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "session_id": session_id,
            "content": scenario["message"],
            "lat": scenario["lat"],
            "lng": scenario["lng"],
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def build_transcript_row(scenario: dict, chat_response: dict) -> dict:
    triage = chat_response.get("triage")
    return {
        "message": scenario["message"],
        "response_text": chat_response["assistant_message"]["content"],
        "severity": triage["severity"] if triage else None,
        "recommended_facility": triage["recommended_facility"] if triage else None,
    }


def run(count: int, base_url: str) -> list[dict]:
    accounts = load_accounts()
    if not accounts:
        raise RuntimeError(
            f"No eval test accounts found at {ACCOUNTS_PATH} — run "
            "create_eval_test_accounts.py first."
        )

    transcripts: list[dict] = []
    for i in range(count):
        scenario = SYMPTOM_SCENARIOS[i % len(SYMPTOM_SCENARIOS)]
        account = accounts[i % len(accounts)]

        token = login(account["email"], account["password"])
        session_id = create_session(base_url, token, scenario["message"])
        chat_response = send_message(base_url, token, session_id, scenario)
        transcripts.append(build_transcript_row(scenario, chat_response))

        logger.info(
            "transcript_generated",
            extra={"index": i, "severity": transcripts[-1]["severity"]},
        )
        # ponytail: fixed pause, not adaptive backoff — Groq/Geoapify are both
        # free-tier per the Sprint 17 discussion notes; a flat pause keeps this
        # single-thread run well under either rate limit without new logic.
        time.sleep(1)

    return transcripts


def write_transcripts(transcripts: list[dict]) -> str:
    os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(TRANSCRIPTS_DIR, f"transcripts_{stamp}.json")
    with open(path, "w") as f:
        json.dump(transcripts, f, indent=2)
    return path


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=20)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("EVAL_API_BASE_URL"),
        help="Eval-project preview backend base URL (or set EVAL_API_BASE_URL)",
    )
    args = parser.parse_args()

    if not args.base_url:
        raise SystemExit("--base-url or EVAL_API_BASE_URL env var is required")

    transcripts = run(args.count, args.base_url)
    path = write_transcripts(transcripts)
    print(f"{len(transcripts)} transcripts written to {path}")


if __name__ == "__main__":
    main()
```

```diff
--- a/.env.example
+++ b/.env.example
@@
 # Metrics endpoint protection
 METRICS_BEARER_TOKEN=
 
+# Evaluation — Sprint 17 Phase B (DeepEval faithfulness pass, eval project only)
+EVAL_API_BASE_URL=                        # eval-project preview backend base URL, used by scripts/triage_deepeval
+OPENAI_API_KEY=                           # DeepEval judge model (gpt-4o-mini) — eval project only, never prod
+
```

```diff
--- a/.gitignore
+++ b/.gitignore
@@
 # eval-env seed data — never commit exported PII-adjacent snapshots or test credentials
 backend/scripts/eval_seed/exports/
 backend/scripts/eval_seed/*_accounts.json
+
+# Phase B DeepEval — generated transcripts and scoring results, regenerate via the scripts
+backend/scripts/triage_deepeval/transcripts/
+backend/scripts/triage_deepeval/results/
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/triage_deepeval/tests/test_generate_transcripts.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/triage_deepeval/generate_transcripts.py backend/scripts/triage_deepeval/tests/test_generate_transcripts.py .env.example .gitignore
git commit -m "feat(system-eval): add Phase B transcript generator against eval /chat endpoints"
```

---

### Task 3: Faithfulness scoring pass (DeepEval)

**Files:**
- Create: `backend/scripts/triage_deepeval/run_faithfulness_eval.py`
- Test: `backend/scripts/triage_deepeval/tests/test_run_faithfulness_eval.py`
- Modify: `backend/requirements.txt` — add `deepeval`

**Interfaces:**
- Consumes: transcript rows from Task 2, shape `{"message": str, "response_text": str, "severity": str | None, "recommended_facility": dict | None}`.
- Produces: `build_retrieval_context(facility: dict) -> list[str]`, `score_transcript(transcript: dict, metric) -> dict | None` returning `{"message":, "score": float, "success": bool, "reason": str}` or `None` when there's no facility to judge against, `summarize_scores(results: list[dict]) -> dict` returning `{"count": int, "mean_score": float, "pass_rate": float}`.

**Design note:** `build_retrieval_context` reconstructs the facility as a plain factual statement — name, address, distance — deliberately **not** the full grounding-message text from `llm_agent.py._generate_grounded_response` (which also contains instructions like "use this exact name"). DeepEval's `FaithfulnessMetric` extracts "truths" from `retrieval_context` via its own LLM call; feeding it instructions instead of pure facts would pollute that extraction.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/triage_deepeval/tests/test_run_faithfulness_eval.py
import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.triage_deepeval.run_faithfulness_eval import (
    build_retrieval_context,
    score_transcript,
    summarize_scores,
)

FACILITY = {
    "id": "fac-001",
    "name": "Toronto General Hospital",
    "category": "hospital",
    "address": "200 Elizabeth St, Toronto",
    "lat": 43.6577,
    "lng": -79.3877,
    "distanceKm": 1.4,
}

TRANSCRIPT_WITH_FACILITY = {
    "message": "chest pain",
    "response_text": "Please go to Toronto General Hospital immediately.",
    "severity": "emergent",
    "recommended_facility": FACILITY,
}

TRANSCRIPT_WITHOUT_FACILITY = {
    "message": "not feeling well",
    "response_text": "Can you tell me more about your symptoms?",
    "severity": None,
    "recommended_facility": None,
}


class TestBuildRetrievalContext:
    def test_includes_name_address_and_distance(self):
        context = build_retrieval_context(FACILITY)
        assert len(context) == 1
        assert "Toronto General Hospital" in context[0]
        assert "200 Elizabeth St, Toronto" in context[0]
        assert "1.4" in context[0]


class TestScoreTranscript:
    def test_returns_none_when_no_facility(self):
        assert score_transcript(TRANSCRIPT_WITHOUT_FACILITY, metric=MagicMock()) is None

    def test_scores_transcript_with_facility(self):
        metric = MagicMock()
        metric.measure.return_value = None
        metric.score = 0.92
        metric.success = True
        metric.reason = "Response matches provided facility facts."

        result = score_transcript(TRANSCRIPT_WITH_FACILITY, metric=metric)

        assert result == {
            "message": "chest pain",
            "score": 0.92,
            "success": True,
            "reason": "Response matches provided facility facts.",
        }
        metric.measure.assert_called_once()


class TestSummarizeScores:
    def test_empty_results(self):
        assert summarize_scores([]) == {"count": 0, "mean_score": 0.0, "pass_rate": 0.0}

    def test_computes_mean_and_pass_rate(self):
        results = [
            {"message": "a", "score": 1.0, "success": True, "reason": ""},
            {"message": "b", "score": 0.5, "success": False, "reason": ""},
            {"message": "c", "score": 0.9, "success": True, "reason": ""},
        ]
        summary = summarize_scores(results)
        assert summary["count"] == 3
        assert round(summary["mean_score"], 4) == round((1.0 + 0.5 + 0.9) / 3, 4)
        assert round(summary["pass_rate"], 4) == round(2 / 3, 4)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/triage_deepeval/tests/test_run_faithfulness_eval.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.triage_deepeval.run_faithfulness_eval'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/triage_deepeval/run_faithfulness_eval.py
"""
Phase B, stage 2: offline DeepEval Faithfulness pass over transcripts written by
generate_transcripts.py. Complements case study 1's existing deterministic
groundedness check (exact facility-name match) with an LLM-judged check of
whether the *entire* response is faithful to the facility fact the model was
actually given — catching fabricated details (wrong hours, invented services,
wrong distance) that a name-only substring match would miss.

Scope: Faithfulness only. Premature-classification rate is explicitly out of
scope for this pass — see the plan's Global Constraints.

Invocation:
    doppler run --config eval -- python scripts/triage_deepeval/run_faithfulness_eval.py \
        --transcripts scripts/triage_deepeval/transcripts/transcripts_<stamp>.json
"""
import argparse
import glob
import json
import os
from datetime import datetime, timezone

from deepeval.metrics import FaithfulnessMetric
from deepeval.test_case import LLMTestCase

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
JUDGE_MODEL = "gpt-4o-mini"
FAITHFULNESS_THRESHOLD = 0.7


def build_retrieval_context(facility: dict) -> list[str]:
    return [
        f"Facility: {facility['name']}. "
        f"Address: {facility['address']}. "
        f"Distance: {facility['distanceKm']} km."
    ]


def score_transcript(transcript: dict, metric) -> dict | None:
    facility = transcript["recommended_facility"]
    if facility is None:
        return None

    test_case = LLMTestCase(
        input=transcript["message"],
        actual_output=transcript["response_text"],
        retrieval_context=build_retrieval_context(facility),
    )
    metric.measure(test_case)

    return {
        "message": transcript["message"],
        "score": metric.score,
        "success": metric.success,
        "reason": metric.reason,
    }


def summarize_scores(results: list[dict]) -> dict:
    if not results:
        return {"count": 0, "mean_score": 0.0, "pass_rate": 0.0}

    count = len(results)
    mean_score = sum(r["score"] for r in results) / count
    pass_rate = sum(1 for r in results if r["success"]) / count
    return {"count": count, "mean_score": mean_score, "pass_rate": pass_rate}


def latest_transcripts_path() -> str:
    transcripts_dir = os.path.join(os.path.dirname(__file__), "transcripts")
    candidates = sorted(glob.glob(os.path.join(transcripts_dir, "transcripts_*.json")))
    if not candidates:
        raise FileNotFoundError(f"No transcript files found in {transcripts_dir}")
    return candidates[-1]


def write_results(results: list[dict], summary: dict) -> str:
    os.makedirs(RESULTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(RESULTS_DIR, f"faithfulness_results_{stamp}.json")
    with open(path, "w") as f:
        json.dump({"summary": summary, "results": results}, f, indent=2)
    return path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--transcripts", default=None, help="Path to a transcripts JSON file (defaults to the most recent)")
    args = parser.parse_args()

    transcripts_path = args.transcripts or latest_transcripts_path()
    with open(transcripts_path) as f:
        transcripts = json.load(f)

    metric = FaithfulnessMetric(threshold=FAITHFULNESS_THRESHOLD, model=JUDGE_MODEL)
    results = []
    for transcript in transcripts:
        result = score_transcript(transcript, metric)
        if result is not None:
            results.append(result)

    summary = summarize_scores(results)
    path = write_results(results, summary)

    print(f"Scored {summary['count']} transcripts (facility-grounded turns only)")
    print(f"Mean faithfulness score: {summary['mean_score']:.3f}")
    print(f"Pass rate (threshold {FAITHFULNESS_THRESHOLD}): {summary['pass_rate']:.1%}")
    print(f"Full results written to {path}")


if __name__ == "__main__":
    main()
```

```diff
--- a/backend/requirements.txt
+++ b/backend/requirements.txt
@@
 groq>=0.13.0
 anthropic==0.40.*
+deepeval>=2.0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/triage_deepeval/tests/test_run_faithfulness_eval.py -v`
Expected: PASS (5 passed) — no live OpenAI call is made; the `FaithfulnessMetric` itself is mocked in every test.

Then install and confirm the import resolves for real:
Run: `source /home/niki/Documents/workenv/pydev/bin/activate && pip install -r backend/requirements.txt && python -c "from deepeval.metrics import FaithfulnessMetric; print('ok')"`
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/triage_deepeval/run_faithfulness_eval.py backend/scripts/triage_deepeval/tests/test_run_faithfulness_eval.py backend/requirements.txt
git commit -m "feat(system-eval): add offline DeepEval faithfulness scoring pass for case study 1"
```

---

### Task 4: Verify — small-batch smoke run against the eval environment

This mirrors Sprint 17's own process (CHANGELOG: "Verify — before trusting any data ... small-batch manual requests"). No new code — confirm the two scripts actually work end-to-end against real infrastructure before trusting a full-size run.

- [ ] **Step 1: Confirm eval test accounts exist**

Run: `doppler run --config eval -- python backend/scripts/eval_seed/create_eval_test_accounts.py --count 5` (skip if `backend/scripts/eval_seed/eval_test_accounts.json` already has accounts from Sprint 17's eval-env-seeding work)

- [ ] **Step 2: Run a 3-request smoke batch**

Run: `doppler run --config eval -- python backend/scripts/triage_deepeval/generate_transcripts.py --count 3 --base-url <eval-project preview Render URL>`
Expected: prints `3 transcripts written to backend/scripts/triage_deepeval/transcripts/transcripts_<stamp>.json`. Open the file — confirm each row has a non-empty `response_text` and a `recommended_facility` with a real facility name (not a placeholder).

- [ ] **Step 3: Run the faithfulness pass on that smoke batch**

Run: `doppler run --config eval -- python backend/scripts/triage_deepeval/run_faithfulness_eval.py`
Expected: prints a mean score between 0.0 and 1.0 and a pass rate, with no exceptions. Sanity-check: 3 requests against `gpt-4o-mini` is a handful of cents — confirm this before scaling up to a full run.

- [ ] **Step 4: Confirm OpenAI usage looks right**

Check the OpenAI dashboard usage page — 3 requests should show up as a small number of judge calls (one `FaithfulnessMetric.measure()` call typically issues 2-3 internal LLM calls: truth extraction, claim extraction, verdict). If the call count is wildly higher than expected, stop and investigate before running the full batch.

No commit for this task — it's a manual verification checkpoint, not a code change.

---

### Task 5: Full Phase B run + publish measured result

**Files:**
- Modify: `webapp/src/data/caseStudies.ts` — case study 1's `result` and `methodology` arrays (lines ~180-190)

- [ ] **Step 1: Run the full batch**

Run: `doppler run --config eval -- python backend/scripts/triage_deepeval/generate_transcripts.py --count 100 --base-url <eval-project preview Render URL>`

(100 requests matches the case study's existing methodology convention for the deterministic-check run, for a comparable sample size.)

- [ ] **Step 2: Score the full batch**

Run: `doppler run --config eval -- python backend/scripts/triage_deepeval/run_faithfulness_eval.py`

Record the printed `count`, `mean_score`, `pass_rate`, and today's date — these are the real numbers Step 3 needs. Do not fabricate a number here; read it from the actual script output.

- [ ] **Step 3: Human review**

Read a handful of the lowest-scoring transcripts in the results JSON (`reason` field explains each score) — confirm any low scores are genuine faithfulness issues and not a metric-configuration bug (e.g. a malformed `retrieval_context`). This is the "human review" gate the CHANGELOG's Sprint 17 process requires before any number is published.

- [ ] **Step 4: Update the case study copy**

Edit `webapp/src/data/caseStudies.ts` case study 1 (`slug: 'two-pass-tool-orchestration-symptom-triage'`):

Add to the `result` array (after the existing groundedness bullet):
```ts
{ text: 'DeepEval Faithfulness score of <MEAN_SCORE> (<PASS_RATE> pass rate at a 0.7 threshold) across <COUNT> facility-grounded responses, complementing the deterministic exact-match check above.', bold: ['<MEAN_SCORE>', '<PASS_RATE>', '<COUNT>'] },
```
(replace `<MEAN_SCORE>`, `<PASS_RATE>`, `<COUNT>` with the real values from Step 2's output)

Add to the `methodology` array (after the existing "Two simulated-load runs..." bullet, before the premature-classification bullet):
```ts
{ text: 'DeepEval FaithfulnessMetric (gpt-4o-mini judge) scored each facility-grounded response against a factual restatement of the facility fact injected pre-Pass-2 (name, address, distance) — catches fabricated details a name-only substring match would miss. Window: <DATE>, <COUNT> requests against the eval Supabase project.', bold: ['<COUNT>'] },
```
(replace `<DATE>` and `<COUNT>` with the real run date and count)

The existing premature-classification bullet (`"...scoped as a DeepEval question for Sprint 9's prompt-evaluation work."`) stays as-is — this plan deliberately does not touch it, per the Global Constraints scope boundary.

- [ ] **Step 5: Verify the frontend renders it**

Run: `cd webapp && npm run build` (or `tsc -b` per this repo's known `tsc --noEmit` false-negative) — confirm no type errors.
Then run the dev server and open `/for-engineers/two-pass-tool-orchestration-symptom-triage` — confirm the new bullets render under Result and Methodology.

- [ ] **Step 6: Commit**

```bash
git add webapp/src/data/caseStudies.ts
git commit -m "docs(case-studies): add DeepEval faithfulness result to case study 1"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1-2 build the transcript-generation harness (didn't exist as a committed script before this plan — the case study's existing "100-request" methodology note describes a run that was done ad hoc). Task 3 adds the actual DeepEval Faithfulness scoring. Task 4 is the CHANGELOG's required "Verify" gate before trusting data. Task 5 is "Run" + "Publish" from the same process. All map onto Sprint 17's documented 4-stage process (Instrumentation/Verify/Run/Publish) applied to this one metric.
- **Scope boundary respected:** no ground-truth labeling, no premature-classification metric, no changes to the existing deterministic `check_facility_groundedness` — this plan only adds a second, complementary check and leaves the Sprint 9 boundary alone, per the user's explicit scope choice.
- **No new dependencies beyond `deepeval`:** `requests` is already in `requirements.txt`; DeepEval brings its own `openai` client transitively for the judge call, no separate `openai` package pin needed in `requirements.txt`.
- **No scope creep:** did not add a staleness/regression baseline or CI gating — CHANGELOG's Sprint 17 entry explicitly deferred LLM-eval CI gating until a baseline exists; this plan's Task 5 output becomes that baseline for a future decision, not something this plan wires into CI itself.
- **Type consistency:** `build_transcript_row` (Task 2) produces `{"message", "response_text", "severity", "recommended_facility"}`; `score_transcript` (Task 3) consumes exactly those same four keys. `FaithfulnessMetric`'s `.score`/`.success`/`.reason` attributes (Task 3 test) match what DeepEval's `BaseMetric` actually exposes after `.measure()`.
- **Placeholder check:** Task 5's `<MEAN_SCORE>`/`<COUNT>`/`<DATE>` placeholders are intentional — they can only be filled with real numbers produced by running Task 5 Step 1-2 for real, not fabricated at planning time. Every other step has complete, runnable code.
