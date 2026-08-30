# V1/V2 Retrieval Eval Fairness — Design & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the shared "first-match-wins, no specificity ranking" defect
in both retrieval providers, then build the missing design+plan-grade
Track A/B regression-eval capability (vocabulary-neutral scenarios,
split recall/selection scoring, a real Track B transcript generator, and
relational scenarios) so v1 and v2 can be compared fairly, per
`artifacts/2026-08-05-v1-v2-retrieval-eval-fairness-gap-analysis.md`.

**Architecture:** No new services or dependencies. Two production-code
fixes (`graph/static_provider.py`, `graph/snomed_neo4j/provider.py` +
`queries.py`) get a shared "rank candidates by specificity, expose all of
them for introspection" shape. The eval side (`backend/scripts/
graphrag_eval/`) gets a new vocabulary-neutral scenario set, a split
Recall@k/selection-accuracy scoring pair, a new in-process transcript
generator for Track B (reusing `scripts.symptom_eval.system_under_test.
LiveLLMAgentAdapter` — no deployed backend, no HTTP, matching the
in-process pattern the symptom-understanding eval already established),
new relational scenarios exercising the `PART_OF`/`RedFlagCluster`
structure, and a combined Track A+B report.

**Tech Stack:** Python 3.11, pytest, DeepEval (already a dependency, Track
B only), Neo4j (already a dependency). No new packages.

## Global Constraints

- Type hints on all new function signatures (per `CLAUDE.md`).
- No new Python dependencies — everything here uses stdlib + already-installed `deepeval`/`pytest`/`neo4j`.
- Branch: continue on `feat/graphrag-eval-track-ab` (already cut from `feat/symptom-understanding-v2`).
- Commits always need explicit user approval (repo rule) — each task ends with a prepared `git commit`; wait for a go-ahead before running it.
- Tasks 1-2 touch production request-path code (`graph/static_provider.py`, `graph/snomed_neo4j/provider.py`, `graph/snomed_neo4j/queries.py`) — after each of these tasks, the full backend suite (`doppler run -- pytest -m "not integration"`) must stay green, not just the new tests.
- Task 6 and the live-Neo4j leg of Task 7's test make real API/DB calls (Groq, Claude, OpenAI, Neo4j) — never run without explicit go-ahead, same rule this repo has applied to every real-cost step so far.
- `backend/scripts/graphrag_eval/transcripts/` and `results/` stay gitignored (existing convention) — nothing this plan writes there gets committed.

---

## File Structure

```
backend/
  graph/
    static_provider.py                       # MODIFY — Task 1
    snomed_neo4j/
      provider.py                             # MODIFY — Task 2
      queries.py                              # MODIFY — Task 2
  tests/graph/
    test_static_provider.py                   # MODIFY — Task 1
    test_snomed_provider.py                   # MODIFY — Task 2
  scripts/graphrag_eval/
    scenarios.py                              # MODIFY — Task 3
    run_track_a_retrieval.py                  # MODIFY — Tasks 3, 4
    generate_track_b_transcripts.py           # CREATE — Task 5
    combined_report.py                        # CREATE — Task 8
    tests/
      test_scenarios.py                       # MODIFY — Task 3
      test_run_track_a_retrieval.py           # MODIFY — Tasks 3, 4
      test_generate_track_b_transcripts.py    # CREATE — Task 5
      test_cluster_scenarios.py               # CREATE — Task 7
      test_combined_report.py                 # CREATE — Task 8
```

---

## Part A — Step 1: Shared ranking fix (both providers)

### Task 1: v1 — longest-match ranking in `StaticLookupProvider`

**Files:**
- Modify: `backend/graph/static_provider.py`
- Modify: `backend/tests/graph/test_static_provider.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `StaticLookupProvider.debug_all_matches(text: str) -> list[str]` — consumed by Task 4's Recall@k scoring.

- [ ] **Step 1: Write the failing tests**

```python
# Add to backend/tests/graph/test_static_provider.py

def test_match_entry_prefers_longest_alias_not_first_inserted(tmp_path):
    """Task 1 fix regression test: 'cough' is inserted BEFORE 'coughing up
    water' in the fixture, so the pre-fix first-match-wins behavior would
    return 'Complaint Short'. The fix must return the more specific,
    longer-alias match instead — see docs/superpowers/plans/
    2026-08-05-v1-v2-retrieval-eval-fairness.md Task 1."""
    fixture = [
        {"nacrs_code": "900", "name": "Complaint Short", "aliases": ["cough"], "red_flags": []},
        {"nacrs_code": "901", "name": "Complaint Long", "aliases": ["coughing up water"], "red_flags": []},
    ]
    data_path = tmp_path / "symptom_triage_data.json"
    data_path.write_text(json.dumps(fixture))
    provider = StaticLookupProvider(data_path=data_path)

    result = provider.get_symptom_graph_context(
        "my son is coughing up water and I am worried", []
    )

    assert result.complaint_name == "Complaint Long"


def test_debug_all_matches_returns_every_matching_complaint(tmp_path):
    """New eval-only method exposes every matching complaint, not just the
    one _match_entry() selects as most specific."""
    fixture = [
        {"nacrs_code": "900", "name": "Complaint Short", "aliases": ["cough"], "red_flags": []},
        {"nacrs_code": "901", "name": "Complaint Long", "aliases": ["coughing up water"], "red_flags": []},
    ]
    data_path = tmp_path / "symptom_triage_data.json"
    data_path.write_text(json.dumps(fixture))
    provider = StaticLookupProvider(data_path=data_path)

    matches = provider.debug_all_matches("my son is coughing up water and I am worried")

    assert set(matches) == {"Complaint Short", "Complaint Long"}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/graph/test_static_provider.py -v`
Expected: `test_match_entry_prefers_longest_alias_not_first_inserted` FAILS with `assert 'Complaint Short' == 'Complaint Long'` (proves the bug is real, not already fixed). `test_debug_all_matches_returns_every_matching_complaint` FAILS with `AttributeError: 'StaticLookupProvider' object has no attribute 'debug_all_matches'`.

- [ ] **Step 3: Write the fix**

