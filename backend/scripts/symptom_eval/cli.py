"""
Composition root ("Main" per Clean Architecture §6) — the only file in this
package allowed to import every concrete adapter and wire them together. No
use case or Entity file imports anthropic/openai/deepeval/LLMAgent directly
(Global Constraints' Dependency Rule); this file is where those concrete
choices are made.

Invocation:
    doppler run --config eval -- python -m scripts.symptom_eval.cli extract-checklists
    doppler run --config eval -- python -m scripts.symptom_eval.cli run-ablation --limit 3
"""
import argparse
import json
import os
from dataclasses import asdict
from datetime import datetime, timezone

from scripts.symptom_eval.ablation import CheckpointStore, run_ablation
from scripts.symptom_eval.checklist_extractor import OpenAIChecklistExtractor
from scripts.symptom_eval.elicitation_coverage import DeepEvalFeaturePresenceJudge
from scripts.symptom_eval.information_gain import DeepEvalRubricJudge
from scripts.symptom_eval.patient_simulator import AnthropicPatientSimulator
from scripts.symptom_eval.system_under_test import LiveLLMAgentAdapter
from scripts.symptom_eval.vignette_loader import CHECKLISTS_DIR, load_all_vignettes, load_raw_vignettes

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")


def extract_checklists() -> None:
    extractor = OpenAIChecklistExtractor()
    os.makedirs(CHECKLISTS_DIR, exist_ok=True)
    for raw in load_raw_vignettes():
        case_id = str(raw["case_id"])
        path = os.path.join(CHECKLISTS_DIR, f"{case_id}.json")
        if os.path.exists(path):
            continue  # never silently overwrite a human-reviewed checklist
        checklist = extractor.extract(raw["scenario"], case_id)
        with open(path, "w") as f:
            json.dump(checklist, f, indent=2)
        print(f"wrote {path} — review before committing")


def run_ablation_command(limit: int | None, checkpoint_path: str | None = None) -> None:
    vignettes = load_all_vignettes()
    if limit:
        vignettes = vignettes[:limit]
    if not vignettes:
        raise SystemExit(
            "No vignettes with authored checklists found — run "
            "'extract-checklists' first, review the output, then re-run."
        )

    os.makedirs(RESULTS_DIR, exist_ok=True)
    checkpoint_path = checkpoint_path or os.path.join(RESULTS_DIR, "checkpoint.jsonl")
    checkpoint = CheckpointStore(checkpoint_path)
    already_done = len(checkpoint.done)
    if already_done:
        print(f"Resuming from checkpoint {checkpoint_path} — {already_done} vignette-legs already recorded")

    legs = run_ablation(
        vignettes=vignettes,
        system_factory=lambda provider: LiveLLMAgentAdapter(graph_rag_provider=provider),
        simulator=AnthropicPatientSimulator(),
        feature_judge=DeepEvalFeaturePresenceJudge(),
        rubric_judge=DeepEvalRubricJudge(),
        checkpoint=checkpoint,
    )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(RESULTS_DIR, f"ablation_results_{stamp}.json")
    with open(path, "w") as f:
        json.dump(
            [
                {
                    "provider": leg.provider,
                    "confusion_matrix": leg.confusion_matrix,
                    "elicitation_coverage": [asdict(r) for r in leg.elicitation_coverage],
                    "information_gain": [asdict(r) for r in leg.information_gain],
                }
                for leg in legs
            ],
            f, indent=2,
        )

    for leg in legs:
        print(f"{leg.provider}: {leg.confusion_matrix}")
    print(f"Full results written to {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("extract-checklists")
    run_parser = subparsers.add_parser("run-ablation")
    run_parser.add_argument("--limit", type=int, default=None)
    run_parser.add_argument(
        "--checkpoint", type=str, default=None,
        help="Path to the JSONL checkpoint file (default: results/checkpoint.jsonl). "
             "Rerunning the same command with the same path resumes from where it left off.",
    )
    args = parser.parse_args()

    if args.command == "extract-checklists":
        extract_checklists()
    elif args.command == "run-ablation":
        run_ablation_command(args.limit, args.checkpoint)


if __name__ == "__main__":
    main()
