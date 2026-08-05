"""
RunBaselineAblation (Metric 4) — runs the full vignette pool through the
conversation loop once per GRAPH_RAG_PROVIDER leg, diffing Metrics 1-3
between legs. No new scoring logic — Metrics 1-3 called once per leg
(backend/graph/factory.py:12 defines the provider values), per design §6.

Takes system_factory rather than constructing LiveLLMAgentAdapter directly —
per this plan's Dependency Rule, only cli.py (Main) may reference that
concrete adapter; this file only sees SystemUnderTestPort.

CheckpointStore persists each vignette-leg's scored result to a JSONL file
as soon as it's computed, not just after a full leg completes — added after
Task 13's first live run crashed on a Groq daily-quota 429 partway through
the `off` leg and lost every already-completed vignette's work, since
nothing was written to disk until both legs finished. Only stdlib file I/O
here (json/os), not a vendor SDK, so it stays in this use-case file rather
than needing a cli.py-only adapter.
"""
import json
import os
from collections import defaultdict
from dataclasses import asdict, dataclass
from typing import Callable

from scripts.symptom_eval import confusion_matrix, elicitation_coverage, information_gain
from scripts.symptom_eval.confusion_matrix import ConfusionMatrixRow
from scripts.symptom_eval.conversation_runner import run_vignette_conversation
from scripts.symptom_eval.domain import Vignette
from scripts.symptom_eval.elicitation_coverage import ElicitationCoverageResult, FeaturePresenceJudgePort
from scripts.symptom_eval.information_gain import InformationGainResult, RubricJudgePort
from scripts.symptom_eval.patient_simulator import PatientSimulatorPort
from scripts.symptom_eval.system_under_test import SystemUnderTestPort


@dataclass
class AblationLegResult:
    provider: str
    confusion_matrix: dict
    elicitation_coverage: list
    information_gain: list


class CheckpointStore:
    """Append-only JSONL checkpoint, one line per completed vignette-leg.

    Loading an existing file reconstructs what's already done; rerunning
    run_ablation/run_leg against the same path skips those vignette-legs and
    resumes from wherever a crash (e.g. a Groq 429) left off — a rerun after
    a fresh daily quota loses at most the one vignette in flight when it
    died, not the whole run.
    """

    def __init__(self, path: str):
        self._path = path
        self.entries: dict[str, list[dict]] = defaultdict(list)
        self.done: set[tuple[str, str]] = set()
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    entry = json.loads(line)
                    self.entries[entry["provider"]].append(entry)
                    self.done.add((entry["provider"], entry["case_id"]))

    def has(self, provider: str, case_id: str) -> bool:
        return (provider, case_id) in self.done

    def append(
        self,
        provider: str,
        confusion_row: ConfusionMatrixRow,
        coverage: ElicitationCoverageResult,
        gain: InformationGainResult,
    ) -> None:
        entry = {
            "provider": provider,
            "case_id": confusion_row.case_id,
            "confusion_row": asdict(confusion_row),
            "coverage": asdict(coverage),
            "gain": asdict(gain),
        }
        with open(self._path, "a") as f:
            f.write(json.dumps(entry) + "\n")
        self.entries[provider].append(entry)
        self.done.add((provider, confusion_row.case_id))

    def rows_for(
        self, provider: str
    ) -> tuple[list[ConfusionMatrixRow], list[ElicitationCoverageResult], list[InformationGainResult]]:
        entries = self.entries[provider]
        confusion_rows = [ConfusionMatrixRow(**e["confusion_row"]) for e in entries]
        coverages = [ElicitationCoverageResult(**e["coverage"]) for e in entries]
        gains = [InformationGainResult(**e["gain"]) for e in entries]
        return confusion_rows, coverages, gains


def run_leg(
    provider: str,
    vignettes: list[Vignette],
    system_factory: Callable[[str], SystemUnderTestPort],
    simulator: PatientSimulatorPort,
    feature_judge: FeaturePresenceJudgePort,
    rubric_judge: RubricJudgePort,
    checkpoint: CheckpointStore | None = None,
) -> AblationLegResult:
    system = system_factory(provider)
    if checkpoint is not None:
        confusion_rows, coverage_results, gain_results = checkpoint.rows_for(provider)
    else:
        confusion_rows, coverage_results, gain_results = [], [], []

    for vignette in vignettes:
        if checkpoint is not None and checkpoint.has(provider, vignette.case_id):
            continue

        transcript = run_vignette_conversation(vignette, simulator, system)
        row = confusion_matrix.score_vignette(vignette, transcript)
        coverage = elicitation_coverage.score_vignette(vignette, transcript, feature_judge)
        gain = information_gain.score_vignette(transcript, rubric_judge)

        confusion_rows.append(row)
        coverage_results.append(coverage)
        gain_results.append(gain)
        if checkpoint is not None:
            checkpoint.append(provider, row, coverage, gain)

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
    checkpoint: CheckpointStore | None = None,
) -> list[AblationLegResult]:
    return [
        run_leg(
            provider, vignettes, system_factory, simulator, feature_judge, rubric_judge,
            checkpoint=checkpoint,
        )
        for provider in providers
    ]
