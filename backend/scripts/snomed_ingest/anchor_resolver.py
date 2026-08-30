# backend/scripts/snomed_ingest/anchor_resolver.py
"""
Deterministic pre-resolver for Phase 2's anchor_mapping.py.

Classifies each of the 165 CTAS complaints into an auto-resolvable bucket, or
NEEDS_JUDGMENT for real editorial review -- before spending any LLM time on
it. Pure CLI, reads local RF2 files only: no live Neo4j, no LLM calls.

Heuristics, in priority order:
  1. AUTO_SINGLE     -- exactly one Clinical-Finding-restricted FSN candidate.
  2. AUTO_HIERARCHY  -- 2+ candidates, but one is a common IS_A ancestor of
                        all the others (within the loaded RF2 relationships)
                        -- the plan's own worked example: choose the broader
                        parent, since IS_A*0..depth traversal from it covers
                        the descendant variants without a separate anchor.
  3. AUTO_SIMILARITY -- 2+ unrelated candidates, but the top textual-
                        similarity match against the complaint's own name
                        clearly beats the runner-up (score gap >= MARGIN).
  4. NEEDS_JUDGMENT  -- everything else. Real editorial review required.

Run: cd backend && python -m scripts.snomed_ingest.anchor_resolver
"""
import argparse
import difflib
import json
import re
import time
from dataclasses import dataclass
from pathlib import Path

from scripts.snomed_ingest.constants import CLINICAL_FINDING_ROOT, FSN_TYPE_ID
from scripts.snomed_ingest.load_rf2 import concept_ids_in_subset
from scripts.snomed_ingest.rf2_reader import read_descriptions, read_relationships

DEFAULT_COMPLAINTS_PATH = Path(__file__).resolve().parents[2] / "triage/resources/symptom_triage_data.json"
DEFAULT_RF2_SNAPSHOT_DIR = (
    Path(__file__).resolve().parents[3]
    / "assets/snomedct/snomed_ct_ca/SnomedCT_Canadian_EditionRelease_PRODUCTION_20260531T120000Z/Snapshot"
)
ENGLISH_LANGUAGE_CODE = "en"

# Score gap required between the best and second-best textual-similarity
# candidate for AUTO_SIMILARITY to fire. Below this margin the pick is
# genuinely ambiguous -- escalate rather than guess.
SIMILARITY_MARGIN = 0.15
# Minimum absolute score for the best candidate, even if the margin is met --
# a "confident" 0.9 vs 0.7 is a real signal; a coin-flip 0.35 vs 0.15 is not.
SIMILARITY_MIN_SCORE = 0.45


@dataclass
class Candidate:
    concept_id: str
    fsn: str


@dataclass
class Resolution:
    nacrs_code: str
    name: str
    bucket: str  # AUTO_SINGLE | AUTO_HIERARCHY | AUTO_SIMILARITY | NEEDS_JUDGMENT | NO_MATCH
    anchor_concept_id: str | None
    anchor_fsn: str | None
    rationale: str
    candidates: list[Candidate]


