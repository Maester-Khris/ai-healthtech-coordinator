import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from graph import factory
from graph.base import GraphContext
from scripts.graphrag_eval.run_track_a_retrieval import (
    run_provider_leg,
    run_scenarios,
    score_hit,
    score_recall,
    summarize,
    write_results,
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
                "candidates": None,
                "hit": True,
                "recall": None,
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
        assert summarize([]) == {
            "count": 0, "hits": 0, "accuracy": 0.0, "recall_count": 0, "recall_rate": 0.0,
        }

    def test_computes_accuracy(self):
        details = [
            {"hit": True, "recall": None},
            {"hit": False, "recall": None},
            {"hit": True, "recall": None},
        ]
        summary = summarize(details)
        assert summary == {
            "count": 3, "hits": 2, "accuracy": 2 / 3, "recall_count": 0, "recall_rate": 0.0,
        }

    def test_computes_recall_rate_over_evaluable_scenarios_only(self):
        details = [
            {"hit": True, "recall": True},
            {"hit": False, "recall": False},
            {"hit": True, "recall": None},
        ]
        summary = summarize(details)
        assert summary["recall_count"] == 2
        assert summary["recall_rate"] == 0.5


class TestScenarioSetSelection:
    def test_lay_scenario_set_writes_to_a_distinct_results_prefix(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            "scripts.graphrag_eval.run_track_a_retrieval.RESULTS_DIR", str(tmp_path)
        )
        path = write_results({}, filename_prefix="track_a_lay_results")
        assert os.path.basename(path).startswith("track_a_lay_results_")


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
