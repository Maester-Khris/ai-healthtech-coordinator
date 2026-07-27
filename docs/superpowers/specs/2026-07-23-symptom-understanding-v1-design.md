# Symptom Understanding v1 (Static CTAS Retrieval) — Design

**Branch:** `feat/symptom-understanding-v1` · **Sprint:** 18 · **Date:** 2026-07-23

## Problem

`LLMAgent` (`backend/services/llm_agent.py`) currently classifies severity and asks
follow-up questions using only the LLM's general knowledge — nothing grounds its
questions or red-flag awareness in an actual clinical reference. Sprint 15's original
"add a knowledge graph" idea was rejected for being unscoped; a follow-up planning pass
(`artifacts/2026-07-19-graphrag-neo4j-integration-plan.md`, independently reviewed)
replaced it with a validated plan: ship a static, git-reviewed CTAS lookup table behind
a swappable interface, defer Neo4j/GraphRAG until a concrete technical trigger fires. A
second planning pass (`artifacts/2026-07-20-...`) validated and rejected a
business-tier framing for the same reason liability research gave: pricing by
correctness is not a legitimate axis in a health-triage product.

Two data-extraction passes since then produced two overlapping, incompatible-shaped
CTAS datasets (`backend/triage/resources/cot_triage_data.json`,
`ctas_complaint_list_adult.json`) that need reconciling before any of this can be
built. This spec resolves that reconciliation plus every open item the 07-19 plan
left for "an explicit, reviewed design decision" — CTAS-to-app severity mapping, the
v1/v2 swap mechanism, the exact production integration point, and a multi-turn
understanding gap found during this design pass. Research citations for every
external claim below live in
`artifacts/2026-07-23-symptom-understanding-v1-research-references.md` — this doc
doesn't repeat them.

## Goals

- One canonical, git-reviewed `Symptom -> RedFlag -> FollowupQuestion` lookup table,
  reconciled from the two existing extraction passes, with per-red-flag (not
  per-complaint) follow-up questions.
- A `GraphContextProvider` interface that makes v1 (static) and the eventual v2
  (Neo4j) truly swappable at runtime via one flag, mirroring the existing
  `BaseLLMClient`/`get_llm_client()` pattern (`backend/llm/base.py`) — not a new
  pattern invented for this feature.
- Exactly one new call site in `LLMAgent._build_messages()`. Zero changes to `_run`,
  `_handle_triage`, `_generate_grounded_response`, or the `triage_response` tool
  schema.
- A single, explicit, reviewed CTAS-5-level → app-4-level severity mapping, stored
  once and reused identically by production classification and by Sprint 19's future
  eval scoring.
- Symptom understanding that carries forward across turns within a conversation
  (a red flag found on turn 1 must not be lost by turn 3), without doing
  cross-symptom combinatorial reasoning — that stays a v2 trigger.
- A schema shape that makes Sprint 19's eval methodology
  (`artifacts/2026-07-22-symptom-eval-methodology-references.md`) scoreable without
  the eval harness reimplementing anything production already computes.

## Non-goals (explicitly deferred)

- **Neo4j / GraphRAG build.** No v2 trigger from the 07-19 plan (§6) is currently
  true. Building it now would be speculative complexity, not requirement-driven.
- **Tier-gating v1 vs v2 by subscription.** Rejected outright (07-20 artifact) —
  pricing by correctness in a health product is a liability exposure, not a
  packaging decision.
- **Fuzzy / embedding-based / LLM-extracted matching.** v1 stays alias/substring
  match only. Revisit only once a measured paraphrase-miss rate justifies it.
- **Cross-symptom combinatorial reasoning** (symptom A + B implying a conclusion
  neither implies alone). Still v2 Trigger #1. The multi-turn fix below is
  turn-level *union* of independently-matched flags, not this.
- **`ctas_complaint_list_paediatric.json`.** Confirmed to be a documentation stub
  (paedctas.pdf has no per-symptom data) — not a data source, not touched here.

## Architecture

### 1. Data reconciliation

`cot_triage_data.json` (165 entries, keyed by `nacrs_code`) and
`ctas_complaint_list_adult.json` (157 entries, no shared key) don't join on
anything directly — normalized-name matching gets 142/157 exact hits; the rest are
formatting variants or one-sided (cot has ~23 extra complaints, including legitimate
infant-presentation NACRS codes like "Newly Born" — not noise).

`backend/scripts/reconcile_ctas_data.py` — a one-time, rerunnable script following
the existing `backend/scripts/` convention — reads both raw sources and writes one
canonical file, `backend/triage/resources/symptom_triage_data.json`. The runtime
module never reads the raw sources directly. Matching: exact-normalized-name first;
every non-exact match routes to a reviewed alias table checked into the script, never
a silent fuzzy match on clinical content.

