"""
Track B — DeepEval faithfulness / contextual precision / contextual recall
pass over v2 (Neo4j-backed) triage transcripts. Same Track A/B pattern as
Sprint 17's case study 1 (backend/scripts/triage_deepeval/
run_faithfulness_eval.py), extended with ContextualPrecisionMetric and
ContextualRecallMetric because — unlike Sprint 17's facility-grounding
check — this comparison needs to measure retrieval *completeness*
(whether the graph context surfaced the red flags it should have), not
just whether the response is consistent with whatever context WAS
retrieved. FaithfulnessMetric alone doesn't measure that.

*** THIS SCRIPT IS NOT RUN AS PART OF TASK 6.3. ***
DeepEval's FaithfulnessMetric/ContextualPrecisionMetric/ContextualRecallMetric
need an actually-generated LLM response (actual_output) scored against
retrieval context — they can't score a bare GraphContext retrieval result,
only a full triage response. Sprint 17's Track B got that response by
hitting a deployed preview backend with real HTTP calls through disposable
eval Supabase accounts (see generate_transcripts.py's module docstring).
Reproducing that for v2 means flipping GRAPH_RAG_PROVIDER=neo4j on a
deployed environment and running live LLM traffic against it — a
shared-infrastructure change, not something to do as a side effect of a
harness-building task. This module is built to the same input/output shape
as generate_transcripts.py/run_faithfulness_eval.py so it is ready to run
the moment someone points it at an eval backend configured with
GRAPH_RAG_PROVIDER=neo4j, and its pure functions are unit-tested (see
tests/test_run_track_b_deepeval.py, which mocks the metric objects — no
live DeepEval/API calls), but running it end-to-end and generating real
transcripts against a v2 deployment is a separate, later operational step,
not part of this task.

Expected transcript row shape (produced by a generate_transcripts.py-style
script pointed at a v2-provider deployment — not built here):
    {
        "message": str,
        "response_text": str,
        "severity": str | None,
        "expected_complaint": str | None,        # from scenarios.py
        "surfaced_red_flags": list[str],          # RedFlagMatch.indicator
                                                   # values actually in the
                                                   # graph context for this turn
        "surfaced_followup_questions": list[str], # RedFlagMatch.followup_question
                                                   # values actually in the
                                                   # graph context for this turn
    }
generate_transcripts.py's current transcript shape (message, response_text,
severity, recommended_facility) doesn't carry any of the graph-context
fields this script needs — extending it is out of scope here per this
task's constraints (this module is only a new consumer, generate_transcripts.py
itself is not modified).

Invocation (once a v2 deployment and matching transcripts exist):
    doppler run --config eval -- python scripts/graphrag_eval/run_track_b_deepeval.py \\
        --transcripts scripts/graphrag_eval/transcripts/track_b_transcripts_<stamp>.json
"""
import argparse
import glob
import json
import os
from datetime import datetime, timezone
from typing import Any

from deepeval.metrics import (
    ContextualPrecisionMetric,
    ContextualRecallMetric,
    FaithfulnessMetric,
)
from deepeval.test_case import LLMTestCase

from scripts.graphrag_eval.scenarios import expected_red_flag_indicators

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
TRANSCRIPTS_DIR = os.path.join(os.path.dirname(__file__), "transcripts")
JUDGE_MODEL = "gpt-4o-mini"
FAITHFULNESS_THRESHOLD = 0.7
CONTEXTUAL_PRECISION_THRESHOLD = 0.7
CONTEXTUAL_RECALL_THRESHOLD = 0.7

METRIC_KEYS = ("faithfulness", "contextual_precision", "contextual_recall")


def build_retrieval_context(transcript: dict) -> list[str]:
    """retrieval_context for all three metrics: the red flags and followup
    questions actually surfaced to the model for this turn (what v2's graph
    context gave the LLM) — not the ground truth. Faithfulness checks the
    response against what was actually retrieved; precision/recall check
    whether that retrieval was any good against the ground truth (see
    build_expected_context)."""
    return [
        *transcript.get("surfaced_red_flags", []),
        *transcript.get("surfaced_followup_questions", []),
    ]


