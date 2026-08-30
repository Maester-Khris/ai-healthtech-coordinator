# Symptom-Understanding Eval (4-Metric CTAS Harness) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the checklist-gated patient-simulator eval harness that unblocks the 4 symptom-understanding metrics (elicitation coverage, triage confusion matrix, information gain per turn, baseline ablation) identified in `artifacts/2026-08-03-symptom-understanding-eval-and-regression-plan.md` §1, against the 27 Ontario CTAS vignettes already committed at `backend/triage/resources/eval_vignettes_ontario_ctas.json`.

**Architecture:** Clean-Architecture-layered offline eval harness (full rationale: `docs/superpowers/specs/2026-08-03-symptom-understanding-eval-design.md`). Pure domain entities (`Vignette`, `VignetteTranscript`) at the center; use cases (`RunVignetteConversation`, `Score*`) depend only on Port ABCs; three concrete adapters (Anthropic patient-simulator, in-process `LLMAgent` system-under-test, OpenAI/DeepEval judges) are wired only in the composition-root CLI. In-process throughout — no HTTP, no eval Supabase accounts, no deployed server — because `LLMAgent.respond()` is already decoupled from its delivery mechanism (design §2).

**Tech Stack:** Python 3.11, `deepeval` (already a dependency), `openai` (new direct dependency — see Global Constraints), `anthropic`/`groq` (already dependencies, reused via existing `BaseLLMClient` implementations, zero new LLM client code).

## Global Constraints

- Type hints on all new function signatures (per `CLAUDE.md`).
- New direct dependency `openai>=1.0` in `backend/requirements.txt` — `deepeval` already installs it transitively (Sprint 17 precedent), but `checklist_extractor.py` imports it directly, which per `CLAUDE.md`'s dependency rule earns its own explicit pin.
- `OPENAI_API_KEY` must be present in Doppler's `eval` config before Task 12 runs for real — this is a config prerequisite (artifact §1.3/§3 blocker), not something this plan's code can satisfy. Task 12 Step 1 checks for it.
- **Dependency Rule (enforced by review, not tooling):** `domain.py` and every `Score*`/`Run*` use case file (`conversation_runner.py`, `confusion_matrix.py`, `elicitation_coverage.py`, `information_gain.py`, `ablation.py`) must never import `anthropic`, `openai`, `deepeval`, `requests`, `LLMAgent`, or a concrete `GraphContextProvider` — only the Port ABCs defined alongside them. Only `checklist_extractor.py`, `patient_simulator.py`, `system_under_test.py`, `graph_capture.py`, and `cli.py` may import those. No import-linter is added in this plan — that would be new tooling for a repo this size; catch violations in review (Broken Windows: don't let the first violation stand unrepaired).
- Never targets `main`, production Supabase, or production Neo4j — everything in this plan runs in-process against local/`GRAPH_RAG_PROVIDER`-switched providers only, reading/writing files under `backend/scripts/symptom_eval/`.
- Branch: continue on `feat/symptom-understanding-v2` — matches how the related `graphrag_eval` Track A/B work already landed on this same branch (git log: `9cb3938`, `6573d2d`), a deliberate consistency choice, not a new branch cut from `preview`.
- Commits always need explicit user approval (repo rule) — each task ends with a prepared `git commit`; wait for a go-ahead before running it.
- `backend/scripts/symptom_eval/checklists/*.json` are **git-tracked, human-reviewed artifacts** — do not gitignore them (Approach A from the earlier research: audit-friendly, versioned disclosure scripts). `transcripts/` and `results/` are gitignored, matching the existing `graphrag_eval`/`triage_deepeval` convention exactly.
- **Correction to the source artifact:** `artifacts/2026-08-03-symptom-understanding-eval-and-regression-plan.md` and the earlier research note both say "25 vignettes." Direct inspection of `eval_vignettes_ontario_ctas.json` shows **27 entries** (`case_id` includes `"10a"`, `"10b"`, `"10c"` as three sub-patients of case 10). This plan uses the real count; flag the "25" in those two files as a minor factual correction when next touched.

---

## File Structure

```
backend/
  requirements.txt                                  # MODIFY — add openai>=1.0
  .env.example                                       # MODIFY — OPENAI_API_KEY already added by Sprint 17's plan; no change needed if present
  scripts/
    symptom_eval/
      __init__.py                                    # CREATE — empty
      domain.py                                       # CREATE — Entities: Vignette, DisclosureItem, ConversationTurn, VignetteTranscript, SEVERITY_RANK
      graph_capture.py                                 # CREATE — CapturingGraphProvider decorator
      checklist_extractor.py                            # CREATE — ChecklistExtractorPort + OpenAIChecklistExtractor
      vignette_loader.py                                 # CREATE — raw JSON + checklist merge -> Vignette
      patient_simulator.py                                # CREATE — PatientSimulatorPort + AnthropicPatientSimulator
      system_under_test.py                                 # CREATE — SystemUnderTestPort + LiveLLMAgentAdapter + SystemTurnResult
      conversation_runner.py                                # CREATE — RunVignetteConversation use case
      confusion_matrix.py                                    # CREATE — ScoreTriageConfusionMatrix use case (Metric 2)
      elicitation_coverage.py                                 # CREATE — ScoreElicitationCoverage use case (Metric 1)
      information_gain.py                                      # CREATE — ScoreInformationGain use case (Metric 3)
      ablation.py                                               # CREATE — RunBaselineAblation use case (Metric 4)
      cli.py                                                      # CREATE — composition root ("Main")
      checklists/                                                 # CREATE (git-tracked) — authored per-vignette disclosure checklists
      transcripts/                                                # CREATE (gitignored) — raw run transcripts
      results/                                                     # CREATE (gitignored) — summarized metric results
      tests/
        __init__.py                                                # CREATE — empty
        test_domain.py                                              # CREATE
        test_graph_capture.py                                        # CREATE
        test_checklist_extractor.py                                   # CREATE
        test_vignette_loader.py                                        # CREATE
        test_patient_simulator.py                                      # CREATE
        test_system_under_test.py                                       # CREATE
        test_conversation_runner.py                                      # CREATE
        test_confusion_matrix.py                                          # CREATE
        test_elicitation_coverage.py                                       # CREATE
        test_information_gain.py                                            # CREATE
        test_ablation.py                                                     # CREATE
.gitignore                                                                    # MODIFY — ignore transcripts/ and results/, keep checklists/ tracked
```

---

### Task 1: Domain model

**Files:**
- Create: `backend/scripts/symptom_eval/__init__.py`
- Create: `backend/scripts/symptom_eval/domain.py`
- Test: `backend/scripts/symptom_eval/tests/__init__.py`
- Test: `backend/scripts/symptom_eval/tests/test_domain.py`

**Interfaces:**
- Produces: `DisclosureItem`, `Vignette`, `ConversationTurn`, `VignetteTranscript` (with `.text_up_to(turn_index: int | None) -> str` method), `SEVERITY_RANK: dict[str, int]` — consumed by every later task.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/symptom_eval/tests/test_domain.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.domain import (
    ConversationTurn, DisclosureItem, SEVERITY_RANK, Vignette, VignetteTranscript,
)


class TestDisclosureItem:
    def test_defaults_to_not_disclosed(self):
        item = DisclosureItem(
            feature_id="gcs_6", category="exam",
            first_person_phrasing="My eyes won't open and I can't talk.",
            reveal_only_if_asked=True,
        )
        assert item.disclosed is False


class TestSeverityRank:
    def test_monotonic_order(self):
        assert (
            SEVERITY_RANK["routine"]
            < SEVERITY_RANK["moderate"]
            < SEVERITY_RANK["urgent"]
            < SEVERITY_RANK["emergent"]
        )


class TestVignetteTranscript:
    def test_text_up_to_includes_only_requested_turns(self):
        turns = [
            ConversationTurn(0, "chest pain", "How long has this been going on?", False, [], []),
            ConversationTurn(1, "an hour", "Are you short of breath?", False, [], []),
        ]
        transcript = VignetteTranscript("1", turns, None, None)

        opening_only = transcript.text_up_to(0)
        assert "chest pain" in opening_only
        assert "an hour" not in opening_only

        full = transcript.text_up_to()
        assert "an hour" in full

    def test_vignette_holds_disclosure_items(self):
        vignette = Vignette(
            case_id="1",
            opening_message="I feel dizzy.",
            disclosure_items=[
                DisclosureItem("gcs_3", "exam", "I can't respond.", True),
            ],
            gold_severity="emergent",
            gold_ctas_level=1,
        )
        assert vignette.disclosure_items[0].feature_id == "gcs_3"
        assert vignette.update_message is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_domain.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.symptom_eval.domain'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/symptom_eval/__init__.py
```
(empty file)

```python
# backend/scripts/symptom_eval/domain.py
"""
Entities for the symptom-understanding eval harness (design §3). Pure
dataclasses — zero framework, zero vendor-SDK dependency. See
docs/superpowers/specs/2026-08-03-symptom-understanding-eval-design.md.
"""
from dataclasses import dataclass, field

SEVERITY_RANK: dict[str, int] = {"routine": 0, "moderate": 1, "urgent": 2, "emergent": 3}


@dataclass
class DisclosureItem:
    feature_id: str
    category: str  # "chief_complaint" | "history" | "vitals" | "exam"
    first_person_phrasing: str
    reveal_only_if_asked: bool
    disclosed: bool = False


@dataclass
class Vignette:
    case_id: str
    opening_message: str
    disclosure_items: list[DisclosureItem]
    gold_severity: str
    gold_ctas_level: int
    update_message: str | None = None
    updated_gold_severity: str | None = None
    source_pages: str = ""


@dataclass
class ConversationTurn:
    turn_index: int
    patient_message: str
    system_response: str
    graph_context_matched: bool
    surfaced_red_flag_indicators: list[str] = field(default_factory=list)
    surfaced_followup_questions: list[str] = field(default_factory=list)


@dataclass
class VignetteTranscript:
    vignette_case_id: str
    turns: list[ConversationTurn]
    final_severity: str | None
    final_reasoning: str | None

    def text_up_to(self, turn_index: int | None = None) -> str:
        turns = self.turns if turn_index is None else self.turns[: turn_index + 1]
        lines = []
        for turn in turns:
            lines.append(f"Patient: {turn.patient_message}")
            lines.append(f"Assistant: {turn.system_response}")
        return "\n".join(lines)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_domain.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/symptom_eval/__init__.py backend/scripts/symptom_eval/domain.py backend/scripts/symptom_eval/tests/__init__.py backend/scripts/symptom_eval/tests/test_domain.py
git commit -m "feat(symptom-eval): add domain entities for the 4-metric eval harness"
```

---

### Task 2: Graph-context capture decorator

**Files:**
- Create: `backend/scripts/symptom_eval/graph_capture.py`
- Test: `backend/scripts/symptom_eval/tests/test_graph_capture.py`

**Interfaces:**
- Consumes: `graph.base.GraphContext`, `graph.base.GraphContextProvider` (existing).
- Produces: `CapturingGraphProvider(wrapped: GraphContextProvider)` with `.last_context: GraphContext | None` — consumed by Task 6.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/symptom_eval/tests/test_graph_capture.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from graph.base import GraphContext, GraphContextProvider, RedFlagMatch
from scripts.symptom_eval.graph_capture import CapturingGraphProvider

MATCHED = GraphContext(
    matched=True, complaint_name="Chest pain (cardiac features)",
    red_flags=[RedFlagMatch("Shock", 1, "emergent", "Are you feeling faint?")],
)


class _StubProvider(GraphContextProvider):
    def __init__(self, context):
        self._context = context

    def _lookup(self, user_message, recent_messages):
        return self._context


class TestCapturingGraphProvider:
    def test_delegates_and_records_context(self):
        capturing = CapturingGraphProvider(_StubProvider(MATCHED))
        result = capturing.get_symptom_graph_context("chest pain", [])

        assert result == MATCHED
        assert capturing.last_context == MATCHED

    def test_starts_with_no_context(self):
        capturing = CapturingGraphProvider(_StubProvider(MATCHED))
        assert capturing.last_context is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_graph_capture.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.symptom_eval.graph_capture'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/symptom_eval/graph_capture.py
"""
Wraps any GraphContextProvider to record the GraphContext returned by each
call — promotes the _CapturingProvider idiom from
backend/tests/llm/test_graph_context_integration.py (test-only) into
reusable eval tooling. Lets RunVignetteConversation (design §6) observe
which red flags/follow-up questions a live provider actually surfaced per
turn, without modifying GraphContextProvider or LLMAgent. As a side effect,
this also closes backend/scripts/graphrag_eval/run_track_b_deepeval.py's
Blocker #2 (no way to capture surfaced_red_flags/surfaced_followup_questions)
— same component, two consumers, no duplication.
"""
from graph.base import GraphContext, GraphContextProvider


class CapturingGraphProvider(GraphContextProvider):
    def __init__(self, wrapped: GraphContextProvider):
        self._wrapped = wrapped
        self.last_context: GraphContext | None = None

    def _lookup(self, user_message: str, recent_messages: list[str]) -> GraphContext:
        context = self._wrapped.get_symptom_graph_context(user_message, recent_messages)
        self.last_context = context
        return context
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_graph_capture.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/symptom_eval/graph_capture.py backend/scripts/symptom_eval/tests/test_graph_capture.py
git commit -m "feat(symptom-eval): add GraphContext-capturing provider decorator"
```

---

### Task 3: Checklist extractor (port + OpenAI adapter)

**Files:**
- Create: `backend/scripts/symptom_eval/checklist_extractor.py`
- Test: `backend/scripts/symptom_eval/tests/test_checklist_extractor.py`
- Modify: `backend/requirements.txt` — add `openai>=1.0`

**Interfaces:**
- Produces: `ChecklistExtractorPort.extract(scenario_text: str, case_id: str) -> dict` returning `{"opening_message": str, "disclosure_items": list[dict], "update_message": str | None}` — consumed by Task 12's manual extraction run. Note the signature takes only `scenario_text` (never the raw vignette's `questions[].ctas_level`/`rationale`) — the gold answer is structurally unreachable from this function, not just conventionally withheld.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/symptom_eval/tests/test_checklist_extractor.py
import json
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.checklist_extractor import OpenAIChecklistExtractor