```python
# backend/graph/static_provider.py — replace _match_entry, add
# _find_all_matches and debug_all_matches. _lookup() is unchanged.

    def _find_all_matches(self, text: str) -> list[tuple[str, dict]]:
        """All (alias, entry) pairs whose alias is a substring of the
        normalized text — not just the first one found. Iteration order
        still follows self._alias_index (dict insertion order = JSON file
        order), but this returns every match instead of stopping at the
        first, so the caller can rank by specificity (longest alias)
        instead of accepting whichever happened to be inserted first."""
        normalized = _normalize(text)
        return [
            (alias, entry)
            for alias, entry in self._alias_index.items()
            if len(alias) >= 4 and alias in normalized
        ]

    def _match_entry(self, text: str) -> dict | None:
        """Longest-alias-wins: the most specific matching alias is
        returned, not whichever happened to be inserted first into
        self._alias_index (fixed 2026-08-05 — see docs/superpowers/plans/
        2026-08-05-v1-v2-retrieval-eval-fairness.md Task 1). Ties
        (equal-length aliases) preserve the original insertion-order
        tie-break, since max() with a key= returns the first maximal
        element it encounters while iterating in order."""
        matches = self._find_all_matches(text)
        if not matches:
            return None
        return max(matches, key=lambda pair: len(pair[0]))[1]

    def debug_all_matches(self, text: str) -> list[str]:
        """Eval-only introspection for Track A's Recall@k metric (backend/
        scripts/graphrag_eval/run_track_a_retrieval.py): every complaint
        name whose alias matched, not just the one _match_entry() selected
        as most specific. Never called from the request path — LLMAgent
        only calls get_symptom_graph_context()."""
        return [entry["name"] for _, entry in self._find_all_matches(text)]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/graph/test_static_provider.py -v`
Expected: PASS (6 passed — 4 existing + 2 new)

- [ ] **Step 5: Run the full backend suite (production code changed)**

Run: `cd backend && doppler run -- python -m pytest -m "not integration" -q`
Expected: all passing, same count as before this task plus the 2 new tests — this touches request-path code, so nothing else may regress.

- [ ] **Step 6: Commit**

```bash
git add backend/graph/static_provider.py backend/tests/graph/test_static_provider.py
git commit -m "fix(graph): rank v1 matches by specificity instead of insertion order"
```

---

### Task 2: v2 — specificity-ranked complaint selection in `Neo4jSnomedProvider`

**Files:**
- Modify: `backend/graph/snomed_neo4j/queries.py`
- Modify: `backend/graph/snomed_neo4j/provider.py`
- Modify: `backend/tests/graph/test_snomed_provider.py`

**Interfaces:**
- Consumes: `AnchorMapping` (existing, `graph.snomed_neo4j.anchor_mapping`).
- Produces: `Neo4jSnomedProvider.debug_all_matches(text: str) -> list[str]` — consumed by Task 4's Recall@k scoring. `build_concept_lookup_query()`'s returned rows now carry `matched_length` in addition to `concept_id`.

- [ ] **Step 1: Patch the 8 existing mocked concept-lookup rows to carry the new field**

