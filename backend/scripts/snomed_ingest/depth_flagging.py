# backend/scripts/snomed_ingest/depth_flagging.py
"""
Phase 3: depth/fan-out flagging tool for anchor_mapping.py's 154 anchors.

Read-only analysis against the live Neo4j graph (Layer 1 + Layer 2 already
seeded by load_rf2.py / seed_red_flags.py). Every Cypher statement in this
module is MATCH-only -- never MERGE/SET/CREATE (see
test_entity_linking_precision.py::test_depth_flagging_never_writes, which
enforces this structurally the same way
test_seed_red_flags.py::test_seed_red_flags_never_writes_layer_1_labels does).

This tool does NOT decide final per-anchor `max_depth` values. It surfaces two
independent, purely mechanical signals so a human (the controller) can review
and hand-correct only the anchors flagged here -- the same review model as
Task 2a's holistic-review corrections.

Signal 1 -- fan-out outlier detection: for each anchor, count descendants
(concepts reaching the anchor via `-[:IS_A*1..N]->`) at depth 1, 2, 3, and 4.
Flag any anchor whose depth-4 count is a statistical outlier (IQR rule: above
Q3 + 1.5*IQR) relative to the other anchors' depth-4 counts, computed over the
actual measured distribution across all anchors.

Signal 2 -- cross-anchor overlap: for each anchor, compute the *set* of
concept IDs in its depth-4 descendant set. Flag any anchor whose set shares
one or more concept IDs with another anchor's set -- a concrete contamination
signal (this exact failure mode already happened once: the 68235000
duplicate-anchor bug found during Task 2a's holistic review).

Standalone script only -- never imported by the request path
(backend/services/llm_agent.py, backend/graph/*). Invoke as:
    cd backend && python -m scripts.snomed_ingest.depth_flagging --neo4j-uri ... --neo4j-user ... --neo4j-password ...

Severity classification is the LLM's job, unconditionally -- nothing here
computes or infers a severity value.
"""
import argparse
import json
import statistics
from pathlib import Path
from typing import Any

from neo4j import GraphDatabase, Session

from scripts.snomed_ingest.anchor_mapping import ANCHOR_MAPPINGS, AnchorMapping
from scripts.snomed_ingest.constants import MAX_SEED_DESCENDANT_DEPTH

DEFAULT_REPORT_PATH = Path(__file__).resolve().parent / "depth_flagging_report.json"


# --------------------------------------------------------------------------
# Pure, driver-free Cypher builders (no `neo4j` import needed to unit-test
# these -- mirrors load_rf2.py's concept_ids_in_subset() / seed_red_flags.py's
# build_rows() convention).
# --------------------------------------------------------------------------


def build_descendant_count_query(anchor_id: str, depth: int) -> tuple[str, dict[str, str]]:
    """Cypher + params counting distinct descendants of `anchor_id` reachable
    via `-[:IS_A*1..depth]->` (i.e. within `depth` IS_A hops, cumulative --
    matches load_rf2.py's concept_ids_in_subset() bounded-traversal semantics,
    not an exact-depth-N layer count).

    Neo4j does not accept a query parameter for a variable-length relationship
    range bound, so `depth` is interpolated into the query text as a validated
    int literal; `anchor_id` remains a real bound parameter.
    """
    if depth < 1:
        raise ValueError(f"depth must be >= 1, got {depth}")
    query = (
        f"MATCH (d:SnomedConcept)-[:IS_A*1..{depth}]->(a:SnomedConcept {{id: $anchor_id}}) "
        "RETURN count(DISTINCT d) AS n"
    )
    return query, {"anchor_id": anchor_id}


