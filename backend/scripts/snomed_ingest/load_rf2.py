# backend/scripts/snomed_ingest/load_rf2.py
import argparse
from itertools import islice
from pathlib import Path
from typing import Iterable, Iterator, TypeVar
from neo4j import GraphDatabase

from backend.scripts.snomed_ingest.constants import (
    CLINICAL_FINDING_ROOT, IS_A_TYPE_ID, FSN_TYPE_ID, MAX_SEED_DESCENDANT_DEPTH,
)
from backend.scripts.snomed_ingest.rf2_reader import (
    read_concepts, read_descriptions, read_relationships,
)
from backend.scripts.snomed_ingest.complaint_seeds import (
    load_complaint_keywords, find_seed_concept_ids,
)

DEFAULT_COMPLAINTS_PATH = Path("backend/triage/resources/symptom_triage_data.json")

# Batch size for UNWIND-based writes. Approved deviation from the plan's literal
# one-row-per-session.run() code: the Clinical Finding subset is ~129k concepts /
# ~490k descriptions / ~264k IS_A relationships, so unbatched writes are ~1.37M
# individual network round-trips to Neo4j Aura — a multi-hour, fragile operation.
# Batching with UNWIND preserves identical MERGE semantics (including the
# order-dependent last-FSN-wins behavior on c.fsn) while cutting round-trips by
# ~3 orders of magnitude.
BATCH_SIZE = 1000

T = TypeVar("T")


def _batched(iterable: Iterable[T], size: int) -> Iterator[list[T]]:
    it = iter(iterable)
    while batch := list(islice(it, size)):
        yield batch


def concept_ids_in_subset(relationships, root, max_depth: int | None = None) -> set[str]:
    """Every concept reachable from `root` by walking IS_A edges downward
    (i.e. every descendant of root, transitively), plus root itself.

    `root` may be a single concept id (str) or an iterable of seed concept ids —
    the multi-seed form supports the complaint-anchored subset (see
    complaint_seeds.py): union the descendants of every CTAS complaint's seed
    concepts instead of walking one root's entire subtree.

    `max_depth` bounds how many IS_A hops to descend from each root/seed;
    None (default) walks the full subtree, preserving the original single-root
    behavior this function was written for.
    """
    roots = {root} if isinstance(root, str) else set(root)
    children_of = {}
    for r in relationships:
        if r.type_id == IS_A_TYPE_ID and r.active:
            children_of.setdefault(r.destination_id, []).append(r.source_id)

    subset = set(roots)
    frontier = list(roots)
    depth = 0
    while frontier and (max_depth is None or depth < max_depth):
        next_frontier = []
        for parent in frontier:
            for child in children_of.get(parent, []):
                if child not in subset:
                    subset.add(child)
                    next_frontier.append(child)
        frontier = next_frontier
        depth += 1
    return subset


