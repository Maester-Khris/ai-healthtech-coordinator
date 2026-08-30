"""
ScoreTriageConfusionMatrix — deterministic, no LLM judge (Metric 2). Compares
the system's final severity call against the vignette's gold answer using
the CTAS-5 to app-4 severity mapping already established and reviewed in
Sprint 18 (backend/scripts/reconcile_ctas_data.py::CTAS_TO_APP_SEVERITY,
reused via Task 4's vignette_loader — not re-derived here).
"""
from dataclasses import dataclass

from scripts.symptom_eval.domain import SEVERITY_RANK, Vignette, VignetteTranscript


@dataclass
class ConfusionMatrixRow:
    case_id: str
    predicted: str | None
    gold: str
    correct: bool
    under_triaged: bool


def score_vignette(vignette: Vignette, transcript: VignetteTranscript) -> ConfusionMatrixRow:
    predicted = transcript.final_severity
    gold = vignette.gold_severity
    under_triaged = predicted is not None and SEVERITY_RANK[predicted] < SEVERITY_RANK[gold]

    return ConfusionMatrixRow(
        case_id=vignette.case_id,
        predicted=predicted,
        gold=gold,
        correct=predicted == gold,
        under_triaged=under_triaged,
    )


def summarize(rows: list[ConfusionMatrixRow]) -> dict:
    count = len(rows)
    if count == 0:
        return {"count": 0, "accuracy": 0.0, "under_triage_rate": 0.0}

    correct = sum(1 for r in rows if r.correct)
    under = sum(1 for r in rows if r.under_triaged)
    return {"count": count, "accuracy": correct / count, "under_triage_rate": under / count}