The existing tests mock `self._client.run_query` with bare `{"concept_id": "..."}` rows for the concept-lookup call. Once Step 3 below reads `row["matched_length"]`, those mocks need the field present (any value works — these tests don't test ranking, just need the key to exist). Run this from `backend/`:

```bash
sed -i 's/{"concept_id": "\([^"]*\)"}/{"concept_id": "\1", "matched_length": 20}/g' tests/graph/test_snomed_provider.py
```

Verify exactly 8 lines changed and nothing else broke the file's syntax:

```bash
git diff --stat tests/graph/test_snomed_provider.py
python -m py_compile tests/graph/test_snomed_provider.py
```

- [ ] **Step 2: Write the new failing tests**

```python
# Add to backend/tests/graph/test_snomed_provider.py

def test_concept_lookup_query_returns_matched_length_ordered_by_specificity():
    """Task 2 fix: the query must return matched_length per concept and
    order candidates by it, so provider.py can rank anchors by specificity
    instead of picking whichever comes first in ANCHOR_MAPPINGS order."""
    query, params = build_concept_lookup_query()
    assert "matched_length" in query
    assert "ORDER BY matched_length DESC" in query


def test_lookup_prefers_most_specific_match_over_list_order(mock_provider):
    """Task 2 fix regression test: two anchors both have surviving
    red-flag rows. Anchor A comes FIRST in ANCHOR_MAPPINGS order but its
    matched concept only hit on a short/generic term (matched_length=5).
    Anchor B comes SECOND but matched on a much longer, more specific term
    (matched_length=18). The pre-fix behavior picked whichever came first
    in ANCHOR_MAPPINGS order (Anchor A) regardless of specificity. The fix
    must pick Anchor B."""
    from graph.snomed_neo4j.anchor_mapping import AnchorMapping

    anchor_a = AnchorMapping(
        ctas_alias="Generic Complaint A", anchor_concept_id="100",
        fsn="A (finding)", rationale="test", max_depth=4,
    )
    anchor_b = AnchorMapping(
        ctas_alias="Specific Complaint B", anchor_concept_id="200",
        fsn="B (finding)", rationale="test", max_depth=4,
    )

    call_count = 0

    def side_effect(query, params):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [
                {"concept_id": "candidate-short", "matched_length": 5},
                {"concept_id": "candidate-long", "matched_length": 18},
            ]
        if call_count == 2:
            return [
                {"candidate_id": "candidate-short", "anchor_id": "100",
                 "indicator": "Flag A", "ctas_level": 3, "app_severity": "urgent",
                 "followup_question": "Q A?"},
                {"candidate_id": "candidate-long", "anchor_id": "200",
                 "indicator": "Flag B", "ctas_level": 3, "app_severity": "urgent",
                 "followup_question": "Q B?"},
            ]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    with patch("graph.snomed_neo4j.provider.ANCHOR_MAPPINGS", [anchor_a, anchor_b]):
        result = mock_provider.get_symptom_graph_context("some text", [])

    assert result.matched is True
    assert result.complaint_name == "Specific Complaint B"


def test_debug_all_matches_returns_every_surviving_complaint(mock_provider):
    """New eval-only method: exposes ALL complaints with surviving red
    flags, not just the one _lookup() selects as most specific. Same
    fixture shape as the ranking test above — both anchors survive, so
    debug_all_matches must return both, in ANCHOR_MAPPINGS order."""
    from graph.snomed_neo4j.anchor_mapping import AnchorMapping

    anchor_a = AnchorMapping(
        ctas_alias="Generic Complaint A", anchor_concept_id="100",
        fsn="A (finding)", rationale="test", max_depth=4,
    )
    anchor_b = AnchorMapping(
        ctas_alias="Specific Complaint B", anchor_concept_id="200",
        fsn="B (finding)", rationale="test", max_depth=4,
    )

    call_count = 0

    def side_effect(query, params):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [
                {"concept_id": "candidate-short", "matched_length": 5},
                {"concept_id": "candidate-long", "matched_length": 18},
            ]
        if call_count == 2:
            return [
                {"candidate_id": "candidate-short", "anchor_id": "100",
                 "indicator": "Flag A", "ctas_level": 3, "app_severity": "urgent",
                 "followup_question": "Q A?"},
                {"candidate_id": "candidate-long", "anchor_id": "200",
                 "indicator": "Flag B", "ctas_level": 3, "app_severity": "urgent",
                 "followup_question": "Q B?"},
            ]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    with patch("graph.snomed_neo4j.provider.ANCHOR_MAPPINGS", [anchor_a, anchor_b]):
        matches = mock_provider.debug_all_matches("some text")

    assert matches == ["Generic Complaint A", "Specific Complaint B"]
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `cd backend && python -m pytest tests/graph/test_snomed_provider.py -v`
Expected: `test_concept_lookup_query_returns_matched_length_ordered_by_specificity` FAILS (`matched_length` not in query). `test_lookup_prefers_most_specific_match_over_list_order` FAILS with `complaint_name == 'Generic Complaint A'` (proves the pre-fix behavior). `test_debug_all_matches_returns_every_surviving_complaint` FAILS with `AttributeError`.

- [ ] **Step 4: Write the fix**

```python
# backend/graph/snomed_neo4j/queries.py — replace build_concept_lookup_query

def build_concept_lookup_query() -> tuple[str, dict]:
    """Build the text → SnomedConcept ID lookup query.

    Finds all SnomedConcept nodes whose English Description.term contains
    the search text (case-insensitive substring). Filters by language_code="en"
    on the Description node — NOT by c.fsn — because c.fsn is last-write-wins
    across EN and FR in the Canadian Edition RF2 release (can be French).
    See deployment reference §Known Limitations §1.

    Also returns matched_length — the longest matching Description.term's
    character length for that concept — so provider.py can rank candidate
    anchors by specificity instead of picking whichever comes first in
    ANCHOR_MAPPINGS's static order regardless of match quality (fixed
    2026-08-05, see docs/superpowers/plans/
    2026-08-05-v1-v2-retrieval-eval-fairness.md Task 2).

    Returns a (query, params_template) tuple; caller sets params["text"] at
    call time.
    """
    query = (
        "MATCH (c:SnomedConcept)-[:HAS_DESCRIPTION]->(d:Description) "
        "WHERE d.language_code = \"en\" "
        "  AND size(d.term) >= 4 "
        "  AND toLower($text) CONTAINS toLower(d.term) "
        "RETURN c.id AS concept_id, max(size(d.term)) AS matched_length "
        "ORDER BY matched_length DESC "
        "LIMIT 50"
    )
    return query, {}
```

```python
# backend/graph/snomed_neo4j/provider.py — replace _lookup, add
# _resolve_surviving_mappings and debug_all_matches. _traverse_all_anchors
# and _log_cross_symptom_clusters are unchanged.

    def _resolve_surviving_mappings(
        self, all_text: str
    ) -> list[tuple]:
        """Shared by _lookup() and debug_all_matches(): every
        ANCHOR_MAPPINGS entry with surviving (non-corrupted) red-flag
        rows, each paired with its specificity score (the longest matched
        Description.term length among the candidate concepts that
        traversed to it) and its rows. Iteration follows ANCHOR_MAPPINGS
        order, which also becomes the tie-break when two anchors share the
        same specificity score (fixed 2026-08-05 — see docs/superpowers/
        plans/2026-08-05-v1-v2-retrieval-eval-fairness.md Task 2;
        previously this picked the first anchor in list order regardless
        of specificity)."""
        lookup_query, lookup_params = build_concept_lookup_query()
        lookup_params = {**lookup_params, "text": all_text}
        concept_rows = self._client.run_query(lookup_query, lookup_params)
        if not concept_rows:
            return []

        candidate_ids = [row["concept_id"] for row in concept_rows]
        candidate_specificity = {
            row["concept_id"]: row["matched_length"] for row in concept_rows
        }
        rows_by_anchor = self._traverse_all_anchors(candidate_ids)
        self._log_cross_symptom_clusters(rows_by_anchor)

        surviving = []
        for mapping in ANCHOR_MAPPINGS:
            rows = rows_by_anchor.get(mapping.anchor_concept_id, [])
            rows = [row for row in rows if not is_corrupted_indicator(row["indicator"])]
            if not rows:
                continue
            specificity = max(candidate_specificity.get(row["candidate_id"], 0) for row in rows)
            surviving.append((mapping, specificity, rows))
        return surviving

    def _lookup(self, user_message: str, recent_messages: list[str]) -> GraphContext:
        all_text = " ".join([user_message, *recent_messages]).strip()
        surviving = self._resolve_surviving_mappings(all_text)
        if not surviving:
            return GraphContext(matched=False)

        # Task 2 fix: most specific (longest matched term) anchor wins,
        # not whichever comes first in ANCHOR_MAPPINGS's static order.
        # max() with key= returns the first maximal element while
        # iterating in order, so ties still preserve the original
        # ANCHOR_MAPPINGS-order tie-break.
        best_mapping, _, _ = max(surviving, key=lambda triple: triple[1])
        complaint_name = best_mapping.ctas_alias

        red_flags: list[RedFlagMatch] = []
        seen_indicators: set[str] = set()
        for _, _, rows in surviving:
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

    def debug_all_matches(self, text: str) -> list[str]:
        """Eval-only introspection for Track A's Recall@k metric (backend/
        scripts/graphrag_eval/run_track_a_retrieval.py): every complaint
        (ctas_alias) with any surviving red-flag rows, not just the one
        _lookup() selects as most specific. Never called from the request
        path — LLMAgent only calls get_symptom_graph_context()."""
        surviving = self._resolve_surviving_mappings(text)
        return [mapping.ctas_alias for mapping, _, _ in surviving]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/graph/test_snomed_provider.py -v`
Expected: all passing (existing tests + 3 new ones).

- [ ] **Step 6: Run the full backend suite (production code changed)**

Run: `cd backend && doppler run -- python -m pytest -m "not integration" -q`
Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add backend/graph/snomed_neo4j/queries.py backend/graph/snomed_neo4j/provider.py backend/tests/graph/test_snomed_provider.py
git commit -m "fix(graph): rank v2 anchor selection by match specificity, not list order"
```

---

## Part B — Step 2: Vocabulary-neutral scenario subset

### Task 3: `LAY_SCENARIOS` + `run_track_a_retrieval.py --scenario-set`

**Files:**
- Modify: `backend/scripts/graphrag_eval/scenarios.py`
- Modify: `backend/scripts/graphrag_eval/run_track_a_retrieval.py`
- Modify: `backend/scripts/graphrag_eval/tests/test_scenarios.py`
- Modify: `backend/scripts/graphrag_eval/tests/test_run_track_a_retrieval.py`

**Interfaces:**
- Produces: `LAY_SCENARIOS: list[dict]` (same shape as `SCENARIOS`) — consumed by `run_track_a_retrieval.py`'s new `--scenario-set lay` flag and by Task 8's combined report (`track_a_lay_results_*.json`).

- [ ] **Step 1: Write the failing tests**

```python
# Add to backend/scripts/graphrag_eval/tests/test_scenarios.py
# (import LAY_SCENARIOS, verified_intersection, _entries_by_name alongside
# whatever this file already imports from scripts.graphrag_eval.scenarios)

def test_lay_scenarios_avoid_every_v1_alias_and_name_substring():
    """Task 3: a vocabulary-neutral scenario subset, per scenarios.py's own
    disclosed-bias note and docs/superpowers/plans/
    2026-08-05-v1-v2-retrieval-eval-fairness.md Step 2. Don't hand-pick and
    hope: assert programmatically, the same way verified_intersection()
    already does for the main SCENARIOS list, that no LAY_SCENARIOS message
    contains any v1 alias or complaint name as a substring — using the
    exact normalization StaticLookupProvider itself uses, so this test
    fails the moment a lay scenario accidentally reuses v1's own
    vocabulary. If this fails against the real data, rephrase the
    offending scenario until it passes — that's the intended guard, not a
    bug in the test."""
    from graph.static_provider import _normalize

    entries = _entries_by_name()
    all_terms = set()
    for entry in entries.values():
        all_terms.add(entry["name"])
        all_terms.update(entry.get("aliases", []))

    for scenario in LAY_SCENARIOS:
        normalized_message = _normalize(scenario["message"])
        for term in all_terms:
            normalized_term = _normalize(term)
            if len(normalized_term) >= 4 and normalized_term in normalized_message:
                pytest.fail(
                    f"Lay scenario {scenario['message']!r} contains v1 term "
                    f"{term!r} — defeats the purpose of a vocabulary-neutral subset"
                )


def test_lay_scenarios_expected_complaints_are_in_verified_intersection():
    """Same ground-truth-identity-space guarantee as the main SCENARIOS
    list — see verified_intersection()'s own docstring."""
    intersection = verified_intersection()
    for scenario in LAY_SCENARIOS:
        assert scenario["expected_complaint"] in intersection
```

```python
# Add to backend/scripts/graphrag_eval/tests/test_run_track_a_retrieval.py

class TestScenarioSetSelection:
    def test_lay_scenario_set_writes_to_a_distinct_results_prefix(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            "scripts.graphrag_eval.run_track_a_retrieval.RESULTS_DIR", str(tmp_path)
        )
        path = write_results({}, filename_prefix="track_a_lay_results")
        assert os.path.basename(path).startswith("track_a_lay_results_")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest scripts/graphrag_eval/tests/test_scenarios.py scripts/graphrag_eval/tests/test_run_track_a_retrieval.py -v`
Expected: `test_lay_scenarios_*` FAIL with `ImportError`/`NameError: name 'LAY_SCENARIOS' is not defined`. `test_lay_scenario_set_writes_to_a_distinct_results_prefix` FAILS with `TypeError: write_results() got an unexpected keyword argument 'filename_prefix'`.

- [ ] **Step 3: Write the implementation**

```python
# Add to backend/scripts/graphrag_eval/scenarios.py, after SCENARIOS

# Vocabulary-neutral subset (Task 3, Step 2 of docs/superpowers/plans/
# 2026-08-05-v1-v2-retrieval-eval-fairness.md): every message here is
# rewritten to deliberately avoid every v1 alias/name substring in
# symptom_triage_data.json — verified programmatically, not by hand, in
# tests/test_scenarios.py::test_lay_scenarios_avoid_every_v1_alias_and_name_substring.
# This isolates a genuine retrieval-quality difference from the
# vocabulary-calibration bias the main SCENARIOS list discloses above.
LAY_SCENARIOS: list[dict] = [
    {
        "message": "There's an elephant sitting on my chest and my left arm feels heavy and tingly.",
        "expected_complaint": "Chest pain (cardiac features)",
    },
    {
        "message": "I got up too fast and everything went black for a second before I hit the floor.",
        "expected_complaint": "Syncope / Pre-syncope",
    },
    {
        "message": "It feels like swallowing broken glass every time I try to eat.",
        "expected_complaint": "Sore throat",
    },
    {
        "message": "Blood keeps dripping out of my nose no matter how long I pinch it.",
        "expected_complaint": "Epistaxis",
    },
    {
        "message": "My little boy's lips went blue after he went under in the bathtub and he will not stop hacking.",
        "expected_complaint": "Near Drowning",
    },
    {
        "message": "It stings like fire every single time I use the bathroom.",
        "expected_complaint": "UTI complaints",
    },
    {
        "message": "I have not gone to the bathroom in five days and my belly feels rock hard.",
        "expected_complaint": "Constipation",
    },
    {
        "message": "My urine came out pink today and it scared me.",
        "expected_complaint": "Hematuria",
    },
    {
        "message": "I cannot keep anything down, everything comes right back up within minutes.",
        "expected_complaint": "Vomiting and/or nausea",
    },
    {
        "message": "My skin and the whites of my eyes turned a strange yellow color overnight.",
        "expected_complaint": "Jaundice",
    },
]
```

```python
# backend/scripts/graphrag_eval/run_track_a_retrieval.py changes:
# 1. import LAY_SCENARIOS alongside SCENARIOS
# 2. write_results gains filename_prefix param
# 3. run_provider_leg gains an optional scenarios param, passed through to run_scenarios
# 4. main() gains --scenario-set

from scripts.graphrag_eval.scenarios import LAY_SCENARIOS, SCENARIOS  # noqa: E402


def write_results(results: dict, filename_prefix: str = "track_a_results") -> str:
    os.makedirs(RESULTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(RESULTS_DIR, f"{filename_prefix}_{stamp}.json")
    with open(path, "w") as f:
        json.dump(results, f, indent=2)
    return path


def run_provider_leg(provider_name: str, scenarios: list[dict] | None = None) -> dict:
    try:
        provider = build_provider(provider_name)
    except Exception as exc:
        print(f"Skipping '{provider_name}' leg — provider construction failed: {exc}")
        return {"skipped": True, "reason": str(exc)}

    try:
        details = run_scenarios(provider, scenarios)
    finally:
        close_graph_provider()

    return {"summary": summarize(details), "details": details}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--provider", choices=["static", "neo4j", "both"], default="both",
        help="Which provider leg(s) to run (default: both)",
    )
    parser.add_argument(
        "--scenario-set", choices=["main", "lay"], default="main",
        help="'main' = original vocabulary-calibrated-to-v1 set (SCENARIOS); "
             "'lay' = vocabulary-neutral set (LAY_SCENARIOS, avoids every v1 "
             "alias/name substring) — see scenarios.py's disclosed-bias note.",
    )
    args = parser.parse_args()

    names = list(PROVIDER_NAMES) if args.provider == "both" else [args.provider]
    scenarios = LAY_SCENARIOS if args.scenario_set == "lay" else SCENARIOS
    prefix = "track_a_lay_results" if args.scenario_set == "lay" else "track_a_results"

    results: dict[str, Any] = {name: run_provider_leg(name, scenarios) for name in names}

    path = write_results(results, prefix)
    print_summary(results)
    print(f"Full results written to {path}")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest scripts/graphrag_eval/tests/test_scenarios.py scripts/graphrag_eval/tests/test_run_track_a_retrieval.py -v`
Expected: all passing. If `test_lay_scenarios_avoid_every_v1_alias_and_name_substring` fails against the real `symptom_triage_data.json`, rephrase the flagged `LAY_SCENARIOS` entry (not the test) until it passes.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/graphrag_eval/scenarios.py backend/scripts/graphrag_eval/run_track_a_retrieval.py backend/scripts/graphrag_eval/tests/test_scenarios.py backend/scripts/graphrag_eval/tests/test_run_track_a_retrieval.py
git commit -m "feat(graphrag-eval): add vocabulary-neutral lay-phrasing scenario subset"
```

---

## Part C — Step 3: Split Recall@k / selection-accuracy scoring

### Task 4: `score_recall()` alongside `score_hit()`

**Files:**
- Modify: `backend/scripts/graphrag_eval/run_track_a_retrieval.py`
- Modify: `backend/scripts/graphrag_eval/tests/test_run_track_a_retrieval.py`

**Interfaces:**
- Consumes: `GraphContextProvider.debug_all_matches` (Tasks 1-2, both providers).
- Produces: `score_recall(candidates: list[str] | None, expected_complaint: str | None) -> bool | None` — consumed by Task 8's combined report via `summarize()`'s new `recall_count`/`recall_rate` fields.

- [ ] **Step 1: Write the failing tests**

```python
# Add to backend/scripts/graphrag_eval/tests/test_run_track_a_retrieval.py

from graph.base import GraphContext
from scripts.graphrag_eval.run_track_a_retrieval import score_recall


class FakeProviderWithDebug:
    """Minimal GraphContextProvider-shaped stub exposing debug_all_matches,
    for testing score_recall()/run_scenarios() wiring without touching a
    real provider."""

    def __init__(self, matched, complaint_name, candidates):
        self._matched = matched
        self._complaint_name = complaint_name
        self._candidates = candidates

    def get_symptom_graph_context(self, text, recent_messages):
        return GraphContext(matched=self._matched, complaint_name=self._complaint_name)

    def debug_all_matches(self, text):
        return self._candidates


class TestScoreRecall:
    def test_recall_true_when_expected_complaint_in_candidates(self):
        assert score_recall(["A", "B"], "B") is True

    def test_recall_false_when_expected_complaint_missing_from_candidates(self):
        assert score_recall(["A", "C"], "B") is False

    def test_recall_undefined_when_provider_has_no_debug_hook(self):
        assert score_recall(None, "B") is None

    def test_recall_true_for_no_match_scenario_with_empty_candidates(self):
        assert score_recall([], None) is True

    def test_recall_false_for_no_match_scenario_with_stray_candidates(self):
        assert score_recall(["A"], None) is False


class TestRunScenariosSeparatesRecallFromSelection:
    def test_selection_failure_is_visible_even_when_recall_succeeded(self):
        """The right complaint WAS a candidate (recall succeeds) but a
        different one got chosen as complaint_name (hit fails) — exactly
        the wrong-match failure mode Task 2's fix targets. The split
        metric must show both facts distinctly, not collapse them into one
        binary hit/miss."""
        provider = FakeProviderWithDebug(
            matched=True, complaint_name="Wrong Pick",
            candidates=["Wrong Pick", "Right Answer"],
        )
        scenarios = [{"message": "test", "expected_complaint": "Right Answer"}]

        details = run_scenarios(provider, scenarios)

        assert details[0]["hit"] is False
        assert details[0]["recall"] is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest scripts/graphrag_eval/tests/test_run_track_a_retrieval.py -v`
Expected: FAIL with `ImportError: cannot import name 'score_recall'`.

- [ ] **Step 3: Write the implementation**

```python
# backend/scripts/graphrag_eval/run_track_a_retrieval.py changes

def score_recall(candidates: list[str] | None, expected_complaint: str | None) -> bool | None:
    """Recall (k = however many candidates debug_all_matches() surfaced):
    was the correct complaint ANYWHERE in the candidate set, regardless of
    which one the provider ultimately selected as complaint_name?
    Separates a coverage failure (the right concept was never found at
    all) from a selection/ranking failure (it was found, but score_hit()
    below still fails because a different candidate got chosen). Returns
    None when the provider doesn't expose debug_all_matches() — recall is
    undefined, not false, in that case."""
    if candidates is None:
        return None
    if expected_complaint is None:
        return len(candidates) == 0
    return expected_complaint in candidates


def score_hit(ctx: GraphContext, expected_complaint: str | None) -> bool:
    """Pure scoring logic, independent of provider construction/CLI code —
    mirrors generate_transcripts.py's build_transcript_row. This is the
    SELECTION-accuracy metric specifically (given the right complaint may
    or may not have been a candidate at all, did the final chosen
    complaint_name match?) — see score_recall() above for the paired
    coverage metric."""
    if expected_complaint is None:
        return not ctx.matched
    return ctx.matched and ctx.complaint_name == expected_complaint


def run_scenarios(
    provider: GraphContextProvider, scenarios: list[dict] | None = None
) -> list[dict]:
    if scenarios is None:
        scenarios = SCENARIOS
    details = []
    for scenario in scenarios:
        ctx = provider.get_symptom_graph_context(scenario["message"], [])
        debug_fn = getattr(provider, "debug_all_matches", None)
        candidates = debug_fn(scenario["message"]) if debug_fn else None
        details.append(
            {
                "message": scenario["message"],
                "expected_complaint": scenario["expected_complaint"],
                "actual_complaint": ctx.complaint_name,
                "matched": ctx.matched,
                "candidates": candidates,
                "hit": score_hit(ctx, scenario["expected_complaint"]),
                "recall": score_recall(candidates, scenario["expected_complaint"]),
            }
        )
    return details


def summarize(details: list[dict]) -> dict:
    count = len(details)
    if count == 0:
        return {"count": 0, "hits": 0, "accuracy": 0.0, "recall_count": 0, "recall_rate": 0.0}
    hits = sum(1 for d in details if d["hit"])
    recall_evaluable = [d for d in details if d["recall"] is not None]
    recall_count = len(recall_evaluable)
    recall_hits = sum(1 for d in recall_evaluable if d["recall"])
    return {
        "count": count,
        "hits": hits,
        "accuracy": hits / count,
        "recall_count": recall_count,
        "recall_rate": (recall_hits / recall_count) if recall_count else 0.0,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest scripts/graphrag_eval/tests/test_run_track_a_retrieval.py -v`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/graphrag_eval/run_track_a_retrieval.py backend/scripts/graphrag_eval/tests/test_run_track_a_retrieval.py
git commit -m "feat(graphrag-eval): split Track A scoring into recall vs selection accuracy"
```

---

## Part D — Step 4: Track B transcript generation (Blocker #2)

### Task 5: `generate_track_b_transcripts.py`

**Files:**
- Create: `backend/scripts/graphrag_eval/generate_track_b_transcripts.py`
- Create: `backend/scripts/graphrag_eval/tests/test_generate_track_b_transcripts.py`

**Interfaces:**
- Consumes: `scripts.symptom_eval.system_under_test.LiveLLMAgentAdapter`/`SystemTurnResult` (existing, built for the symptom-understanding eval), `scripts.graphrag_eval.scenarios.SCENARIOS`.
- Produces: a JSON file at `backend/scripts/graphrag_eval/transcripts/track_b_transcripts_<stamp>.json` matching `run_track_b_deepeval.py`'s already-documented expected row shape — closing Blocker #2 without needing a deployed backend or eval Supabase accounts, per `graph_capture.py`'s own stated intent ("closes ... Blocker #2 ... same component, two consumers, no duplication").

- [ ] **Step 1: Write the failing tests**

```python
# backend/scripts/graphrag_eval/tests/test_generate_track_b_transcripts.py
import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.graphrag_eval.generate_track_b_transcripts import (
    build_transcript_row,
    generate_transcripts,
)
from scripts.symptom_eval.system_under_test import SystemTurnResult


class TestBuildTranscriptRow:
    def test_maps_adapter_result_into_track_b_row_shape(self):
        scenario = {"message": "chest pain", "expected_complaint": "Chest pain (cardiac features)"}
        adapter = MagicMock()
        adapter.respond.return_value = SystemTurnResult(
            response_text="Please go to the ER.", severity="emergent", reasoning="why",
            graph_context_matched=True,
            surfaced_red_flag_indicators=["Shock"],
            surfaced_followup_questions=["Are you feeling faint?"],
        )

        row = build_transcript_row(scenario, adapter)

        assert row == {
            "message": "chest pain",
            "response_text": "Please go to the ER.",
            "severity": "emergent",
            "expected_complaint": "Chest pain (cardiac features)",
            "surfaced_red_flags": ["Shock"],
            "surfaced_followup_questions": ["Are you feeling faint?"],
        }
        adapter.respond.assert_called_once_with("chest pain", [])


class TestGenerateTranscripts:
    def test_calls_build_row_once_per_scenario(self, monkeypatch):
        scenarios = [
            {"message": "a", "expected_complaint": "X"},
            {"message": "b", "expected_complaint": None},
        ]
        fake_adapter = MagicMock()
        fake_adapter.respond.return_value = SystemTurnResult(
            response_text="r", severity=None, reasoning=None, graph_context_matched=False,
        )
        monkeypatch.setattr(
            "scripts.graphrag_eval.generate_track_b_transcripts.LiveLLMAgentAdapter",
            lambda graph_rag_provider: fake_adapter,
        )

        transcripts = generate_transcripts(scenarios)

        assert len(transcripts) == 2
        assert fake_adapter.respond.call_count == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest scripts/graphrag_eval/tests/test_generate_track_b_transcripts.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.graphrag_eval.generate_track_b_transcripts'`.

- [ ] **Step 3: Write the implementation**

```python
# backend/scripts/graphrag_eval/generate_track_b_transcripts.py
"""
Generates Track B transcript rows (run_track_b_deepeval.py's expected
shape) by driving LiveLLMAgentAdapter in-process against the v2 (neo4j)
provider — reusing scripts.symptom_eval.system_under_test.
LiveLLMAgentAdapter exactly as-is, per graph_capture.py's own stated
intent: "closes backend/scripts/graphrag_eval/run_track_b_deepeval.py's
Blocker #2 ... same component, two consumers, no duplication." This
removes the need run_track_b_deepeval.py's own docstring originally
assumed — a deployed preview backend + disposable eval Supabase accounts —
since LiveLLMAgentAdapter already runs LLMAgent in-process with no HTTP,
no auth, no cache (same reasoning as the symptom-understanding eval's own
design doc §2).

Each SCENARIOS entry is single-turn (Track A already drives these with no
history), so this script makes exactly one LiveLLMAgentAdapter.respond()
call per scenario — no multi-turn conversation loop needed here.

Invocation:
    doppler run --config eval -- python -m scripts.graphrag_eval.generate_track_b_transcripts
"""
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scripts.graphrag_eval.scenarios import SCENARIOS  # noqa: E402
from scripts.symptom_eval.system_under_test import LiveLLMAgentAdapter  # noqa: E402

TRANSCRIPTS_DIR = os.path.join(os.path.dirname(__file__), "transcripts")


def build_transcript_row(scenario: dict, adapter: LiveLLMAgentAdapter) -> dict:
    result = adapter.respond(scenario["message"], [])
    return {
        "message": scenario["message"],
        "response_text": result.response_text,
        "severity": result.severity,
        "expected_complaint": scenario["expected_complaint"],
        "surfaced_red_flags": result.surfaced_red_flag_indicators,
        "surfaced_followup_questions": result.surfaced_followup_questions,
    }


def generate_transcripts(scenarios: list[dict] | None = None) -> list[dict]:
    if scenarios is None:
        scenarios = SCENARIOS
    adapter = LiveLLMAgentAdapter(graph_rag_provider="neo4j")
    return [build_transcript_row(scenario, adapter) for scenario in scenarios]


def write_transcripts(transcripts: list[dict]) -> str:
    os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(TRANSCRIPTS_DIR, f"track_b_transcripts_{stamp}.json")
    with open(path, "w") as f:
        json.dump(transcripts, f, indent=2)
    return path


def main() -> None:
    transcripts = generate_transcripts()
    path = write_transcripts(transcripts)
    print(f"Generated {len(transcripts)} Track B transcripts -> {path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest scripts/graphrag_eval/tests/test_generate_track_b_transcripts.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/graphrag_eval/generate_track_b_transcripts.py backend/scripts/graphrag_eval/tests/test_generate_track_b_transcripts.py
git commit -m "feat(graphrag-eval): add in-process Track B transcript generator, closing Blocker #2"
```

---

### Task 6 (Verify — real API cost, STOP for explicit go-ahead): run Track B for real

Mirrors this repo's established Verify-gate pattern for real-cost steps (Sprint 17's Task 4, the symptom-understanding eval's Task 12). **Do not run without the user's explicit go-ahead** — this hits Groq, Claude, OpenAI, and Neo4j for real.

- [ ] **Step 1: Confirm the `eval` Doppler config still has everything needed**

Run: `doppler secrets --config eval | grep -E "GROQ_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY|NEO4J_URI"`
Expected: all four present (already confirmed earlier in this project's history).

- [ ] **Step 2: Generate real Track B transcripts**

Run: `doppler run --config eval -- python -m scripts.graphrag_eval.generate_track_b_transcripts`
Expected: `Generated 20 Track B transcripts -> .../transcripts/track_b_transcripts_<stamp>.json` (20 = `len(SCENARIOS)`), no exceptions.

- [ ] **Step 3: Run Track B's DeepEval pass against the real transcripts**

Run: `doppler run --config eval -- python scripts/graphrag_eval/run_track_b_deepeval.py`
Expected: prints per-metric `mean=` / `pass_rate=` lines and `Full results written to .../results/track_b_results_<stamp>.json`.

- [ ] **Step 4: Sanity-check API usage**

Check the Groq/Anthropic/OpenAI usage dashboards — 20 scenarios × (1 Groq call + occasional Claude/graph calls + 3 DeepEval judge calls each) is a small, bounded volume; if wildly higher, stop and investigate before trusting the results.

No commit for this task — it's a data-collection checkpoint, not a code change.

---

## Part E — Step 5: Relational/multi-hop scenarios

### Task 7: `CLUSTER_SCENARIOS` exercising `PART_OF`/`RedFlagCluster`

**Files:**
- Create: `backend/scripts/graphrag_eval/tests/test_cluster_scenarios.py`
- Modify: `backend/scripts/graphrag_eval/scenarios.py`

**Interfaces:**
- Produces: `CLUSTER_SCENARIOS: list[dict]` — a small scenario set specifically designed to exercise cross-symptom-cluster detection (v2's structural advantage over v1, per `artifacts/2026-08-05-v1-v2-retrieval-eval-fairness-gap-analysis.md` §5), not just single-complaint lookup.

- [ ] **Step 1: Add the scenario set**

```python
# Add to backend/scripts/graphrag_eval/scenarios.py

# Step 5 (docs/superpowers/plans/2026-08-05-v1-v2-retrieval-eval-fairness.md):
# scenarios combining wording from more than one of the pilot
# RedFlagCluster's anchors (cardiac chest pain, dyspnea, syncope — see
# Sprint 19's 2026-07-29 pilot cluster entry) in a single message, so a
# single _lookup() call's candidate set spans multiple anchors and
# _log_cross_symptom_clusters() has a real chance to fire. This exercises
# the multi-hop/relational structure v1's flat alias lookup has no
# equivalent for — Track A/B's other scenarios only test single-complaint
# identification, where v1 wins by construction (see the gap analysis's
# GraphRAG-literature citations).
CLUSTER_SCENARIOS: list[dict] = [
    {
        "message": "I have crushing chest pain radiating to my left arm and I feel like I might faint.",
        "expected_complaint": "Chest pain (cardiac features)",
    },
]
```

- [ ] **Step 2: Write the integration test**

```python
# backend/scripts/graphrag_eval/tests/test_cluster_scenarios.py
"""
Requires GRAPH_RAG_PROVIDER=neo4j and live Neo4j credentials (same
convention as other @pytest.mark.integration tests in this suite, skipped
by default via -m "not integration"). If the assertion fails, the
CLUSTER_SCENARIOS wording may need adjusting against the live graph's
actual matching anchors — that's a scenario-tuning task, not necessarily a
code bug; see docs/superpowers/plans/
2026-08-05-v1-v2-retrieval-eval-fairness.md Task 7.
"""
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

import pytest

from scripts.graphrag_eval.scenarios import CLUSTER_SCENARIOS


@pytest.mark.integration
def test_cluster_scenario_logs_cross_symptom_cluster_matched(caplog):
    from graph.snomed_neo4j.provider import Neo4jSnomedProvider

    provider = Neo4jSnomedProvider()
    try:
        with caplog.at_level(logging.INFO, logger="graph.snomed_neo4j.provider"):
            provider.get_symptom_graph_context(CLUSTER_SCENARIOS[0]["message"], [])
    finally:
        provider.close()

    cluster_logs = [r for r in caplog.records if r.message == "cross_symptom_cluster_matched"]
    assert cluster_logs, (
        "Expected a cross_symptom_cluster_matched log line — if this fails, "
        "the scenario wording in CLUSTER_SCENARIOS may need adjusting "
        "against the live graph's actual matching anchors, not a code bug."
    )
```

- [ ] **Step 3: Run the non-integration suite to confirm nothing else broke**

Run: `cd backend && python -m pytest scripts/graphrag_eval/ -m "not integration" -v`
Expected: all passing (the new integration test is deselected by default, matching this repo's existing convention).

- [ ] **Step 4 (Verify — live Neo4j, STOP for go-ahead): run the integration test for real**

Run: `doppler run --config eval -- python -m pytest scripts/graphrag_eval/tests/test_cluster_scenarios.py -m integration -v`
Expected: PASS. If it fails, hand-tune `CLUSTER_SCENARIOS[0]["message"]`'s wording and re-run — do not weaken the assertion.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/graphrag_eval/scenarios.py backend/scripts/graphrag_eval/tests/test_cluster_scenarios.py
git commit -m "feat(graphrag-eval): add relational scenario exercising cross-symptom-cluster detection"
```

---

## Part F — Step 6: Combined Track A+B reporting

### Task 8: `combined_report.py`

**Files:**
- Create: `backend/scripts/graphrag_eval/combined_report.py`
- Create: `backend/scripts/graphrag_eval/tests/test_combined_report.py`

**Interfaces:**
- Consumes: the latest `track_a_results_*.json`, `track_a_lay_results_*.json`, and `track_b_results_*.json` files under `backend/scripts/graphrag_eval/results/`.
- Produces: `build_report() -> str` — a Markdown summary combining all three, so the eventual case-study writeup reports Track A (both scenario sets) and Track B together rather than Track A alone — the reporting gap identified in `artifacts/2026-08-05-v1-v2-retrieval-eval-fairness-gap-analysis.md` §4.

- [ ] **Step 1: Write the failing tests**

```python
# backend/scripts/graphrag_eval/tests/test_combined_report.py
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

from scripts.graphrag_eval import combined_report


def test_build_report_combines_all_three_result_kinds(tmp_path, monkeypatch):
    monkeypatch.setattr(combined_report, "RESULTS_DIR", str(tmp_path))

    (tmp_path / "track_a_results_20260101T000000Z.json").write_text(json.dumps({
        "static": {"summary": {"count": 20, "hits": 20, "accuracy": 1.0}, "details": []},
        "neo4j": {"summary": {"count": 20, "hits": 7, "accuracy": 0.35, "recall_count": 20, "recall_rate": 0.6}, "details": []},
    }))
    (tmp_path / "track_a_lay_results_20260101T000000Z.json").write_text(json.dumps({
        "static": {"summary": {"count": 10, "hits": 8, "accuracy": 0.8}, "details": []},
        "neo4j": {"summary": {"count": 10, "hits": 6, "accuracy": 0.6, "recall_count": 10, "recall_rate": 0.7}, "details": []},
    }))
    (tmp_path / "track_b_results_20260101T000000Z.json").write_text(json.dumps({
        "summary": {"count": 18, "metrics": {"faithfulness": {"mean_score": 0.9, "pass_rate": 0.95}}},
        "results": [],
    }))

    report = combined_report.build_report()

    assert "Track A — original scenario set" in report
    assert "Track A — vocabulary-neutral" in report
    assert "Track B" in report
    assert "faithfulness" in report


def test_build_report_handles_missing_results_gracefully(tmp_path, monkeypatch):
    monkeypatch.setattr(combined_report, "RESULTS_DIR", str(tmp_path))

    report = combined_report.build_report()

    assert "no results found" in report
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest scripts/graphrag_eval/tests/test_combined_report.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.graphrag_eval.combined_report'`.

- [ ] **Step 3: Write the implementation**

```python
# backend/scripts/graphrag_eval/combined_report.py
"""
Combines the latest Track A (original and vocabulary-neutral scenario
sets) and Track B results into one Markdown summary for the case-study
writeup — Step 6 of docs/superpowers/plans/
2026-08-05-v1-v2-retrieval-eval-fairness.md. Reads the most recent results
file of each kind from backend/scripts/graphrag_eval/results/ (gitignored,
regenerate via the other scripts in this package) rather than reporting
one Track A number alone, which is how the original "v2 looks unfairly
bad" impression happened in the first place.
"""
import glob
import json
import os

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")


def _latest(pattern: str) -> dict | None:
    candidates = sorted(glob.glob(os.path.join(RESULTS_DIR, pattern)))
    if not candidates:
        return None
    with open(candidates[-1]) as f:
        return json.load(f)


def _format_track_a_section(title: str, result: dict | None) -> list[str]:
    lines = [f"## {title}"]
    if result is None:
        lines.append("no results found\n")
        return lines
    for provider, leg in result.items():
        if leg.get("skipped"):
            lines.append(f"- {provider}: SKIPPED — {leg['reason']}")
            continue
        s = leg["summary"]
        lines.append(
            f"- {provider}: {s['hits']}/{s['count']} hits ({s['accuracy']:.1%}), "
            f"recall {s.get('recall_count', 0)} evaluated at {s.get('recall_rate', 0):.1%}"
        )
    lines.append("")
    return lines


def build_report() -> str:
    track_a = _latest("track_a_results_*.json")
    track_a_lay = _latest("track_a_lay_results_*.json")
    track_b = _latest("track_b_results_*.json")

    lines = ["# V1 vs V2 Retrieval — Combined Track A/B Report", ""]
    lines += _format_track_a_section("Track A — original scenario set (vocabulary calibrated to v1)", track_a)
    lines += _format_track_a_section("Track A — vocabulary-neutral (lay-phrasing) scenario set", track_a_lay)

    lines.append("## Track B — DeepEval faithfulness / contextual precision / recall (v2)")
    if track_b is None:
        lines.append("no results found\n")
    else:
        for key, m in track_b["summary"].get("metrics", {}).items():
            lines.append(f"- {key}: mean={m['mean_score']:.3f}, pass_rate={m['pass_rate']:.1%}")
        lines.append("")

    return "\n".join(lines)


def main() -> None:
    print(build_report())


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest scripts/graphrag_eval/tests/test_combined_report.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/graphrag_eval/combined_report.py backend/scripts/graphrag_eval/tests/test_combined_report.py
git commit -m "feat(graphrag-eval): add combined Track A/B markdown report"
```

---

## Self-Review Notes

- **Spec coverage:** Step 1 (rank-based fix, both providers) → Tasks 1-2. Step 2 (vocabulary-neutral subset) → Task 3. Step 3 (Recall@k/selection split) → Task 4. Step 4 (Track B transcript generator + real run) → Tasks 5-6. Step 5 (relational scenarios) → Task 7. Step 6 (combined reporting) → Task 8.
- **Dependency Rule check (mirrors the symptom-understanding eval's own convention):** Tasks 1-2 are production request-path code — every existing test plus the new ones must pass, and the full backend suite is re-run after each. Task 5's `generate_track_b_transcripts.py` reuses `LiveLLMAgentAdapter` rather than duplicating LLMAgent-wiring logic, keeping DRY across the two eval efforts (the same principle `graph_capture.py` already established).
- **Type consistency:** `debug_all_matches(text: str) -> list[str]` has the identical signature on both `StaticLookupProvider` (Task 1) and `Neo4jSnomedProvider` (Task 2), so `run_scenarios()` (Task 4) can call it uniformly via `getattr` regardless of which provider is active. `SystemTurnResult`'s field names consumed in Task 5 (`response_text`, `severity`, `surfaced_red_flag_indicators`, `surfaced_followup_questions`) match `scripts/symptom_eval/system_under_test.py`'s existing dataclass exactly — no renaming.
- **Placeholder scan:** every step has real, runnable code. The one explicitly-flagged uncertainty is Task 7's `CLUSTER_SCENARIOS` wording, which is disclosed as needing possible live-graph tuning (matching this repo's existing practice for anything that can't be verified without a live Neo4j connection) rather than hidden as a false certainty.
- **No scope creep:** this plan does not touch `backend/scripts/symptom_eval/` beyond reusing its already-built, already-tested `LiveLLMAgentAdapter` — that harness's own Task 12/13 work continues independently on `feat/symptom-understanding-v2-eval`. Does not add a v1 curated-alias-list rewrite (Task 1 only fixes the ranking bug, doesn't restructure the underlying data). Does not wire anything into CI (no established baseline yet, same reasoning this repo has already applied to every other eval effort).

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-05-v1-v2-retrieval-eval-fairness.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