FAKE_COMPLETION = {
    "opening_message": "I feel dizzy and almost fainted.",
    "disclosure_items": [
        {
            "feature_id": "syncope",
            "category": "history",
            "first_person_phrasing": "I passed out for a few seconds.",
            "reveal_only_if_asked": True,
        }
    ],
    "update_message": None,
}


class TestOpenAIChecklistExtractor:
    @patch("scripts.symptom_eval.checklist_extractor.OpenAI")
    def test_extract_parses_json_response(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        mock_client.chat.completions.create.return_value.choices = [
            MagicMock(message=MagicMock(content=json.dumps(FAKE_COMPLETION)))
        ]

        extractor = OpenAIChecklistExtractor()
        result = extractor.extract("A 36 year old with syncope.", case_id="2")

        assert result == FAKE_COMPLETION
        call_kwargs = mock_client.chat.completions.create.call_args.kwargs
        assert "A 36 year old with syncope." in call_kwargs["messages"][0]["content"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_checklist_extractor.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.symptom_eval.checklist_extractor'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/symptom_eval/checklist_extractor.py
"""
One-time preprocessing: turns a raw third-person CTAS vignette
(backend/triage/resources/eval_vignettes_ontario_ctas.json) into a
first-person disclosure checklist, following the USMLE/NBME
standardized-patient authoring template (research artifact §1.4, source 9)
— a rubric of concepts disclosed only when asked, never the diagnosis or
CTAS level itself.

extract()'s signature deliberately accepts only scenario_text: str — the
gold CTAS level/rationale is structurally unreachable from this function,
not merely withheld by convention, so the checklist can never leak the
answer into the patient-simulator's own knowledge.

Invocation (Task 12 — run once, review the output, then commit checklists/):
    doppler run --config eval -- python -m scripts.symptom_eval.cli extract-checklists
"""
import json
from abc import ABC, abstractmethod

from openai import OpenAI

CHECKLIST_MODEL = "gpt-4o-mini"

EXTRACTION_PROMPT = """You are authoring a standardized-patient script for a clinical training simulator, following the USMLE Step 2 CS checklist convention: extract discrete clinical findings from the case below into a checklist a scripted patient actor will disclose ONE AT A TIME, ONLY when a question actually asks about it — never volunteered.

Case (third-person clinical narrative):
{scenario}

Return strict JSON:
{{
  "opening_message": "<first-person chief-complaint sentence a real patient/caller would say, containing ONLY the presenting complaint, no other detail>",
  "disclosure_items": [
    {{"feature_id": "<short_slug>", "category": "<chief_complaint|history|vitals|exam>", "first_person_phrasing": "<what the patient says when this is asked about>", "reveal_only_if_asked": true}}
  ],
  "update_message": null
}}

Do not include a CTAS level, triage category, or diagnosis anywhere in your output."""


class ChecklistExtractorPort(ABC):
    @abstractmethod
    def extract(self, scenario_text: str, case_id: str) -> dict:
        ...


class OpenAIChecklistExtractor(ChecklistExtractorPort):
    def __init__(self, model: str = CHECKLIST_MODEL):
        self._client = OpenAI()
        self._model = model

    def extract(self, scenario_text: str, case_id: str) -> dict:
        resp = self._client.chat.completions.create(
            model=self._model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "user", "content": EXTRACTION_PROMPT.format(scenario=scenario_text)}
            ],
        )
        return json.loads(resp.choices[0].message.content)
```

```diff
--- a/backend/requirements.txt
+++ b/backend/requirements.txt
@@
 groq>=0.13.0
 anthropic==0.40.*
 deepeval>=2.0
