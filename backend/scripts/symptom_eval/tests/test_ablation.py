import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.ablation import run_ablation
from scripts.symptom_eval.domain import Vignette
from scripts.symptom_eval.system_under_test import SystemTurnResult

VIGNETTES = [
    Vignette("1", "dizzy", [], "emergent", 1),
    Vignette("2", "sore throat", [], "routine", 5),
]


class _FakeSystem:
    def __init__(self, severity):
        self._severity = severity

    def respond(self, patient_message, history):
        return SystemTurnResult("classified", self._severity, "why", False)


class _FakeSimulator:
    def reply(self, vignette, system_question, history):
        return "more info"


class _FakeFeatureJudge:
    def was_surfaced(self, feature, transcript_text):
        return False


class _FakeRubricJudge:
    def score_candidates(self, transcript_text):
        return {"routine": 0.25, "moderate": 0.25, "urgent": 0.25, "emergent": 0.25}


class TestRunAblation:
    def test_runs_one_leg_per_provider(self):
        legs = run_ablation(
            vignettes=VIGNETTES,
            system_factory=lambda provider: _FakeSystem(severity="emergent"),
            simulator=_FakeSimulator(),
            feature_judge=_FakeFeatureJudge(),
            rubric_judge=_FakeRubricJudge(),
            providers=("off", "neo4j"),
        )

        assert [leg.provider for leg in legs] == ["off", "neo4j"]
        for leg in legs:
            assert leg.confusion_matrix["count"] == 2
            assert len(leg.elicitation_coverage) == 2
            assert len(leg.information_gain) == 2
