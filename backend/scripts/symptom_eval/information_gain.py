"""
ScoreInformationGain (Metric 3) — entropy reduction turn-over-turn over
MediCoord's 4 severity tiers as the candidate set. A disclosed adaptation of
IOR-Bench's candidate-department distribution (research artifact §1.4,
source 2) to this product's own triage-tier domain: MediCoord triages to a
facility tier, not a hospital department, but the entropy mechanics are
identical. Secondary/diagnostic signal only — IOR-Bench's own finding is
that entropy reduction doesn't reliably track final accuracy, so this never
gates a pass/fail on its own (design §6).
"""
import math
from abc import ABC, abstractmethod
from dataclasses import dataclass

from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

from scripts.symptom_eval.domain import VignetteTranscript

SEVERITY_TIERS = ["routine", "moderate", "urgent", "emergent"]
JUDGE_MODEL = "gpt-4o-mini"


class RubricJudgePort(ABC):
    @abstractmethod
    def score_candidates(self, transcript_text: str) -> dict[str, float]:
        """Raw (pre-softmax) support score per severity tier, 0-1 each."""
        ...


class DeepEvalRubricJudge(RubricJudgePort):
    """One GEval instance per candidate tier — collapses IOR-Bench's
    7-dimension rubric (complaint match, symptom consistency, red-flag
    relevance, background fit, supporting evidence, management fit,
    contradictory evidence) into a single 0-1 support score per tier."""

    def __init__(self, model: str = JUDGE_MODEL):
        self._metrics = {
            tier: GEval(
                name=f"SeveritySupport_{tier}",
                criteria=(
                    f"Rate 0-1 how strongly the transcript's symptoms, "
                    f"history, and red flags support classifying this "
                    f"patient's severity as '{tier}' on a "
                    f"routine/moderate/urgent/emergent triage scale — "
                    f"considering complaint match, symptom consistency, "
                    f"red-flag relevance, and contradictory evidence."
                ),
                evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT],
                threshold=0.0,
                model=model,
            )
            for tier in SEVERITY_TIERS
        }

    def score_candidates(self, transcript_text: str) -> dict[str, float]:
        scores = {}
        for tier, metric in self._metrics.items():
            test_case = LLMTestCase(input="", actual_output=transcript_text)
            metric.measure(test_case)
            scores[tier] = metric.score
        return scores


def _softmax(scores: dict[str, float]) -> dict[str, float]:
    values = list(scores.values())
    max_v = max(values)
    exps = {k: math.exp(v - max_v) for k, v in scores.items()}
    total = sum(exps.values())
    return {k: v / total for k, v in exps.items()}


def _entropy(distribution: dict[str, float]) -> float:
    return -sum(p * math.log(p) for p in distribution.values() if p > 0)


@dataclass
class InformationGainResult:
    case_id: str
    entropy_per_turn: list[float]
    gains: list[float]


def score_vignette(
    transcript: VignetteTranscript, judge: RubricJudgePort
) -> InformationGainResult:
    entropies = []
    for turn in transcript.turns:
        text = transcript.text_up_to(turn.turn_index)
        distribution = _softmax(judge.score_candidates(text))
        entropies.append(_entropy(distribution))

    gains = [entropies[i - 1] - entropies[i] for i in range(1, len(entropies))]
    return InformationGainResult(
        case_id=transcript.vignette_case_id, entropy_per_turn=entropies, gains=gains
    )