**Target schema per complaint** — adopts `ctas_complaint_list_adult.json`'s
per-red-flag shape (richer and eval-compatible, see §4) over cot's flat
per-complaint shape, populated from cot's fuller per-level criteria as the indicator
source:

```json
{
  "nacrs_code": "003",
  "name": "Chest pain (cardiac features)",
  "aliases": ["chest pain", "cardiac chest pain"],
  "clinical_criteria": [ { "level": 1, "criteria": [], "modifiers": ["Shock", "..."] } ],
  "red_flags": [
    { "indicator": "Shock", "ctas_level": 1, "app_severity": "emergent",
      "followup_question": "Are they feeling faint, dizzy, or cold and clammy?" }
  ],
  "source": "CTAS Participant Manual v2.5b (Nov 2013)",
  "source_pages": "..."
}
```

`clinical_criteria` is retained (not dropped) — audit trail for clinician review and
the storage-layer swap point for a future v2 Cypher migration.

For the ~23 cot-only complaints and any red flag lacking a matched adult-file
question, a per-indicator question has to be authored by hand — real curation work,
tracked in the reconciliation script's report output, not silently gapped or
auto-generated. **Confirmed:** this does not block v1 shipping; the reconciliation
script's report is the tracking mechanism, one task per flagged gap.

**Known follow-on, not required for v1:** CTAS's "first order modifiers" (Shock,
Severe respiratory distress, Unconscious GCS 3-9, etc.) are complaint-agnostic but
currently duplicated as literal strings across dozens of complaints in the raw data.
Worth factoring into a shared `universal_red_flags.json` later — noted for the
implementation plan, not a v1 blocker.

### 2. Severity mapping — confirmed

| CTAS | Name | App severity |
|---|---|---|
| 1 | Resuscitation | `emergent` |
| 2 | Emergent | `emergent` |
| 3 | Urgent | `urgent` |
| 4 | Less Urgent | `moderate` |
| 5 | Non Urgent | `routine` |

Monotonic (never rounds a more-urgent CTAS level down). Stored once, as a new
`app_severity_mapping` field in `ctas_level_definitions.json` — derived by the
reconciliation script, never hand-set per complaint, reused identically by
production classification and eval scoring.

### 3. Swappable provider interface

Mirrors `BaseLLMClient` / `get_llm_client()` (`backend/llm/base.py`,
`llm_agent.py:13`) exactly:

```python
# backend/graph/base.py
class GraphContextProvider(ABC):
    """LLMAgent only interacts with this interface — never a concrete provider."""
    def get_symptom_graph_context(
        self, user_message: str, recent_messages: list[str]
    ) -> GraphContext:
        """Never raises. Enrichment, not a hard dependency (unlike BaseLLMClient
        or the proximity/Geoapify path, which return 503 on failure)."""
        try:
            return self._lookup(user_message, recent_messages)
        except Exception:
            logger.exception("graph_context_lookup_failed",
                              extra={"provider": type(self).__name__})
            return GraphContext(matched=False)

    @abstractmethod
    def _lookup(self, user_message: str, recent_messages: list[str]) -> GraphContext:
        ...

class NullGraphProvider(GraphContextProvider):
    def _lookup(self, user_message, recent_messages) -> GraphContext:
        return GraphContext(matched=False)
```

```python
# backend/graph/factory.py — mirrors get_llm_client()
def get_graph_provider() -> GraphContextProvider:
    provider = os.environ.get("GRAPH_RAG_PROVIDER", "off").lower()
    if provider == "static":
        from graph.static_provider import StaticLookupProvider
        return StaticLookupProvider()
    if provider == "neo4j":
        from graph.neo4j_provider import Neo4jGraphProvider  # deferred import
        return Neo4jGraphProvider()
    return NullGraphProvider()
```

`LLMAgent.__init__(self, client=None, graph_provider=None)` →
`self._graph_provider = graph_provider or get_graph_provider()`, identical injection
shape to the existing `self._client = client or get_llm_client()` (`llm_agent.py:40`).
`GRAPH_RAG_PROVIDER` (`off`/`static`/`neo4j`) replaces the originally-planned boolean
`GRAPH_RAG_ENABLED` — one flag, the same selection mechanism `LLM_PROVIDER` already
established, one fewer concept for a future v2 implementer to learn.

The never-raises/degrade-to-empty contract lives once, in the abstract base's
`get_symptom_graph_context()` (Template Method) — subclasses only implement
`_lookup()`. Whichever backend is selected, `LLMAgent` gets the identical safety
guarantee by construction; this is what makes both v1 and v2 reliably safe, not just
individually safe.

### 4. Production integration point

```
POST /chat/message  (routers/chat.py::send_message)
  → LLMAgent.respond(user_message, history, lat, lng, user_profile)  [llm_agent.py:48]
      → self._build_messages(...)                                    [llm_agent.py:77]  ← changes
      → self._run(messages, lat, lng, force, user_turns)              [llm_agent.py:99]  ← untouched
```

