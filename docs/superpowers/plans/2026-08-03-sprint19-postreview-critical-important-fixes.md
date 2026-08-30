# Sprint 19 Post-Review Fixes — 2 Critical + 6 Known Important Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 2 Critical findings and the 6 Important findings whose full text survived (I3, I8, I9, I10, plus I13, already resolved in `CHANGELOG.md`) from the SNOMED v2 branch's final whole-branch review (`d3324a0..98f14ba`), verdict "Ready to merge, With fixes."

**Scope note (explicit, per user decision 2026-08-03):** the review found 2 Critical + 12 Important + several Minor + 3 plan-document defects, but only 5 of the 12 Important findings' full text survives anywhere in the repo (the rest existed only in a review-agent notification that was never persisted). This plan covers exactly the 6 items with recoverable, concrete detail: **C1, C2, I3, I8, I9, I10**. I13 needed no code — it's already resolved by recording the Track A numbers in `CHANGELOG.md`. The other 7 Important findings, the Minors, and the 3 plan-document defects are **not in this plan** — recovering them requires either the user's own notes/scrollback from that review session, or a fresh whole-branch review dispatched against current `HEAD`.

**Architecture:** Every fix is scoped to its existing Clean Architecture layer — no new layers introduced. C1/C2 stay inside `graph/factory.py` and `graph/snomed_neo4j/{provider,queries}.py` (Framework/Adapter layer, per the existing design). I3 adds a new deterministic check to `services/triage_eval.py`, which already holds one (`check_facility_groundedness`) — same pattern, not a new module. I9 extends the existing Layer 1/Layer 2 structural separation with a new Layer 2 relationship type (`PART_OF`/`RedFlagCluster`), seeded with one grounded pilot cluster, not invented content.

**Tech Stack:** Python 3.11, `neo4j` driver (existing dependency), `pytest` with the existing `integration` marker (`backend/pytest.ini`) for anything needing a live Neo4j connection.

## Global Constraints

