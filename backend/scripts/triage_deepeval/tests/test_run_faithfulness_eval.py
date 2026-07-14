import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.triage_deepeval.run_faithfulness_eval import (
    build_retrieval_context,
    score_transcript,
    summarize_scores,
)

FACILITY = {
    "id": "fac-001",
    "name": "Toronto General Hospital",
    "category": "hospital",
    "address": "200 Elizabeth St, Toronto",
    "lat": 43.6577,
    "lng": -79.3877,
    "distanceKm": 1.4,
}

TRANSCRIPT_WITH_FACILITY = {
    "message": "chest pain",
    "response_text": "Please go to Toronto General Hospital immediately.",
    "severity": "emergent",
    "recommended_facility": FACILITY,
}

TRANSCRIPT_WITHOUT_FACILITY = {
    "message": "not feeling well",
    "response_text": "Can you tell me more about your symptoms?",
    "severity": None,
    "recommended_facility": None,
}


class TestBuildRetrievalContext:
    def test_includes_name_address_and_distance(self):
        context = build_retrieval_context(FACILITY)
        assert len(context) == 1
        assert "Toronto General Hospital" in context[0]
        assert "200 Elizabeth St, Toronto" in context[0]
        assert "1.4" in context[0]


class TestScoreTranscript:
    def test_returns_none_when_no_facility(self):
        assert score_transcript(TRANSCRIPT_WITHOUT_FACILITY, metric=MagicMock()) is None

    def test_scores_transcript_with_facility(self):
        metric = MagicMock()
        metric.measure.return_value = None
        metric.score = 0.92
        metric.success = True
        metric.reason = "Response matches provided facility facts."

        result = score_transcript(TRANSCRIPT_WITH_FACILITY, metric=metric)

        assert result == {
            "message": "chest pain",
            "score": 0.92,
            "success": True,
            "reason": "Response matches provided facility facts.",
        }
        metric.measure.assert_called_once()


class TestSummarizeScores:
    def test_empty_results(self):
        assert summarize_scores([]) == {"count": 0, "mean_score": 0.0, "pass_rate": 0.0}

    def test_computes_mean_and_pass_rate(self):
        results = [
            {"message": "a", "score": 1.0, "success": True, "reason": ""},
            {"message": "b", "score": 0.5, "success": False, "reason": ""},
            {"message": "c", "score": 0.9, "success": True, "reason": ""},
        ]
        summary = summarize_scores(results)
        assert summary["count"] == 3
        assert round(summary["mean_score"], 4) == round((1.0 + 0.5 + 0.9) / 3, 4)
        assert round(summary["pass_rate"], 4) == round(2 / 3, 4)
