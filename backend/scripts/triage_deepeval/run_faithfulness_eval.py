"""
Phase B, stage 2: offline DeepEval Faithfulness pass over transcripts written by
generate_transcripts.py. Complements case study 1's existing deterministic
groundedness check (exact facility-name match) with an LLM-judged check of
whether the *entire* response is faithful to the facility fact the model was
actually given — catching fabricated details (wrong hours, invented services,
wrong distance) that a name-only substring match would miss.

Scope: Faithfulness only. Premature-classification rate is explicitly out of
scope for this pass — see the plan's Global Constraints.

Invocation:
    doppler run --config eval -- python scripts/triage_deepeval/run_faithfulness_eval.py \
        --transcripts scripts/triage_deepeval/transcripts/transcripts_<stamp>.json
"""
import argparse
import glob
import json
import os
from datetime import datetime, timezone
from typing import Any

from deepeval.metrics import FaithfulnessMetric
from deepeval.test_case import LLMTestCase

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
JUDGE_MODEL = "gpt-4o-mini"
FAITHFULNESS_THRESHOLD = 0.7


def build_retrieval_context(facility: dict) -> list[str]:
    return [
        f"Facility: {facility['name']}. "
        f"Address: {facility['address']}. "
        f"Distance: {facility['distanceKm']} km."
    ]


def score_transcript(transcript: dict, metric: Any) -> dict | None:
    facility = transcript["recommended_facility"]
    if facility is None:
        return None

    test_case = LLMTestCase(
        input=transcript["message"],
        actual_output=transcript["response_text"],
        retrieval_context=build_retrieval_context(facility),
    )
    metric.measure(test_case)

    return {
        "message": transcript["message"],
        "score": metric.score,
        "success": metric.success,
        "reason": metric.reason,
    }


def summarize_scores(results: list[dict]) -> dict:
    if not results:
        return {"count": 0, "mean_score": 0.0, "pass_rate": 0.0}

    count = len(results)
    mean_score = sum(r["score"] for r in results) / count
    pass_rate = sum(1 for r in results if r["success"]) / count
    return {"count": count, "mean_score": mean_score, "pass_rate": pass_rate}


def latest_transcripts_path() -> str:
    transcripts_dir = os.path.join(os.path.dirname(__file__), "transcripts")
    candidates = sorted(glob.glob(os.path.join(transcripts_dir, "transcripts_*.json")))
    if not candidates:
        raise FileNotFoundError(f"No transcript files found in {transcripts_dir}")
    return candidates[-1]


def write_results(results: list[dict], summary: dict) -> str:
    os.makedirs(RESULTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(RESULTS_DIR, f"faithfulness_results_{stamp}.json")
    with open(path, "w") as f:
        json.dump({"summary": summary, "results": results}, f, indent=2)
    return path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--transcripts", default=None, help="Path to a transcripts JSON file (defaults to the most recent)")
    args = parser.parse_args()

    transcripts_path = args.transcripts or latest_transcripts_path()
    with open(transcripts_path) as f:
        transcripts = json.load(f)

    metric = FaithfulnessMetric(threshold=FAITHFULNESS_THRESHOLD, model=JUDGE_MODEL)
    results = []
    for transcript in transcripts:
        result = score_transcript(transcript, metric)
        if result is not None:
            results.append(result)

    summary = summarize_scores(results)
    path = write_results(results, summary)

    print(f"Scored {summary['count']} transcripts (facility-grounded turns only)")
    print(f"Mean faithfulness score: {summary['mean_score']:.3f}")
    print(f"Pass rate (threshold {FAITHFULNESS_THRESHOLD}): {summary['pass_rate']:.1%}")
    print(f"Full results written to {path}")


if __name__ == "__main__":
    main()
