import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.confusion_matrix import ConfusionMatrixRow, score_vignette, summarize
from scripts.symptom_eval.domain import Vignette, VignetteTranscript

VIGNETTE = Vignette(
    case_id="2", opening_message="dizzy", disclosure_items=[],
    gold_severity="emergent", gold_ctas_level=1,
)


class TestScoreVignette:
    def test_correct_classification(self):
        transcript = VignetteTranscript("2", [], "emergent", "reasoning")
        row = score_vignette(VIGNETTE, transcript)
        assert row == ConfusionMatrixRow("2", "emergent", "emergent", True, False)

    def test_under_triage_detected(self):
        transcript = VignetteTranscript("2", [], "routine", "reasoning")
        row = score_vignette(VIGNETTE, transcript)
        assert row.correct is False
        assert row.under_triaged is True

    def test_never_classified_is_not_under_triage(self):
        transcript = VignetteTranscript("2", [], None, None)
        row = score_vignette(VIGNETTE, transcript)
        assert row.predicted is None
        assert row.correct is False
        assert row.under_triaged is False


class TestSummarize:
    def test_empty(self):
        assert summarize([]) == {"count": 0, "accuracy": 0.0, "under_triage_rate": 0.0}

    def test_computes_rates(self):
        rows = [
            ConfusionMatrixRow("1", "emergent", "emergent", True, False),
            ConfusionMatrixRow("2", "routine", "emergent", False, True),
        ]
        summary = summarize(rows)
        assert summary == {"count": 2, "accuracy": 0.5, "under_triage_rate": 0.5}