def _load_complaints(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def _build_description_index(
    descriptions, clinical_finding_subtree: set[str]
) -> tuple[list[tuple[str, str]], dict[str, str]]:
    """(concept_id, term) pairs for ALL active English descriptions (FSN +
    synonyms), whose concept is in the Clinical Finding subtree -- same CF
    restriction Phase 1's complaint_seeds.py applies, and for the same reason
    (unrestricted matching pulls in false positives from Procedure/Body
    Structure/etc). Broader than FSN-only on purpose: many CTAS complaint
    names/aliases are compound/jargon phrasing that won't appear verbatim in
    a concept's formal FSN, but often does appear in one of its synonyms.

    Also returns a concept_id -> FSN lookup (separate from the match index)
    so a candidate matched via a synonym still displays its canonical FSN in
    rationale text, rather than the raw synonym string that happened to hit."""
    index = []
    fsn_of: dict[str, str] = {}
    for d in descriptions:
        if not (d.active and d.language_code == ENGLISH_LANGUAGE_CODE and d.concept_id in clinical_finding_subtree):
            continue
        index.append((d.concept_id, d.term))
        if d.type_id == FSN_TYPE_ID:
            fsn_of[d.concept_id] = d.term
    return index, fsn_of


def _expand_keywords(raw_terms: list[str]) -> list[str]:
    """Generate additional keyword variants for three observed, systematic
    CTAS naming patterns that a plain substring match can't see through:

    1. Slash-compounds bundle two real, independently-matchable medical terms
       into one string that never appears verbatim in any SNOMED description
       -- e.g. "Difficulty swallowing / Dysphagia" contains the real term
       "Dysphagia" but the compound never matches. Split on "/" and add each
       side as its own keyword.
    2. Comma-inverted phrasing is CTAS's own "Noun, Modifier" convention for
       what SNOMED phrases naturally as "Modifier Noun" -- e.g. "Edema,
       generalized" / "Discharge, ear" read as "generalized edema" / "ear
       discharge" in SNOMED's FSN/synonym text. For a two-part comma split,
       also add the reversed order.
    3. A trailing parenthetical qualifier is often CTAS's own clinical
       sub-classification, not part of SNOMED's term at all -- e.g. "Cardiac
       arrest (non traumatic)" / "Cardiac arrest (traumatic)" both fail to
       match verbatim, even though SNOMED has a plain "Cardiac arrest
       (disorder)" [410429000] AND a specific "Cardiac arrest due to trauma
       (disorder)" [422970001] -- the base phrase before the qualifier is
       exactly what's needed. Caught by manual inspection of a "critical
       gap" flag a batch worker raised on this exact complaint (see
       task-2a-report / controller diagnostic) -- not speculative.

    Confirmed against real NO_MATCH/miss cases, not speculative. Original
    terms are always kept too; this only adds variants."""
    expanded: list[str] = list(raw_terms)
    for term in raw_terms:
        if "/" in term:
            for part in term.split("/"):
                part = part.strip()
                if len(part) > 2 and part != term:
                    expanded.append(part)
        if "," in term:
            parts = [p.strip() for p in term.split(",")]
            if len(parts) == 2 and all(len(p) > 2 for p in parts):
                reversed_form = f"{parts[1]} {parts[0]}"
                expanded.append(reversed_form)
                expanded.extend(parts)
        stripped_match = re.match(r"^(.*\S)\s*\([^()]*\)\s*$", term)
        if stripped_match:
            base = stripped_match.group(1).strip()
            if len(base) > 2 and base != term:
                expanded.append(base)
    # Dedupe, preserve order (first occurrence wins) -- Python 3.7+ dict trick.
    return list(dict.fromkeys(expanded))


def _candidates_for_complaint(
    keywords: list[str],
    description_index: list[tuple[str, str]],
    fsn_of: dict[str, str],
) -> list[Candidate]:
    """Same word-boundary match rule as complaint_seeds.find_seed_concept_ids
    (see that module's docstring for why \\b doesn't work here), applied per-
    complaint instead of unioned flat across all complaints, so ambiguity can
    be resolved per complaint rather than only scoped in aggregate.

    Matches against ALL descriptions (FSN + synonyms), not just FSN -- see
    _build_description_index's docstring. A candidate's displayed `fsn` is
    always its canonical FSN via fsn_of, even when the match itself came from
    a synonym description; falls back to the matched term on the rare concept
    with no indexed FSN (shouldn't happen for real Clinical Finding concepts,
    but degrade gracefully rather than KeyError)."""
    patterns = [
        re.compile(rf"(?<![A-Za-z0-9]){re.escape(kw)}(?![A-Za-z0-9])")
        for kw in keywords
    ]
    seen: dict[str, str] = {}
    for concept_id, term in description_index:
        if concept_id in seen:
            continue
        term_lower = term.lower()
        if any(p.search(term_lower) for p in patterns):
            seen[concept_id] = fsn_of.get(concept_id, term)
    return [Candidate(cid, fsn) for cid, fsn in seen.items()]


def _find_common_ancestor(
    candidates: list[Candidate], ancestors_of: dict[str, set[str]]
) -> Candidate | None:
    """A candidate C is the answer if every other candidate is a descendant of
    C -- i.e. C is in every other candidate's ancestor set. Mirrors the plan's
    chest-pain worked example (broader parent chosen so IS_A*0..depth
    traversal from it naturally covers the descendant variants)."""
    for c in candidates:
        others = [o for o in candidates if o.concept_id != c.concept_id]
        if others and all(c.concept_id in ancestors_of.get(o.concept_id, set()) for o in others):
            return c
    return None


def _similarity_pick(complaint_name: str, candidates: list[Candidate]) -> tuple[Candidate, float, float] | None:
    scored = sorted(
        (
            (c, difflib.SequenceMatcher(None, complaint_name.lower(), c.fsn.lower()).ratio())
            for c in candidates
        ),
        key=lambda pair: pair[1],
        reverse=True,
    )
    best, best_score = scored[0]
    second_score = scored[1][1] if len(scored) > 1 else 0.0
    return best, best_score, second_score


def resolve_all(
    complaints: list[dict],
    description_index: list[tuple[str, str]],
    fsn_of: dict[str, str],
    ancestors_of: dict[str, set[str]],
    progress: bool = True,
) -> list[Resolution]:
    results: list[Resolution] = []
    total = len(complaints)
    start = time.monotonic()

    for i, complaint in enumerate(complaints, start=1):
        name = complaint["name"]
        raw_terms = [name.lower(), *[a.lower() for a in complaint.get("aliases", [])]]
        keywords = _expand_keywords(raw_terms)
        candidates = _candidates_for_complaint(keywords, description_index, fsn_of)

        if not candidates:
            res = Resolution(complaint["nacrs_code"], name, "NO_MATCH", None, None,
                              "No FSN/synonym candidate matched any keyword -- needs manual "
                              "research, not just editorial pick-among-candidates.", candidates)
        elif len(candidates) == 1:
            c = candidates[0]
            res = Resolution(complaint["nacrs_code"], name, "AUTO_SINGLE", c.concept_id, c.fsn,
                              f"Sole candidate matching complaint keywords.", candidates)
        else:
            ancestor = _find_common_ancestor(candidates, ancestors_of)
            if ancestor is not None:
                res = Resolution(
                    complaint["nacrs_code"], name, "AUTO_HIERARCHY",
                    ancestor.concept_id, ancestor.fsn,
                    f"Broader parent of all {len(candidates)} candidates in the IS_A hierarchy "
                    "-- chosen so descendant-bounded traversal covers the variants without a "
                    "separate anchor per variant (same reasoning as the plan's chest-pain example).",
                    candidates,
                )
            else:
                best, best_score, second_score = _similarity_pick(name, candidates)
                if best_score >= SIMILARITY_MIN_SCORE and (best_score - second_score) >= SIMILARITY_MARGIN:
                    res = Resolution(
                        complaint["nacrs_code"], name, "AUTO_SIMILARITY",
                        best.concept_id, best.fsn,
                        f"Textual similarity to complaint name clearly dominant "
                        f"({best_score:.2f} vs runner-up {second_score:.2f}, margin >= {SIMILARITY_MARGIN}).",
                        candidates,
                    )
                else:
                    res = Resolution(
                        complaint["nacrs_code"], name, "NEEDS_JUDGMENT", None, None,
                        f"{len(candidates)} candidates, no hierarchy relationship, no dominant "
                        f"textual match (best {best_score:.2f} vs runner-up {second_score:.2f}) "
                        "-- genuine editorial judgment required.",
                        candidates,
                    )
        results.append(res)

        if progress:
            pct = i / total * 100
            elapsed = time.monotonic() - start
            print(f"[{i:3d}/{total}] ({pct:5.1f}%) {res.bucket:15s} {name!r} "
                  f"({len(candidates)} candidates, {elapsed:5.1f}s elapsed)", flush=True)

    return results


def summarize(results: list[Resolution]) -> dict:
    from collections import Counter
    counts = Counter(r.bucket for r in results)
    return {
        "total": len(results),
        "by_bucket": dict(counts),
        "needs_judgment": [
            {"nacrs_code": r.nacrs_code, "name": r.name,
             "candidates": [{"id": c.concept_id, "fsn": c.fsn} for c in r.candidates]}
            for r in results if r.bucket == "NEEDS_JUDGMENT"
        ],
        "no_match": [
            {"nacrs_code": r.nacrs_code, "name": r.name}
            for r in results if r.bucket == "NO_MATCH"
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rf2-snapshot-dir", type=Path, default=DEFAULT_RF2_SNAPSHOT_DIR)
    parser.add_argument("--complaints-path", type=Path, default=DEFAULT_COMPLAINTS_PATH)
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent / "anchor_resolution.json")
    args = parser.parse_args()

    terminology = args.rf2_snapshot_dir / "Terminology"
    description_file = next(terminology.glob("sct2_Description_Snapshot_*.txt"))
    relationship_file = next(terminology.glob("sct2_Relationship_Snapshot_*.txt"))

    print("Reading RF2 relationships and descriptions (this is the slow part, ~15-25s)...", flush=True)
    t0 = time.monotonic()
    relationships = list(read_relationships(relationship_file))
    descriptions = list(read_descriptions(description_file))
    print(f"  done in {time.monotonic() - t0:.1f}s "
          f"({len(relationships):,} relationships, {len(descriptions):,} descriptions)", flush=True)

    print("Building Clinical Finding subtree + ancestor index...", flush=True)
    t0 = time.monotonic()
    clinical_finding_subtree = concept_ids_in_subset(relationships, CLINICAL_FINDING_ROOT)
    # ancestors_of[x] = every concept reachable upward from x via IS_A (its
    # transitive parents) -- built once, reused for every complaint's
    # hierarchy check, instead of a live query per candidate pair.
    parent_of: dict[str, list[str]] = {}
    for r in relationships:
        if r.type_id == "116680003" and r.active:  # IS_A_TYPE_ID
            parent_of.setdefault(r.source_id, []).append(r.destination_id)

    def _ancestors(concept_id: str) -> set[str]:
        seen: set[str] = set()
        frontier = [concept_id]
        while frontier:
            nxt = []
            for c in frontier:
                for p in parent_of.get(c, []):
                    if p not in seen:
                        seen.add(p)
                        nxt.append(p)
            frontier = nxt
        return seen

    description_index, fsn_of = _build_description_index(descriptions, clinical_finding_subtree)
    print(f"  done in {time.monotonic() - t0:.1f}s "
          f"({len(clinical_finding_subtree):,} concepts in Clinical Finding, "
          f"{len(description_index):,} description candidates indexed, "
          f"{len(fsn_of):,} with a known FSN)", flush=True)

    complaints = _load_complaints(args.complaints_path)
    print(f"Resolving {len(complaints)} complaints...", flush=True)

    # Ancestor sets are only computed for concepts that actually show up as
    # candidates, not the whole subtree -- cheap, and avoids paying for
    # ~10-20k ancestor-closure computations nothing will ever look up.
    all_candidate_ids = {cid for cid, _ in description_index}
    ancestors_of = {cid: _ancestors(cid) for cid in all_candidate_ids}

    results = resolve_all(complaints, description_index, fsn_of, ancestors_of)

    summary = summarize(results)
    args.out.write_text(json.dumps(
        {
            "summary": {"total": summary["total"], "by_bucket": summary["by_bucket"]},
            "resolutions": [
                {
                    "nacrs_code": r.nacrs_code, "name": r.name, "bucket": r.bucket,
                    "anchor_concept_id": r.anchor_concept_id, "anchor_fsn": r.anchor_fsn,
                    "rationale": r.rationale,
                    "candidates": [{"id": c.concept_id, "fsn": c.fsn} for c in r.candidates],
                }
                for r in results
            ],
        },
        indent=2,
    ))

    print()
    print("=" * 60)
    print(f"Total complaints: {summary['total']}")
    for bucket, count in sorted(summary["by_bucket"].items()):
        print(f"  {bucket:15s} {count:3d} ({count / summary['total'] * 100:.1f}%)")
    print(f"Written to {args.out}")


if __name__ == "__main__":
    main()