def build_descendant_ids_query(anchor_id: str, depth: int) -> tuple[str, dict[str, str]]:
    """Cypher + params returning the distinct concept IDs of `anchor_id`'s
    descendants at (cumulative) depth `depth` -- the set Signal 2 needs, not
    just the count."""
    if depth < 1:
        raise ValueError(f"depth must be >= 1, got {depth}")
    query = (
        f"MATCH (d:SnomedConcept)-[:IS_A*1..{depth}]->(a:SnomedConcept {{id: $anchor_id}}) "
        "RETURN DISTINCT d.id AS id"
    )
    return query, {"anchor_id": anchor_id}


# --------------------------------------------------------------------------
# Pure signal-detection functions -- testable against synthetic dicts, no
# Neo4j involved at all.
# --------------------------------------------------------------------------


def detect_fanout_outliers(depth4_counts: dict[str, int]) -> list[str]:
    """IQR-based outlier detection over the actual measured depth-4-count
    distribution: flag anchor IDs whose count is above Q3 + 1.5*IQR (the
    standard Tukey fence -- not invented for this task).

    Q1/Q3 are computed via `statistics.quantiles(..., n=4, method="exclusive")`
    (Python stdlib, no new dependency), the traditional textbook/Excel-QUARTILE.EXC
    method -- a defensible, standard choice; any linear-interpolation quartile
    method would give near-identical cut points on a 154-point distribution.

    Returns an empty list if there are too few anchors for a meaningful quartile
    split (fewer than 4 data points -- `statistics.quantiles` requires at least
    that many with method="exclusive").
    """
    if len(depth4_counts) < 4:
        return []
    values = sorted(depth4_counts.values())
    q1, _, q3 = statistics.quantiles(values, n=4, method="exclusive")
    iqr = q3 - q1
    threshold = q3 + 1.5 * iqr
    return sorted(
        anchor_id for anchor_id, count in depth4_counts.items() if count > threshold
    )


def detect_cross_anchor_overlap(descendant_sets: dict[str, set[str]]) -> dict[str, set[str]]:
    """For each anchor, find which *other* anchors' depth-4 descendant sets it
    shares one or more concept IDs with. Anchors with no overlap are omitted
    from the result entirely (empty overlap is not a flag)."""
    anchor_ids = sorted(descendant_sets)
    overlap: dict[str, set[str]] = {}
    for i, anchor_a in enumerate(anchor_ids):
        set_a = descendant_sets[anchor_a]
        for anchor_b in anchor_ids[i + 1 :]:
            if set_a & descendant_sets[anchor_b]:
                overlap.setdefault(anchor_a, set()).add(anchor_b)
                overlap.setdefault(anchor_b, set()).add(anchor_a)
    return overlap


def flag_anchors(
    depth4_counts: dict[str, int],
    descendant_sets: dict[str, set[str]],
) -> dict[str, list[str]]:
    """Union both signals into a per-anchor reason list. Anchors flagged by
    neither signal are not included in the output at all. Reasons within an
    anchor's list are sorted for deterministic (rerun-stable) output."""
    outliers = set(detect_fanout_outliers(depth4_counts))
    overlaps = detect_cross_anchor_overlap(descendant_sets)

    flagged: dict[str, list[str]] = {}
    for anchor_id in sorted(set(depth4_counts) | set(descendant_sets)):
        reasons: list[str] = []
        if anchor_id in outliers:
            reasons.append("fanout_outlier")
        reasons.extend(
            f"cross_anchor_overlap:{other}" for other in sorted(overlaps.get(anchor_id, ()))
        )
        if reasons:
            flagged[anchor_id] = reasons
    return flagged


# --------------------------------------------------------------------------
# Thin live-execution layer -- the only part of this module that touches a
# real Neo4j session.
# --------------------------------------------------------------------------


