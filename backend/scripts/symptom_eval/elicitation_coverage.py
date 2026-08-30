"""
ScoreElicitationCoverage (Metric 1) — for each DisclosureItem, asks a judge
whether it appears anywhere in the full transcript, then whether it already
appeared in turn 0 alone (the opening message) to tell volunteered from
elicited. Direct implementation of Paper 1's method (Madda & Kondru 2025,
research artifact §1.4 source 1): elicitation coverage = |elicited| /
|total features|, elicitation fraction = |elicited| / |surfaced|.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass

from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

from scripts.symptom_eval.domain import DisclosureItem, Vignette, VignetteTranscript

JUDGE_MODEL = "gpt-4o-mini"


class FeaturePresenceJudgePort(ABC):
    @abstractmethod
    def was_surfaced(self, feature: DisclosureItem, transcript_text: str) -> bool:
        ...


class DeepEvalFeaturePresenceJudge(FeaturePresenceJudgePort):
    def __init__(self, model: str = JUDGE_MODEL):
        self._metric = GEval(
            name="FeaturePresence",
            criteria=(
                "Determine whether the clinical fact described in `input` was "
                "conveyed anywhere in the `actual_output` conversation "
                "transcript, in the patient's own words or clearly implied by "
                "an assistant question being answered. Score 1 if present, 0 "
                "if absent."
            ),
            evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
            threshold=0.5,
            model=model,
        )

    def was_surfaced(self, feature: DisclosureItem, transcript_text: str) -> bool:
        test_case = LLMTestCase(
            input=feature.first_person_phrasing, actual_output=transcript_text
        )
        self._metric.measure(test_case)
        return self._metric.success


@dataclass
class ElicitationCoverageResult:
    case_id: str
    total_features: int
    surfaced_count: int
    elicited_count: int
    coverage: float
    fraction: float


def score_vignette(
    vignette: Vignette, transcript: VignetteTranscript, judge: FeaturePresenceJudgePort
) -> ElicitationCoverageResult:
    opening_text = transcript.text_up_to(0)
    full_text = transcript.text_up_to()

    surfaced_count = 0
    elicited_count = 0
    for feature in vignette.disclosure_items:
        if not judge.was_surfaced(feature, full_text):
            continue
        surfaced_count += 1
        if not judge.was_surfaced(feature, opening_text):
            elicited_count += 1

    total = len(vignette.disclosure_items)
    return ElicitationCoverageResult(
        case_id=vignette.case_id,
        total_features=total,
        surfaced_count=surfaced_count,
        elicited_count=elicited_count,
        coverage=(elicited_count / total) if total else 0.0,
        fraction=(elicited_count / surfaced_count) if surfaced_count else 0.0,
    )
