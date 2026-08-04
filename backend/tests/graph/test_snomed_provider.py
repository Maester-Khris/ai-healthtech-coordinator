# backend/tests/graph/test_snomed_provider.py
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from unittest.mock import MagicMock, patch

import pytest

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
            return [{"concept_id": "22253000"}]
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
            return [{"concept_id": "22253000"}]
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
                return [{"concept_id": "22253000"}]
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
            return [{"concept_id": "22253000"}]
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
            return [{"concept_id": "1"}]
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
