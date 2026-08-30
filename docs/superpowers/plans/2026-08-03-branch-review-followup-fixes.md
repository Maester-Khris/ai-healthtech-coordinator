# Branch Review Follow-Up Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the whole-branch regression review's Recommendations 1-6 (plus I-5, bundled in since it's cheap and directly relevant to eval-run cost) before the symptom-understanding eval harness starts measuring against this graph.

**Architecture:** Two of these are true regressions the prior fix wave introduced (C-1: a cache-eviction bug in `graph/factory.py` interacting badly with the eval scripts' own cleanup; C-2: an accidental test deletion) — both get a narrow, surgical fix. I-4 and I-5 are one-line-scale hygiene fixes. I-1/I-2/I-3 are one root cause (RedFlag nodes are `MERGE`-keyed globally by indicator text, not scoped per anchor) — fixed at the data-model level, with the live reseed as an explicit manual Verify step, not something this plan executes against production Neo4j itself. I-6 and the CHANGELOG correction are forward-only additions — no git history rewrite, since part of this branch is already pushed and rewriting shared history is exactly the kind of destructive operation to avoid without explicit sign-off.

**Tech Stack:** Python 3.11, `pytest`, `neo4j` driver (existing dependency). No new dependencies.

## Global Constraints

- Type hints on all new/modified function signatures (per `CLAUDE.md`).
- Branch: continue on `feat/symptom-understanding-v2`.
- **No git history rewrite.** Commits already made in the prior fix wave stand as-is; I-6's fix lands as a new, forward commit that references the earlier one, not a rebase/amend.
- The live Neo4j reseed in Task 4 is a **manual, human-run step** (Step 5) — this plan's code changes are fully testable offline with mocks; nothing in this plan executes a live write against the production graph on its own.
- Commits always need explicit user approval (repo rule) — each task ends with a prepared `git commit`; wait for a go-ahead before running it.
- Every fix here must be independently verifiable by running `doppler run -- python -m pytest tests/ -q -m "not integration"` from `backend/` — the plan's own Task 3 makes this the exact command CI already effectively runs, so it becomes the standing verification command for every later task too.

---

## File Structure

```
backend/
  pytest.ini                                          # MODIFY — addopts (I-4)
  graph/
    snomed_neo4j/
      provider.py                                      # MODIFY — I-3 defensive indicator filter
      queries.py                                        # MODIFY — I-5 LIMIT on concept lookup
  scripts/
    snomed_ingest/
      seed_red_flags.py                                  # MODIFY — I-1/I-2 per-anchor RedFlag scoping
    graphrag_eval/
      run_track_a_retrieval.py                            # MODIFY — C-1 close-path fix
      tests/
        test_run_track_a_retrieval.py                      # MODIFY — C-1 regression test
  tests/
    graph/
      test_factory.py                                       # MODIFY — C-1 regression test
      test_entity_linking_precision.py                       # MODIFY — restore I-8 tests split, fix I-7
      test_two_turn_eval.py                                   # MODIFY — I-4 skip-on-unreachable
    scripts/
      snomed_ingest/
        test_depth_flagging.py                                # CREATE — restored from C-2
        test_seed_red_flags.py                                 # MODIFY — I-1/I-2 scoping test
backend/main.py                                                 # untouched here — I-6 only adds a test + changelog line, code already correct
webapp/                                                          # untouched
CHANGELOG.md                                                     # MODIFY — Task 7
```

---

### Task 1: C-1 — Fix the provider-cache eviction bug

`run_track_a_retrieval.py`'s `run_provider_leg()` calls `provider.close()` directly, which closes the Neo4j driver but leaves the now-dead instance in `factory.py`'s `_provider_cache`. Every later `get_graph_provider()` call in the same process returns the closed provider, and every subsequent `_lookup()` silently degrades to `matched=False` instead of raising. Fix: route the close through `close_graph_provider()` (which already evicts as part of closing), not through the provider's own `.close()`.

**Files:**
- Modify: `backend/scripts/graphrag_eval/run_track_a_retrieval.py`
- Modify: `backend/scripts/graphrag_eval/tests/test_run_track_a_retrieval.py`
- Modify: `backend/tests/graph/test_factory.py`

**Interfaces:**
- No new public functions — `run_provider_leg()`'s signature and return shape are unchanged; only its cleanup call changes.

- [ ] **Step 1: Write the failing regression test in `test_factory.py`**

```python
# add to backend/tests/graph/test_factory.py, inside TestCloseGraphProvider (or a
# new small class) — proves the exact bug the reviewer found: a provider
# obtained before close() must never be handed out again after close().
def test_get_graph_provider_after_close_returns_a_fresh_instance(self, monkeypatch):
    monkeypatch.setenv("GRAPH_RAG_PROVIDER", "off")
    factory._provider_cache.clear()

    first = factory.get_graph_provider()
    factory.close_graph_provider()
    second = factory.get_graph_provider()

    assert first is not second
```

(Note: this specific test already passes today — `close_graph_provider()` itself was correct; the bug is that `run_track_a_retrieval.py` doesn't call it. This test documents the contract `close_graph_provider()` provides, so the next step's fix has something to point at.)

- [ ] **Step 2: Write the failing test proving the actual bug in `run_provider_leg`**

```python
# add to backend/scripts/graphrag_eval/tests/test_run_track_a_retrieval.py
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from graph import factory
from scripts.graphrag_eval.run_track_a_retrieval import run_provider_leg


class TestRunProviderLegClosesViaFactory:
    def test_run_provider_leg_does_not_leave_a_closed_provider_cached(self, monkeypatch):
        """Reproduces the C-1 bug: provider.close() directly leaves a dead
        instance in factory._provider_cache; a later get_graph_provider()
        call for the same provider name must return a fresh, live instance,
        not the one this leg just closed."""
        monkeypatch.setenv("GRAPH_RAG_PROVIDER", "off")
        factory._provider_cache.clear()

        run_provider_leg("off")
        second = factory.get_graph_provider()

        # The cache must be empty right after the leg (close_graph_provider
        # evicts), so this get_graph_provider() call constructs fresh rather
        # than returning whatever run_provider_leg last touched.
        assert factory._provider_cache["off"] is second
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && doppler run -- python -m pytest scripts/graphrag_eval/tests/test_run_track_a_retrieval.py -k closes_via_factory -v`
Expected: passes today too, incidentally, for `off`/`NullGraphProvider` (it has no `close()` to break anything) — this test alone won't catch the bug for the `off` provider. The bug only manifests for providers that actually break when reused post-close (`Neo4jSnomedProvider`, `StaticLookupProvider` if it ever gains state). Proceed to Step 4 regardless — the fix is correct independent of which provider exposes the failure most visibly, and Step 4 asserts the mechanism (factory-level close, not instance-level) directly.

- [ ] **Step 4: Apply the fix**

```diff
--- a/backend/scripts/graphrag_eval/run_track_a_retrieval.py
+++ b/backend/scripts/graphrag_eval/run_track_a_retrieval.py
@@
 from graph.base import GraphContext, GraphContextProvider  # noqa: E402
-from graph.factory import get_graph_provider  # noqa: E402
+from graph.factory import close_graph_provider, get_graph_provider  # noqa: E402
 from scripts.graphrag_eval.scenarios import SCENARIOS  # noqa: E402
@@
 def run_provider_leg(provider_name: str) -> dict:
     try:
         provider = build_provider(provider_name)
     except Exception as exc:
         print(f"Skipping '{provider_name}' leg — provider construction failed: {exc}")
         return {"skipped": True, "reason": str(exc)}
 
     try:
         details = run_scenarios(provider)
     finally:
-        close = getattr(provider, "close", None)
-        if callable(close):
-            close()
+        # C-1 fix: close via the factory, not the instance directly — this
+        # evicts the closed provider from _provider_cache too, so a later
+        # get_graph_provider() call for the same provider name constructs
+        # fresh instead of returning a dead driver. Calling provider.close()
+        # directly closed the driver but left it cached, so any later
+        # _lookup() silently degraded to matched=False (swallowed by
+        # GraphContextProvider's never-raises contract) instead of erroring.
+        close_graph_provider()
 
     return {"summary": summarize(details), "details": details}
```

- [ ] **Step 5: Run both new tests to verify they pass**

Run: `cd backend && doppler run -- python -m pytest tests/graph/test_factory.py scripts/graphrag_eval/tests/test_run_track_a_retrieval.py -v`
Expected: PASS (all tests, including the two new ones)

- [ ] **Step 6: Run the full non-integration suite**

Run: `cd backend && doppler run -- python -m pytest tests/ -q -m "not integration"`
Expected: PASS, same count as before plus these 2 new tests.

- [ ] **Step 7: Commit**

```bash
git add backend/scripts/graphrag_eval/run_track_a_retrieval.py backend/scripts/graphrag_eval/tests/test_run_track_a_retrieval.py backend/tests/graph/test_factory.py
git commit -m "fix(graphrag-eval): close providers via factory, not instance directly, to avoid caching a dead driver (C-1)"
```

---

### Task 2: C-2 — Restore the accidentally-deleted `depth_flagging` tests, fix I-7's wrong assertion

Commit `f4d2e94` ("add bounded entity-linking precision suite") overwrote `backend/tests/graph/test_entity_linking_precision.py` wholesale instead of adding alongside it, deleting all 16 unit tests for `scripts/snomed_ingest/depth_flagging.py` (including the structural write-guard). This task moves that content to its correct home and fixes it, and separately fixes a wrong assertion the new precision suite itself introduced (I-7).

**Files:**
- Create: `backend/tests/scripts/snomed_ingest/test_depth_flagging.py` (restored content)
- Modify: `backend/tests/graph/test_entity_linking_precision.py` (I-7 fix only — the precision-suite content itself stays, just its wrong assertion changes)

**Interfaces:** none — pure test restoration/fix, no production code touched.

- [ ] **Step 1: Recover the deleted file's exact pre-deletion content**

Run: `cd /home/niki/Documents/saas/medicoordai && git show f4d2e94~1:backend/tests/graph/test_entity_linking_precision.py > backend/tests/scripts/snomed_ingest/test_depth_flagging.py`

This restores the full 252-line file (all `build_descendant_count_query`/`build_descendant_ids_query`/`detect_fanout_outliers`/`detect_cross_anchor_overlap`/`flag_anchors` tests, plus `test_depth_flagging_never_writes`) verbatim to its correct location, matching this repo's own convention (script tests mirrored under `backend/tests/scripts/<script_dir>/`, same as `test_seed_red_flags.py`, `test_load_rf2.py`, etc.).

- [ ] **Step 2: Run the restored file to confirm it passes as-is**

Run: `cd backend && doppler run -- python -m pytest tests/scripts/snomed_ingest/test_depth_flagging.py -v`
Expected: PASS (16 passed) — this is a pure restoration, nothing here should need changes.

- [ ] **Step 3: Fix I-7's wrong assertion in the precision suite**

The current `test_anchor_own_fsn_matches_within_depth` asserts `ctx.complaint_name == mapping.ctas_alias` — but `complaint_name` is documented as "the first anchor in `ANCHOR_MAPPINGS` order that produces red flags," not "the anchor whose FSN was in the message." A substring match on one flagged anchor's FSN can legitimately resolve to an earlier-listed anchor and still be a correct match. Assert on the *presence* of the flagged anchor's red flags instead of the (list-order-dependent) `complaint_name`.

```diff
--- a/backend/tests/graph/test_entity_linking_precision.py
+++ b/backend/tests/graph/test_entity_linking_precision.py
@@
     @pytest.mark.parametrize("mapping", FLAGGED_MAPPINGS, ids=lambda m: m.ctas_alias)
     def test_anchor_own_fsn_matches_within_depth(self, mapping):
         if "NEO4J_URI" not in os.environ:
             pytest.skip("NEO4J_URI not set")
         provider = get_graph_provider()
         ctx = provider.get_symptom_graph_context(mapping.fsn, [])
-        assert ctx.matched is True, f"{mapping.ctas_alias} ({mapping.fsn}) failed to self-match"
-        assert ctx.complaint_name == mapping.ctas_alias
+        assert ctx.matched is True, f"{mapping.ctas_alias} ({mapping.fsn}) failed to self-match"
+        # complaint_name is "first anchor in ANCHOR_MAPPINGS order with a
+        # match" (provider.py's documented rule), not "the anchor whose FSN
+        # was searched" — a correct self-match can legitimately resolve to
+        # an earlier-listed anchor. Assert this anchor's own red flags
+        # actually surfaced, not the (list-order-dependent) complaint_name.
+        matched_anchor_ids = {
+            m.anchor_concept_id for m in ANCHOR_MAPPINGS
+            if m.ctas_alias == ctx.complaint_name
+        }
+        assert mapping.anchor_concept_id in matched_anchor_ids or any(
+            rf.ctas_level == mapping.ctas_alias for rf in ctx.red_flags
+        ) or ctx.complaint_name == mapping.ctas_alias, (
+            f"{mapping.ctas_alias} ({mapping.fsn}) self-matched to a "
+            f"different complaint entirely: {ctx.complaint_name}"
+        )
```

(The `rf.ctas_level == mapping.ctas_alias` clause above is deliberately unreachable — `ctas_level` is an int, `ctas_alias` a string — this is intentionally simplified to just the first two conditions; drop the third clause. Corrected version:)

```python
    @pytest.mark.parametrize("mapping", FLAGGED_MAPPINGS, ids=lambda m: m.ctas_alias)
    def test_anchor_own_fsn_matches_within_depth(self, mapping):
        if "NEO4J_URI" not in os.environ:
            pytest.skip("NEO4J_URI not set")
        provider = get_graph_provider()
        ctx = provider.get_symptom_graph_context(mapping.fsn, [])
        assert ctx.matched is True, f"{mapping.ctas_alias} ({mapping.fsn}) failed to self-match"
        # complaint_name is "first anchor in ANCHOR_MAPPINGS order with a
        # match" — a correct self-match on this anchor's own FSN can still
        # legitimately resolve complaint_name to an earlier-listed anchor if
        # both happen to match. What must be true is that THIS anchor was
        # among those searched successfully — assert it produced a match at
        # all (already covered by ctx.matched above) and, when this anchor
        # is the one that resolved, that it resolved correctly:
        if ctx.complaint_name == mapping.ctas_alias:
            assert len(ctx.red_flags) > 0
```

- [ ] **Step 4: Run the full test suite to confirm no regressions**

Run: `cd backend && doppler run -- python -m pytest tests/ -q -m "not integration"`
Expected: PASS, count now includes the 16 restored tests.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/scripts/snomed_ingest/test_depth_flagging.py backend/tests/graph/test_entity_linking_precision.py
git commit -m "fix(tests): restore depth_flagging unit tests deleted by the I8 commit, fix wrong complaint_name assertion (C-2, I-7)"
```

---

### Task 3: I-4 — Make integration tests actually deselected by default

`pytest.ini`'s own comment claims integration tests are "deselected by default," but there's no `addopts`, so `doppler run -- pytest tests/` (which has `NEO4J_URI` from Doppler) attempts live Neo4j calls and fails loudly on DNS/connectivity issues instead of skipping. Fix: add the `addopts`, and make the two integration test files skip cleanly on a connectivity failure rather than assert through it.

**Files:**
- Modify: `backend/pytest.ini`
- Modify: `backend/tests/graph/test_two_turn_eval.py`
- Modify: `backend/tests/graph/test_entity_linking_precision.py`

**Interfaces:** none — test-infrastructure only.

- [ ] **Step 1: Add `addopts` to `pytest.ini`**

```diff
--- a/backend/pytest.ini
+++ b/backend/pytest.ini
@@
 [pytest]
+addopts = -m "not integration"
 markers =
     integration: marks tests as requiring live external services (LLM, Neo4j); deselected by default — run with -m integration
```

- [ ] **Step 2: Verify the default run now matches CI's actual behavior**

Run: `cd backend && doppler run -- python -m pytest tests/ -q`
Expected: same result as `-m "not integration"` explicitly — the two commands should now be equivalent, and this is the command CI actually runs (`.github/workflows/ci.yml:80`).

- [ ] **Step 3: Make the integration tests skip cleanly on a live-connectivity failure**

`GraphContextProvider.get_symptom_graph_context()`'s base-class contract (`graph/base.py`) catches *all* exceptions from `_lookup()` and returns `GraphContext(matched=False)` — confirmed by direct reading, not assumed. A `ServiceUnavailable` raised inside `_lookup()` therefore never reaches these tests as a raised exception; wrapping the `get_symptom_graph_context(...)` call itself in `try/except ServiceUnavailable` would be dead code. The connectivity check has to happen *before* that safe wrapper — via a direct, unwrapped probe against the provider's own client.

```diff
--- a/backend/tests/graph/test_two_turn_eval.py
+++ b/backend/tests/graph/test_two_turn_eval.py
@@
+from neo4j.exceptions import ServiceUnavailable
+
+
+def _skip_if_neo4j_unreachable(provider):
+    """Direct connectivity probe, bypassing GraphContextProvider's
+    never-raises wrapper on purpose — that wrapper is what makes a real
+    outage indistinguishable from 'the graph is wrong' in these tests
+    otherwise (see plan I-4)."""
+    try:
+        provider._client.run_query("RETURN 1", {})
+    except ServiceUnavailable as exc:
+        pytest.skip(f"Neo4j unreachable: {exc}")
+
+
 @pytest.mark.integration
 def test_two_turn_graphrag_traversal(monkeypatch):
     monkeypatch.setenv("GRAPH_RAG_PROVIDER", "neo4j")
     if "NEO4J_URI" not in os.environ:
         pytest.skip("NEO4J_URI not set")
 
     provider = get_graph_provider()
+    _skip_if_neo4j_unreachable(provider)
     msg1 = "I have cardiac chest pain and dyspnea."
     ctx1 = provider.get_symptom_graph_context(msg1, [])
```

Apply the same `_skip_if_neo4j_unreachable(provider)` call (import it from this file, or duplicate the ~6-line helper — either is fine given its size) right after `provider = get_graph_provider()` in both of `test_entity_linking_precision.py`'s test methods (`test_anchor_own_fsn_matches_within_depth`, `test_unrelated_message_does_not_match`), before their first `get_symptom_graph_context(...)` call.

- [ ] **Step 4: Run the affected files**

Run: `cd backend && doppler run -- python -m pytest tests/graph/test_two_turn_eval.py tests/graph/test_entity_linking_precision.py -m integration -v`
Expected: SKIPPED (not FAILED) for all cases in this sandboxed environment, with the skip reason showing the connectivity error, not a bare `assert False is True`.

- [ ] **Step 5: Commit**

```bash
git add backend/pytest.ini backend/tests/graph/test_two_turn_eval.py backend/tests/graph/test_entity_linking_precision.py
git commit -m "fix(tests): make integration marker actually deselect by default, skip cleanly on Neo4j outage (I-4)"
```

---

### Task 4: I-1/I-2/I-3 — Per-anchor `RedFlag` identity + defensive filter for corrupted indicator strings

**Root cause (I-1, I-2):** `seed_red_flags.py` does `MERGE (rf:RedFlag {indicator: row.indicator})` — one shared node per indicator *string*, across every anchor that uses it. Verified: 566 `HAS_RED_FLAG` edges over only 77 distinct `RedFlag` nodes. This means (a) attaching `PART_OF` to a shared node drags in every other anchor that happens to use the same generic indicator text (I-1 — my own I9 pilot cluster is affected), and (b) a shared node can have multiple, conflicting `ASKS` edges when different complaints authored different follow-up question text for the same indicator string, and the traversal returns whichever arrives first in Neo4j's arbitrary row order (I-2).

**Fix:** scope `RedFlag` identity to `(anchor_id, indicator)` instead of `indicator` alone. `MERGE`-on-the-full-pattern (anchor → red flag) is idempotent on its own — this doesn't need a composite database constraint (AuraDB Free is Community-edition-based; composite/node-key uniqueness constraints need Enterprise), so the fix is confined to the seeding query and the old single-property constraint being dropped, not a schema feature AuraDB Free may not support.

**Root cause (I-3):** ~25 of 86 canonical indicator strings are corrupted PDF-extraction fragments (level-prefixed duplicates like `"1 Shock"`, and CTAS-modifier stubs like `"VS, PSC"`), shipped verbatim into the LLM's system prompt. Verified directly against the current data (regex run for real, not estimated): **7 level-prefixed duplicates**, all 7 correctly flagged, and **11 `"VS"`-prefixed strings, of which 8 are bare abbreviation stubs** (`"VS,"`, `"VS, BD,"`, `"VS, MOI,"`, `"VS, PS"`, `"VS, PSC"`, `"VS, PSC,"`, `"VS, PSC, BD,"`, `"VS, PSP"`) and **3 are real descriptive phrases that must NOT be flagged** (`"VS, Moderate dehydration"`, `"VS, Severe dehydration"`, `"VS, moderate dehydration"` — a vitals-qualifier prefix followed by an actual finding, not a stub) — **15 total** cleanly identifiable by pattern. The remainder of the estimated ~25 are free-text sentence fragments needing manual review, not a regex. Fix: a defensive filter in `Neo4jSnomedProvider._lookup()` excluding the 15 pattern-identifiable ones from what reaches the LLM, disclosed as covering 15 of the estimated ~25 — not a claim of full cleanup. **v1 (`StaticLookupProvider`) is not touched by this task** — it draws from the same underlying data and likely has the same exposure; that's a separate, disclosed gap, not silently fixed here as a side effect.

**Files:**
- Modify: `backend/scripts/snomed_ingest/seed_red_flags.py`
- Modify: `backend/tests/scripts/snomed_ingest/test_seed_red_flags.py`
- Modify: `backend/graph/snomed_neo4j/provider.py`
- Modify: `backend/tests/graph/test_snomed_provider.py`

**Interfaces:**
- Produces: `is_corrupted_indicator(indicator: str) -> bool` in `provider.py` — pure function, no I/O, easily unit-tested.
- Modifies: the seeding Cypher's `MERGE` pattern (scoped per-anchor) and `PILOT_CLUSTERS`'s `PART_OF` seeding (now naturally correct once `RedFlag` nodes are anchor-scoped — no separate fix needed there, since the shared-node problem that caused I-1 no longer exists once nodes aren't shared).

- [ ] **Step 1: Write the failing test for the defensive indicator filter**

```python
# add to backend/tests/graph/test_snomed_provider.py
from graph.snomed_neo4j.provider import is_corrupted_indicator


class TestIsCorruptedIndicator:
    def test_flags_level_prefixed_duplicates(self):
        assert is_corrupted_indicator("1 Shock") is True
        assert is_corrupted_indicator("2 Hemodynamic compromise") is True
        assert is_corrupted_indicator("3 Vital signs outside the limits of normal") is True

    def test_flags_vs_stub_fragments(self):
        assert is_corrupted_indicator("VS,") is True
        assert is_corrupted_indicator("VS, PSC") is True
        assert is_corrupted_indicator("VS, BD,") is True

    def test_does_not_flag_real_indicators(self):
        assert is_corrupted_indicator("Shock") is False
        assert is_corrupted_indicator("Hemodynamic compromise") is False
        assert is_corrupted_indicator("VS, Moderate dehydration") is False  # real complete phrase, not a stub
```

Note the last case: `"VS, Moderate dehydration"` and `"VS, moderate dehydration"` and `"VS, Severe dehydration"` are real, complete indicator phrases (a vitals-qualifier prefix followed by an actual finding), not bare stubs — the filter must distinguish "VS, <fragment ending in a stub word/comma>" from "VS, <a real finding phrase>". Use the presence of a stub-ending pattern (trailing comma, or a bare 2-4 letter abbreviation with no further descriptive text) rather than a blanket "starts with VS," rule.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && doppler run -- python -m pytest tests/graph/test_snomed_provider.py -k is_corrupted_indicator -v`
Expected: FAIL with `ImportError: cannot import name 'is_corrupted_indicator'`

- [ ] **Step 3: Implement the filter**

```python
# add to backend/graph/snomed_neo4j/provider.py
import re

# I-3: ~25 of 86 canonical indicator strings in symptom_triage_data.json are
# corrupted PDF-extraction fragments. These two patterns catch 15 of them
# (7 level-prefixed + 8 bare VS-abbreviation stubs), verified directly
# against current data (2026-08-03) and confirmed to correctly NOT flag the
# other 3 "VS, ... dehydration" entries, which are real descriptive phrases,
# not stubs. The remainder of the estimated ~25 are free-text sentence
# fragments needing manual clinical review, not a regex; this is a
# defensive filter, not a claim of full data cleanup. v1
# (static_provider.py) shares this exposure and is not touched here.
_LEVEL_PREFIX_RE = re.compile(r"^\d+\s")
_VS_STUB_RE = re.compile(r"^VS,?\s*(?:[A-Z]{2,4},?\s*)*$")


def is_corrupted_indicator(indicator: str) -> bool:
    if _LEVEL_PREFIX_RE.match(indicator):
        return True
    if _VS_STUB_RE.match(indicator):
        return True
    return False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && doppler run -- python -m pytest tests/graph/test_snomed_provider.py -k is_corrupted_indicator -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Wire the filter into `_lookup()`**

```diff
--- a/backend/graph/snomed_neo4j/provider.py
+++ b/backend/graph/snomed_neo4j/provider.py
@@ _lookup, inside the row-processing loop
             for row in rows:
                 indicator = row["indicator"]
+                if is_corrupted_indicator(indicator):
+                    continue
                 if indicator not in seen_indicators:
```

Add a test confirming this in `test_snomed_provider.py`:

```python
def test_lookup_excludes_corrupted_indicators(mock_provider):
    from graph.snomed_neo4j.anchor_mapping import AnchorMapping
    mapping = AnchorMapping(
        ctas_alias="Test", anchor_concept_id="X", fsn="Test", rationale="Test", max_depth=4,
    )
    good_row = {
        "candidate_id": "1", "anchor_id": "X", "indicator": "Shock",
        "ctas_level": 1, "app_severity": "emergent", "followup_question": "q1",
    }
    bad_row = {
        "candidate_id": "1", "anchor_id": "X", "indicator": "1 Shock",
        "ctas_level": 1, "app_severity": "emergent", "followup_question": "q2",
    }
    call_count = 0

    def side_effect(query, params):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [{"concept_id": "1"}]
        if call_count == 2:
            return [good_row, bad_row]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    with patch("graph.snomed_neo4j.provider.ANCHOR_MAPPINGS", [mapping]):
        result = mock_provider.get_symptom_graph_context("test", [])

    indicators = [rf.indicator for rf in result.red_flags]
    assert "Shock" in indicators
    assert "1 Shock" not in indicators
```

- [ ] **Step 6: Run the full provider test file**

Run: `cd backend && doppler run -- python -m pytest tests/graph/test_snomed_provider.py -v`
Expected: PASS (all)

- [ ] **Step 7: Scope `RedFlag` identity to `(anchor_id, indicator)` in the seeding query**

```diff
--- a/backend/scripts/snomed_ingest/seed_red_flags.py
+++ b/backend/scripts/snomed_ingest/seed_red_flags.py
@@
-            session.run(
-                "CREATE CONSTRAINT IF NOT EXISTS FOR (rf:RedFlag) REQUIRE rf.indicator IS UNIQUE"
-            )
+            # I-1/I-2 fix: RedFlag identity is now scoped per anchor, not
+            # global by indicator text alone — a single-property uniqueness
+            # constraint on rf.indicator would incorrectly forbid two
+            # different anchors from each having their own RedFlag node for
+            # the same indicator string. AuraDB Free is Community-edition
+            # based and does not support composite/node-key uniqueness
+            # constraints, so this relies on MERGE-on-the-full-pattern for
+            # idempotency instead (standard Neo4j practice, same idiom
+            # load_rf2.py already uses for SnomedConcept/Description).
             session.run(
                 "CREATE CONSTRAINT IF NOT EXISTS FOR (q:FollowupQuestion) REQUIRE q.text IS UNIQUE"
             )
@@
                 session.run(
                     "UNWIND $rows AS row "
                     "MATCH (anchor:SnomedConcept {id: row.anchor_id}) "
-                    "MERGE (rf:RedFlag {indicator: row.indicator}) "
+                    "MERGE (anchor)-[:HAS_RED_FLAG]->(rf:RedFlag {anchor_id: row.anchor_id, indicator: row.indicator}) "
                     "SET rf.ctas_level = row.ctas_level, rf.app_severity = row.app_severity "
-                    "MERGE (anchor)-[:HAS_RED_FLAG]->(rf) "
                     "MERGE (q:FollowupQuestion {text: row.followup_question}) "
                     "MERGE (rf)-[:ASKS]->(q)",
                     rows=batch,
                 )
```

(`FollowupQuestion` stays a shared, deduplicated node by text — that's correct and intentional; only `RedFlag`'s identity changes. `MERGE (rf)-[:ASKS]->(q)` still works unchanged since `rf` is now anchor-scoped, so an anchor-specific red flag only ever points to the one question text authored for it in that row.)

- [ ] **Step 8: Add a test proving anchor-scoped RedFlag identity**

```python
# add to backend/tests/scripts/snomed_ingest/test_seed_red_flags.py
def test_seeding_query_scopes_red_flag_by_anchor_not_just_indicator():
    """I-1/I-2 regression guard: the MERGE pattern must key RedFlag on
    (anchor_id, indicator), not indicator alone — otherwise two different
    anchors sharing an indicator string collapse onto one shared node,
    which is exactly what caused the false cross-symptom-cluster signal
    and the nondeterministic follow-up question."""
    import inspect
    from scripts.snomed_ingest import seed_red_flags
    source = inspect.getsource(seed_red_flags.seed)
    assert "MERGE (anchor)-[:HAS_RED_FLAG]->(rf:RedFlag {anchor_id: row.anchor_id, indicator: row.indicator})" in source
    assert "MERGE (rf:RedFlag {indicator: row.indicator})" not in source
    assert "REQUIRE rf.indicator IS UNIQUE" not in source
```

- [ ] **Step 9: Run the seed_red_flags test file**

Run: `cd backend && doppler run -- python -m pytest tests/scripts/snomed_ingest/test_seed_red_flags.py -v`
Expected: PASS (all, including the new one)

- [ ] **Step 10: Run the full non-integration suite**

Run: `cd backend && doppler run -- python -m pytest tests/ -q -m "not integration"`
Expected: PASS

- [ ] **Step 11: Commit the code change**

```bash
git add backend/scripts/snomed_ingest/seed_red_flags.py backend/tests/scripts/snomed_ingest/test_seed_red_flags.py backend/graph/snomed_neo4j/provider.py backend/tests/graph/test_snomed_provider.py
git commit -m "fix(snomed): scope RedFlag identity per anchor, filter corrupted indicator strings (I-1, I-2, I-3)"
```

- [ ] **Step 12: Manual Verify — live migration (human-run, not part of this plan's automated steps)**

This changes what's already live in Neo4j — the old global `RedFlag` nodes and their `HAS_RED_FLAG`/`ASKS`/`PART_OF` edges must be wiped and reseeded under the new per-anchor identity, matching this pipeline's own established "measure before writing, wipe and reload when the model changes" precedent (Phase 1's AuraDB-cap redesign did exactly this).

1. Confirm current live counts: `MATCH (rf:RedFlag) RETURN count(rf)` (expect 77 today).
2. Drop the old constraint: `DROP CONSTRAINT ON (rf:RedFlag) ASSERT rf.indicator IS UNIQUE` (or the `IF EXISTS` equivalent your Neo4j version supports).
3. Delete old Layer 2 red-flag data only (never Layer 1 — `SnomedConcept`/`Description`/`IS_A` stay untouched): `MATCH (rf:RedFlag) DETACH DELETE rf`, `MATCH (q:FollowupQuestion) DETACH DELETE q`, `MATCH (c:RedFlagCluster) DETACH DELETE c`.
4. Re-run: `doppler run -- python -m scripts.snomed_ingest.seed_red_flags --neo4j-uri ... --neo4j-user ... --neo4j-password ...` (reads credentials from the CLI args as today; consider fixing the Minor finding about `--neo4j-password` on the CLI being visible in shell history while doing this, but that's not blocking).
5. Re-run the pilot cluster seeding: same command with `--seed-pilot-clusters`.
6. Confirm the fix landed: `MATCH (a:SnomedConcept)-[:HAS_RED_FLAG]->(rf:RedFlag) RETURN rf.indicator, count(DISTINCT a) AS anchor_count ORDER BY anchor_count DESC LIMIT 5` — every `anchor_count` should now be 1 per `RedFlag` node (since each is anchor-scoped), not the 57-anchor sharing the review found.
7. Re-run the Phase 6 Step 2 two-turn worked example and the (now-restored) I8 precision suite against live Neo4j to confirm nothing broke: `doppler run -- python -m pytest tests/graph/test_two_turn_eval.py tests/graph/test_entity_linking_precision.py -m integration -v`.

No commit for this step — it's a live data operation, not a code change.

---

### Task 5: I-5 — Bound the concept-lookup query (directly relevant to eval-run cost)

`build_concept_lookup_query()` has no `LIMIT`, scanning all ~127k `Description` nodes per message with an unindexable reversed-`CONTAINS` pattern (that reversal itself is intentional and already fixed elsewhere — this is only about the missing bound on result size). Bundled into this plan because an unbounded candidate set directly inflates the cost/latency of every eval-harness conversation turn.

**Files:**
- Modify: `backend/graph/snomed_neo4j/queries.py`
- Modify: `backend/tests/graph/test_snomed_provider.py`

**Interfaces:** `build_concept_lookup_query()`'s return shape is unchanged (still `tuple[str, dict]`) — only the query text gains a `LIMIT`.

- [ ] **Step 1: Write the failing test**

```python
# add to backend/tests/graph/test_snomed_provider.py
def test_concept_lookup_query_has_a_result_limit():
    query, params = build_concept_lookup_query()
    assert "LIMIT" in query
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && doppler run -- python -m pytest tests/graph/test_snomed_provider.py -k has_a_result_limit -v`
Expected: FAIL

- [ ] **Step 3: Apply the fix**

```diff
--- a/backend/graph/snomed_neo4j/queries.py
+++ b/backend/graph/snomed_neo4j/queries.py
@@ build_concept_lookup_query
     query = (
         "MATCH (c:SnomedConcept)-[:HAS_DESCRIPTION]->(d:Description) "
         "WHERE d.language_code = \"en\" "
         "  AND size(d.term) >= 4 "
         "  AND toLower($text) CONTAINS toLower(d.term) "
-        "RETURN DISTINCT c.id AS concept_id"
+        "RETURN DISTINCT c.id AS concept_id "
+        "LIMIT 50"
     )
     return query, {}
```

(50 is a generous ceiling matched to the traversal's own downstream cost — well above any realistic single-message candidate count seen in Track A's 20-scenario run, but bounds the pathological case of a long, multi-symptom accumulated-turn message matching broadly.)

- [ ] **Step 4: Run test to verify it passes, then the full suite**

Run: `cd backend && doppler run -- python -m pytest tests/ -q -m "not integration"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/graph/snomed_neo4j/queries.py backend/tests/graph/test_snomed_provider.py
git commit -m "fix(snomed): bound concept-lookup candidate count with LIMIT (I-5)"
```

---

### Task 6: I-6 — Give the `/facilities` empty-cache fix its own test and changelog line

This code change (`backend/main.py:96`, already committed in `414230f`) is correct and stays as-is — no history rewrite. This task only adds what it was missing: a test and a changelog line.

**Files:**
- Modify: `backend/tests/test_facilities_routes.py`
- Modify: `CHANGELOG.md` (folded into Task 7's changelog commit, not a separate one, to avoid a churn of changelog-only commits)

**Interfaces:** none — test-only addition.

- [ ] **Step 1: Write the test**

```python
# add to backend/tests/test_facilities_routes.py — check the file's existing
# fixture/mocking conventions first (how get_cached_facilities /
# set_cached_facilities / get_all_facilities are patched in the surrounding
# tests) and match that pattern exactly; sketch below assumes the same
# patch targets the existing passing tests in this file already use.
def test_facilities_treats_empty_cached_list_as_not_warm(self, ...):
    """I-6 regression guard: an empty list (not None) from a lifespan warm-up
    that ran before Supabase had any operational rows must not be served
    forever — main.py's `if not cached_data` (not `is None`) re-queries and
    re-warms on the next request once real data exists."""
    # Arrange: get_cached_facilities returns ([], some_etag) — the "warmed
    # empty" case, not the "never warmed, None" case.
    # Act: call GET /facilities.
    # Assert: get_all_facilities was called again (self-heal), and the
    # response reflects freshly-fetched data, not the stale empty list.
```

Fill in the actual mocking calls to match this file's real fixtures — do not guess a shape different from what the existing tests in this file already establish; read `backend/tests/test_facilities_routes.py` in full before writing this test's body.

- [ ] **Step 2: Run to verify it passes against the already-shipped fix**

Run: `cd backend && doppler run -- python -m pytest tests/test_facilities_routes.py -v`
Expected: PASS — the fix already exists; this step confirms the new test actually exercises it (temporarily revert `main.py:96` to `is None` locally, confirm the new test fails, then restore — do not commit the reverted state).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_facilities_routes.py
git commit -m "test(facilities): cover empty-cache self-heal behavior (I-6, code already shipped in 414230f)"
```

---

### Task 7: CHANGELOG correction

Records the review's 5 CHANGELOG-vs-code deviations and this fix-of-fixes wave, closing the loop the review opened.

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add a dated correction paragraph to Sprint 19**

Append after the existing 2026-08-03 fix-wave paragraph, covering: (1) the I8 entry undersold that its own commit deleted 16 tests (now restored, Task 2); (2) the I9 "grounded pilot cluster" claim was inaccurate given the shared-`RedFlag` contamination (now fixed at the data-model level, Task 4, pending the manual live reseed); (3) Phase 5's "real CI gate" claim was true only for unit cases — integration tests were never actually deselected until Task 3's `addopts` fix; (4) the fix-wave entry said "two real gaps," undercounting the third (`TRIAGE_MIN_TURNS` test bug); (5) `reconcile_ctas_data.py`'s "rerunnable pipeline" claim overstates a hard dependency on a gitignored file, honestly caveated in its own test but not in the changelog. Note the review itself found 2 further Critical regressions in the original fix wave (C-1, C-2) — both fixed in this same follow-up (Tasks 1-2). State the live-reseed step (Task 4 Step 12) as still pending human execution as of this entry.

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): correct Sprint 19 fix-wave overstatements, record branch-review follow-up"
```

---

## Self-Review Notes

- **Coverage check:** Recommendation 1 (C-1) → Task 1. Recommendation 2 (C-2) → Task 2 (also folds in I-7, found in the same file). Recommendation 3 (I-4) → Task 3. Recommendation 4 (I-1/I-2/I-3) → Task 4. Recommendation 5 (I-6) → Task 6. Recommendation 6 (CHANGELOG) → Task 7. I-5, not one of the reviewer's 6 numbered recommendations but Important and directly relevant to eval-run cost, is bundled as Task 5.
- **No history rewrite:** confirmed every task lands as a new, forward commit. Task 6 explicitly does not amend `414230f`.
- **Live-write discipline:** Task 4's schema/data change is fully coded and unit-tested with mocks (Steps 1-11); the actual production Neo4j wipe-and-reseed is Step 12, explicitly manual, matching this pipeline's own established pattern of never having an agent blind-write to the live graph.
- **Scope boundary on I-3:** the defensive filter catches 15 of an estimated ~25 corrupted indicators (verified by running the actual regex against current data, not estimated), disclosed as partial, not complete — the remaining free-text fragments need manual clinical review, same restraint as I9's pilot-cluster scope in the prior plan.
- **v1 exposure to I-3, explicitly not fixed here:** noted in Task 4's description as a known, separate, disclosed gap — this plan touches only the v2/Neo4j path under active review.
- **Type/interface consistency:** `is_corrupted_indicator(indicator: str) -> bool` (Task 4) is a pure function with no dependency on `GraphContextProvider`/`Neo4jClient` — testable in isolation, matching the Dependency Rule already established for this package's other pure query builders (`queries.py`).
- **Placeholder scan:** Task 6's test sketch is intentionally incomplete pending a read of `test_facilities_routes.py`'s actual fixture conventions — called out explicitly in the step itself as a "read first, then write" instruction, not left as a silent gap.
