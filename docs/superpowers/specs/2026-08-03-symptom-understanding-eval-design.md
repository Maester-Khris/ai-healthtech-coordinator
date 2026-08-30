# Symptom-Understanding Eval (4-Metric CTAS Harness) — Design

**Status:** Proposed. Companion implementation plan:
`docs/superpowers/plans/2026-08-03-symptom-understanding-eval.md`.

**Source of truth for the "why":** `artifacts/2026-08-03-symptom-understanding-eval-and-regression-plan.md`
§1 (blockers, metrics, citations) — this document is the "how," scoped to the
4-metric pure-NLU eval only. It does not cover `backend/scripts/graphrag_eval/`
(Track A/B, already built/partially run) except where the two share a
component.

## 1. Problem restated

Four metrics were selected (elicitation coverage, triage confusion matrix,
information gain per turn, baseline ablation) but three of them share one
blocking gap: the only vignette source in the repo
(`backend/triage/resources/eval_vignettes_ontario_ctas.json`) is third-person
paramedic-exam narrative with an answer key, not a first-person conversation.
Nothing in the codebase can turn a static vignette into a multi-turn chat
session that discloses information only when asked — which is a hard
requirement, not a nicety, because "which features came out only because the
system asked" is literally what elicitation coverage measures.

## 2. Architectural approach — Clean Architecture applied to an eval harness

The eval harness is itself a small system with the same dependency-direction
risk as the product it's testing: it's tempting to let `anthropic`, `openai`,
`deepeval`, and `LLMAgent` leak into the scoring math, which would make the
scoring logic untestable without live API calls and would couple three
unrelated vendor SDKs into every file. Instead:

```
                     ┌─────────────────────────────────────────┐
                     │   Frameworks/Drivers (outermost)          │
                     │   anthropic SDK · openai SDK · deepeval  │
                     │   LLMAgent · GraphContextProvider(impl)  │
                     └───────────────┬───────────────────────────┘
                                      │ implements
                     ┌───────────────▼───────────────────────────┐
                     │   Interface Adapters                       │
                     │   AnthropicPatientSimulator                │
                     │   LiveLLMAgentAdapter                       │
                     │   OpenAIChecklistExtractor                  │
                     │   DeepEvalFeaturePresenceJudge               │
                     │   DeepEvalRubricJudge                        │
                     │   CapturingGraphProvider (decorator)          │
                     └───────────────┬───────────────────────────┘
                                      │ implements Ports (ABCs)
                     ┌───────────────▼───────────────────────────┐
                     │   Use Cases (application rules)             │
                     │   RunVignetteConversation                    │
                     │   ScoreElicitationCoverage                   │
                     │   ScoreTriageConfusionMatrix                 │
                     │   ScoreInformationGain                       │
                     │   RunBaselineAblation                        │
                     └───────────────┬───────────────────────────┘
                                      │ operates on
                     ┌───────────────▼───────────────────────────┐
                     │   Entities (innermost — pure dataclasses)   │
                     │   Vignette · DisclosureItem                  │
                     │   ConversationTurn · VignetteTranscript       │
                     └─────────────────────────────────────────────┘
```

**Dependency Rule applied:** nothing in `domain.py` or the `Score*`/`Run*` use
cases imports `anthropic`, `openai`, `deepeval`, `requests`, `LLMAgent`, or any
concrete `GraphContextProvider`. Every one of those lives behind a Port (an
`ABC` defined next to the use case that consumes it) and is only wired to a
concrete implementation in `cli.py` — the composition root ("Main as a
plugin", per Clean Architecture §6). This buys the same thing it buys the
product code: the scoring math (confusion matrix, entropy calc) is unit
tested with zero API calls, zero cost, and sub-second runtime, and any of the
three vendor SDKs can be swapped without touching a single use case.

**Why a decorator, not a new capture mechanism:** `GraphContextProvider`
(`backend/graph/base.py`) is a Strategy interface `LLMAgent` depends on but
never inspects beyond `matched`/`complaint_name`/`red_flags`. The codebase
already has the exact idiom needed to observe what a provider returned,
in `backend/tests/llm/test_graph_context_integration.py`'s `_CapturingProvider`
— a provider that wraps another provider's `_lookup` and records what came
back. This design promotes that idiom from test-only code into
`graph_capture.py`, reused by both this harness and (as a side effect) closes
`backend/scripts/graphrag_eval/run_track_b_deepeval.py`'s Blocker #2 (no way
to capture `surfaced_red_flags`/`surfaced_followup_questions` per turn) — one
component, two consumers, no duplication (DRY).