+openai>=1.0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_checklist_extractor.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/symptom_eval/checklist_extractor.py backend/scripts/symptom_eval/tests/test_checklist_extractor.py backend/requirements.txt
git commit -m "feat(symptom-eval): add OpenAI-backed disclosure-checklist extractor"
```

---

### Task 4: Vignette loader

**Files:**
- Create: `backend/scripts/symptom_eval/vignette_loader.py`
- Test: `backend/scripts/symptom_eval/tests/test_vignette_loader.py`

**Interfaces:**
- Consumes: `DisclosureItem`, `Vignette` (Task 1); `scripts.reconcile_ctas_data.CTAS_TO_APP_SEVERITY` (existing, Sprint 18's reviewed CTAS-5→app-4 mapping — reused, not re-derived).
- Produces: `load_raw_vignettes(path) -> list[dict]`, `load_checklist(case_id, checklists_dir) -> dict | None`, `build_vignette(raw: dict, checklist: dict) -> Vignette`, `load_all_vignettes(raw_path, checklists_dir) -> list[Vignette]`, and constant `CHECKLISTS_DIR: str` — consumed by Task 12/13's CLI run.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/symptom_eval/tests/test_vignette_loader.py
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.vignette_loader import build_vignette, load_all_vignettes

RAW_SINGLE_STAGE = {
    "case_id": "2",
    "scenario": "A 36 year old unresponsive female...",
    "patient_index": None,
    "questions": [{"prompt": "What is the Arrival CTAS Level?", "ctas_level": 1, "rationale": "..."}],
    "source": "Ontario MOHLTC Prehospital CTAS Paramedic Guide v2.0",
    "source_pages": "p.73, p.81",
}

RAW_TWO_STAGE = {
    "case_id": "4",
    "scenario": "...",
    "patient_index": None,
    "questions": [
        {"prompt": "What was this Patient's Arrival CTAS Level?", "ctas_level": 2, "rationale": "..."},
        {"prompt": "What is the Departure CTAS Level?", "ctas_level": 3, "rationale": "..."},
    ],
    "source": "Ontario MOHLTC Prehospital CTAS Paramedic Guide v2.0",
    "source_pages": "p.74",
}

CHECKLIST = {
    "opening_message": "I feel dizzy and almost fainted.",
    "disclosure_items": [
        {"feature_id": "syncope", "category": "history",
         "first_person_phrasing": "I passed out.", "reveal_only_if_asked": True}
    ],
    "update_message": None,
}


class TestBuildVignette:
    def test_single_stage_maps_ctas_to_app_severity(self):
        vignette = build_vignette(RAW_SINGLE_STAGE, CHECKLIST)
        assert vignette.case_id == "2"
        assert vignette.gold_severity == "emergent"  # CTAS 1 -> emergent
        assert vignette.gold_ctas_level == 1
        assert vignette.update_message is None
        assert vignette.disclosure_items[0].feature_id == "syncope"

    def test_two_stage_carries_departure_severity(self):
        vignette = build_vignette(RAW_TWO_STAGE, CHECKLIST)
        assert vignette.gold_severity == "emergent"      # CTAS 2 -> emergent
        assert vignette.updated_gold_severity == "urgent"  # CTAS 3 -> urgent


class TestLoadAllVignettes:
    def test_skips_vignettes_without_a_checklist(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw_path = os.path.join(tmp, "raw.json")
            checklists_dir = os.path.join(tmp, "checklists")
            os.makedirs(checklists_dir)

            with open(raw_path, "w") as f:
                json.dump([RAW_SINGLE_STAGE, RAW_TWO_STAGE], f)
            with open(os.path.join(checklists_dir, "2.json"), "w") as f:
                json.dump(CHECKLIST, f)
            # no checklist written for case_id "4" — must be skipped, not error

            vignettes = load_all_vignettes(raw_path=raw_path, checklists_dir=checklists_dir)

            assert len(vignettes) == 1
            assert vignettes[0].case_id == "2"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_vignette_loader.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.symptom_eval.vignette_loader'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/symptom_eval/vignette_loader.py
"""
Loads the raw Ontario CTAS vignette pool and merges each entry with its
authored disclosure checklist (backend/scripts/symptom_eval/checklists/),
producing Vignette domain objects. The raw JSON has no first-person text
and no per-feature checklist — checklists/<case_id>.json (authored via
checklist_extractor.py, Task 3) is where that gap gets closed.

A vignette with no checklist file yet is skipped, not an error — this lets
the harness run against a partially-authored pool during rollout instead of
failing until all 27 are done.
"""
import json
import os

from scripts.reconcile_ctas_data import CTAS_TO_APP_SEVERITY
from scripts.symptom_eval.domain import DisclosureItem, Vignette

RAW_VIGNETTES_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "triage", "resources",
    "eval_vignettes_ontario_ctas.json",
)
CHECKLISTS_DIR = os.path.join(os.path.dirname(__file__), "checklists")


def load_raw_vignettes(path: str = RAW_VIGNETTES_PATH) -> list[dict]:
    with open(path) as f:
        return json.load(f)


def load_checklist(case_id: str, checklists_dir: str = CHECKLISTS_DIR) -> dict | None:
    path = os.path.join(checklists_dir, f"{case_id}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def build_vignette(raw: dict, checklist: dict) -> Vignette:
    arrival = raw["questions"][0]
    departure = (
        raw["questions"][1]
        if len(raw["questions"]) > 1 and "Departure" in raw["questions"][1]["prompt"]
        or (len(raw["questions"]) > 1 and "departure" in raw["questions"][1]["prompt"].lower())
        else None
    )

    return Vignette(
        case_id=str(raw["case_id"]),
        opening_message=checklist["opening_message"],
        disclosure_items=[
            DisclosureItem(**item) for item in checklist["disclosure_items"]
        ],
        gold_severity=CTAS_TO_APP_SEVERITY[arrival["ctas_level"]],
        gold_ctas_level=arrival["ctas_level"],
        update_message=checklist.get("update_message"),
        updated_gold_severity=(
            CTAS_TO_APP_SEVERITY[departure["ctas_level"]] if departure else None
        ),
        source_pages=raw.get("source_pages", ""),
    )


def load_all_vignettes(
    raw_path: str = RAW_VIGNETTES_PATH, checklists_dir: str = CHECKLISTS_DIR
) -> list[Vignette]:
    vignettes = []
    for raw in load_raw_vignettes(raw_path):
        checklist = load_checklist(str(raw["case_id"]), checklists_dir)
        if checklist is None:
            continue
        vignettes.append(build_vignette(raw, checklist))
    return vignettes
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_vignette_loader.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/symptom_eval/vignette_loader.py backend/scripts/symptom_eval/tests/test_vignette_loader.py
git commit -m "feat(symptom-eval): add vignette loader merging raw CTAS data with authored checklists"
```

---

### Task 5: Patient simulator (port + Anthropic adapter)

**Files:**
- Create: `backend/scripts/symptom_eval/patient_simulator.py`
- Test: `backend/scripts/symptom_eval/tests/test_patient_simulator.py`

**Interfaces:**
- Consumes: `llm.base.BaseLLMClient`, `llm.base.LLMMessage` (existing); `llm.anthropic_client.AnthropicClient` (existing, reused as-is); `ConversationTurn`, `Vignette` (Task 1).
- Produces: `PatientSimulatorPort.reply(vignette, system_question, history) -> str` — consumed by Task 7.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/symptom_eval/tests/test_patient_simulator.py
import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from llm.base import LLMResponse
from scripts.symptom_eval.domain import ConversationTurn, DisclosureItem, Vignette
from scripts.symptom_eval.patient_simulator import AnthropicPatientSimulator

VIGNETTE = Vignette(
    case_id="2",
    opening_message="I feel dizzy and almost fainted.",
    disclosure_items=[
        DisclosureItem("syncope_duration", "history", "It lasted a few seconds.", True),
        DisclosureItem("no_chest_pain", "history", "No, I don't have chest pain.", True),
    ],
    gold_severity="emergent",
    gold_ctas_level=1,
)


class TestAnthropicPatientSimulator:
    def test_reply_returns_client_content(self):
        client = MagicMock()
        client.chat.return_value = LLMResponse(
            content="It lasted a few seconds.", tool_calls=None,
            finish_reason="stop", model="claude-haiku-4-5", usage={},
        )
        simulator = AnthropicPatientSimulator(client=client)

        reply = simulator.reply(VIGNETTE, "How long did the dizziness last?", history=[])

        assert reply == "It lasted a few seconds."

    def test_checklist_in_system_prompt_excludes_already_disclosed_items(self):
        client = MagicMock()
        client.chat.return_value = LLMResponse(
            content="ok", tool_calls=None, finish_reason="stop", model="x", usage={},
        )
        VIGNETTE.disclosure_items[0].disclosed = True
        simulator = AnthropicPatientSimulator(client=client)

        simulator.reply(VIGNETTE, "Anything else?", history=[])

        system_prompt = client.chat.call_args.kwargs["messages"][0].content
        assert "No, I don't have chest pain." in system_prompt
        assert "It lasted a few seconds." not in system_prompt
        VIGNETTE.disclosure_items[0].disclosed = False  # reset for other tests

    def test_history_and_question_included_as_conversation(self):
        client = MagicMock()
        client.chat.return_value = LLMResponse(
            content="ok", tool_calls=None, finish_reason="stop", model="x", usage={},
        )
        simulator = AnthropicPatientSimulator(client=client)
        history = [
            ConversationTurn(0, "I feel dizzy.", "How long has this been going on?", False, [], []),
        ]

        simulator.reply(VIGNETTE, "Any chest pain?", history=history)

        messages = client.chat.call_args.kwargs["messages"]
        contents = [m.content for m in messages]
        assert "How long has this been going on?" in contents
        assert "I feel dizzy." in contents
        assert "Any chest pain?" in contents
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_patient_simulator.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.symptom_eval.patient_simulator'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/symptom_eval/patient_simulator.py
"""
PatientSimulatorPort + AnthropicPatientSimulator — plays the vignette's
patient, discloses DisclosureItems only when a system question targets
them. Reuses AnthropicClient (backend/llm/anthropic_client.py) as-is — this
role only needs BaseLLMClient.chat(), no new LLM wrapper (design §5: Claude
is fixed for this role regardless of GRAPH_RAG_PROVIDER/LLM_PROVIDER, so the
simulator is never the same model instance as the system under test).
"""
from abc import ABC, abstractmethod

