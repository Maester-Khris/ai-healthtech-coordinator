# backend/tests/graph/test_snomed_provider.py
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from unittest.mock import MagicMock, patch

import pytest

from graph.snomed_neo4j.provider import is_corrupted_indicator
from graph.snomed_neo4j.queries import (
    build_concept_lookup_query,
    build_red_flag_traversal_query,
    build_red_flag_traversal_query_batch,
)
import graph.snomed_neo4j.client

# ---------------------------------------------------------------------------
# Pure Cypher builder tests — no driver, no mock needed
# ---------------------------------------------------------------------------

def test_traversal_query_bounds_is_a_depth_and_filters_by_candidate_ids():
    """Verbatim from the plan doc Step 1 (TDD anchor)."""
    query, params = build_red_flag_traversal_query(candidate_concept_ids=["22253000"], anchor_concept_id="123456")
    assert "MATCH (c)-[:IS_A*0..3]->(anchor:SnomedConcept {id: $anchor_concept_id})" in query
    assert params["candidate_concept_ids"] == ["22253000"]
    assert params["anchor_concept_id"] == "123456"

def test_traversal_query_respects_custom_max_depth():
    query, params = build_red_flag_traversal_query(["22253000"], "123456", max_depth=2)
    assert "MATCH (c)-[:IS_A*0..2]->(anchor:SnomedConcept {id: $anchor_concept_id})" in query
    assert "IS_A*0..3" not in query

def test_traversal_query_rejects_negative_depth():
    with pytest.raises(ValueError):
        build_red_flag_traversal_query(["22253000"], "123456", max_depth=-1)

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

def test_batch_traversal_query_includes_optional_cluster_match():
    query, params = build_red_flag_traversal_query_batch(["1"], ["2"], max_depth=4)
    assert "OPTIONAL MATCH (rf)-[:PART_OF]->(cluster:RedFlagCluster)" in query
    assert "cluster.name AS cluster_name" in query


def test_concept_lookup_query_filters_by_english_language_code():
    """FSN-language guard: must filter on language_code, not c.fsn."""
    query, params = build_concept_lookup_query()
    assert "language_code" in query
    assert '"en"' in query or "'en'" in query
    assert "$text" in query
    assert "concept_id" in query


def test_concept_lookup_query_matches_keyword_in_term_not_reversed():
    """Keyword-containment direction: $text CONTAINS d.term, not reversed."""
    query, params = build_concept_lookup_query()
    # Verify the correct (fixed) direction: input keyword is containment source
    assert "toLower($text) CONTAINS toLower(d.term)" in query
    # Verify the old (buggy) reversed direction is NOT present
    assert "toLower(d.term) CONTAINS toLower($text)" not in query


def test_concept_lookup_query_filters_trivial_short_terms():
    """Short-term guard: filter out d.term < 4 chars to prevent false positives."""
    query, params = build_concept_lookup_query()
    assert "size(d.term) >= 4" in query

def test_concept_lookup_query_has_a_result_limit():
    """I-5: unbounded, this scans ~127k Description nodes per message and
    returns an unbounded candidate-concept list into the traversal."""
    query, params = build_concept_lookup_query()
    assert "LIMIT 50" in query

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
            return [{"concept_id": "1", "matched_length": 20}]
        if call_count == 2:
            return [good_row, bad_row]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    with patch("graph.snomed_neo4j.provider.ANCHOR_MAPPINGS", [mapping]):
        result = mock_provider.get_symptom_graph_context("test", [])

    indicators = [rf.indicator for rf in result.red_flags]
    assert "Shock" in indicators
    assert "1 Shock" not in indicators


def test_lookup_does_not_name_the_complaint_after_an_all_corrupted_anchor(mock_provider):
    """The I-3 filter must run before complaint_name is chosen: an anchor whose
    rows are all extraction artifacts contributes zero red flags, so it must
    not win complaint_name over a later anchor that actually contributed."""
    from graph.snomed_neo4j.anchor_mapping import AnchorMapping
    corrupt_only = AnchorMapping(
        ctas_alias="CorruptOnly", anchor_concept_id="A", fsn="A", rationale="A", max_depth=4,
    )
    real = AnchorMapping(
        ctas_alias="Real", anchor_concept_id="B", fsn="B", rationale="B", max_depth=4,
    )
    rows = [
        {"candidate_id": "1", "anchor_id": "A", "indicator": "VS, PSC",
         "ctas_level": 2, "app_severity": "urgent", "followup_question": "q1"},
        {"candidate_id": "1", "anchor_id": "B", "indicator": "Shock",
         "ctas_level": 1, "app_severity": "emergent", "followup_question": "q2"},
    ]
    call_count = 0

    def side_effect(query, params):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [{"concept_id": "1", "matched_length": 20}]
        if call_count == 2:
            return rows
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    with patch("graph.snomed_neo4j.provider.ANCHOR_MAPPINGS", [corrupt_only, real]):
        result = mock_provider.get_symptom_graph_context("test", [])

    assert result.matched is True
    assert result.complaint_name == "Real"
    assert [rf.indicator for rf in result.red_flags] == ["Shock"]


