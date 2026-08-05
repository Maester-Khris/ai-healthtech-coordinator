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

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

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
