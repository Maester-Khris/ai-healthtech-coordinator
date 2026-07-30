# backend/scripts/snomed_ingest/search_snomed.py
"""
Ad-hoc exploratory search against the local SNOMED CT RF2 data -- for
verifying a candidate concept actually exists before proposing it as an
anchor, rather than guessing blind (the plan's mapping methodology forbids
"a fuzzy guess").

Loose substring search (not the strict word-boundary regex production
matching uses) against ALL active English descriptions (FSN + synonyms).
Restricted to Clinical Finding by default -- pass --any-hierarchy to search
everything if a complaint's real concept might live outside Clinical Finding
(procedures, situations, etc).

Run (from backend/):
    python -m scripts.snomed_ingest.search_snomed "generalized edema"
    python -m scripts.snomed_ingest.search_snomed "removal of sutures" --any-hierarchy
    python -m scripts.snomed_ingest.search_snomed "edema" --limit 30
"""
import argparse
from pathlib import Path

from scripts.snomed_ingest.constants import CLINICAL_FINDING_ROOT
from scripts.snomed_ingest.load_rf2 import concept_ids_in_subset
from scripts.snomed_ingest.rf2_reader import read_descriptions, read_relationships

DEFAULT_RF2_SNAPSHOT_DIR = (
    Path(__file__).resolve().parents[3]
    / "assets/snomedct/snomed_ct_ca/SnomedCT_Canadian_EditionRelease_PRODUCTION_20260531T120000Z/Snapshot"
)
ENGLISH_LANGUAGE_CODE = "en"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("query", help="Free-text term to search for (case-insensitive substring)")
    parser.add_argument("--rf2-snapshot-dir", type=Path, default=DEFAULT_RF2_SNAPSHOT_DIR)
    parser.add_argument("--any-hierarchy", action="store_true",
                         help="Search all of SNOMED, not just Clinical Finding descendants")
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()

    terminology = args.rf2_snapshot_dir / "Terminology"
    description_file = next(terminology.glob("sct2_Description_Snapshot_*.txt"))

    descriptions = list(read_descriptions(description_file))

    allowed_ids: set[str] | None = None
    if not args.any_hierarchy:
        relationship_file = next(terminology.glob("sct2_Relationship_Snapshot_*.txt"))
        relationships = list(read_relationships(relationship_file))
        allowed_ids = concept_ids_in_subset(relationships, CLINICAL_FINDING_ROOT)

    query_lower = args.query.lower()
    seen: dict[str, tuple[str, str]] = {}  # concept_id -> (fsn_or_matched_term, matched_term)
    fsn_of: dict[str, str] = {}

    for d in descriptions:
        if not (d.active and d.language_code == ENGLISH_LANGUAGE_CODE):
            continue
        if allowed_ids is not None and d.concept_id not in allowed_ids:
            continue
        if d.type_id == "900000000000003001":  # FSN_TYPE_ID
            fsn_of[d.concept_id] = d.term
        if query_lower in d.term.lower() and d.concept_id not in seen:
            seen[d.concept_id] = d.term

    results = [
        (cid, fsn_of.get(cid, matched_term), matched_term)
        for cid, matched_term in seen.items()
    ]
    results.sort(key=lambda r: len(r[1]))  # shorter FSN first -- usually the more general/canonical hit

    scope = "all SNOMED" if args.any_hierarchy else "Clinical Finding only"
    print(f"Query: {args.query!r}  |  Scope: {scope}  |  {len(results)} concept(s) matched\n")
    for cid, fsn, matched_term in results[: args.limit]:
        marker = "" if matched_term == fsn else f"  (via synonym: {matched_term!r})"
        print(f"  {cid:>18}  {fsn}{marker}")
    if len(results) > args.limit:
        print(f"\n  ... and {len(results) - args.limit} more (use --limit to see more)")


if __name__ == "__main__":
    main()