**Why in-process, not HTTP-driven like Sprint 17's `generate_transcripts.py`:**
`LLMAgent.respond(user_message, history, lat, lng, user_profile)`
(`backend/services/llm_agent.py:55`) is already decoupled from the delivery
mechanism — `routers/chat.py` calls it with a plain `history: list[dict]` it
sourced from `cache_chat.py`; `LLMAgent` itself never touches Supabase, auth,
or the cache. Driving it in-process (like `run_track_a_retrieval.py` already
does for retrieval-only checks) reproduces the exact same business behavior
as the HTTP path — same two-pass triage logic, same `GraphContextProvider`
dependency, same tool schema — without provisioning eval Supabase accounts, a
live server, or session/auth plumbing that adds infra fragility without
adding fidelity to what's being measured (Pragmatic Programmer's
orthogonality test: "if I change the delivery mechanism, does this eval
break?" — the answer must be no). HTTP-driven remains the right call for
Track B (`graphrag_eval`) only because that track's own scope is explicitly
"does the deployed system work," a different question than "does the
question-asking logic work."

## 3. Domain model (Entities)

```python
@dataclass
class DisclosureItem:
    feature_id: str                 # stable slug, e.g. "gcs_6"
    category: str                   # "chief_complaint"|"history"|"vitals"|"exam"|"red_flag"
    first_person_phrasing: str       # what the simulated patient says when asked
    reveal_only_if_asked: bool
    disclosed: bool = False          # mutated during simulation, never at authoring time

@dataclass
class Vignette:
    case_id: str                     # matches eval_vignettes_ontario_ctas.json, e.g. "10a"
    opening_message: str              # first-person chief complaint, sent as patient's turn 0
    disclosure_items: list[DisclosureItem]
    gold_severity: str                # routine|moderate|urgent|emergent (arrival)
    gold_ctas_level: int              # 1-5 (arrival), for reporting alongside app severity
    update_message: str | None = None       # departure-stage scripted update, if any
    updated_gold_severity: str | None = None  # departure severity, if update_message is set
    source_pages: str = ""

@dataclass
class ConversationTurn:
    turn_index: int
    patient_message: str
    system_response: str
    graph_context_matched: bool
    surfaced_red_flag_indicators: list[str]
    surfaced_followup_questions: list[str]

@dataclass
class VignetteTranscript:
    vignette_case_id: str
    turns: list[ConversationTurn]
    final_severity: str | None
    final_reasoning: str | None
```

These are plain `@dataclass`es — no ORM, no Pydantic, no framework import —
per Clean Architecture's Entity rule ("not a database row... encapsulating
critical [domain] rules... zero framework dependency"). `DisclosureItem` is
the direct code form of the USMLE/NBME standardized-patient checklist (design
rationale in the research artifact §1.4, source 9).

## 4. Ports (interfaces the use cases depend on, defined inward)

| Port | Method | Consumed by |
|---|---|---|
| `PatientSimulatorPort` | `reply(vignette, system_question, history) -> str` | `RunVignetteConversation` |
| `SystemUnderTestPort` | `respond(patient_message, history) -> SystemTurnResult` | `RunVignetteConversation` |
| `ChecklistExtractorPort` | `extract(scenario_text, case_id) -> list[DisclosureItem]` | one-time preprocessing CLI command, not the eval loop itself |
| `FeaturePresenceJudgePort` | `was_disclosed(feature, transcript) -> bool` | `ScoreElicitationCoverage` |
| `RubricJudgePort` | `score_candidates(transcript, up_to_turn) -> dict[str, float]` | `ScoreInformationGain` |

`SystemTurnResult` is a small dataclass `{response_text, severity, reasoning}`
— the same three fields `LLMAgent._run`/`_handle_triage` already return inside
its dict, just given a name instead of passed as a bare `dict[str, Any]`
(Clean Code: functions should return something a reader can name).

## 5. Model-role assignment (unchanged from the prior conversation, restated for this design's Global Constraints)