def collect_depth_counts_and_sets(
    session: Session,
    mappings: list[AnchorMapping],
    max_depth: int = MAX_SEED_DESCENDANT_DEPTH,
) -> tuple[dict[str, dict[int, int]], dict[str, set[str]]]:
    """Read-only: for each anchor, run the depth-1..max_depth count queries
    and the depth-max_depth descendant-ID-set query against the live graph.

    Returns (counts_by_depth, depth_n_descendant_sets), both keyed by
    anchor_concept_id.
    """
    counts_by_depth: dict[str, dict[int, int]] = {}
    descendant_sets: dict[str, set[str]] = {}
    for mapping in mappings:
        anchor_id = mapping.anchor_concept_id
        counts_by_depth[anchor_id] = {}
        for depth in range(1, max_depth + 1):
            query, params = build_descendant_count_query(anchor_id, depth)
            counts_by_depth[anchor_id][depth] = session.run(query, params).single()["n"]

        ids_query, ids_params = build_descendant_ids_query(anchor_id, max_depth)
        descendant_sets[anchor_id] = {
            record["id"] for record in session.run(ids_query, ids_params)
        }
    return counts_by_depth, descendant_sets


def build_report(
    mappings: list[AnchorMapping],
    counts_by_depth: dict[str, dict[int, int]],
    descendant_sets: dict[str, set[str]],
    max_depth: int = MAX_SEED_DESCENDANT_DEPTH,
) -> dict[str, Any]:
    """Combine per-anchor counts + descendant sets into the JSON-serializable
    report structure (both for stdout printing and depth_flagging_report.json)."""
    depth_n_counts = {
        anchor_id: counts[max_depth] for anchor_id, counts in counts_by_depth.items()
    }
    flagged = flag_anchors(depth_n_counts, descendant_sets)

    anchors_report = []
    for mapping in mappings:
        anchor_id = mapping.anchor_concept_id
        anchors_report.append(
            {
                "ctas_alias": mapping.ctas_alias,
                "anchor_concept_id": anchor_id,
                "counts_by_depth": counts_by_depth[anchor_id],
                "flags": flagged.get(anchor_id, []),
            }
        )
    return {
        "max_depth": max_depth,
        "total_anchors": len(mappings),
        "flagged_count": len(flagged),
        "anchors": anchors_report,
    }


def print_report(report: dict[str, Any]) -> None:
    print(
        f"Depth/fan-out flagging report -- {report['total_anchors']} anchors, "
        f"{report['flagged_count']} flagged (max_depth={report['max_depth']})"
    )
    depth4_counts = [
        entry["counts_by_depth"][report["max_depth"]] for entry in report["anchors"]
    ]
    print(
        f"Depth-{report['max_depth']} count distribution -- "
        f"min={min(depth4_counts)}, median={statistics.median(depth4_counts)}, "
        f"max={max(depth4_counts)}"
    )
    for entry in report["anchors"]:
        if entry["flags"]:
            counts = entry["counts_by_depth"]
            counts_str = ", ".join(f"d{d}={counts[d]}" for d in sorted(counts, key=int))
            print(
                f"  FLAGGED {entry['anchor_concept_id']} ({entry['ctas_alias']}): "
                f"{counts_str} -- reasons: {', '.join(entry['flags'])}"
            )


def run(
    neo4j_uri: str,
    neo4j_auth: tuple[str, str],
    report_path: Path = DEFAULT_REPORT_PATH,
) -> dict[str, Any]:
    driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
    try:
        with driver.session() as session:
            counts_by_depth, descendant_sets = collect_depth_counts_and_sets(
                session, ANCHOR_MAPPINGS
            )
        report = build_report(ANCHOR_MAPPINGS, counts_by_depth, descendant_sets)
        print_report(report)
        report_path.write_text(json.dumps(report, indent=2))
        return report
    finally:
        driver.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--neo4j-uri", required=True)
    parser.add_argument("--neo4j-user", required=True)
    parser.add_argument("--neo4j-password", required=True)
    parser.add_argument("--report-path", type=Path, default=DEFAULT_REPORT_PATH)
    args = parser.parse_args()
    run(args.neo4j_uri, (args.neo4j_user, args.neo4j_password), args.report_path)