from llm.anthropic_client import AnthropicClient
from llm.base import BaseLLMClient, LLMMessage
from scripts.symptom_eval.domain import ConversationTurn, Vignette

SIMULATOR_SYSTEM_PROMPT = """You are role-playing a patient in a triage chat, following a strict script. You will ONLY disclose the facts listed below, and ONLY when the assistant's question actually asks about that fact. Never volunteer a fact that wasn't asked about. Never state a CTAS level, triage category, or diagnosis. Keep every reply to 1-2 short sentences, in first person, as a real patient would speak.

Facts you may disclose (only when asked):
{checklist_text}

If the assistant asks about something not in this list, say you're not sure or give a brief, plausible, non-committal answer consistent with the case — do not invent a new red-flag-worthy fact."""


class PatientSimulatorPort(ABC):
    @abstractmethod
    def reply(
        self, vignette: Vignette, system_question: str, history: list[ConversationTurn]
    ) -> str:
        ...


def _format_checklist(vignette: Vignette) -> str:
    return "\n".join(
        f"- ({item.category}) {item.first_person_phrasing}"
        for item in vignette.disclosure_items
        if not item.disclosed
    )


class AnthropicPatientSimulator(PatientSimulatorPort):
    def __init__(self, client: BaseLLMClient | None = None):
        self._client = client or AnthropicClient()

    def reply(
        self, vignette: Vignette, system_question: str, history: list[ConversationTurn]
    ) -> str:
        system_prompt = SIMULATOR_SYSTEM_PROMPT.format(
            checklist_text=_format_checklist(vignette)
        )
        messages = [LLMMessage(role="system", content=system_prompt)]
        for turn in history:
            messages.append(LLMMessage(role="user", content=turn.system_response))
            messages.append(LLMMessage(role="assistant", content=turn.patient_message))
        messages.append(LLMMessage(role="user", content=system_question))

        resp = self._client.chat(messages=messages, tools=None, temperature=0.3)
        return resp.content or "I'm not sure."
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_patient_simulator.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/symptom_eval/patient_simulator.py backend/scripts/symptom_eval/tests/test_patient_simulator.py
git commit -m "feat(symptom-eval): add Claude-backed checklist-gated patient simulator"
```

---

### Task 6: System-under-test adapter

**Files:**
- Create: `backend/scripts/symptom_eval/system_under_test.py`
- Test: `backend/scripts/symptom_eval/tests/test_system_under_test.py`

**Interfaces:**
- Consumes: `CapturingGraphProvider` (Task 2); `graph.factory.get_graph_provider`, `llm.groq_client.GroqClient`, `services.llm_agent.LLMAgent` (existing).
- Produces: `SystemTurnResult` dataclass, `SystemUnderTestPort.respond(patient_message, history) -> SystemTurnResult` — consumed by Task 7 and Task 11.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/symptom_eval/tests/test_system_under_test.py
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from graph.base import GraphContext, GraphContextProvider, RedFlagMatch
from scripts.symptom_eval.system_under_test import LiveLLMAgentAdapter


class _StubProvider(GraphContextProvider):
    def __init__(self, context):
        self._context = context

    def _lookup(self, user_message, recent_messages):
        return self._context


MATCHED = GraphContext(
    matched=True, complaint_name="Chest pain (cardiac features)",
    red_flags=[RedFlagMatch("Shock", 1, "emergent", "Are you feeling faint?")],
)


class TestLiveLLMAgentAdapter:
    @patch("scripts.symptom_eval.system_under_test.get_graph_provider")
    @patch("scripts.symptom_eval.system_under_test.LLMAgent")
    @patch("scripts.symptom_eval.system_under_test.GroqClient")
    def test_respond_captures_graph_context_and_result_fields(
        self, mock_groq_cls, mock_agent_cls, mock_get_provider
    ):
        mock_get_provider.return_value = _StubProvider(MATCHED)
        mock_agent = MagicMock()
        mock_agent.respond.return_value = {
            "response": "Please go to the ER.", "severity": "emergent",
            "reasoning": "chest pain with shock signs", "recommended_facility": None,
            "nearby_facilities": [], "turn_type": "triage",
        }
        mock_agent_cls.return_value = mock_agent

        adapter = LiveLLMAgentAdapter(graph_rag_provider="static")
        result = adapter.respond("I have chest pain", [])

        assert result.response_text == "Please go to the ER."
        assert result.severity == "emergent"
        assert result.graph_context_matched is True
        assert result.surfaced_red_flag_indicators == ["Shock"]
        assert result.surfaced_followup_questions == ["Are you feeling faint?"]
        assert os.environ["GRAPH_RAG_PROVIDER"] == "static"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_system_under_test.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.symptom_eval.system_under_test'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/symptom_eval/system_under_test.py
"""
SystemUnderTestPort + LiveLLMAgentAdapter — wraps the real LLMAgent
in-process (design §2: same business behavior as the HTTP path, no
server/auth/cache needed). Always constructs a GroqClient directly (not
get_llm_client(), which would respect an ambient LLM_PROVIDER override) so
the system-under-test model is fixed to Groq — the production default
(backend/services/llm_agent.py:20) — regardless of environment, per the
model-role assignment in design §5. Wraps the real GraphContextProvider in
CapturingGraphProvider (Task 2) so each call's GraphContext is observable.
"""
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from graph.factory import get_graph_provider
from llm.groq_client import GroqClient
from services.llm_agent import LLMAgent
from scripts.symptom_eval.graph_capture import CapturingGraphProvider


@dataclass
class SystemTurnResult:
    response_text: str
    severity: str | None
    reasoning: str | None
    graph_context_matched: bool
    surfaced_red_flag_indicators: list[str] = field(default_factory=list)
    surfaced_followup_questions: list[str] = field(default_factory=list)


class SystemUnderTestPort(ABC):
    @abstractmethod
    def respond(self, patient_message: str, history: list[dict]) -> SystemTurnResult:
        ...


class LiveLLMAgentAdapter(SystemUnderTestPort):
    def __init__(self, graph_rag_provider: str = "off"):
        os.environ["GRAPH_RAG_PROVIDER"] = graph_rag_provider
        self._capturing_provider = CapturingGraphProvider(get_graph_provider())
        self._agent = LLMAgent(client=GroqClient(), graph_provider=self._capturing_provider)

    def respond(self, patient_message: str, history: list[dict]) -> SystemTurnResult:
        result = self._agent.respond(patient_message, history)
        context = self._capturing_provider.last_context

        return SystemTurnResult(
            response_text=result["response"],
            severity=result["severity"],
            reasoning=result["reasoning"],
            graph_context_matched=bool(context and context.matched),
            surfaced_red_flag_indicators=(
                [rf.indicator for rf in context.red_flags] if context else []
            ),
            surfaced_followup_questions=(
                [rf.followup_question for rf in context.red_flags] if context else []
            ),
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_system_under_test.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/symptom_eval/system_under_test.py backend/scripts/symptom_eval/tests/test_system_under_test.py
git commit -m "feat(symptom-eval): add in-process LLMAgent adapter with graph-context capture"
```

---

### Task 7: Conversation runner (core multi-turn loop)

**Files:**
- Create: `backend/scripts/symptom_eval/conversation_runner.py`
- Test: `backend/scripts/symptom_eval/tests/test_conversation_runner.py`

**Interfaces:**
- Consumes: `PatientSimulatorPort` (Task 5), `SystemUnderTestPort`/`SystemTurnResult` (Task 6), `ConversationTurn`/`Vignette`/`VignetteTranscript` (Task 1).
- Produces: `run_vignette_conversation(vignette, simulator, system) -> VignetteTranscript`, constant `MAX_TURNS: int` — consumed by Task 11.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/symptom_eval/tests/test_conversation_runner.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.conversation_runner import run_vignette_conversation
from scripts.symptom_eval.domain import Vignette
from scripts.symptom_eval.system_under_test import SystemTurnResult

