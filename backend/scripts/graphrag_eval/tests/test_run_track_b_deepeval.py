import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.graphrag_eval.run_track_b_deepeval import (
    build_expected_context,
    build_retrieval_context,
    build_test_case,
    score_transcript,
    summarize_scores,
)

TRANSCRIPT_WITH_COMPLAINT = {
    "message": "I have crushing chest pain radiating to my left arm.",
    "response_text": "That sounds serious — have you had any shortness of breath or sweating?",
    "severity": "emergent",
    "expected_complaint": "Chest pain (cardiac features)",
    "surfaced_red_flags": ["Shock", "Severe respiratory distress"],
    "surfaced_followup_questions": ["Are you short of breath?"],
}

TRANSCRIPT_WITHOUT_COMPLAINT = {
    "message": "What are your visiting hours?",
    "response_text": "Our visiting hours are 9am to 8pm.",
    "severity": None,
    "expected_complaint": None,
    "surfaced_red_flags": [],
    "surfaced_followup_questions": [],
}


class TestBuildRetrievalContext:
    def test_combines_surfaced_red_flags_and_followup_questions(self):
        context = build_retrieval_context(TRANSCRIPT_WITH_COMPLAINT)
        assert context == [
            "Shock",
            "Severe respiratory distress",
            "Are you short of breath?",
        ]

    def test_empty_when_transcript_has_none_surfaced(self):
        assert build_retrieval_context(TRANSCRIPT_WITHOUT_COMPLAINT) == []


class TestBuildExpectedContext:
    def test_looks_up_ground_truth_red_flags_for_expected_complaint(self):
        context = build_expected_context(TRANSCRIPT_WITH_COMPLAINT)
        assert context
        assert all(isinstance(indicator, str) for indicator in context)

    def test_empty_when_no_expected_complaint(self):
        assert build_expected_context(TRANSCRIPT_WITHOUT_COMPLAINT) == []


class TestBuildTestCase:
    def test_populates_expected_deepeval_fields(self):
        test_case = build_test_case(TRANSCRIPT_WITH_COMPLAINT)

        assert test_case.input == TRANSCRIPT_WITH_COMPLAINT["message"]
        assert test_case.actual_output == TRANSCRIPT_WITH_COMPLAINT["response_text"]
        assert test_case.retrieval_context == [
            "Shock",
            "Severe respiratory distress",
            "Are you short of breath?",
        ]
        assert test_case.expected_output  # non-empty joined ground-truth string
        assert test_case.context  # list form of the same ground truth


class TestScoreTranscript:
    def test_returns_none_when_no_expected_complaint(self):
        assert score_transcript(TRANSCRIPT_WITHOUT_COMPLAINT, metrics={}) is None

    def test_scores_transcript_with_all_three_metrics(self):
        faithfulness = MagicMock(score=0.9, success=True, reason="faithful")
        precision = MagicMock(score=0.8, success=True, reason="precise")
        recall = MagicMock(score=0.75, success=False, reason="missed a red flag")
        metrics = {
            "faithfulness": faithfulness,
            "contextual_precision": precision,
            "contextual_recall": recall,
        }

        result = score_transcript(TRANSCRIPT_WITH_COMPLAINT, metrics)

        assert result["message"] == TRANSCRIPT_WITH_COMPLAINT["message"]
        assert result["expected_complaint"] == "Chest pain (cardiac features)"
        assert result["faithfulness"] == {
            "score": 0.9,
            "success": True,
            "reason": "faithful",
        }
        assert result["contextual_precision"] == {
            "score": 0.8,
            "success": True,
            "reason": "precise",
        }
        assert result["contextual_recall"] == {
            "score": 0.75,
            "success": False,
            "reason": "missed a red flag",
        }
        faithfulness.measure.assert_called_once()
        precision.measure.assert_called_once()
        recall.measure.assert_called_once()


class TestSummarizeScores:
    def test_empty_results(self):
        assert summarize_scores([]) == {"count": 0, "metrics": {}}

    def test_computes_mean_and_pass_rate_per_metric(self):
        results = [
            {
                "message": "a",
                "expected_complaint": "X",
                "faithfulness": {"score": 1.0, "success": True, "reason": ""},
                "contextual_precision": {"score": 1.0, "success": True, "reason": ""},
                "contextual_recall": {"score": 1.0, "success": True, "reason": ""},
            },
            {
                "message": "b",
                "expected_complaint": "Y",
                "faithfulness": {"score": 0.5, "success": False, "reason": ""},
                "contextual_precision": {"score": 0.6, "success": False, "reason": ""},
                "contextual_recall": {"score": 0.4, "success": False, "reason": ""},
            },
        ]

        summary = summarize_scores(results)

        assert summary["count"] == 2
        assert summary["metrics"]["faithfulness"]["mean_score"] == 0.75
        assert summary["metrics"]["faithfulness"]["pass_rate"] == 0.5
        assert summary["metrics"]["contextual_precision"]["mean_score"] == 0.8
        assert summary["metrics"]["contextual_recall"]["mean_score"] == 0.7