# ---------------------------------------------------------------------------
# Provider integration tests — mocked Neo4jClient
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_provider():
    """Neo4jSnomedProvider with its Neo4jClient.__init__ short-circuited."""
    with patch.dict(os.environ, {
        "NEO4J_URI": "bolt://mock:7687",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "mock",
    }):
        with patch("graph.snomed_neo4j.client.GraphDatabase.driver") as mock_driver:
            mock_driver.return_value = MagicMock()
            from graph.snomed_neo4j.provider import Neo4jSnomedProvider
            provider = Neo4jSnomedProvider()
            yield provider


def test_ping_calls_verify_connectivity(mock_provider):
    mock_provider._client._driver.verify_connectivity = MagicMock()
    mock_provider.ping()
    mock_provider._client._driver.verify_connectivity.assert_called_once()


def test_ping_propagates_failure(mock_provider):
    mock_provider._client._driver.verify_connectivity = MagicMock(side_effect=ConnectionError("down"))
    with pytest.raises(ConnectionError):
        mock_provider.ping()


def test_lookup_returns_matched_false_on_zero_concept_hits(mock_provider):
    """Zero concept-lookup rows → matched=False, no traversal attempted."""
    mock_provider._client.run_query = MagicMock(return_value=[])
    result = mock_provider.get_symptom_graph_context("I have a headache", [])
    assert result.matched is False
    assert result.red_flags == []


def test_lookup_maps_records_to_red_flag_matches(mock_provider):
    """Happy path: concept lookup returns one hit, one batched traversal call
    (grouped by max_depth) returns one red flag. ANCHOR_MAPPINGS is patched
    to a single controlled mapping so the mocked anchor_id actually resolves
    during _lookup()'s reassembly loop — the real ANCHOR_MAPPINGS has no
    "29857009" entry, so this mock data is otherwise inert against it."""
    from graph.snomed_neo4j.anchor_mapping import AnchorMapping

    traversal_row = {
        "candidate_id": "22253000",
        "anchor_id": "29857009",
        "indicator": "Shock",
        "ctas_level": 1,
        "app_severity": "emergent",
        "followup_question": "Are they cold and clammy?",
    }
    test_mapping = AnchorMapping(
        ctas_alias="Test complaint", anchor_concept_id="29857009",
        fsn="Test finding (finding)", rationale="Test", max_depth=4,
    )

    call_count = 0

    def side_effect(query, params):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [{"concept_id": "22253000", "matched_length": 20}]
        # one batched call per distinct max_depth group — only one group
        # here (max_depth=4), so exactly one traversal call.
        if call_count == 2:
            return [traversal_row]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    with patch("graph.snomed_neo4j.provider.ANCHOR_MAPPINGS", [test_mapping]):
        result = mock_provider.get_symptom_graph_context("chest pain", [])

    assert result.matched is True
    assert len(result.red_flags) >= 1
    assert result.red_flags[0].indicator == "Shock"
    assert result.red_flags[0].ctas_level == 1
    assert result.red_flags[0].followup_question == "Are they cold and clammy?"
    assert call_count == 2  # 1 concept lookup + 1 batched call (single depth group)


