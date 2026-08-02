import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from graph.base import GraphContext
from scripts.graphrag_eval.run_track_a_retrieval import (
    run_scenarios,
    score_hit,
    summarize,
)


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