def load(
    rf2_snapshot_dir: Path,
    source_release: str,
    neo4j_uri: str,
    neo4j_auth: tuple[str, str],
    complaints_path: Path = DEFAULT_COMPLAINTS_PATH,
):
    terminology = rf2_snapshot_dir / "Terminology"
    concept_file = next(terminology.glob("sct2_Concept_Snapshot_*.txt"))
    description_file = next(terminology.glob("sct2_Description_Snapshot_*.txt"))
    relationship_file = next(terminology.glob("sct2_Relationship_Snapshot_*.txt"))

    relationships = list(read_relationships(relationship_file))
    descriptions = list(read_descriptions(description_file))

    # Approved deviation from the plan's literal single-root subset design (see
    # constants.py's MAX_SEED_DESCENDANT_DEPTH comment and task-1-report.md): the
    # full Clinical Finding subtree is ~3x over Neo4j AuraDB Free tier's 200,000-node
    # cap, and was never actually needed downstream — only the neighborhoods around
    # the CTAS complaint concepts. Restrict candidate seed matches to genuine Clinical
    # Finding descendants first (fixes a false-positive-seed problem: unrestricted
    # keyword matching also hits Procedure/Body Structure/other non-finding concepts
    # by string coincidence, e.g. "shock" matching "Electric shock therapy"), then
    # union each seed's IS_A descendants up to MAX_SEED_DESCENDANT_DEPTH.
    clinical_finding_subtree = concept_ids_in_subset(relationships, CLINICAL_FINDING_ROOT)
    keywords = load_complaint_keywords(complaints_path)
    seed_ids = find_seed_concept_ids(descriptions, keywords) & clinical_finding_subtree
    subset_ids = concept_ids_in_subset(relationships, seed_ids, max_depth=MAX_SEED_DESCENDANT_DEPTH)

    driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
    with driver.session() as session:
        # Approved deviation from the plan's literal code (same category as UNWIND
        # batching above): without a uniqueness constraint, every MERGE on {id: ...}
        # does a full label scan, which degrades toward O(n) per row as the graph
        # grows — observed directly (68,121/129,425 concepts in ~22 min before this
        # was added). Standard Neo4j bulk-load practice; additive only, no semantic
        # change; safe to run every invocation via IF NOT EXISTS.
        session.run(
            "CREATE CONSTRAINT IF NOT EXISTS FOR (c:SnomedConcept) REQUIRE c.id IS UNIQUE"
        )
        session.run(
            "CREATE CONSTRAINT IF NOT EXISTS FOR (d:Description) REQUIRE d.id IS UNIQUE"
        )

        concept_rows = (
            {"id": c.id, "source_release": source_release, "effective_time": c.effective_time}
            for c in read_concepts(concept_file)
            if c.id in subset_ids and c.active
        )
        for batch in _batched(concept_rows, BATCH_SIZE):
            session.run(
                "UNWIND $rows AS row "
                "MERGE (c:SnomedConcept {id: row.id}) "
                "SET c.source_release = row.source_release, c.effective_time = row.effective_time",
                rows=batch,
            )

        # `descriptions` was already read fully into memory above for seed matching;
        # reuse it here instead of re-reading the file a second time. Loads both
        # EN and FR descriptions (and all description types, not just FSN) for the
        # scoped subset — synonyms matter for Phase 2's later matching.
        description_rows = (
            {
                "concept_id": d.concept_id, "id": d.id, "term": d.term,
                "language_code": d.language_code, "is_fsn": d.type_id == FSN_TYPE_ID,
                "source_release": source_release, "effective_time": d.effective_time,
            }
            for d in descriptions
            if d.concept_id in subset_ids and d.active
        )
        for batch in _batched(description_rows, BATCH_SIZE):
            session.run(
                "UNWIND $rows AS row "
                "MATCH (c:SnomedConcept {id: row.concept_id}) "
                "MERGE (d:Description {id: row.id}) "
                "SET d.term = row.term, d.language_code = row.language_code, "
                "    d.is_fsn = row.is_fsn, d.source_release = row.source_release, "
                "    d.effective_time = row.effective_time "
                "MERGE (c)-[:HAS_DESCRIPTION]->(d) "
                "WITH c, row "
                "FOREACH (_ IN CASE WHEN row.is_fsn THEN [1] ELSE [] END | SET c.fsn = row.term)",
                rows=batch,
            )

        is_a_rows = (
            {"source_id": rel.source_id, "destination_id": rel.destination_id}
            for rel in relationships
            if (rel.type_id == IS_A_TYPE_ID and rel.active
                and rel.source_id in subset_ids and rel.destination_id in subset_ids)
        )
        for batch in _batched(is_a_rows, BATCH_SIZE):
            session.run(
                "UNWIND $rows AS row "
                "MATCH (child:SnomedConcept {id: row.source_id}) "
                "MATCH (parent:SnomedConcept {id: row.destination_id}) "
                "MERGE (child)-[:IS_A]->(parent)",
                rows=batch,
            )
    driver.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rf2-snapshot-dir", type=Path, required=True)
    parser.add_argument("--source-release", required=True)
    parser.add_argument("--neo4j-uri", required=True)
    parser.add_argument("--neo4j-user", required=True)
    parser.add_argument("--neo4j-password", required=True)
    parser.add_argument("--complaints-path", type=Path, default=DEFAULT_COMPLAINTS_PATH)
    args = parser.parse_args()
    load(args.rf2_snapshot_dir, args.source_release, args.neo4j_uri,
         (args.neo4j_user, args.neo4j_password), args.complaints_path)