def build_expected_context(transcript: dict) -> list[str]:
    """expected_output/context ground truth for ContextualPrecisionMetric/
    ContextualRecallMetric: the complaint's full red-flag indicator set from
    scenarios.py's expected_red_flag_indicators(), keyed by this
    transcript's expected_complaint (the same v1/v2 shared identity space
    documented in scenarios.py). Empty for the deliberately-no-match
    scenarios (expected_complaint is None)."""
    complaint = transcript.get("expected_complaint")
    if not complaint:
        return []
    return expected_red_flag_indicators(complaint)


def build_test_case(transcript: dict) -> LLMTestCase:
    expected_context = build_expected_context(transcript)
    return LLMTestCase(
        input=transcript["message"],
        actual_output=transcript["response_text"],
        retrieval_context=build_retrieval_context(transcript),
        expected_output="; ".join(expected_context),
        context=expected_context,
    )


def score_transcript(transcript: dict, metrics: dict[str, Any]) -> dict | None:
    """Pure scoring logic, independent of transcript-loading/CLI code —
    mirrors run_faithfulness_eval.py's score_transcript. Skips scenarios
    with no expected_complaint (nothing to measure retrieval completeness
    against), same shape as the original skipping ungrounded turns."""
    if not transcript.get("expected_complaint"):
        return None

    test_case = build_test_case(transcript)
    result: dict[str, Any] = {
        "message": transcript["message"],
        "expected_complaint": transcript["expected_complaint"],
    }
    for key in METRIC_KEYS:
        metric = metrics[key]
        metric.measure(test_case)
        result[key] = {
            "score": metric.score,
            "success": metric.success,
            "reason": metric.reason,
        }
    return result


def build_metrics() -> dict[str, Any]:
    return {
        "faithfulness": FaithfulnessMetric(
            threshold=FAITHFULNESS_THRESHOLD, model=JUDGE_MODEL
        ),
        "contextual_precision": ContextualPrecisionMetric(
            threshold=CONTEXTUAL_PRECISION_THRESHOLD, model=JUDGE_MODEL
        ),
        "contextual_recall": ContextualRecallMetric(
            threshold=CONTEXTUAL_RECALL_THRESHOLD, model=JUDGE_MODEL
        ),
    }


def summarize_scores(results: list[dict]) -> dict:
    if not results:
        return {"count": 0, "metrics": {}}

    count = len(results)
    metrics_summary = {}
    for key in METRIC_KEYS:
        scores = [r[key]["score"] for r in results]
        successes = [r[key]["success"] for r in results]
        metrics_summary[key] = {
            "mean_score": sum(scores) / count,
            "pass_rate": sum(1 for s in successes if s) / count,
        }
    return {"count": count, "metrics": metrics_summary}


def latest_transcripts_path() -> str:
    candidates = sorted(
        glob.glob(os.path.join(TRANSCRIPTS_DIR, "track_b_transcripts_*.json"))
    )
    if not candidates:
        raise FileNotFoundError(f"No transcript files found in {TRANSCRIPTS_DIR}")
    return candidates[-1]


def write_results(results: list[dict], summary: dict) -> str:
    os.makedirs(RESULTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(RESULTS_DIR, f"track_b_results_{stamp}.json")
    with open(path, "w") as f:
        json.dump({"summary": summary, "results": results}, f, indent=2)
    return path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--transcripts",
        default=None,
        help="Path to a Track B transcripts JSON file (defaults to the most recent)",
    )
    args = parser.parse_args()

    transcripts_path = args.transcripts or latest_transcripts_path()
    with open(transcripts_path) as f:
        transcripts = json.load(f)

    metrics = build_metrics()
    results = []
    for transcript in transcripts:
        result = score_transcript(transcript, metrics)
        if result is not None:
            results.append(result)

    summary = summarize_scores(results)
    path = write_results(results, summary)

    print(f"Scored {summary['count']} transcripts (complaint-grounded turns only)")
    for key, m in summary.get("metrics", {}).items():
        print(f"  {key}: mean={m['mean_score']:.3f} pass_rate={m['pass_rate']:.1%}")
    print(f"Full results written to {path}")


if __name__ == "__main__":
    main()