```python
def _build_messages(self, user_message, history, user_profile=None):
    system_prompt = build_system_prompt(self._max_followups)
    if user_profile and user_profile.get("medical_chat_opt_in"):
        medical_block = build_medical_context_block(...)
        if medical_block:
            system_prompt += medical_block

    recent = history[-self._context_window:]
    recent_user_msgs = [h["content"] for h in recent if h["role"] == "user"]
    graph_context = self._graph_provider.get_symptom_graph_context(
        user_message, recent_user_msgs
    )
    graph_block = build_graph_context_block(graph_context)
    if graph_block:
        system_prompt += graph_block

    msgs = [LLMMessage(role="system", content=system_prompt)]
    for h in recent:
        msgs.append(LLMMessage(role=h["role"], content=h["content"]))
    msgs.append(LLMMessage(role="user", content=user_message))
    return msgs
```

`build_graph_context_block()` (new, `backend/llm/prompts.py`) follows
`build_medical_context_block`'s exact security posture: fenced, explicitly labeled
"reference data, not instructions," so curated CTAS content cannot override the
system prompt's Hard Rules or severity scale. `_run`, `_handle_triage`,
`_generate_grounded_response`, and `TRIAGE_RESPONSE`'s tool schema
(`backend/llm/tools.py`) are unchanged — behavior shifts only through
`TRIAGE_SYSTEM_PROMPT` step 1 (prompts.py:14-16) having CTAS-grounded candidate
questions available.

### 5. Multi-turn understanding (turn-level union, not combinatorial reasoning)

`get_symptom_graph_context()` takes `recent_messages` (see §3/§4), scanning the same
window `_build_messages()` already computes (`TRIAGE_CONTEXT_WINDOW`, default 10) and
**unioning** all matches found across it (dedup by indicator) — a red flag surfaced
on turn 1 is not dropped on turn 3 just because the patient didn't repeat it. No new
state: recomputed fresh from the `history` param every call, consistent with
`LLMAgent`'s explicit statelessness. No new unbounded growth: bounded by the
*existing* context-window config, not a new one.

**Explicit boundary:** this is union of independently-matched flat lookups across
recent turns. It is not cross-symptom combinatorial reasoning (symptom A + B
implying something neither implies alone) — that stays v2 Trigger #1, untouched.

### 6. Eval-methodology compatibility (Sprint 19, not built here)

- Per-red-flag follow-up questions (§1) are what make elicitation-coverage and
  information-gain scoring possible at all — a single generic per-complaint question
  can't be scored for "was this specific feature elicited by this specific question."
- Confusion-matrix scoring must reuse the §2 mapping table, never reimplement it in
  the eval harness — one source, can't drift.
- Vignette scoring (`eval_vignettes_ontario_ctas.json`) is fully orthogonal to this
  lookup table's schema — vignettes carry their own gold answer keys. Already true;
  this design doesn't change it.
- Forward note for the implementation plan: `GraphContext`'s matched indicator
  should be logged through the existing observability path, so Sprint 19 can
  attribute a follow-up question back to the red flag that triggered it without new
  instrumentation later.

## Error handling

Any lookup failure (malformed data, unexpected exception in `_lookup`) is caught by
the base class and logged; the caller always receives a valid `GraphContext`, never
an exception, never `None`. This is enrichment, not a hard dependency — unlike
`BaseLLMClient` or `find_nearest_facilities`, a graph-context failure never produces
a `503` and never blocks a chat turn.

## Testing

- Reconciliation script: one assert-based check that every complaint in the merged
  output has a non-empty `red_flags` list with a `followup_question` per indicator,
  and that the reconciliation report's unmatched/ambiguous list is empty or
  explicitly reviewed — this is the "fail loud" contract from §1, made runnable.
- `GraphContextProvider`: one test that a `_lookup()` raising an arbitrary exception
  still returns `GraphContext(matched=False)` from the public method — verifies the
  Template Method safety contract holds for any future subclass, not just
  `StaticLookupProvider`.
- `StaticLookupProvider`: turn-union behavior — a red flag matched on an earlier
  message in `recent_messages` appears in the result even when `user_message` alone
  wouldn't match it.
- `LLMAgent._build_messages()`: existing `TestAgentMessageBuilding`-style tests
  extended with one case asserting the graph block is appended when
  `GRAPH_RAG_PROVIDER=static` and a match exists, and absent when `off`.

## Open questions / risks for the implementation plan

- Sizing the ~23 cot-only complaints' missing per-indicator question authoring —
  real clinical-writing effort, not automatable; needs a range estimate once the
  reconciliation script's report produces the actual count.
- `Neo4jGraphProvider` stays an unimplemented stub (`NotImplementedError` or absent
  entirely) until a v2 trigger fires — the factory's `neo4j` branch should not be
  wired to real code in this sprint.