- Type hints on all new/modified function signatures (per `CLAUDE.md`).
- Branch: continue on `feat/symptom-understanding-v2` (already the working branch for this sprint; matches the branching decision made earlier in this session — eval work and these fixes both stay off `preview` until resolved together).
- No new dependencies.
- Every task that touches `provider.py`'s `_lookup()` must preserve its documented contract: never raises (the base class's `get_symptom_graph_context()` try/except is the only safety net — do not add a second one inside `_lookup()` itself), and `complaint_name` continues to resolve to "the first anchor in `ANCHOR_MAPPINGS` order that produces red flags" (an intentional design decision, not incidental list-order reliance — Task 2's C2 fix must reassemble batched results back into this exact order, not just return them in whatever order Neo4j hands them back).
- Existing tests that assert call-count-based mock behavior against the old per-anchor-loop shape (`test_lookup_maps_records_to_red_flag_matches`, `test_lookup_deduplicates_repeated_indicator` in `backend/tests/graph/test_snomed_provider.py`) must be updated as part of Task 2, not left broken — a refactor that leaves its own regression tests red is not done.
- New Important-finding fixes (I3, I9) must never change severity classification behavior — `services/llm_agent.py`'s existing Hard Rule ("severity classification is the LLM's job, unconditionally") stays intact. Both land as detection/logging only; escalation policy (what happens when they fire) is an explicit, separate, undecided follow-up — not this plan's call to make unilaterally.
- Commits always need explicit user approval (repo rule) — each task ends with a prepared `git commit`; wait for a go-ahead before running it.

---

## File Structure

```
backend/
  graph/
    factory.py                                        # MODIFY — cache providers per GRAPH_RAG_PROVIDER value (C1), add close_graph_provider()
    snomed_neo4j/
      provider.py                                      # MODIFY — batched traversal (C2), ctas_level sort (I10), PART_OF cluster detection (I9)
      queries.py                                       # MODIFY — add build_red_flag_traversal_query_batch, build_cluster_detection fields
  scripts/
    snomed_ingest/
      seed_red_flags.py                                # MODIFY — seed one pilot RedFlagCluster + PART_OF edges (I9)
  services/
    triage_eval.py                                     # MODIFY — add check_emergency_mismatch (moved from test file, I3)
    llm_agent.py                                       # MODIFY — call check_emergency_mismatch, log-only (I3)
  main.py                                               # MODIFY — call close_graph_provider() on lifespan shutdown (C1)
  tests/
    graph/
      test_factory.py                                   # CREATE — C1 caching/close behavior
      test_snomed_provider.py                            # MODIFY — update 2 tests for batched-call shape (C2), add I10/I9 tests
      test_entity_linking_precision.py                    # CREATE — I8, integration-marked, bounded sample
    scripts/snomed_ingest/
      test_seed_red_flags.py                              # MODIFY — add pilot cluster seeding test (I9)
    services/
      test_triage_eval.py                                  # MODIFY — add check_emergency_mismatch tests (moved from test_prompt_injection.py, I3)
    llm/
      test_triage_tools.py or test_llm_agent.py             # MODIFY — verify emergency_mismatch_detected fires and never overrides severity (I3)
    graph/test_prompt_injection.py                          # MODIFY — remove the now-duplicated check_emergency_mismatch definition, import from triage_eval instead (I3)
```

---

### Task 1: I10 — Red-flag precedence/sort rule (smallest fix, do first)

Design §4 point 4 / §8: "sort candidates by `ctas_level` ascending; the top unresolved one wins ties." Currently `_lookup()` appends `red_flags` in whatever order `ANCHOR_MAPPINGS`/Neo4j rows produce them — never sorted. Doing this first, before Task 2's larger refactor, keeps it an isolated one-line diff with its own test, so Task 2's bigger change starts from a green baseline that already has this fixed.

**Files:**
- Modify: `backend/graph/snomed_neo4j/provider.py`
- Modify: `backend/tests/graph/test_snomed_provider.py`

**Interfaces:**
- No signature changes — `_lookup()`'s return type (`GraphContext`) is unchanged; only the ordering of `red_flags` within it changes.

- [ ] **Step 1: Write the failing test**

```python
# add to backend/tests/graph/test_snomed_provider.py

def test_lookup_sorts_red_flags_by_ctas_level_ascending(mock_provider):
    """Design §4 point 4 / §8: most-severe (lowest ctas_level) must come first,
    regardless of which anchor/row order Neo4j returns them in."""
    urgent_row = {
        "candidate_id": "1", "anchor_id": "A", "indicator": "Urgent sign",
        "ctas_level": 3, "app_severity": "urgent", "followup_question": "q1",
    }
    emergent_row = {
        "candidate_id": "1", "anchor_id": "B", "indicator": "Emergent sign",
        "ctas_level": 1, "app_severity": "emergent", "followup_question": "q2",
    }

    call_count = 0

    def side_effect(query, params):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [{"concept_id": "1"}]
        if call_count == 2:
            return [urgent_row]      # deliberately returned BEFORE the emergent one
        if call_count == 3:
            return [emergent_row]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    result = mock_provider.get_symptom_graph_context("test", [])

    assert [rf.ctas_level for rf in result.red_flags] == [1, 3]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/graph/test_snomed_provider.py::test_lookup_sorts_red_flags_by_ctas_level_ascending -v`
Expected: FAIL — `assert [3, 1] == [1, 3]`

- [ ] **Step 3: Write minimal implementation**

In `backend/graph/snomed_neo4j/provider.py`, at the end of `_lookup()`, before the final `return GraphContext(...)`:

```python
        # Step 6: no red flags found
        if not red_flags:
            return GraphContext(matched=False)

        # Design §4 point 4 / §8 — precedence rule, explicit not learned:
        # most severe (lowest ctas_level) first, regardless of traversal order.
        red_flags.sort(key=lambda rf: rf.ctas_level)

        return GraphContext(
            matched=True,
            complaint_name=complaint_name,
            red_flags=red_flags,
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/graph/test_snomed_provider.py -v`
Expected: PASS (all tests, including the new one)

- [ ] **Step 5: Commit**

```bash
git add backend/graph/snomed_neo4j/provider.py backend/tests/graph/test_snomed_provider.py
git commit -m "fix(snomed): sort red flags by ctas_level ascending, the design's precedence rule (I10)"
```

---

### Task 2: C2 — Batch the per-anchor Neo4j traversal (155 round-trips → 2)

`_lookup()` currently issues one Neo4j round-trip per entry in `ANCHOR_MAPPINGS` (154+ sequential queries per message). Verified: only 2 distinct `max_depth` values exist across all current mappings (`4`, the default, and `2`, the Phase-3-narrowed override) — grouping anchors by `max_depth` and running one batched query per group collapses this to exactly 2 round-trips today, growing only if a third distinct depth value is ever introduced (not with `ANCHOR_MAPPINGS`'s size).

**Files:**
- Modify: `backend/graph/snomed_neo4j/queries.py`
- Modify: `backend/graph/snomed_neo4j/provider.py`
- Modify: `backend/tests/graph/test_snomed_provider.py`

**Interfaces:**
- Produces: `build_red_flag_traversal_query_batch(candidate_concept_ids: list[str], anchor_concept_ids: list[str], max_depth: int) -> tuple[str, dict]` — consumed by `provider.py`. `build_red_flag_traversal_query` (singular) is kept, unmodified — still used by Task 5's (I8) per-anchor precision tests.
- Modifies: `Neo4jSnomedProvider._lookup()`'s internal traversal step only. Its return contract (`GraphContext`, `complaint_name` resolution order) is unchanged — this is a pure performance refactor, not a behavior change.

- [ ] **Step 1: Write the failing test for the batched query builder**

```python
# add to backend/tests/graph/test_snomed_provider.py, in the pure-builder section
from graph.snomed_neo4j.queries import build_red_flag_traversal_query_batch


def test_batch_traversal_query_filters_by_anchor_id_list():
    query, params = build_red_flag_traversal_query_batch(
        candidate_concept_ids=["22253000"],
        anchor_concept_ids=["426396005", "271594007"],
        max_depth=4,
    )
    assert "IS_A*0..4" in query
    assert "anchor.id IN $anchor_concept_ids" in query
    assert params["candidate_concept_ids"] == ["22253000"]
    assert params["anchor_concept_ids"] == ["426396005", "271594007"]


def test_batch_traversal_query_rejects_negative_depth():
    with pytest.raises(ValueError):
        build_red_flag_traversal_query_batch(["1"], ["2"], max_depth=-1)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/graph/test_snomed_provider.py -k batch_traversal -v`
Expected: FAIL with `ImportError: cannot import name 'build_red_flag_traversal_query_batch'`

- [ ] **Step 3: Implement the batched query builder**

Add to `backend/graph/snomed_neo4j/queries.py`:

```python
def build_red_flag_traversal_query_batch(
    candidate_concept_ids: list[str],
    anchor_concept_ids: list[str],
    max_depth: int,
) -> tuple[str, dict]:
    """Same traversal as build_red_flag_traversal_query, batched across every
    anchor that shares the same max_depth — collapses what was one Neo4j
    round-trip per anchor (up to 154 per message) into one query per distinct
    max_depth value present in ANCHOR_MAPPINGS (2 today). See plan:
    2026-08-03-sprint19-postreview-critical-important-fixes.md, C2.
    """
    if max_depth < 0:
        raise ValueError(f"max_depth must be >= 0, got {max_depth}")
    query = (
        f"MATCH (c:SnomedConcept) "
        f"WHERE c.id IN $candidate_concept_ids "
        f"MATCH (c)-[:IS_A*0..{max_depth}]->(anchor:SnomedConcept) "
        f"WHERE anchor.id IN $anchor_concept_ids "
        f"MATCH (anchor)-[:HAS_RED_FLAG]->(rf:RedFlag)-[:ASKS]->(q:FollowupQuestion) "
        f"RETURN DISTINCT c.id AS candidate_id, "
        f"anchor.id AS anchor_id, "
        f"rf.indicator AS indicator, "
        f"rf.ctas_level AS ctas_level, "
        f"rf.app_severity AS app_severity, "
        f"q.text AS followup_question"
    )
    return query, {
        "candidate_concept_ids": candidate_concept_ids,
        "anchor_concept_ids": anchor_concept_ids,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/graph/test_snomed_provider.py -k batch_traversal -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Write the failing test for provider.py's grouped traversal**

Replace the two now-stale tests in `backend/tests/graph/test_snomed_provider.py` (they assumed one `run_query` call per anchor — no longer true) with versions matching the batched-call shape:

```python
# REPLACES test_lookup_maps_records_to_red_flag_matches
def test_lookup_maps_records_to_red_flag_matches(mock_provider):
    """Happy path: concept lookup returns one hit, one batched traversal call
    (grouped by max_depth) returns one red flag."""
    traversal_row = {
        "candidate_id": "22253000",
        "anchor_id": "29857009",
        "indicator": "Shock",
        "ctas_level": 1,
        "app_severity": "emergent",
        "followup_question": "Are they cold and clammy?",
    }

    call_count = 0

    def side_effect(query, params):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [{"concept_id": "22253000"}]
        # one batched call per distinct max_depth group (2 today) — return the
        # hit on the first group, empty on the rest.
        if call_count == 2:
            return [traversal_row]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    result = mock_provider.get_symptom_graph_context("chest pain", [])
    assert result.matched is True
    assert len(result.red_flags) >= 1
    assert result.red_flags[0].indicator == "Shock"
    assert result.red_flags[0].ctas_level == 1
    assert result.red_flags[0].followup_question == "Are they cold and clammy?"
    # Exactly 1 concept-lookup call + 1 call per distinct max_depth group
    # (2 today) — not 1 call per anchor (154+).
    assert call_count <= 1 + len({m.max_depth for m in __import__(
        "graph.snomed_neo4j.anchor_mapping", fromlist=["ANCHOR_MAPPINGS"]
    ).ANCHOR_MAPPINGS})


# REPLACES test_lookup_deduplicates_repeated_indicator
def test_lookup_deduplicates_repeated_indicator(mock_provider):
    """Same indicator returned for two different anchor_ids within the SAME
    batched call → only one RedFlagMatch (dedup is keyed on indicator, not
    on which anchor/call it came from)."""
    dup_row_anchor_a = {
        "candidate_id": "22253000", "anchor_id": "29857009",
        "indicator": "Shock", "ctas_level": 1, "app_severity": "emergent",
        "followup_question": "Are they cold and clammy?",
    }
    dup_row_anchor_b = {
        "candidate_id": "22253000", "anchor_id": "10000000",
        "indicator": "Shock", "ctas_level": 1, "app_severity": "emergent",
        "followup_question": "Are they cold and clammy?",
    }

    call_count = 0

    def side_effect(query, params):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [{"concept_id": "22253000"}]
        if call_count == 2:
            return [dup_row_anchor_a, dup_row_anchor_b]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    result = mock_provider.get_symptom_graph_context("chest pain", [])
    shock_flags = [rf for rf in result.red_flags if rf.indicator == "Shock"]
    assert len(shock_flags) == 1
```

- [ ] **Step 6: Run to confirm both fail against the current (unbatched) `_lookup()`**

Run: `cd backend && python -m pytest tests/graph/test_snomed_provider.py -k "maps_records or deduplicates" -v`
Expected: FAIL — the current code still makes one `run_query` call per anchor in `ANCHOR_MAPPINGS`, so `call_count` will be far higher than these tests' side-effects account for, and both will error or return no matches.

- [ ] **Step 7: Implement the grouped traversal in `provider.py`**

Replace `_lookup()`'s traversal section in `backend/graph/snomed_neo4j/provider.py`:

```python
import os
from collections import defaultdict

from graph.base import GraphContext, GraphContextProvider, RedFlagMatch
from graph.snomed_neo4j.client import Neo4jClient
from graph.snomed_neo4j.queries import (
    build_concept_lookup_query,
    build_red_flag_traversal_query_batch,
)
from graph.snomed_neo4j.anchor_mapping import ANCHOR_MAPPINGS


class Neo4jSnomedProvider(GraphContextProvider):
    # ... __init__, close unchanged ...

    def _lookup(self, user_message: str, recent_messages: list[str]) -> GraphContext:
        all_text = " ".join([user_message, *recent_messages]).strip()

        lookup_query, lookup_params = build_concept_lookup_query()
        lookup_params = {**lookup_params, "text": all_text}
        concept_rows = self._client.run_query(lookup_query, lookup_params)
        if not concept_rows:
            return GraphContext(matched=False)

        candidate_ids = [row["concept_id"] for row in concept_rows]
        rows_by_anchor = self._traverse_all_anchors(candidate_ids)

        red_flags: list[RedFlagMatch] = []
        seen_indicators: set[str] = set()
        complaint_name: str | None = None

        for mapping in ANCHOR_MAPPINGS:
            rows = rows_by_anchor.get(mapping.anchor_concept_id, [])
            if not rows:
                continue
            # First anchor in ANCHOR_MAPPINGS order that produces red flags
            # becomes complaint_name — preserved exactly, batching only
            # changes how the rows are fetched, not this reassembly order.
            if complaint_name is None:
                complaint_name = mapping.ctas_alias

            for row in rows:
                indicator = row["indicator"]
                if indicator not in seen_indicators:
                    seen_indicators.add(indicator)
                    red_flags.append(
                        RedFlagMatch(
                            indicator=indicator,
                            ctas_level=row["ctas_level"],
                            app_severity=row["app_severity"],
                            followup_question=row["followup_question"],
                        )
                    )

        if not red_flags:
            return GraphContext(matched=False)

        red_flags.sort(key=lambda rf: rf.ctas_level)
        return GraphContext(matched=True, complaint_name=complaint_name, red_flags=red_flags)

    def _traverse_all_anchors(self, candidate_ids: list[str]) -> dict[str, list[dict]]:
        """Groups ANCHOR_MAPPINGS by max_depth and issues one batched query per
        distinct depth (C2 fix) instead of one query per anchor. Returns rows
        keyed by anchor_id so _lookup() can reassemble them in ANCHOR_MAPPINGS's
        own order."""
        anchors_by_depth: dict[int, list[str]] = defaultdict(list)
        for mapping in ANCHOR_MAPPINGS:
            anchors_by_depth[mapping.max_depth].append(mapping.anchor_concept_id)

        rows_by_anchor: dict[str, list[dict]] = defaultdict(list)
        for max_depth, anchor_ids in anchors_by_depth.items():
            query, params = build_red_flag_traversal_query_batch(
                candidate_ids, anchor_ids, max_depth
            )
            for row in self._client.run_query(query, params):
                rows_by_anchor[row["anchor_id"]].append(row)
        return rows_by_anchor
```

(`__init__`/`close` are unchanged from the current file — only the imports and the two methods shown above change.)

- [ ] **Step 8: Run the full provider test file**

Run: `cd backend && python -m pytest tests/graph/test_snomed_provider.py -v`
Expected: PASS (all tests, including Task 1's sort test and Step 5's updated tests). `test_lookup_uses_per_anchor_max_depth` should also still pass unchanged — a single-mapping list still produces one batched call for that mapping's own depth.

- [ ] **Step 9: Commit**

```bash
git add backend/graph/snomed_neo4j/queries.py backend/graph/snomed_neo4j/provider.py backend/tests/graph/test_snomed_provider.py
git commit -m "fix(snomed): batch red-flag traversal by max_depth, ~154 round-trips per message down to 2 (C2)"
```

---

### Task 3: C1 — Cache the graph provider per process, close it on shutdown

`get_graph_provider()` constructs a brand-new provider — and, for `neo4j`, a brand-new `GraphDatabase.driver()` with its own connection pool — on every call. `routers/chat.py:124` constructs a fresh `LLMAgent()` (which calls `get_graph_provider()` internally) on every single chat request. Nothing ever closes the resulting driver. Fix must not break the existing eval scripts' pattern of setting `GRAPH_RAG_PROVIDER` at runtime and expecting a fresh provider for the new value (`run_track_a_retrieval.py`'s `build_provider()`) — so caching is keyed by the provider-name string, not a single unconditional singleton.

**Files:**
- Modify: `backend/graph/factory.py`
- Modify: `backend/main.py`
- Create: `backend/tests/graph/test_factory.py`

**Interfaces:**
- Produces: `close_graph_provider() -> None` — consumed by `main.py`'s `lifespan()`.
- `get_graph_provider()`'s signature and return type are unchanged — only its internal caching behavior changes.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/graph/test_factory.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from graph.base import GraphContext, GraphContextProvider
from graph import factory


class _FakeProvider(GraphContextProvider):
    """Records whether close() was called — the real Neo4jSnomedProvider isn't
    constructible without live env vars, so factory-level caching/close
    behavior is tested against a fake, not the real provider."""

    def __init__(self):
        self.closed = False

    def _lookup(self, user_message, recent_messages):
        return GraphContext(matched=False)

    def close(self):
        self.closed = True


class TestGetGraphProvider:
    def setup_method(self):
        factory._provider_cache.clear()

    def test_returns_same_instance_for_repeated_calls_with_same_provider_value(self, monkeypatch):
        monkeypatch.setenv("GRAPH_RAG_PROVIDER", "off")
        first = factory.get_graph_provider()
        second = factory.get_graph_provider()
        assert first is second

    def test_returns_a_fresh_instance_when_provider_value_changes(self, monkeypatch):
        monkeypatch.setenv("GRAPH_RAG_PROVIDER", "off")
        off_instance = factory.get_graph_provider()
        monkeypatch.setenv("GRAPH_RAG_PROVIDER", "static")
        static_instance = factory.get_graph_provider()
        assert off_instance is not static_instance


class TestCloseGraphProvider:
    def setup_method(self):
        factory._provider_cache.clear()

    def test_closes_every_cached_provider_that_supports_close(self):
        fake = _FakeProvider()
        factory._provider_cache["off"] = fake
        factory.close_graph_provider()
        assert fake.closed is True

    def test_clears_the_cache_after_closing(self):
        factory._provider_cache["off"] = _FakeProvider()
        factory.close_graph_provider()
        assert factory._provider_cache == {}

    def test_tolerates_providers_without_close(self, monkeypatch):
        monkeypatch.setenv("GRAPH_RAG_PROVIDER", "off")
        factory.get_graph_provider()  # NullGraphProvider has no close()
        factory.close_graph_provider()  # must not raise
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/graph/test_factory.py -v`
Expected: FAIL — `AttributeError: module 'graph.factory' has no attribute '_provider_cache'` / `has no attribute 'close_graph_provider'`

- [ ] **Step 3: Write minimal implementation**

Replace `backend/graph/factory.py` entirely:

```python
"""
Factory. Reads GRAPH_RAG_PROVIDER env var. Mirrors get_llm_client()
(backend/services/llm_agent.py) — deferred imports so unused provider
packages don't cause ImportError.

Providers are cached per provider-name value (not a single unconditional
singleton) — this fixes C1 (a fresh Neo4j driver/connection pool was opened
on every LLMAgent() construction, i.e. every chat request, and never closed)
while preserving the existing eval-script pattern of setting
GRAPH_RAG_PROVIDER at runtime mid-process and expecting a fresh provider for
the new value (backend/scripts/graphrag_eval/run_track_a_retrieval.py's
build_provider()). See plan: 2026-08-03-sprint19-postreview-critical-important-fixes.md, C1.
"""
import os

from graph.base import GraphContextProvider, NullGraphProvider

_provider_cache: dict[str, GraphContextProvider] = {}


def _build_provider(provider_name: str) -> GraphContextProvider:
    if provider_name == "static":
        from graph.static_provider import StaticLookupProvider
        return StaticLookupProvider()
    if provider_name == "neo4j":
        from graph.snomed_neo4j.provider import Neo4jSnomedProvider
        return Neo4jSnomedProvider()
    return NullGraphProvider()


def get_graph_provider() -> GraphContextProvider:
    provider_name = os.environ.get("GRAPH_RAG_PROVIDER", "off").lower()
    if provider_name not in _provider_cache:
        _provider_cache[provider_name] = _build_provider(provider_name)
    return _provider_cache[provider_name]


def close_graph_provider() -> None:
    """Closes every cached provider that exposes close() (today, only
    Neo4jSnomedProvider does) and clears the cache. Call once from FastAPI
    lifespan teardown (backend/main.py) — the shutdown half cache.py's
    startup-warm pattern doesn't otherwise have."""
    for provider in _provider_cache.values():
        close = getattr(provider, "close", None)
        if callable(close):
            close()
    _provider_cache.clear()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/graph/test_factory.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Wire `close_graph_provider()` into `main.py`'s lifespan shutdown**

```diff
--- a/backend/main.py
+++ b/backend/main.py
@@
 from cache import get_cached_facilities, set_cached_facilities
+from graph.factory import close_graph_provider
 from observability import init_observability, verify_metrics_token, RequestIDMiddleware, _registry
@@
 @asynccontextmanager
 async def lifespan(_app: FastAPI):
     try:
         data = get_all_facilities()
         set_cached_facilities(data)
         logger.info("cache_warm", extra={"facility_count": len(data)})
     except Exception as exc:
         logger.warning("cache_warm_failed", extra={"error_type": type(exc).__name__})
     yield
+    close_graph_provider()
```

- [ ] **Step 6: Run the full backend suite to confirm nothing else broke**

Run: `cd backend && python -m pytest tests/ -v`
Expected: PASS (existing count + 5 new + Task 1/2's changes)

- [ ] **Step 7: Commit**

```bash
git add backend/graph/factory.py backend/main.py backend/tests/graph/test_factory.py
git commit -m "fix(graph): cache graph provider per GRAPH_RAG_PROVIDER value, close on lifespan shutdown (C1)"
```

---

### Task 4: I3 — Wire the emergency output-side cross-check into the request path

`check_emergency_mismatch()` (deterministic: does the user's message contain an EMERGENCY keyword while the LLM classified below `emergent`?) is fully implemented and unit-tested, but only exists inside `backend/tests/graph/test_prompt_injection.py` — never imported by production code. Fix: move it to `services/triage_eval.py` (which already holds one deterministic post-hoc safety check, `check_facility_groundedness`, same pattern), call it from `LLMAgent._handle_triage()`, log-only — per Global Constraints, this must never override the LLM's severity classification.

**Files:**
- Modify: `backend/services/triage_eval.py`
- Modify: `backend/services/llm_agent.py`
- Modify: `backend/tests/graph/test_prompt_injection.py` — remove the duplicated definition, import from `triage_eval` instead
- Modify: `backend/tests/services/test_triage_eval.py` (create if it doesn't already exist as a separate file — `test_triage_eval.py` may currently only cover `check_facility_groundedness`)

**Interfaces:**
- Produces: `check_emergency_mismatch(user_message: str, severity: str) -> bool` — consumed by `LLMAgent._handle_triage()`.

- [ ] **Step 1: Confirm the function's current home and exact behavior**

Run: `cd backend && sed -n '60,85p' tests/graph/test_prompt_injection.py`
Expected: shows `EMERGENCY_KEYWORDS` and `check_emergency_mismatch()` exactly as currently defined — copy this verbatim into its new home, don't rewrite it (it's already reviewed, tested code; moving it is not an excuse to also change its behavior).

- [ ] **Step 2: Write the failing test in `triage_eval`'s test location**

```python
# add to backend/tests/services/test_triage_eval.py (create the file if it
# doesn't exist yet — check first: `ls backend/tests/services/`)
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from services.triage_eval import check_emergency_mismatch


class TestCheckEmergencyMismatch:
    def test_fires_when_emergency_keyword_present_but_severity_is_low(self):
        assert check_emergency_mismatch("I have chest pain", "routine") is True

    def test_does_not_fire_when_severity_matches_emergent(self):
        assert check_emergency_mismatch("I have chest pain", "emergent") is False

    def test_does_not_fire_without_an_emergency_keyword(self):
        assert check_emergency_mismatch("I have a mild headache", "routine") is False
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/test_triage_eval.py -v`
Expected: FAIL with `ImportError: cannot import name 'check_emergency_mismatch' from 'services.triage_eval'`

- [ ] **Step 4: Move the function into `triage_eval.py`**

```python
# backend/services/triage_eval.py — append (keep check_facility_groundedness above, unchanged)

# Design §9 point 4 — deterministic (no LLM judge) output-side cross-check.
# Fires if the user's message contains an EMERGENCY-tier keyword but the LLM
# classified below `emergent` — a defense-in-depth signal against a
# prompt-injection or model-error under-triage, never used to override the
# LLM's own classification (severity classification is the LLM's job,
# unconditionally — this is detection/logging only, see plan
# 2026-08-03-sprint19-postreview-critical-important-fixes.md, I3).
EMERGENCY_KEYWORDS = [
    "chest pain", "difficulty breathing", "trouble breathing", "unconscious",
    "unresponsive", "severe bleeding", "stroke", "heart attack",
    "can't breathe", "cannot breathe", "seizure", "anaphylaxis",
]


def check_emergency_mismatch(user_message: str, severity: str) -> bool:
    """Returns True (anomalous) if the message contains an EMERGENCY keyword
    but severity was classified below 'emergent'."""
    lower = user_message.lower()
    has_keyword = any(kw in lower for kw in EMERGENCY_KEYWORDS)
    return has_keyword and severity != "emergent"
```

(Copy `EMERGENCY_KEYWORDS`'s real, full list from `test_prompt_injection.py` verbatim in Step 1 — the list above is illustrative of the shape, not necessarily the exact final list; use the actual reviewed one.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/services/test_triage_eval.py -v`
Expected: PASS (3 passed)

- [ ] **Step 6: Update `test_prompt_injection.py` to import instead of redefine**

```diff
--- a/backend/tests/graph/test_prompt_injection.py
+++ b/backend/tests/graph/test_prompt_injection.py
@@
-# The EMERGENCY cross-check function (output-side validation, §9 point 4).
-# Deterministic, no LLM. Fires if user message has an EMERGENCY keyword but
-EMERGENCY_KEYWORDS = [
-    ...
-]
-
-
-def check_emergency_mismatch(user_message: str, severity: str) -> bool:
-    """Return True (anomalous) if the message contains an EMERGENCY keyword
-    ...
-    has_keyword = any(kw in lower for kw in EMERGENCY_KEYWORDS)
-    ...
+from services.triage_eval import EMERGENCY_KEYWORDS, check_emergency_mismatch
```

Run: `cd backend && python -m pytest tests/graph/test_prompt_injection.py -v`
Expected: PASS — same tests, now exercising the production copy of the function via import, not a second parallel definition.

- [ ] **Step 7: Write the failing test for wiring into `LLMAgent`**

```python
# add to backend/tests/llm/test_graph_context_integration.py or a new
# backend/tests/llm/test_emergency_mismatch_logging.py
import logging
import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from llm.base import LLMResponse
from services.llm_agent import LLMAgent


def _triage_response(severity: str) -> LLMResponse:
    import json
    return LLMResponse(
        content=None,
        tool_calls=[{
            "name": "triage_response",
            "arguments": json.dumps({
                "severity": severity, "reasoning": "test",
                "information_sufficient": True,
            }),
        }],
        finish_reason="tool_calls", model="test", usage={},
    )


class TestEmergencyMismatchLogging:
    def test_logs_mismatch_without_changing_severity(self, caplog):
        client = MagicMock()
        client.chat.side_effect = [
            _triage_response("routine"),
            LLMResponse(content="ok", tool_calls=None, finish_reason="stop", model="test", usage={}),
        ]
        agent = LLMAgent(client=client)

        with caplog.at_level(logging.WARNING, logger="services.llm_agent"):
            result = agent.respond("I have chest pain", history=[
                {"role": "user", "content": "a"}, {"role": "assistant", "content": "b"},
                {"role": "user", "content": "c"}, {"role": "assistant", "content": "d"},
            ])

        # Severity is untouched — detection never overrides classification.
        assert result["severity"] == "routine"
        mismatches = [r for r in caplog.records if r.message == "emergency_mismatch_detected"]
        assert len(mismatches) == 1
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/llm/test_emergency_mismatch_logging.py -v`
Expected: FAIL — no `emergency_mismatch_detected` log record exists yet.

- [ ] **Step 9: Wire the check into `LLMAgent._handle_triage()`**

```diff
--- a/backend/services/llm_agent.py
+++ b/backend/services/llm_agent.py
@@
-from services.triage_eval import check_facility_groundedness
+from services.triage_eval import check_emergency_mismatch, check_facility_groundedness
@@
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
+        original_user_message = next(
+            (m.content for m in reversed(messages) if m.role == "user"), ""
+        )
+        if check_emergency_mismatch(original_user_message, severity):
+            logger.warning(
+                "emergency_mismatch_detected",
+                extra={"severity": severity, "user_turns": user_turns},
+            )
         logger.info(
             "triage_called",
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/llm/test_emergency_mismatch_logging.py -v`
Expected: PASS. Then run the full suite: `cd backend && python -m pytest tests/ -v` — confirm no regressions.

- [ ] **Step 11: Commit**

```bash
git add backend/services/triage_eval.py backend/services/llm_agent.py backend/tests/services/test_triage_eval.py backend/tests/graph/test_prompt_injection.py backend/tests/llm/test_emergency_mismatch_logging.py
git commit -m "fix(triage): wire the emergency-keyword output-side cross-check into the request path, log-only (I3)"
```

---

### Task 5: I9 — `PART_OF`/`RedFlagCluster` structural scaffolding (one grounded pilot cluster)

**Scope, stated plainly:** this task builds the *mechanism* (schema, query, wiring, detection logging) using one real, grounded pilot cluster (the cardiac/dyspnea/syncope combination already used as the Phase 6 Step 2 two-turn worked example and the design doc's own example). It does **not** attempt to author full cross-symptom cluster content across the other ~150 anchors — that is real clinical-editorial work (same rigor as Task 2a's anchor-selection process: multi-round review, accredited-health-professional sign-off) and is exactly the kind of work the branch review called "too large to fix unilaterally." This task makes the previously-completely-absent mechanism real and testable; expanding cluster coverage is a separate, explicitly follow-on task.

**Design deviation, disclosed:** the original design doc (§4 point 3) proposed a *second* Cypher query following `PART_OF` after the main traversal. This plan does it in one pass instead — the batched traversal query from Task 2 is extended to also return each red flag's cluster (if any) via an `OPTIONAL MATCH`, and cluster cross-anchor detection happens in Python by grouping the already-fetched rows by `cluster_name`. Same outcome (detect when red flags from ≥2 distinct anchors share a cluster), no extra Neo4j round-trip. This is a deliberate, disclosed improvement over the design doc's literal text, matching how this same pipeline already handled other pre-implementation-vs-measured deviations (e.g. UNWIND batching in Phase 1).

**Files:**
- Modify: `backend/graph/snomed_neo4j/queries.py`
- Modify: `backend/graph/snomed_neo4j/provider.py`
- Modify: `backend/scripts/snomed_ingest/seed_red_flags.py`
- Modify: `backend/tests/graph/test_snomed_provider.py`
- Modify: `backend/tests/scripts/snomed_ingest/test_seed_red_flags.py`

**Interfaces:**
- `build_red_flag_traversal_query_batch` (Task 2) gains an `OPTIONAL MATCH` clause and a `cluster_name` return field — additive, does not change any existing caller's required fields.
- Produces: `_lookup()` logs `cross_symptom_cluster_matched` (detection only, no severity change, matching I3's restraint).

- [ ] **Step 1: Write the failing test for the extended query**

```python
# add to backend/tests/graph/test_snomed_provider.py
def test_batch_traversal_query_includes_optional_cluster_match():
    query, params = build_red_flag_traversal_query_batch(["1"], ["2"], max_depth=4)
    assert "OPTIONAL MATCH (rf)-[:PART_OF]->(cluster:RedFlagCluster)" in query
    assert "cluster.name AS cluster_name" in query
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/graph/test_snomed_provider.py -k cluster_match -v`
Expected: FAIL — no `OPTIONAL MATCH`/`cluster_name` in the current query text.

- [ ] **Step 3: Extend the batched query**

```diff
--- a/backend/graph/snomed_neo4j/queries.py
+++ b/backend/graph/snomed_neo4j/queries.py
@@ build_red_flag_traversal_query_batch
     query = (
         f"MATCH (c:SnomedConcept) "
         f"WHERE c.id IN $candidate_concept_ids "
         f"MATCH (c)-[:IS_A*0..{max_depth}]->(anchor:SnomedConcept) "
         f"WHERE anchor.id IN $anchor_concept_ids "
         f"MATCH (anchor)-[:HAS_RED_FLAG]->(rf:RedFlag)-[:ASKS]->(q:FollowupQuestion) "
+        f"OPTIONAL MATCH (rf)-[:PART_OF]->(cluster:RedFlagCluster) "
         f"RETURN DISTINCT c.id AS candidate_id, "
         f"anchor.id AS anchor_id, "
         f"rf.indicator AS indicator, "
         f"rf.ctas_level AS ctas_level, "
         f"rf.app_severity AS app_severity, "
-        f"q.text AS followup_question"
+        f"q.text AS followup_question, "
+        f"cluster.name AS cluster_name"
     )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/graph/test_snomed_provider.py -v`
Expected: PASS — including all of Task 2's tests, whose mocked rows don't include `cluster_name` and must still work (`row.get("cluster_name")` handles that, per Step 6 below).

- [ ] **Step 5: Write the failing test for cross-anchor cluster detection**

```python
# add to backend/tests/graph/test_snomed_provider.py
def test_lookup_logs_cross_symptom_cluster_when_two_anchors_share_one(mock_provider, caplog):
    import logging
    cardiac_row = {
        "candidate_id": "1", "anchor_id": "426396005", "indicator": "Chest pain sign",
        "ctas_level": 1, "app_severity": "emergent", "followup_question": "q1",
        "cluster_name": "Cardiac symptom cluster",
    }
    dyspnea_row = {
        "candidate_id": "1", "anchor_id": "267036007", "indicator": "Dyspnea sign",
        "ctas_level": 1, "app_severity": "emergent", "followup_question": "q2",
        "cluster_name": "Cardiac symptom cluster",
    }

    call_count = 0

    def side_effect(query, params):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [{"concept_id": "1"}]
        if call_count == 2:
            return [cardiac_row, dyspnea_row]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    with caplog.at_level(logging.INFO, logger="graph.snomed_neo4j.provider"):
        mock_provider.get_symptom_graph_context("chest pain and dyspnea", [])

    matches = [r for r in caplog.records if r.message == "cross_symptom_cluster_matched"]
    assert len(matches) == 1
    assert matches[0].cluster_name == "Cardiac symptom cluster"
```

- [ ] **Step 6: Run to verify it fails, then implement detection in `_lookup()`**

Run: `cd backend && python -m pytest tests/graph/test_snomed_provider.py -k cross_symptom_cluster -v`
Expected: FAIL — no such log line yet.

```diff
--- a/backend/graph/snomed_neo4j/provider.py
+++ b/backend/graph/snomed_neo4j/provider.py
@@ _lookup
         candidate_ids = [row["concept_id"] for row in concept_rows]
         rows_by_anchor = self._traverse_all_anchors(candidate_ids)
+        self._log_cross_symptom_clusters(rows_by_anchor)

         red_flags: list[RedFlagMatch] = []
@@
         red_flags.sort(key=lambda rf: rf.ctas_level)
         return GraphContext(matched=True, complaint_name=complaint_name, red_flags=red_flags)

+    def _log_cross_symptom_clusters(self, rows_by_anchor: dict[str, list[dict]]) -> None:
+        """Design §4 point 3 (disclosed deviation: single-pass, not a second
+        query — see plan I9). Detection/logging only — does not affect
+        severity classification, per the same restraint as I3."""
+        anchors_by_cluster: dict[str, set[str]] = defaultdict(set)
+        for anchor_id, rows in rows_by_anchor.items():
+            for row in rows:
+                cluster_name = row.get("cluster_name")
+                if cluster_name:
+                    anchors_by_cluster[cluster_name].add(anchor_id)
+
+        for cluster_name, anchor_ids in anchors_by_cluster.items():
+            if len(anchor_ids) >= 2:
+                logger.info(
+                    "cross_symptom_cluster_matched",
+                    extra={"cluster_name": cluster_name, "anchor_count": len(anchor_ids)},
+                )
```

Add `logger = logging.getLogger(__name__)` and `import logging` at the top of `provider.py` if not already present (it isn't, currently).

- [ ] **Step 7: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/graph/test_snomed_provider.py -v`
Expected: PASS (all tests)

- [ ] **Step 8: Seed the one pilot cluster in `seed_red_flags.py`**

Add a small, clearly-scoped pilot seeding block to `backend/scripts/snomed_ingest/seed_red_flags.py` — grounding it in the three real anchors already used by the Phase 6 Step 2 worked example (`anchor_mapping.py`: `426396005` Chest pain (cardiac features), `267036007` Dyspnea, `271594007` Syncope):

```python
# Pilot RedFlagCluster (I9) — deliberately narrow scope, see plan
# 2026-08-03-sprint19-postreview-critical-important-fixes.md, Task 5. Grounds
# design §4 point 3's cross-symptom mechanism in the same three anchors
# already used by the Phase 6 Step 2 worked example
# (test_two_turn_eval.py / research artifact Addendum 3). Expanding cluster
# coverage beyond this pilot needs the same clinical-review rigor as Task 2a
# — not done here.
PILOT_CLUSTERS = [
    {
        "cluster_name": "Cardiac symptom cluster",
        "anchor_concept_ids": ["426396005", "267036007", "271594007"],
    },
]


def seed_pilot_clusters(client) -> None:
    for cluster in PILOT_CLUSTERS:
        client.run_query(
            "MERGE (cluster:RedFlagCluster {name: $cluster_name})",
            {"cluster_name": cluster["cluster_name"]},
        )
        client.run_query(
            "MATCH (anchor:SnomedConcept)-[:HAS_RED_FLAG]->(rf:RedFlag) "
            "WHERE anchor.id IN $anchor_concept_ids "
            "MATCH (cluster:RedFlagCluster {name: $cluster_name}) "
            "MERGE (rf)-[:PART_OF]->(cluster)",
            {
                "anchor_concept_ids": cluster["anchor_concept_ids"],
                "cluster_name": cluster["cluster_name"],
            },
        )
```

(Exact integration point into `seed_red_flags.py`'s existing `main()`/CLI structure depends on that file's current shape — call `seed_pilot_clusters(client)` after the existing per-anchor red-flag seeding call, same client/session already in scope.)

- [ ] **Step 9: Write a test for the seeding function (mocked client, no live Neo4j)**

```python
# add to backend/tests/scripts/snomed_ingest/test_seed_red_flags.py
from unittest.mock import MagicMock

from scripts.snomed_ingest.seed_red_flags import seed_pilot_clusters, PILOT_CLUSTERS


def test_seed_pilot_clusters_merges_cluster_and_part_of_edges():
    client = MagicMock()
    seed_pilot_clusters(client)

    assert client.run_query.call_count == len(PILOT_CLUSTERS) * 2
    first_call_query = client.run_query.call_args_list[0][0][0]
    assert "MERGE (cluster:RedFlagCluster" in first_call_query
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/scripts/snomed_ingest/test_seed_red_flags.py -v`
Expected: PASS

- [ ] **Step 11: Live seeding run (manual, once — not part of the automated test suite)**

Run: `doppler run -- python -m scripts.snomed_ingest.seed_red_flags --seed-pilot-clusters` (exact flag name depends on the file's existing CLI — add one if it doesn't have a way to run just this step). Confirm via a read-only Cypher check: `MATCH (cluster:RedFlagCluster) RETURN cluster.name, size((cluster)<-[:PART_OF]-()) AS red_flag_count` — expect 1 cluster, `red_flag_count` matching however many red flags those 3 anchors actually have.

- [ ] **Step 12: Commit**

```bash
git add backend/graph/snomed_neo4j/queries.py backend/graph/snomed_neo4j/provider.py backend/scripts/snomed_ingest/seed_red_flags.py backend/tests/graph/test_snomed_provider.py backend/tests/scripts/snomed_ingest/test_seed_red_flags.py
git commit -m "feat(snomed): add PART_OF/RedFlagCluster mechanism with one grounded pilot cluster, detection-only (I9)"
```

---

### Task 6: I8 — Entity-linking precision test suite (bounded sample, not all ~154 anchors)

The design's Phase 3 called for `test_entity_linking_precision.py` with "one parametrized test per anchor, (a)/(b)/(c) cases per design §10" — a true-positive-within-depth case, a true-negative-outside-depth case, and a false-positive/cross-anchor-overlap regression case, per anchor. Running this against all ~154 anchors requires a live Neo4j connection per case and would be both slow and disproportionate for a first pass. Scope this to the anchors `depth_flagging.py` already identified as highest-risk (the 33/154 flagged by the IQR-based fan-out/overlap detection built in Phase 3) — reusing existing, already-computed prioritization rather than inventing new criteria or hand-picking a sample.

**Files:**
- Create: `backend/tests/graph/test_entity_linking_precision.py`

**Interfaces:**
- Consumes: `build_red_flag_traversal_query` (singular, Task 2 kept this unmodified — exactly suited to testing one anchor in isolation), `ANCHOR_MAPPINGS`, and `depth_flagging.py`'s flagged-anchor output (re-run to get the current flagged set, not a hardcoded list from an earlier run — anchors may have changed since Phase 3 shipped).

- [ ] **Step 1: Get the current flagged-anchor list (informs which anchors this suite covers)**

Run: `doppler run -- python -m scripts.snomed_ingest.depth_flagging` (or however that CLI is invoked — check its own `if __name__ == "__main__"` block) against the live graph, and record the flagged anchor IDs it prints — these become the parametrize list in Step 3. Do not hardcode a stale list from the Phase 3 build notes; re-derive it now, since anchors may have changed (Task 2a's post-Phase-3 corrections, I9's pilot cluster, etc.).

- [ ] **Step 2: Write the test structure**

```python
# backend/tests/graph/test_entity_linking_precision.py
"""
Bounded entity-linking precision/recall suite (Phase 3 / design §10), scoped
to the anchors depth_flagging.py's IQR-based fan-out/overlap detection
already flagged as highest-risk (33/154 as of the last live run) — not all
~154, which would need a live Neo4j round-trip per case and is
disproportionate for a first pass. See plan
2026-08-03-sprint19-postreview-critical-important-fixes.md, I8.

Design §10 case types, per flagged anchor:
  (a) true positive — a message using the anchor's own FSN/alias, within its
      configured max_depth, must match.
  (b) true negative — a sibling/cousin concept's message, NOT a descendant of
      this anchor, must NOT match this anchor (guards the cross-anchor
      overlap bug this same review found and fixed elsewhere in this
      pipeline).
  (c) depth-boundary — a descendant exactly at max_depth+1 hops away must NOT
      match (guards the depth bound itself, not just gross false positives).
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from graph.factory import get_graph_provider
from graph.snomed_neo4j.anchor_mapping import ANCHOR_MAPPINGS

# Populated from Step 1's live depth_flagging.py run — replace with the real
# current output, do not leave this as a placeholder list.
FLAGGED_ANCHOR_IDS = [
    # e.g. "95320005", "426396005", ...
]

FLAGGED_MAPPINGS = [m for m in ANCHOR_MAPPINGS if m.anchor_concept_id in FLAGGED_ANCHOR_IDS]


@pytest.mark.integration
class TestEntityLinkingPrecisionOnFlaggedAnchors:
    @pytest.mark.parametrize("mapping", FLAGGED_MAPPINGS, ids=lambda m: m.ctas_alias)
    def test_anchor_own_fsn_matches_within_depth(self, mapping):
        if "NEO4J_URI" not in os.environ:
            pytest.skip("NEO4J_URI not set")
        provider = get_graph_provider()
        # Use the anchor's own FSN text as the message — the simplest
        # guaranteed-true-positive case for this anchor.
        ctx = provider.get_symptom_graph_context(mapping.fsn, [])
        assert ctx.matched is True, f"{mapping.ctas_alias} ({mapping.fsn}) failed to self-match"
        assert ctx.complaint_name == mapping.ctas_alias
```

- [ ] **Step 3: Fill in `FLAGGED_ANCHOR_IDS` from Step 1's real output, run against live Neo4j**

Run: `doppler run -- python -m pytest tests/graph/test_entity_linking_precision.py -m integration -v`
Expected: PASS for every flagged anchor's self-FSN-match case. Any failure here is a real, newly-discovered precision defect — investigate and fix the anchor's mapping (per Task 2a's own established process: verify via `search_snomed.py` before changing anything), don't loosen the test to make it pass.

- [ ] **Step 4: Add the (b)/(c) case types for a representative subset (not the full flagged set — start with 3-5 anchors, expand as a follow-up)**

```python
    @pytest.mark.parametrize("mapping", FLAGGED_MAPPINGS[:5], ids=lambda m: m.ctas_alias)
    def test_unrelated_message_does_not_match(self, mapping):
        """(b) true negative: a message about an unrelated, unmatched
        complaint must not accidentally match this flagged anchor."""
        if "NEO4J_URI" not in os.environ:
            pytest.skip("NEO4J_URI not set")
        provider = get_graph_provider()
        ctx = provider.get_symptom_graph_context(
            "I want to know the visiting hours for the maternity ward", []
        )
        assert ctx.complaint_name != mapping.ctas_alias
```

- [ ] **Step 5: Commit**

```bash
git add backend/tests/graph/test_entity_linking_precision.py
git commit -m "test(snomed): add bounded entity-linking precision suite for depth_flagging-flagged anchors (I8)"
```

---

### Task 7: Verify — full suite, CI collection, CHANGELOG update

- [ ] **Step 1: Run the complete backend test suite**

Run: `cd backend && doppler run -- python -m pytest tests/ -v`
Expected: PASS. Confirm the previously-known-passing count (317 passed, 2 skipped per the last recorded ledger run) grows by exactly the tests added across Tasks 1-6, with no unexplained failures.

- [ ] **Step 2: Confirm CI collection is still clean**

Run: `cd backend && python -m pytest tests/ --collect-only`
Expected: 0 errors — this specifically guards against reintroducing the `backend.`-prefixed import bug this same pipeline already hit once (Phase 1's CI-breaking finding).

- [ ] **Step 3: Update `CHANGELOG.md`'s Sprint 19 entry**

Add a dated note recording that C1, C2, I3, I8, I9, I10 are now fixed (with the real before/after numbers from Task 2's fix — "~154 round-trips per message down to 2" — and Task 6's real flagged-anchor test pass/fail outcome), and that the remaining 7 Important findings + Minors + 3 plan-document defects from the original review are still outstanding, unrecovered, and would need either the user's own notes or a fresh review to enumerate.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): record C1/C2/I3/I8/I9/I10 fixes against Sprint 19's final review"
```

---

## Self-Review Notes

- **Coverage check:** C1 → Task 3. C2 → Task 2. I3 → Task 4. I8 → Task 6. I9 → Task 5. I10 → Task 1. I13 already resolved (CHANGELOG, prior session). All 6 recoverable findings covered; the 7 unrecoverable Important findings + Minors + plan-doc defects are explicitly out of scope, per the user's own decision, not silently dropped.
- **Ordering rationale:** I10 first (smallest, isolated), then C2 (the big provider.py refactor), then C1 (independent file, no dependency on C2), then I3 (independent), then I9 (depends on C2's batched query existing, to extend it rather than duplicate it), then I8 (benefits from I9/C2 already landed since it exercises the same `_lookup()` path), then a whole-suite Verify.
- **Regression discipline:** Task 2 explicitly updates the 2 existing tests its own refactor invalidates (`test_lookup_maps_records_to_red_flag_matches`, `test_lookup_deduplicates_repeated_indicator`) rather than leaving them red or deleting them — a refactor is not done until its own regression tests are green again.
- **Restraint on I3/I9:** neither fix changes severity classification or triage behavior — both are detection/logging only, preserving `llm_agent.py`'s existing Hard Rule. Escalation policy (what to actually do when either fires) is explicitly left as a separate, undecided follow-up, not something this plan decides unilaterally.
- **I9's scope boundary, restated:** one grounded pilot cluster (3 real anchors, already used by an existing acceptance test), not full cluster-content authoring across the anchor set — that remains a clinical-editorial task, matching Task 2a's own precedent for why this kind of work needs multi-round review, not solo authorship.
- **Placeholder scan:** `FLAGGED_ANCHOR_IDS` in Task 6 is intentionally left to be filled from a live `depth_flagging.py` run at execution time (Step 1) rather than a stale hardcoded list — this is the one deliberate "fill in with a real value from a real command, not fabricated" spot, called out explicitly, not a silent gap.
- **Type/interface consistency:** `build_red_flag_traversal_query_batch`'s return shape (Task 2, extended in Task 5) is consumed identically by `provider.py`'s `_traverse_all_anchors`; `close_graph_provider()` (Task 3) and `check_emergency_mismatch()` (Task 4) match exactly what their respective call sites (`main.py`, `llm_agent.py`) invoke.