VIGNETTE = Vignette(
    case_id="2", opening_message="I feel dizzy.", disclosure_items=[],
    gold_severity="emergent", gold_ctas_level=1,
)


class _ScriptedSystem:
    def __init__(self, results: list[SystemTurnResult]):
        self._results = results
        self.calls: list[tuple[str, list[dict]]] = []

    def respond(self, patient_message, history):
        self.calls.append((patient_message, list(history)))
        return self._results[len(self.calls) - 1]


class _ScriptedSimulator:
    def __init__(self, replies: list[str]):
        self._replies = replies
        self.calls = 0

    def reply(self, vignette, system_question, history):
        reply = self._replies[self.calls]
        self.calls += 1
        return reply


class TestRunVignetteConversation:
    def test_stops_at_first_triage_result(self):
        system = _ScriptedSystem([
            SystemTurnResult("How long?", None, None, False),
            SystemTurnResult("Go to the ER.", "emergent", "reasoning", False),
        ])
        simulator = _ScriptedSimulator(["An hour."])

        transcript = run_vignette_conversation(VIGNETTE, simulator, system)

        assert transcript.final_severity == "emergent"
        assert len(transcript.turns) == 2
        assert transcript.turns[0].patient_message == "I feel dizzy."
        assert transcript.turns[1].patient_message == "An hour."
        assert simulator.calls == 1  # only asked for a reply once, before the triage turn

    def test_history_accumulates_across_turns(self):
        system = _ScriptedSystem([
            SystemTurnResult("How long?", None, None, False),
            SystemTurnResult("Go to the ER.", "emergent", "reasoning", False),
        ])
        simulator = _ScriptedSimulator(["An hour."])

        run_vignette_conversation(VIGNETTE, simulator, system)

        second_call_history = system.calls[1][1]
        assert second_call_history == [
            {"role": "user", "content": "I feel dizzy."},
            {"role": "assistant", "content": "How long?"},
        ]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_conversation_runner.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.symptom_eval.conversation_runner'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/symptom_eval/conversation_runner.py
"""
RunVignetteConversation — the core multi-turn loop. Turn 0 sends the
vignette's static opening_message (deterministic, no LLM — design §7).
Turns 1..N are patient-simulator replies to the system's question,
checklist-gated so information surfaces only when asked. Stops when the
system fires a triage classification (severity is not None) or MAX_TURNS
is hit — a safety bound distinct from LLMAgent's own internal followup
ceiling (TRIAGE_MAX_FOLLOWUPS), which this harness doesn't reimplement.
"""
from scripts.symptom_eval.domain import ConversationTurn, Vignette, VignetteTranscript
from scripts.symptom_eval.patient_simulator import PatientSimulatorPort
from scripts.symptom_eval.system_under_test import SystemUnderTestPort

MAX_TURNS = 8


