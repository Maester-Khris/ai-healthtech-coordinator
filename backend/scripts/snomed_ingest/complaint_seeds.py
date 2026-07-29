# backend/scripts/snomed_ingest/complaint_seeds.py
"""
Complaint-anchored seed selection for Phase 1's Clinical Finding subset.

Deviation from the plan's literal single-root design (see load_rf2.py's module
docstring / task-1-report.md for the full rationale): the full Clinical Finding
subtree (129,425 concepts) is ~3x over Neo4j AuraDB Free tier's 200,000-node cap.
The actual downstream need — Phase 2's red-flag anchors and Phase 3's bounded
IS_A*0..4 traversal from each anchor — never needed the whole subtree, only the
neighborhoods around the CTAS complaint list. This module does a mechanical
FSN-substring candidate search against the raw RF2 Description file (no Neo4j
involved) to find seed concepts for those neighborhoods; load_rf2.py then walks
IS_A descendants from each seed up to a bounded depth.

This is the same match logic Phase 2's anchor-mapping was always going to run
(FSN, English, keyword-in-term) — executed here pre-load against flat files
instead of post-load against the graph, purely to scope what gets written.
"""
import json
from pathlib import Path
from typing import Iterable

from backend.scripts.snomed_ingest.constants import FSN_TYPE_ID
from backend.scripts.snomed_ingest.rf2_reader import DescriptionRow

ENGLISH_LANGUAGE_CODE = "en"


def load_complaint_keywords(path: Path) -> list[str]:
    """Read the CTAS complaint list and return every complaint name + alias,
    lowercased, as a flat list of candidate match keywords."""
    complaints = json.loads(path.read_text(encoding="utf-8"))
    keywords: list[str] = []
    for complaint in complaints:
        keywords.append(complaint["name"].lower())
        for alias in complaint.get("aliases", []):
            keywords.append(alias.lower())
    return keywords


def find_seed_concept_ids(
    descriptions: Iterable[DescriptionRow], keywords: list[str]
) -> set[str]:
    """Mechanical substring match: for every active English FSN description,
    if any complaint keyword is a substring of the term (case-insensitive),
    its concept is a seed. Same match rule Phase 2's anchor-mapping uses,
    run here against the raw file instead of the graph."""
    seeds: set[str] = set()
    for d in descriptions:
        if not d.active or d.type_id != FSN_TYPE_ID or d.language_code != ENGLISH_LANGUAGE_CODE:
            continue
        term_lower = d.term.lower()
        if any(keyword in term_lower for keyword in keywords):
            seeds.add(d.concept_id)
    return seeds