def test_lookup_deduplicates_repeated_indicator(mock_provider):
    """Same indicator returned for two different anchor_ids within the SAME
    batched call → only one RedFlagMatch (dedup is keyed on indicator, not
    on which anchor/call it came from). Both mappings share max_depth=4 so
    they land in the same batched call, matching call_count==2 below."""
    from graph.snomed_neo4j.anchor_mapping import AnchorMapping

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
    mapping_a = AnchorMapping(
        ctas_alias="Test A", anchor_concept_id="29857009",
        fsn="Test finding A", rationale="Test", max_depth=4,
    )
    mapping_b = AnchorMapping(
        ctas_alias="Test B", anchor_concept_id="10000000",
        fsn="Test finding B", rationale="Test", max_depth=4,
    )

    call_count = 0

    def side_effect(query, params):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [{"concept_id": "22253000", "matched_length": 20}]
        if call_count == 2:
            return [dup_row_anchor_a, dup_row_anchor_b]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    with patch("graph.snomed_neo4j.provider.ANCHOR_MAPPINGS", [mapping_a, mapping_b]):
        result = mock_provider.get_symptom_graph_context("chest pain", [])
    shock_flags = [rf for rf in result.red_flags if rf.indicator == "Shock"]
    assert len(shock_flags) == 1


def test_lookup_uses_per_anchor_max_depth(mock_provider):
    """_lookup() must pass mapping.max_depth, not a hardcoded constant."""
    from graph.snomed_neo4j.anchor_mapping import AnchorMapping

    test_mapping = AnchorMapping(
        ctas_alias="Test complaint",
        anchor_concept_id="12345678",
        fsn="Test finding (finding)",
        rationale="Test rationale",
        max_depth=2,
    )

    captured_queries: list[str] = []

    def side_effect(query, params):
        captured_queries.append(query)
        if not captured_queries or captured_queries[0] == query:
            if len(captured_queries) == 1:
                return [{"concept_id": "22253000", "matched_length": 20}]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)

    with patch("graph.snomed_neo4j.provider.ANCHOR_MAPPINGS", [test_mapping]):
        mock_provider.get_symptom_graph_context("test", [])

    # First call is concept lookup; second is traversal — must use max_depth=2
    traversal_queries = [q for q in captured_queries if "IS_A" in q]
    assert traversal_queries, "No traversal query was issued"
    assert "IS_A*0..2" in traversal_queries[0]


def test_lookup_returns_matched_false_when_traversal_has_no_red_flags(mock_provider):
    """Concept found but no red flags in the graph → matched=False."""
    call_count = 0

    def side_effect(query, params):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [{"concept_id": "22253000", "matched_length": 20}]
        return []  # all traversals empty

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    result = mock_provider.get_symptom_graph_context("something obscure", [])
    assert result.matched is False


def test_lookup_sorts_red_flags_by_ctas_level_ascending(mock_provider):
    """Design §4 point 4 / §8: most-severe (lowest ctas_level) must come first,
    regardless of which anchor/row order Neo4j returns them in. Mappings A/B
    use different max_depth values so they land in two separate batched
    calls (call_count 2 and 3), deliberately returned less-severe-first to
    prove the sort, not the traversal order, decides final ordering."""
    from graph.snomed_neo4j.anchor_mapping import AnchorMapping

    urgent_row = {
        "candidate_id": "1", "anchor_id": "A", "indicator": "Urgent sign",
        "ctas_level": 3, "app_severity": "urgent", "followup_question": "q1",
    }
    emergent_row = {
        "candidate_id": "1", "anchor_id": "B", "indicator": "Emergent sign",
        "ctas_level": 1, "app_severity": "emergent", "followup_question": "q2",
    }
    mapping_a = AnchorMapping(
        ctas_alias="Test A", anchor_concept_id="A",
        fsn="Test finding A", rationale="Test", max_depth=4,
    )
    mapping_b = AnchorMapping(
        ctas_alias="Test B", anchor_concept_id="B",
        fsn="Test finding B", rationale="Test", max_depth=2,
    )

    call_count = 0

    def side_effect(query, params):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [{"concept_id": "1", "matched_length": 20}]
        if call_count == 2:
            return [urgent_row]      # deliberately returned BEFORE the emergent one
        if call_count == 3:
            return [emergent_row]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    with patch("graph.snomed_neo4j.provider.ANCHOR_MAPPINGS", [mapping_a, mapping_b]):
        result = mock_provider.get_symptom_graph_context("test", [])

    assert [rf.ctas_level for rf in result.red_flags] == [1, 3]

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
            return [{"concept_id": "1", "matched_length": 20}]
        if call_count == 2:
            return [cardiac_row, dyspnea_row]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    with caplog.at_level(logging.INFO, logger="graph.snomed_neo4j.provider"):
        mock_provider.get_symptom_graph_context("chest pain and dyspnea", [])

    matches = [r for r in caplog.records if r.message == "cross_symptom_cluster_matched"]
    assert len(matches) == 1
    assert matches[0].cluster_name == "Cardiac symptom cluster"


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
