"""
RunBaselineAblation (Metric 4) — runs the full vignette pool through the
conversation loop once per GRAPH_RAG_PROVIDER leg, diffing Metrics 1-3
between legs. No new scoring logic — Metrics 1-3 called once per leg
(backend/graph/factory.py:12 defines the provider values), per design §6.

Takes system_factory rather than constructing LiveLLMAgentAdapter directly —
per this plan's Dependency Rule, only cli.py (Main) may reference that
concrete adapter; this file only sees SystemUnderTestPort.
"""
from dataclasses import dataclass
from typing import Callable

from scripts.symptom_eval import confusion_matrix, elicitation_coverage, information_gain
from scripts.symptom_eval.conversation_runner import run_vignette_conversation
from scripts.symptom_eval.domain import Vignette
from scripts.symptom_eval.elicitation_coverage import FeaturePresenceJudgePort
from scripts.symptom_eval.information_gain import RubricJudgePort
from scripts.symptom_eval.patient_simulator import PatientSimulatorPort
from scripts.symptom_eval.system_under_test import SystemUnderTestPort


@dataclass
class AblationLegResult:
    provider: str
    confusion_matrix: dict
    elicitation_coverage: list
    information_gain: list


def run_leg(
    provider: str,
    vignettes: list[Vignette],
    system_factory: Callable[[str], SystemUnderTestPort],
    simulator: PatientSimulatorPort,
    feature_judge: FeaturePresenceJudgePort,
    rubric_judge: RubricJudgePort,
) -> AblationLegResult:
    system = system_factory(provider)
    confusion_rows = []
    coverage_results = []
    gain_results = []

    for vignette in vignettes:
        transcript = run_vignette_conversation(vignette, simulator, system)
        confusion_rows.append(confusion_matrix.score_vignette(vignette, transcript))
        coverage_results.append(
            elicitation_coverage.score_vignette(vignette, transcript, feature_judge)
        )
        gain_results.append(information_gain.score_vignette(transcript, rubric_judge))

    return AblationLegResult(
        provider=provider,
        confusion_matrix=confusion_matrix.summarize(confusion_rows),
        elicitation_coverage=coverage_results,
        information_gain=gain_results,
    )


def run_ablation(
    vignettes: list[Vignette],
    system_factory: Callable[[str], SystemUnderTestPort],
    simulator: PatientSimulatorPort,
    feature_judge: FeaturePresenceJudgePort,
    rubric_judge: RubricJudgePort,
    providers: tuple[str, ...] = ("off", "neo4j"),
) -> list[AblationLegResult]:
    return [
        run_leg(provider, vignettes, system_factory, simulator, feature_judge, rubric_judge)
        for provider in providers
    ]
