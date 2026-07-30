# backend/tests/graph/test_snomed_provider.py
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from unittest.mock import MagicMock, patch

import pytest

from graph.snomed_neo4j.queries import (
    build_concept_lookup_query,
    build_red_flag_traversal_query,
)


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


def test_concept_lookup_query_filters_by_english_language_code():
    """FSN-language guard: must filter on language_code, not c.fsn."""
    query, params = build_concept_lookup_query()
    assert "language_code" in query
    assert '"en"' in query or "'en'" in query
    assert "$text" in query
    assert "concept_id" in query


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
    """Happy path: concept lookup returns one hit, traversal returns one red flag."""
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
            # concept lookup
            return [{"concept_id": "22253000"}]
        # traversal — return one hit on first anchor call, empty for the rest
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


def test_lookup_deduplicates_repeated_indicator(mock_provider):
    """Same indicator from two different anchor traversals → only one RedFlagMatch."""
    dup_row = {
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
        if call_count in (2, 3):
            # Two different anchors both return the same indicator
            return [dup_row]
        return []

    mock_provider._client.run_query = MagicMock(side_effect=side_effect)
    result = mock_provider.get_symptom_graph_context("chest pain", [])
    shock_flags = [rf for rf in result.red_flags if rf.indicator == "Shock"]
    assert len(shock_flags) == 1


def test_lookup_uses_per_anchor_max_depth(mock_provider):
    """_lookup() must pass mapping.max_depth, not a hardcoded constant."""
    from scripts.snomed_ingest.anchor_mapping import AnchorMapping

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