| Role | Port implementation | Model |
|---|---|---|
| System-under-test | `LiveLLMAgentAdapter` | **Groq** (`LLM_PROVIDER=groq`, production default) |
| Patient-simulator | `AnthropicPatientSimulator` | **Claude**, via the existing `AnthropicClient` (`backend/llm/anthropic_client.py`) — reused as-is, zero new LLM client code |
| Checklist extractor, both judges | `OpenAIChecklistExtractor`, `DeepEvalFeaturePresenceJudge`, `DeepEvalRubricJudge` | **OpenAI** `gpt-4o-mini`, matching `JUDGE_MODEL` already hardcoded in `run_faithfulness_eval.py` / `run_track_b_deepeval.py` — one consistent judge model across every eval effort in this repo |

Requires `OPENAI_API_KEY` in Doppler's `eval` config (flagged blocker,
artifact §1.3/§3) — Task 0 of the implementation plan, not code.

## 6. The four metrics, mapped to concrete use cases

1. **Elicitation coverage/fraction** → `ScoreElicitationCoverage(checklist, transcript, judge)`. For each `DisclosureItem`, ask the judge whether it appears (as information, not necessarily verbatim) anywhere in the transcript's `system_response`/`patient_message` pair sequence, tag volunteered (appeared before any targeted question) vs. elicited (only after). Pure arithmetic once the judge returns booleans — `|elicited| / |features|` and `|elicited| / |surfaced|`.
2. **Triage confusion matrix + under-triage rate** → `ScoreTriageConfusionMatrix(vignette, transcript)`. Deterministic — no judge. Compares `transcript.final_severity` against `vignette.gold_severity` (and the departure pair, if `update_message` was sent) using `SEVERITY_RANK = {"routine":0,"moderate":1,"urgent":2,"emergent":3}`; under-triage = `SEVERITY_RANK[predicted] < SEVERITY_RANK[gold]`.
3. **Information gain per follow-up turn** → `ScoreInformationGain(transcript, judge)`. Adapts IOR-Bench's "candidate department" notion to MediCoord's domain: **candidates are the 4 severity tiers**, not open-ended diagnoses (a deliberate, disclosed adaptation — MediCoord triages to a facility tier, IOR-Bench triages to a hospital department; the entropy mechanics are identical, the candidate set is domain-appropriate). The rubric judge scores support for each of the 4 tiers after each turn, softmax gives `p_t`, entropy `H_t = -Σ p_t log p_t`, gain = `H_{t-1} - H_t`. Secondary/diagnostic only, never gates a pass/fail (per IOR-Bench's own finding, restated in the research artifact).
4. **Baseline ablation** → `RunBaselineAblation(vignettes, ...)`. Runs the full vignette pool through `RunVignetteConversation` twice — once with the harness's `GRAPH_RAG_PROVIDER` env override set to `off`, once to `static` or `neo4j` — and diffs metrics 1-3 between legs. No new logic; it's Metrics 1-3 called twice with one env var changed, per `backend/graph/factory.py:12`.

## 7. Determinism / reproducibility stance (closes the artifact §3 gap)

Full byte-for-bit determinism is not achievable (turns 2+ are LLM-simulated
patient replies) — DeepEval's own multi-turn-simulation docs describe this as
inherent and settle for "statistical" reproducibility (research artifact §1.4
source 11). This design narrows the non-determinism instead of accepting it
wholesale:

- **Turn 0 (opening) and the departure-update turn are static text**, taken
  verbatim from the vignette's `opening_message`/`update_message` — authored
  once by the checklist extractor, reviewed, and git-committed. No LLM call,
  no variance, on the two turns most load-bearing for the confusion-matrix
  metric.
- **Every real run's transcripts are written to disk** (`transcripts/`,
  gitignored like every other eval script's output in this repo) — a
  regression check is "diff this run's summary stats against the last
  committed results snapshot," not "expect byte-identical transcripts."
- Only turns 1..N-1 (the simulator's checklist-gated mid-conversation
  replies) vary run-to-run — bounded, not eliminated.

## 8. What this design deliberately does not do

- Does not touch `backend/scripts/graphrag_eval/` (Track A/B) — separate
  effort, separate concern, sharing only `graph_capture.py`.
- Does not add Semigran's 45 BMJ vignettes — licensing unconfirmed (artifact
  §3); the harness is built vignette-source-agnostic (`vignette_loader.py`
  takes a path) so adding a second pool later is a data change, not a code
  change, once licensing clears.
- Does not wire this into CI — no baseline exists yet to regress against
  (same reasoning Sprint 17 already applied and documented in
  `artifacts/system_evaluation_discussion.md`).
- Does not add a human-clinician review pass in code — that's a process step
  (artifact §3's last point), tracked as a manual Verify task in the
  implementation plan, not automated.
