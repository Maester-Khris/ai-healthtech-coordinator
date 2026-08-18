"""
Generates Track B transcript rows (run_track_b_deepeval.py's expected
shape) by driving LiveLLMAgentAdapter in-process against the v2 (neo4j)
provider — reusing scripts.symptom_eval.system_under_test.
LiveLLMAgentAdapter exactly as-is, per graph_capture.py's own stated
intent: "closes backend/scripts/graphrag_eval/run_track_b_deepeval.py's
Blocker #2 ... same component, two consumers, no duplication." This
removes the need run_track_b_deepeval.py's own docstring originally
assumed — a deployed preview backend + disposable eval Supabase accounts —
since LiveLLMAgentAdapter already runs LLMAgent in-process with no HTTP,
no auth, no cache (same reasoning as the symptom-understanding eval's own
design doc §2).

Each SCENARIOS entry is single-turn (Track A already drives these with no
history), so this script makes exactly one LiveLLMAgentAdapter.respond()
call per scenario — no multi-turn conversation loop needed here.

Invocation:
    doppler run --config eval -- python -m scripts.graphrag_eval.generate_track_b_transcripts
    doppler run --config eval -- python -m scripts.graphrag_eval.generate_track_b_transcripts --provider static

--provider selects which GraphContextProvider (graph/factory.py) drives the
adapter — 'neo4j' (v2, the original scope) or 'static' (v1), so both
versions go through the identical transcript-generation and DeepEval
scoring path per the fairness plan's own premise.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from scripts.graphrag_eval.scenarios import SCENARIOS  # noqa: E402
from scripts.symptom_eval.system_under_test import LiveLLMAgentAdapter  # noqa: E402

TRANSCRIPTS_DIR = os.path.join(os.path.dirname(__file__), "transcripts")


def build_transcript_row(scenario: dict, adapter: LiveLLMAgentAdapter) -> dict:
    result = adapter.respond(scenario["message"], [])
    return {
        "message": scenario["message"],
        "response_text": result.response_text,
        "severity": result.severity,
        "expected_complaint": scenario["expected_complaint"],
        "surfaced_red_flags": result.surfaced_red_flag_indicators,
        "surfaced_followup_questions": result.surfaced_followup_questions,
    }


def generate_transcripts(scenarios: list[dict] | None = None, provider: str = "neo4j") -> list[dict]:
    if scenarios is None:
        scenarios = SCENARIOS
    adapter = LiveLLMAgentAdapter(graph_rag_provider=provider)
    return [build_transcript_row(scenario, adapter) for scenario in scenarios]


def write_transcripts(transcripts: list[dict], provider: str) -> str:
    os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(TRANSCRIPTS_DIR, f"track_b_transcripts_{provider}_{stamp}.json")
    with open(path, "w") as f:
        json.dump(transcripts, f, indent=2)
    return path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--provider", type=str, default="neo4j",
        help="GRAPH_RAG_PROVIDER value to drive the adapter with — 'static' (v1) or 'neo4j' (v2).",
    )
    args = parser.parse_args()

    transcripts = generate_transcripts(provider=args.provider)
    path = write_transcripts(transcripts, args.provider)
    print(f"Generated {len(transcripts)} Track B transcripts -> {path}")


if __name__ == "__main__":
    main()
