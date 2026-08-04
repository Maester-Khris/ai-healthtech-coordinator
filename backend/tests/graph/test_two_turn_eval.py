import os
import sys
import pytest
from neo4j.exceptions import ServiceUnavailable

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
from graph.factory import get_graph_provider


def _skip_if_neo4j_unreachable(provider):
    """Direct connectivity probe, bypassing GraphContextProvider's
    never-raises wrapper on purpose — that wrapper is what makes a real
    outage indistinguishable from 'the graph is wrong' in these tests
    otherwise (see plan I-4)."""
    try:
        provider._client.run_query("RETURN 1", {})
    except ServiceUnavailable as exc:
        pytest.skip(f"Neo4j unreachable: {exc}")


@pytest.mark.integration
def test_two_turn_graphrag_traversal(monkeypatch):
    """
    Step 2: Run the two-turn worked example from design doc §4 / research artifact
    Addendum 3 as the first hand-written eval case.
    """
    monkeypatch.setenv("GRAPH_RAG_PROVIDER", "neo4j")
    
    # Needs valid credentials in env, skipped otherwise
    if "NEO4J_URI" not in os.environ:
        pytest.skip("NEO4J_URI not set")

    provider = get_graph_provider()
    _skip_if_neo4j_unreachable(provider)
    
    # Turn 1:
    # Use explicit descriptions that exist in the subset: "cardiac chest pain", "dyspnea"
    msg1 = "I have cardiac chest pain and dyspnea."
    ctx1 = provider.get_symptom_graph_context(msg1, [])
    
    assert ctx1.matched is True
    # Verify the correct cluster is surfaced
    assert ctx1.complaint_name == "Chest pain (cardiac features)"
    assert len(ctx1.red_flags) > 0
    # Collect the asked indicators
    indicators_asked_t1 = {rf.indicator for rf in ctx1.red_flags}

    # Turn 2:
    # We provide "fainting" and "pleuritic chest pain"
    msg2 = "No radiating pain, but I have pleuritic chest pain when I breathe and fainting."
    ctx2 = provider.get_symptom_graph_context(msg2, [msg1])
    
    assert ctx2.matched is True
    # It should accumulate T1's red flags and add any new ones for dizziness
    indicators_asked_t2 = {rf.indicator for rf in ctx2.red_flags}
    
    new_indicators = indicators_asked_t2 - indicators_asked_t1
    assert len(new_indicators) > 0
