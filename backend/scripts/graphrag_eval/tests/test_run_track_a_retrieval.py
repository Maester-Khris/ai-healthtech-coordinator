import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from graph import factory
from graph.base import GraphContext
from scripts.graphrag_eval.run_track_a_retrieval import (
    run_provider_leg,
    run_scenarios,
    score_hit,
    summarize,
)

class TestRunProviderLegClosesViaFactory:
    def test_run_provider_leg_does_not_leave_a_closed_provider_cached(self, monkeypatch):
        """Reproduces the C-1 bug: provider.close() directly leaves a dead
        instance in factory._provider_cache; a later get_graph_provider()
        call for the same provider name must return a fresh, live instance,
        not the one this leg just closed."""
        monkeypatch.setenv("GRAPH_RAG_PROVIDER", "off")
        factory._provider_cache.clear()

        first = factory.get_graph_provider()
        run_provider_leg("off")

        # The eviction itself is the contract: closing through the factory
        # empties the cache. Asserting only that a later get_graph_provider()
        # equals whatever is cached would be tautological — it always is.
        assert factory._provider_cache == {}

        second = factory.get_graph_provider()
        assert second is not first


class FakeProvider:
    def __init__(self, response: GraphContext):
        self._response = response

    def get_symptom_graph_context(self, user_message, recent_messages):
        return self._response


class TestScoreHit:
    def test_hit_when_matched_and_complaint_names_equal(self):
        ctx = GraphContext(matched=True, complaint_name="Sore throat")
        assert score_hit(ctx, "Sore throat") is True

    def test_miss_when_matched_but_wrong_complaint(self):
        ctx = GraphContext(matched=True, complaint_name="Epistaxis")
        assert score_hit(ctx, "Sore throat") is False

    def test_miss_when_expected_a_complaint_but_not_matched(self):
        ctx = GraphContext(matched=False)
        assert score_hit(ctx, "Sore throat") is False

    def test_hit_for_no_match_scenario_when_provider_correctly_reports_no_match(self):
        ctx = GraphContext(matched=False)
        assert score_hit(ctx, None) is True

    def test_miss_for_no_match_scenario_when_provider_false_positives(self):
        ctx = GraphContext(matched=True, complaint_name="Sore throat")
        assert score_hit(ctx, None) is False


class TestRunScenarios:
    def test_builds_one_detail_row_per_scenario(self):
        provider = FakeProvider(
            GraphContext(matched=True, complaint_name="Sore throat")
        )
        scenarios = [
            {"message": "my throat hurts a lot", "expected_complaint": "Sore throat"}
        ]

        details = run_scenarios(provider, scenarios)

        assert details == [
            {
                "message": "my throat hurts a lot",
                "expected_complaint": "Sore throat",
                "actual_complaint": "Sore throat",
                "matched": True,
                "hit": True,
            }
        ]

    def test_marks_miss_when_provider_returns_wrong_complaint(self):
        provider = FakeProvider(GraphContext(matched=True, complaint_name="Epistaxis"))
        scenarios = [{"message": "chest pain", "expected_complaint": "Sore throat"}]

        details = run_scenarios(provider, scenarios)

        assert details[0]["hit"] is False
        assert details[0]["actual_complaint"] == "Epistaxis"


class TestSummarize:
    def test_empty_details(self):
        assert summarize([]) == {"count": 0, "hits": 0, "accuracy": 0.0}

    def test_computes_accuracy(self):
        details = [{"hit": True}, {"hit": False}, {"hit": True}]
        summary = summarize(details)
        assert summary == {"count": 3, "hits": 2, "accuracy": 2 / 3}
