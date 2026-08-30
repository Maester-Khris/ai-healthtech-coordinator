import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.domain import ConversationTurn, VignetteTranscript
from scripts.symptom_eval.information_gain import score_vignette

TRANSCRIPT = VignetteTranscript(
    "2",
    [
        ConversationTurn(0, "I feel dizzy.", "Tell me more.", False, [], []),
        ConversationTurn(1, "I also have chest pain.", "Go to the ER.", False, [], []),
    ],
    "emergent", "reasoning",
)


class _ScriptedRubricJudge:
    """Turn 0: near-uniform (high entropy). Turn 1: confidently emergent (low entropy)."""

    def __init__(self):
        self.call_count = 0

    def score_candidates(self, transcript_text):
        self.call_count += 1
        if self.call_count == 1:
            return {"routine": 0.5, "moderate": 0.5, "urgent": 0.5, "emergent": 0.5}
        return {"routine": 0.0, "moderate": 0.0, "urgent": 0.1, "emergent": 0.9}


class TestScoreVignette:
    def test_entropy_decreases_as_evidence_accumulates(self):
        judge = _ScriptedRubricJudge()
        result = score_vignette(TRANSCRIPT, judge)

        assert len(result.entropy_per_turn) == 2
        assert result.entropy_per_turn[0] > result.entropy_per_turn[1]
        assert len(result.gains) == 1
        assert result.gains[0] == result.entropy_per_turn[0] - result.entropy_per_turn[1]
        assert result.gains[0] > 0  # positive information gain

    def test_uniform_distribution_has_max_entropy(self):
        judge = _ScriptedRubricJudge()
        result = score_vignette(TRANSCRIPT, judge)
        expected_max_entropy = math.log(4)  # ln(4 candidates), uniform
        assert round(result.entropy_per_turn[0], 4) == round(expected_max_entropy, 4)