def run_vignette_conversation(
    vignette: Vignette,
    simulator: PatientSimulatorPort,
    system: SystemUnderTestPort,
) -> VignetteTranscript:
    history: list[dict] = []
    turns: list[ConversationTurn] = []
    patient_message = vignette.opening_message

    for turn_index in range(MAX_TURNS):
        result = system.respond(patient_message, history)
        turns.append(
            ConversationTurn(
                turn_index=turn_index,
                patient_message=patient_message,
                system_response=result.response_text,
                graph_context_matched=result.graph_context_matched,
                surfaced_red_flag_indicators=result.surfaced_red_flag_indicators,
                surfaced_followup_questions=result.surfaced_followup_questions,
            )
        )
        history.append({"role": "user", "content": patient_message})
        history.append({"role": "assistant", "content": result.response_text})

        if result.severity is not None:
            return VignetteTranscript(
                vignette_case_id=vignette.case_id, turns=turns,
                final_severity=result.severity, final_reasoning=result.reasoning,
            )

        patient_message = simulator.reply(vignette, result.response_text, turns)

    return VignetteTranscript(
        vignette_case_id=vignette.case_id, turns=turns,
        final_severity=None, final_reasoning=None,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_conversation_runner.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/symptom_eval/conversation_runner.py backend/scripts/symptom_eval/tests/test_conversation_runner.py
git commit -m "feat(symptom-eval): add multi-turn conversation runner use case"
```

---

### Task 8: Triage confusion matrix scorer (Metric 2 — tracer bullet complete)

This is the first fully working end-to-end metric: no LLM judge, pure comparison against the already-reviewed CTAS-to-app-severity mapping. Once Tasks 1-8 are done and at least one checklist exists (Task 12), Metric 2 can run for real.

**Files:**
- Create: `backend/scripts/symptom_eval/confusion_matrix.py`
- Test: `backend/scripts/symptom_eval/tests/test_confusion_matrix.py`

**Interfaces:**
- Consumes: `SEVERITY_RANK`, `Vignette`, `VignetteTranscript` (Task 1).
- Produces: `ConfusionMatrixRow`, `score_vignette(vignette, transcript) -> ConfusionMatrixRow`, `summarize(rows: list[ConfusionMatrixRow]) -> dict` — consumed by Task 11.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/symptom_eval/tests/test_confusion_matrix.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.confusion_matrix import ConfusionMatrixRow, score_vignette, summarize
from scripts.symptom_eval.domain import Vignette, VignetteTranscript

VIGNETTE = Vignette(
    case_id="2", opening_message="dizzy", disclosure_items=[],
    gold_severity="emergent", gold_ctas_level=1,
)


class TestScoreVignette:
    def test_correct_classification(self):
        transcript = VignetteTranscript("2", [], "emergent", "reasoning")
        row = score_vignette(VIGNETTE, transcript)
        assert row == ConfusionMatrixRow("2", "emergent", "emergent", True, False)

    def test_under_triage_detected(self):
        transcript = VignetteTranscript("2", [], "routine", "reasoning")
        row = score_vignette(VIGNETTE, transcript)
        assert row.correct is False
        assert row.under_triaged is True

    def test_never_classified_is_not_under_triage(self):
        transcript = VignetteTranscript("2", [], None, None)
        row = score_vignette(VIGNETTE, transcript)
        assert row.predicted is None
        assert row.correct is False
        assert row.under_triaged is False


class TestSummarize:
    def test_empty(self):
        assert summarize([]) == {"count": 0, "accuracy": 0.0, "under_triage_rate": 0.0}

    def test_computes_rates(self):
        rows = [
            ConfusionMatrixRow("1", "emergent", "emergent", True, False),
            ConfusionMatrixRow("2", "routine", "emergent", False, True),
        ]
        summary = summarize(rows)
        assert summary == {"count": 2, "accuracy": 0.5, "under_triage_rate": 0.5}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_confusion_matrix.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.symptom_eval.confusion_matrix'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/symptom_eval/confusion_matrix.py
"""
ScoreTriageConfusionMatrix — deterministic, no LLM judge (Metric 2). Compares
the system's final severity call against the vignette's gold answer using
the CTAS-5 to app-4 severity mapping already established and reviewed in
Sprint 18 (backend/scripts/reconcile_ctas_data.py::CTAS_TO_APP_SEVERITY,
reused via Task 4's vignette_loader — not re-derived here).
"""
from dataclasses import dataclass

from scripts.symptom_eval.domain import SEVERITY_RANK, Vignette, VignetteTranscript


@dataclass
class ConfusionMatrixRow:
    case_id: str
    predicted: str | None
    gold: str
    correct: bool
    under_triaged: bool


def score_vignette(vignette: Vignette, transcript: VignetteTranscript) -> ConfusionMatrixRow:
    predicted = transcript.final_severity
    gold = vignette.gold_severity
    under_triaged = predicted is not None and SEVERITY_RANK[predicted] < SEVERITY_RANK[gold]

    return ConfusionMatrixRow(
        case_id=vignette.case_id,
        predicted=predicted,
        gold=gold,
        correct=predicted == gold,
        under_triaged=under_triaged,
    )


def summarize(rows: list[ConfusionMatrixRow]) -> dict:
    count = len(rows)
    if count == 0:
        return {"count": 0, "accuracy": 0.0, "under_triage_rate": 0.0}

    correct = sum(1 for r in rows if r.correct)
    under = sum(1 for r in rows if r.under_triaged)
    return {"count": count, "accuracy": correct / count, "under_triage_rate": under / count}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_confusion_matrix.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/symptom_eval/confusion_matrix.py backend/scripts/symptom_eval/tests/test_confusion_matrix.py
git commit -m "feat(symptom-eval): add deterministic triage confusion-matrix scorer (Metric 2)"
```

---

### Task 9: Elicitation coverage scorer (Metric 1)

**Files:**
- Create: `backend/scripts/symptom_eval/elicitation_coverage.py`
- Test: `backend/scripts/symptom_eval/tests/test_elicitation_coverage.py`

**Interfaces:**
- Consumes: `DisclosureItem`, `Vignette`, `VignetteTranscript` (Task 1, using `.text_up_to()`).
- Produces: `FeaturePresenceJudgePort.was_surfaced(feature, transcript_text) -> bool`, `ElicitationCoverageResult`, `score_vignette(vignette, transcript, judge) -> ElicitationCoverageResult` — consumed by Task 11.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/symptom_eval/tests/test_elicitation_coverage.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.domain import ConversationTurn, DisclosureItem, Vignette, VignetteTranscript
from scripts.symptom_eval.elicitation_coverage import score_vignette

VIGNETTE = Vignette(
    case_id="2", opening_message="I feel dizzy.",
    disclosure_items=[
        DisclosureItem("volunteered_fact", "chief_complaint", "I feel dizzy.", False),
        DisclosureItem("elicited_fact", "history", "It lasted a few seconds.", True),
        DisclosureItem("never_surfaced_fact", "exam", "My skin is pale.", True),
    ],
    gold_severity="emergent", gold_ctas_level=1,
)

TRANSCRIPT = VignetteTranscript(
    "2",
    [
        ConversationTurn(0, "I feel dizzy.", "How long did it last?", False, [], []),
        ConversationTurn(1, "It lasted a few seconds.", "Go to the ER.", False, [], []),
    ],
    "emergent", "reasoning",
)


class _ScriptedJudge:
    """Returns True for exactly the features present verbatim in the given text."""

    def was_surfaced(self, feature, transcript_text):
        return feature.first_person_phrasing in transcript_text


class TestScoreVignette:
    def test_classifies_volunteered_elicited_and_absent(self):
        result = score_vignette(VIGNETTE, TRANSCRIPT, _ScriptedJudge())

        assert result.total_features == 3
        assert result.surfaced_count == 2      # volunteered + elicited, not the absent one
        assert result.elicited_count == 1       # only the one absent from turn 0's text
        assert result.coverage == 1 / 3
        assert result.fraction == 1 / 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_elicitation_coverage.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.symptom_eval.elicitation_coverage'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/symptom_eval/elicitation_coverage.py
"""
ScoreElicitationCoverage (Metric 1) — for each DisclosureItem, asks a judge
whether it appears anywhere in the full transcript, then whether it already
appeared in turn 0 alone (the opening message) to tell volunteered from
elicited. Direct implementation of Paper 1's method (Madda & Kondru 2025,
research artifact §1.4 source 1): elicitation coverage = |elicited| /
|total features|, elicitation fraction = |elicited| / |surfaced|.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass

from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

from scripts.symptom_eval.domain import DisclosureItem, Vignette, VignetteTranscript

JUDGE_MODEL = "gpt-4o-mini"


class FeaturePresenceJudgePort(ABC):
    @abstractmethod
    def was_surfaced(self, feature: DisclosureItem, transcript_text: str) -> bool:
        ...


class DeepEvalFeaturePresenceJudge(FeaturePresenceJudgePort):
    def __init__(self, model: str = JUDGE_MODEL):
        self._metric = GEval(
            name="FeaturePresence",
            criteria=(
                "Determine whether the clinical fact described in `input` was "
                "conveyed anywhere in the `actual_output` conversation "
                "transcript, in the patient's own words or clearly implied by "
                "an assistant question being answered. Score 1 if present, 0 "
                "if absent."
            ),
            evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
            threshold=0.5,
            model=model,
        )

    def was_surfaced(self, feature: DisclosureItem, transcript_text: str) -> bool:
        test_case = LLMTestCase(
            input=feature.first_person_phrasing, actual_output=transcript_text
        )
        self._metric.measure(test_case)
        return self._metric.success


@dataclass
class ElicitationCoverageResult:
    case_id: str
    total_features: int
    surfaced_count: int
    elicited_count: int
    coverage: float
    fraction: float


def score_vignette(
    vignette: Vignette, transcript: VignetteTranscript, judge: FeaturePresenceJudgePort
) -> ElicitationCoverageResult:
    opening_text = transcript.text_up_to(0)
    full_text = transcript.text_up_to()

    surfaced_count = 0
    elicited_count = 0
    for feature in vignette.disclosure_items:
        if not judge.was_surfaced(feature, full_text):
            continue
        surfaced_count += 1
        if not judge.was_surfaced(feature, opening_text):
            elicited_count += 1

    total = len(vignette.disclosure_items)
    return ElicitationCoverageResult(
        case_id=vignette.case_id,
        total_features=total,
        surfaced_count=surfaced_count,
        elicited_count=elicited_count,
        coverage=(elicited_count / total) if total else 0.0,
        fraction=(elicited_count / surfaced_count) if surfaced_count else 0.0,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_elicitation_coverage.py -v`
Expected: PASS (1 passed) — no live DeepEval/OpenAI call is made; `_ScriptedJudge` replaces `DeepEvalFeaturePresenceJudge` entirely in this test.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/symptom_eval/elicitation_coverage.py backend/scripts/symptom_eval/tests/test_elicitation_coverage.py
git commit -m "feat(symptom-eval): add elicitation coverage/fraction scorer (Metric 1)"
```

---

### Task 10: Information gain scorer (Metric 3)

**Files:**
- Create: `backend/scripts/symptom_eval/information_gain.py`
- Test: `backend/scripts/symptom_eval/tests/test_information_gain.py`

**Interfaces:**
- Consumes: `VignetteTranscript` (Task 1, `.text_up_to()`).
- Produces: `RubricJudgePort.score_candidates(transcript_text) -> dict[str, float]`, `InformationGainResult`, `score_vignette(transcript, judge) -> InformationGainResult`, constant `SEVERITY_TIERS: list[str]` — consumed by Task 11.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/symptom_eval/tests/test_information_gain.py
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.domain import ConversationTurn, VignetteTranscript
from scripts.symptom_eval.information_gain import score_vignette

TRANSCRIPT = VignetteTranscript(
    "2",
    [
        ConversationTurn(0, "I feel dizzy.", "Tell me more.", False, [], []),
        ConversationTurn(1, "I also have chest pain.", "Go to the ER.", False, [], []),
    ],
    "emergent", "reasoning",
)


class _ScriptedRubricJudge:
    """Turn 0: near-uniform (high entropy). Turn 1: confidently emergent (low entropy)."""

    def __init__(self):
        self.call_count = 0

    def score_candidates(self, transcript_text):
        self.call_count += 1
        if self.call_count == 1:
            return {"routine": 0.5, "moderate": 0.5, "urgent": 0.5, "emergent": 0.5}
        return {"routine": 0.0, "moderate": 0.0, "urgent": 0.1, "emergent": 0.9}


class TestScoreVignette:
    def test_entropy_decreases_as_evidence_accumulates(self):
        judge = _ScriptedRubricJudge()
        result = score_vignette(TRANSCRIPT, judge)

        assert len(result.entropy_per_turn) == 2
        assert result.entropy_per_turn[0] > result.entropy_per_turn[1]
        assert len(result.gains) == 1
        assert result.gains[0] == result.entropy_per_turn[0] - result.entropy_per_turn[1]
        assert result.gains[0] > 0  # positive information gain

    def test_uniform_distribution_has_max_entropy(self):
        judge = _ScriptedRubricJudge()
        result = score_vignette(TRANSCRIPT, judge)
        expected_max_entropy = math.log(4)  # ln(4 candidates), uniform
        assert round(result.entropy_per_turn[0], 4) == round(expected_max_entropy, 4)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_information_gain.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.symptom_eval.information_gain'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/symptom_eval/information_gain.py
"""
ScoreInformationGain (Metric 3) — entropy reduction turn-over-turn over
MediCoord's 4 severity tiers as the candidate set. A disclosed adaptation of
IOR-Bench's candidate-department distribution (research artifact §1.4,
source 2) to this product's own triage-tier domain: MediCoord triages to a
facility tier, not a hospital department, but the entropy mechanics are
identical. Secondary/diagnostic signal only — IOR-Bench's own finding is
that entropy reduction doesn't reliably track final accuracy, so this never
gates a pass/fail on its own (design §6).
"""
import math
from abc import ABC, abstractmethod
from dataclasses import dataclass

from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

from scripts.symptom_eval.domain import VignetteTranscript

SEVERITY_TIERS = ["routine", "moderate", "urgent", "emergent"]
JUDGE_MODEL = "gpt-4o-mini"


class RubricJudgePort(ABC):
    @abstractmethod
    def score_candidates(self, transcript_text: str) -> dict[str, float]:
        """Raw (pre-softmax) support score per severity tier, 0-1 each."""
        ...


class DeepEvalRubricJudge(RubricJudgePort):
    """One GEval instance per candidate tier — collapses IOR-Bench's
    7-dimension rubric (complaint match, symptom consistency, red-flag
    relevance, background fit, supporting evidence, management fit,
    contradictory evidence) into a single 0-1 support score per tier."""

    def __init__(self, model: str = JUDGE_MODEL):
        self._metrics = {
            tier: GEval(
                name=f"SeveritySupport_{tier}",
                criteria=(
                    f"Rate 0-1 how strongly the transcript's symptoms, "
                    f"history, and red flags support classifying this "
                    f"patient's severity as '{tier}' on a "
                    f"routine/moderate/urgent/emergent triage scale — "
                    f"considering complaint match, symptom consistency, "
                    f"red-flag relevance, and contradictory evidence."
                ),
                evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT],
                threshold=0.0,
                model=model,
            )
            for tier in SEVERITY_TIERS
        }

    def score_candidates(self, transcript_text: str) -> dict[str, float]:
        scores = {}
        for tier, metric in self._metrics.items():
            test_case = LLMTestCase(input="", actual_output=transcript_text)
            metric.measure(test_case)
            scores[tier] = metric.score
        return scores


def _softmax(scores: dict[str, float]) -> dict[str, float]:
    values = list(scores.values())
    max_v = max(values)
    exps = {k: math.exp(v - max_v) for k, v in scores.items()}
    total = sum(exps.values())
    return {k: v / total for k, v in exps.items()}


def _entropy(distribution: dict[str, float]) -> float:
    return -sum(p * math.log(p) for p in distribution.values() if p > 0)


@dataclass
class InformationGainResult:
    case_id: str
    entropy_per_turn: list[float]
    gains: list[float]


def score_vignette(
    transcript: VignetteTranscript, judge: RubricJudgePort
) -> InformationGainResult:
    entropies = []
    for turn in transcript.turns:
        text = transcript.text_up_to(turn.turn_index)
        distribution = _softmax(judge.score_candidates(text))
        entropies.append(_entropy(distribution))

    gains = [entropies[i - 1] - entropies[i] for i in range(1, len(entropies))]
    return InformationGainResult(
        case_id=transcript.vignette_case_id, entropy_per_turn=entropies, gains=gains
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_information_gain.py -v`
Expected: PASS (2 passed) — no live DeepEval/OpenAI call; `_ScriptedRubricJudge` replaces `DeepEvalRubricJudge` entirely.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/symptom_eval/information_gain.py backend/scripts/symptom_eval/tests/test_information_gain.py
git commit -m "feat(symptom-eval): add information-gain-per-turn scorer (Metric 3)"
```

---

### Task 11: Baseline ablation orchestrator + CLI composition root (Metric 4)

**Files:**
- Create: `backend/scripts/symptom_eval/ablation.py`
- Create: `backend/scripts/symptom_eval/cli.py`
- Test: `backend/scripts/symptom_eval/tests/test_ablation.py`
- Modify: `.gitignore` — ignore `transcripts/`/`results/`, keep `checklists/` tracked

**Interfaces:**
- Consumes: everything from Tasks 1-10.
- Produces: `AblationLegResult`, `run_leg(provider, vignettes, system_factory, simulator, feature_judge, rubric_judge) -> AblationLegResult`, `run_ablation(vignettes, system_factory, simulator, feature_judge, rubric_judge, providers) -> list[AblationLegResult]` — consumed by `cli.py`.

**Design note:** `run_leg`/`run_ablation` take `system_factory: Callable[[str], SystemUnderTestPort]` rather than constructing `LiveLLMAgentAdapter` internally — per the Dependency Rule (Global Constraints), a use case never instantiates a concrete adapter itself; only `cli.py` (Main) does, passing the factory in. This is also what makes `test_ablation.py` possible without any live LLM/API dependency.

- [ ] **Step 1: Write the failing test**

```python
# backend/scripts/symptom_eval/tests/test_ablation.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.ablation import run_ablation
from scripts.symptom_eval.domain import Vignette
from scripts.symptom_eval.system_under_test import SystemTurnResult

VIGNETTES = [
    Vignette("1", "dizzy", [], "emergent", 1),
    Vignette("2", "sore throat", [], "routine", 5),
]


class _FakeSystem:
    def __init__(self, severity):
        self._severity = severity

    def respond(self, patient_message, history):
        return SystemTurnResult("classified", self._severity, "why", False)


class _FakeSimulator:
    def reply(self, vignette, system_question, history):
        return "more info"


class _FakeFeatureJudge:
    def was_surfaced(self, feature, transcript_text):
        return False


class _FakeRubricJudge:
    def score_candidates(self, transcript_text):
        return {"routine": 0.25, "moderate": 0.25, "urgent": 0.25, "emergent": 0.25}


class TestRunAblation:
    def test_runs_one_leg_per_provider(self):
        legs = run_ablation(
            vignettes=VIGNETTES,
            system_factory=lambda provider: _FakeSystem(severity="emergent"),
            simulator=_FakeSimulator(),
            feature_judge=_FakeFeatureJudge(),
            rubric_judge=_FakeRubricJudge(),
            providers=("off", "neo4j"),
        )

        assert [leg.provider for leg in legs] == ["off", "neo4j"]
        for leg in legs:
            assert leg.confusion_matrix["count"] == 2
            assert len(leg.elicitation_coverage) == 2
            assert len(leg.information_gain) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_ablation.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.symptom_eval.ablation'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/scripts/symptom_eval/ablation.py
"""
RunBaselineAblation (Metric 4) — runs the full vignette pool through the
conversation loop once per GRAPH_RAG_PROVIDER leg, diffing Metrics 1-3
between legs. No new scoring logic — Metrics 1-3 called once per leg
(backend/graph/factory.py:12 defines the provider values), per design §6.

