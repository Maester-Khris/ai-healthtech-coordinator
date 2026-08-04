"""
Track A — v1 (StaticLookupProvider) vs v2 (Neo4jSnomedProvider) retrieval
hit-rate comparison. Runs in-process, directly through
graph.factory.get_graph_provider() with GRAPH_RAG_PROVIDER switched per leg
— no deployed backend, no eval Supabase accounts, no live LLM call. This is
the "shared groundedness check... compared on the same scale" design §12
asks for.

Applying ranked-retrieval metrics like MRR to v1's single-best-match lookup
is a stretch (design §12) — both legs are scored the same simple way
instead: a hit is `ctx.matched and ctx.complaint_name == expected_complaint`
(and, for the deliberately-no-match scenarios in scenarios.py, a hit is
`ctx.matched is False`).

Invocation (from backend/, venv activated):
    doppler run -- python -m scripts.graphrag_eval.run_track_a_retrieval --provider both

`--provider static` or `--provider neo4j` runs a single leg. If the neo4j
leg's provider construction fails (e.g. NEO4J_URI/NEO4J_USERNAME/
NEO4J_PASSWORD missing from the environment), that leg is skipped with a
clear message and the static leg's results are still reported — a missing
credential never kills the whole run.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from graph.base import GraphContext, GraphContextProvider  # noqa: E402
from graph.factory import close_graph_provider, get_graph_provider  # noqa: E402
from scripts.graphrag_eval.scenarios import SCENARIOS  # noqa: E402

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
PROVIDER_NAMES = ("static", "neo4j")


def score_hit(ctx: GraphContext, expected_complaint: str | None) -> bool:
    """Pure scoring logic, independent of provider construction/CLI code —
    mirrors generate_transcripts.py's build_transcript_row."""
    if expected_complaint is None:
        return not ctx.matched
    return ctx.matched and ctx.complaint_name == expected_complaint


def run_scenarios(
    provider: GraphContextProvider, scenarios: list[dict] | None = None
) -> list[dict]:
    if scenarios is None:
        scenarios = SCENARIOS
    details = []
    for scenario in scenarios:
        ctx = provider.get_symptom_graph_context(scenario["message"], [])
        details.append(
            {
                "message": scenario["message"],
                "expected_complaint": scenario["expected_complaint"],
                "actual_complaint": ctx.complaint_name,
                "matched": ctx.matched,
                "hit": score_hit(ctx, scenario["expected_complaint"]),
            }
        )
    return details


def summarize(details: list[dict]) -> dict:
    count = len(details)
    if count == 0:
        return {"count": 0, "hits": 0, "accuracy": 0.0}
    hits = sum(1 for d in details if d["hit"])
    return {"count": count, "hits": hits, "accuracy": hits / count}


def build_provider(provider_name: str) -> GraphContextProvider:
    """Sets GRAPH_RAG_PROVIDER and delegates to the real factory — the same
    public entry point LLMAgent uses, per this task's constraint against
    touching graph/factory.py itself."""
    os.environ["GRAPH_RAG_PROVIDER"] = provider_name
    return get_graph_provider()


def run_provider_leg(provider_name: str) -> dict:
    try:
        provider = build_provider(provider_name)
    except Exception as exc:
        print(f"Skipping '{provider_name}' leg — provider construction failed: {exc}")
        return {"skipped": True, "reason": str(exc)}

    try:
        details = run_scenarios(provider)
    finally:
        # C-1 fix: close via the factory, not the instance directly — this
        # evicts the closed provider from _provider_cache too, so a later
        # get_graph_provider() call for the same provider name constructs
        # fresh instead of returning a dead driver. Calling provider.close()
        # directly closed the driver but left it cached, so any later
        # _lookup() silently degraded to matched=False (swallowed by
        # GraphContextProvider's never-raises contract) instead of erroring.
        close_graph_provider()

    return {"summary": summarize(details), "details": details}


def write_results(results: dict) -> str:
    os.makedirs(RESULTS_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(RESULTS_DIR, f"track_a_results_{stamp}.json")
    with open(path, "w") as f:
        json.dump(results, f, indent=2)
    return path


def print_summary(results: dict[str, Any]) -> None:
    print("Track A retrieval hit-rate comparison (v1 static vs v2 neo4j)")
    for name, result in results.items():
        if result.get("skipped"):
            print(f"  {name}: SKIPPED — {result['reason']}")
            continue
        summary = result["summary"]
        print(
            f"  {name}: {summary['hits']}/{summary['count']} hits "
            f"({summary['accuracy']:.1%})"
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--provider",
        choices=["static", "neo4j", "both"],
        default="both",
        help="Which provider leg(s) to run (default: both)",
    )
    args = parser.parse_args()

    names = list(PROVIDER_NAMES) if args.provider == "both" else [args.provider]

    results: dict[str, Any] = {name: run_provider_leg(name) for name in names}

    path = write_results(results)
    print_summary(results)
    print(f"Full results written to {path}")


if __name__ == "__main__":
    main()
