"""
Combines the latest Track A (original and vocabulary-neutral scenario
sets) and Track B results into one Markdown summary for the case-study
writeup — Step 6 of docs/superpowers/plans/
2026-08-05-v1-v2-retrieval-eval-fairness.md. Reads the most recent results
file of each kind from backend/scripts/graphrag_eval/results/ (gitignored,
regenerate via the other scripts in this package) rather than reporting
one Track A number alone, which is how the original "v2 looks unfairly
bad" impression happened in the first place.
"""
import glob
import json
import os

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")


def _latest(pattern: str) -> dict | None:
    candidates = sorted(glob.glob(os.path.join(RESULTS_DIR, pattern)))
    if not candidates:
        return None
    with open(candidates[-1]) as f:
        return json.load(f)


def _format_track_a_section(title: str, result: dict | None) -> list[str]:
    lines = [f"## {title}"]
    if result is None:
        lines.append("no results found\n")
        return lines
    for provider, leg in result.items():
        if leg.get("skipped"):
            lines.append(f"- {provider}: SKIPPED — {leg['reason']}")
            continue
        s = leg["summary"]
        lines.append(
            f"- {provider}: {s['hits']}/{s['count']} hits ({s['accuracy']:.1%}), "
            f"recall {s.get('recall_count', 0)} evaluated at {s.get('recall_rate', 0):.1%}"
        )
    lines.append("")
    return lines


def build_report() -> str:
    track_a = _latest("track_a_results_*.json")
    track_a_lay = _latest("track_a_lay_results_*.json")
    track_b = _latest("track_b_results_*.json")

    lines = ["# V1 vs V2 Retrieval — Combined Track A/B Report", ""]
    lines += _format_track_a_section("Track A — original scenario set (vocabulary calibrated to v1)", track_a)
    lines += _format_track_a_section("Track A — vocabulary-neutral (lay-phrasing) scenario set", track_a_lay)

    lines.append("## Track B — DeepEval faithfulness / contextual precision / recall (v2)")
    if track_b is None:
        lines.append("no results found\n")
    else:
        for key, m in track_b["summary"].get("metrics", {}).items():
            lines.append(f"- {key}: mean={m['mean_score']:.3f}, pass_rate={m['pass_rate']:.1%}")
        lines.append("")

    return "\n".join(lines)


def main() -> None:
    print(build_report())


if __name__ == "__main__":
    main()