Takes system_factory rather than constructing LiveLLMAgentAdapter directly —
per this plan's Dependency Rule, only cli.py (Main) may reference that
concrete adapter; this file only sees SystemUnderTestPort.
"""
from dataclasses import dataclass
from typing import Callable

from scripts.symptom_eval import confusion_matrix, elicitation_coverage, information_gain
from scripts.symptom_eval.conversation_runner import run_vignette_conversation
from scripts.symptom_eval.domain import Vignette
from scripts.symptom_eval.elicitation_coverage import FeaturePresenceJudgePort
from scripts.symptom_eval.information_gain import RubricJudgePort
from scripts.symptom_eval.patient_simulator import PatientSimulatorPort
from scripts.symptom_eval.system_under_test import SystemUnderTestPort


@dataclass
class AblationLegResult:
    provider: str
    confusion_matrix: dict
    elicitation_coverage: list
    information_gain: list


def run_leg(
    provider: str,
    vignettes: list[Vignette],
    system_factory: Callable[[str], SystemUnderTestPort],
    simulator: PatientSimulatorPort,
    feature_judge: FeaturePresenceJudgePort,
    rubric_judge: RubricJudgePort,
) -> AblationLegResult:
    system = system_factory(provider)
    confusion_rows = []
    coverage_results = []
    gain_results = []

    for vignette in vignettes:
        transcript = run_vignette_conversation(vignette, simulator, system)
        confusion_rows.append(confusion_matrix.score_vignette(vignette, transcript))
        coverage_results.append(
            elicitation_coverage.score_vignette(vignette, transcript, feature_judge)
        )
        gain_results.append(information_gain.score_vignette(transcript, rubric_judge))

    return AblationLegResult(
        provider=provider,
        confusion_matrix=confusion_matrix.summarize(confusion_rows),
        elicitation_coverage=coverage_results,
        information_gain=gain_results,
    )


def run_ablation(
    vignettes: list[Vignette],
    system_factory: Callable[[str], SystemUnderTestPort],
    simulator: PatientSimulatorPort,
    feature_judge: FeaturePresenceJudgePort,
    rubric_judge: RubricJudgePort,
    providers: tuple[str, ...] = ("off", "neo4j"),
) -> list[AblationLegResult]:
    return [
        run_leg(provider, vignettes, system_factory, simulator, feature_judge, rubric_judge)
        for provider in providers
    ]
```

```python
# backend/scripts/symptom_eval/cli.py
"""
Composition root ("Main" per Clean Architecture §6) — the only file in this
package allowed to import every concrete adapter and wire them together. No
use case or Entity file imports anthropic/openai/deepeval/LLMAgent directly
(Global Constraints' Dependency Rule); this file is where those concrete
choices are made.

Invocation:
    doppler run --config eval -- python -m scripts.symptom_eval.cli extract-checklists
    doppler run --config eval -- python -m scripts.symptom_eval.cli run-ablation --limit 3
"""
import argparse
import json
import os
from dataclasses import asdict
from datetime import datetime, timezone

from scripts.symptom_eval.ablation import run_ablation
from scripts.symptom_eval.checklist_extractor import OpenAIChecklistExtractor
from scripts.symptom_eval.elicitation_coverage import DeepEvalFeaturePresenceJudge
from scripts.symptom_eval.information_gain import DeepEvalRubricJudge
from scripts.symptom_eval.patient_simulator import AnthropicPatientSimulator
from scripts.symptom_eval.system_under_test import LiveLLMAgentAdapter
from scripts.symptom_eval.vignette_loader import CHECKLISTS_DIR, load_all_vignettes, load_raw_vignettes

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")


def extract_checklists() -> None:
    extractor = OpenAIChecklistExtractor()
    os.makedirs(CHECKLISTS_DIR, exist_ok=True)
    for raw in load_raw_vignettes():
        case_id = str(raw["case_id"])
        path = os.path.join(CHECKLISTS_DIR, f"{case_id}.json")
        if os.path.exists(path):
            continue  # never silently overwrite a human-reviewed checklist
        checklist = extractor.extract(raw["scenario"], case_id)
        with open(path, "w") as f:
            json.dump(checklist, f, indent=2)
        print(f"wrote {path} — review before committing")


def run_ablation_command(limit: int | None) -> None:
    vignettes = load_all_vignettes()
    if limit:
        vignettes = vignettes[:limit]
    if not vignettes:
        raise SystemExit(
            "No vignettes with authored checklists found — run "
            "'extract-checklists' first, review the output, then re-run."
        )

    legs = run_ablation(
        vignettes=vignettes,
        system_factory=lambda provider: LiveLLMAgentAdapter(graph_rag_provider=provider),
        simulator=AnthropicPatientSimulator(),
        feature_judge=DeepEvalFeaturePresenceJudge(),
        rubric_judge=DeepEvalRubricJudge(),
    )

    os.makedirs(RESULTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(RESULTS_DIR, f"ablation_results_{stamp}.json")
    with open(path, "w") as f:
        json.dump(
            [
                {
                    "provider": leg.provider,
                    "confusion_matrix": leg.confusion_matrix,
                    "elicitation_coverage": [asdict(r) for r in leg.elicitation_coverage],
                    "information_gain": [asdict(r) for r in leg.information_gain],
                }
                for leg in legs
            ],
            f, indent=2,
        )

    for leg in legs:
        print(f"{leg.provider}: {leg.confusion_matrix}")
    print(f"Full results written to {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("extract-checklists")
    run_parser = subparsers.add_parser("run-ablation")
    run_parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    if args.command == "extract-checklists":
        extract_checklists()
    elif args.command == "run-ablation":
        run_ablation_command(args.limit)


if __name__ == "__main__":
    main()
```

```diff
--- a/.gitignore
+++ b/.gitignore
@@
 backend/scripts/graphrag_eval/transcripts/
 backend/scripts/graphrag_eval/results/
+
+# Symptom-understanding 4-metric eval — checklists/ is git-tracked
+# (human-reviewed disclosure scripts); only generated run output is ignored.
+backend/scripts/symptom_eval/transcripts/
+backend/scripts/symptom_eval/results/
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest scripts/symptom_eval/tests/test_ablation.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/symptom_eval/ablation.py backend/scripts/symptom_eval/cli.py backend/scripts/symptom_eval/tests/test_ablation.py .gitignore
git commit -m "feat(symptom-eval): add baseline-ablation orchestrator and CLI composition root (Metric 4)"
```

---

### Task 12: Verify — author real checklists, human-review, smoke run

Mirrors the CHANGELOG's established Verify gate (Sprint 17's Task 4 pattern) — confirm the harness works against real infrastructure on a small sample before trusting a full 27-vignette × 2-leg run.

- [ ] **Step 1: Confirm `OPENAI_API_KEY` is in Doppler's `eval` config**

Run: `doppler secrets --config eval | grep OPENAI_API_KEY`
Expected: a value present. If missing, this is the blocker flagged in the artifact §1.3/§3 — add it before continuing (out of this plan's scope: it's a Doppler dashboard action, not a code change).

- [ ] **Step 2: Generate all 27 checklists**

Run: `doppler run --config eval -- python -m scripts.symptom_eval.cli extract-checklists`
Expected: prints `wrote .../checklists/<case_id>.json — review before committing` 27 times (one `gpt-4o-mini` call each — trivial cost, confirm on the OpenAI dashboard afterward).

- [ ] **Step 3: Human review of every generated checklist**

Read each `backend/scripts/symptom_eval/checklists/<case_id>.json` next to its source vignette in `eval_vignettes_ontario_ctas.json`. Confirm for each: (a) `opening_message` matches only the chief complaint, no other detail leaked; (b) no `disclosure_item` states a CTAS level, triage tier, or diagnosis; (c) no invented finding not present in the source `scenario` text. This is the human-fidelity check every benchmark surveyed in the research budgets for (AgentClinic's clinician ratings, IOR-Bench's physician role-play, AMIE's OSCE fallback — research artifact §1.4 sources 5, 2, 7) — do not skip it even though it's manual. Fix any bad checklist by hand-editing the JSON (do not silently accept a leaking or hallucinating checklist).

- [ ] **Step 4: Commit the reviewed checklists**

```bash
git add backend/scripts/symptom_eval/checklists/
git commit -m "feat(symptom-eval): add human-reviewed disclosure checklists for all 27 CTAS vignettes"
```

- [ ] **Step 5: Smoke run — 3 vignettes, one leg**

Run: `doppler run --config eval -- python -m scripts.symptom_eval.cli run-ablation --limit 3`

(Note: `run_ablation_command` always runs both configured providers — for a true single-leg smoke test, temporarily edit the `providers` default in `cli.py`'s call, or accept both legs run at `--limit 3`, 6 vignette-conversations total either way, still a small/cheap batch.)

Expected: prints one summary line per provider leg and `Full results written to .../results/ablation_results_<stamp>.json`, no exceptions. Open the file — confirm each vignette entry has a non-empty transcript-derived result, not a placeholder.

- [ ] **Step 6: Confirm API usage looks right**

Check the OpenAI and Anthropic usage dashboards — 3 vignettes × 2 legs × (1 feature-presence judge call per disclosure item + 4 rubric-judge calls per turn) is a small number of calls; if wildly higher, stop and investigate before scaling up (mirrors Sprint 17's own Task 4 caution).

No commit for this task's Steps 5-6 — manual verification checkpoints, not code changes.

---

### Task 13: Full run + decide on publication target

- [ ] **Step 1: Run the full pool, both legs**

Run: `doppler run --config eval -- python -m scripts.symptom_eval.cli run-ablation`

Record the printed summaries and today's date — do not fabricate a number, read it from the actual output.

- [ ] **Step 2: Human review of low-scoring or flagged transcripts**

Read the lowest-`coverage` and any `under_triaged: true` rows in the results JSON. Confirm each is a genuine harness/product finding, not a checklist-authoring bug (e.g. a checklist that never mentions the actual red flag) or a judge miscalibration.

- [ ] **Step 3: Decide where these numbers get published — explicit open decision, not fixed by this plan**

Per the source artifact's own §3 finding ("two eval plans, never formally reconciled" — this 4-metric harness vs. `graphrag_eval`'s Track A/B, which measure different things): decide with the user whether these results feed the `/for-engineers` case study alongside or instead of Track A/B's numbers, and in what order. This plan deliberately does not prescribe an answer — it was flagged as an open question, not resolved by building the harness.

No commit for this task — it's a data-collection and decision checkpoint, not a code change.

---

## Self-Review Notes

- **Spec coverage:** Metric 1 (elicitation coverage) → Task 9. Metric 2 (confusion matrix + under-triage) → Task 8. Metric 3 (information gain) → Task 10. Metric 4 (ablation) → Task 11. The shared blocker (no vignette-to-conversation runner) → Tasks 1-7 (domain, capture, checklist extraction, loader, simulator, system adapter, conversation loop). The `OPENAI_API_KEY`-in-Doppler blocker (artifact §1.3/§3) → Task 12 Step 1. The human-review-pass gap (artifact §3) → Task 12 Step 3 and Task 13 Step 2.
- **Dependency Rule check:** `domain.py`, `confusion_matrix.py`, `elicitation_coverage.py`, `information_gain.py`, `ablation.py`, `conversation_runner.py` import only stdlib, `deepeval` (in the two judge files, which are themselves adapters implementing a Port defined in the same file — acceptable per Clean Architecture's "Port and its DTO live at the same boundary" convention already used by `graph.base.GraphContext`/`GraphContextProvider`), and each other's Port ABCs/domain types. Only `checklist_extractor.py` (`openai`), `patient_simulator.py` (`anthropic` via `AnthropicClient`), `system_under_test.py` (`groq` via `GroqClient`, `LLMAgent`, `graph.factory`), and `cli.py` (all of the above) cross into vendor-SDK/production-code territory.
- **Type consistency:** `SystemTurnResult` (Task 6) fields (`response_text`, `severity`, `reasoning`, `graph_context_matched`, `surfaced_red_flag_indicators`, `surfaced_followup_questions`) match exactly what `conversation_runner.py` (Task 7) reads off it. `ConversationTurn` (Task 1) fields match what `conversation_runner.py` writes and what `elicitation_coverage.py`/`information_gain.py` read via `VignetteTranscript.text_up_to()`. `Vignette.gold_severity`/`SEVERITY_RANK` (Task 1) match what `confusion_matrix.py` (Task 8) consumes.
- **Placeholder scan:** every step has real, complete code; the only intentionally-open item is Task 13 Step 3 (publication target), which is explicitly an open decision per the source artifact, not a placeholder for missing code.
- **No scope creep:** this plan does not touch `backend/scripts/graphrag_eval/` beyond the shared `graph_capture.py` decorator (which that track can adopt separately, not required by this plan); does not add Semigran's 45 BMJ vignettes (licensing unconfirmed, artifact §3); does not wire anything into CI (no baseline exists yet, same reasoning Sprint 17 already documented).
- **Correction carried from Global Constraints:** vignette count is 27, not 25 — verified by direct inspection of `eval_vignettes_ontario_ctas.json`, corrects both the 2026-07-22 research note and `artifacts/2026-08-03-symptom-understanding-eval-and-regression-plan.md`.

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-03-symptom-understanding-eval.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
