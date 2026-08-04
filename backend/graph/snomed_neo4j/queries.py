"""
backend/graph/snomed_neo4j/queries.py

Pure Cypher string builders — no neo4j import, independently testable.
Same layering as backend/scripts/snomed_ingest/depth_flagging.py's builders:
no driver knowledge, only string/dict construction.

Neo4j does not accept a query parameter for a variable-length relationship
range bound, so max_depth is interpolated as a validated int literal;
list parameters (candidate_concept_ids) remain real bound params.
"""


def build_red_flag_traversal_query(
    candidate_concept_ids: list[str],
    anchor_concept_id: str,
    max_depth: int = 3,
) -> tuple[str, dict]:
    """Build the IS_A traversal + red-flag collection query.

    Walks from each candidate concept *upward* toward its ancestors
    (schema direction: (child:SnomedConcept)-[:IS_A]->(parent:SnomedConcept))
    up to max_depth hops, finds the specific SnomedConcept anchor reachable that way,
    then returns its attached RedFlag + FollowupQuestion nodes.

    max_depth is interpolated as a validated int literal (Neo4j doesn't accept
    a query param for a variable-length relationship range bound).
    candidate_concept_ids and anchor_concept_id remain real bound parameters.
    """
    if max_depth < 0:
        raise ValueError(f"max_depth must be >= 0, got {max_depth}")
    query = (
        f"MATCH (c:SnomedConcept) "
        f"WHERE c.id IN $candidate_concept_ids "
        f"MATCH (c)-[:IS_A*0..{max_depth}]->(anchor:SnomedConcept {{id: $anchor_concept_id}}) "
        f"MATCH (anchor)-[:HAS_RED_FLAG]->(rf:RedFlag)-[:ASKS]->(q:FollowupQuestion) "
        f"RETURN DISTINCT c.id AS candidate_id, "
        f"anchor.id AS anchor_id, "
        f"rf.indicator AS indicator, "
        f"rf.ctas_level AS ctas_level, "
        f"rf.app_severity AS app_severity, "
        f"q.text AS followup_question"
    )
    return query, {"candidate_concept_ids": candidate_concept_ids, "anchor_concept_id": anchor_concept_id}


def build_concept_lookup_query() -> tuple[str, dict]:
    """Build the text → SnomedConcept ID lookup query.

    Finds all SnomedConcept nodes whose English Description.term contains
    the search text (case-insensitive substring). Filters by language_code="en"
    on the Description node — NOT by c.fsn — because c.fsn is last-write-wins
    across EN and FR in the Canadian Edition RF2 release (can be French).
    See deployment reference §Known Limitations §1.

    Returns a (query, params_template) tuple; caller sets params["text"] at
    call time.
    """
    query = (
        "MATCH (c:SnomedConcept)-[:HAS_DESCRIPTION]->(d:Description) "
        "WHERE d.language_code = \"en\" "
        "  AND size(d.term) >= 4 "
        "  AND toLower($text) CONTAINS toLower(d.term) "
        "RETURN DISTINCT c.id AS concept_id "
        "LIMIT 50"
    )
    return query, {}


def build_red_flag_traversal_query_batch(
    candidate_concept_ids: list[str],
    anchor_concept_ids: list[str],
    max_depth: int,
) -> tuple[str, dict]:
    """Same traversal as build_red_flag_traversal_query, batched across every
    anchor that shares the same max_depth — collapses what was one Neo4j
    round-trip per anchor (up to 154 per message) into one query per distinct
    max_depth value present in ANCHOR_MAPPINGS (2 today). See plan:
    2026-08-03-sprint19-postreview-critical-important-fixes.md, C2.
    """
    if max_depth < 0:
        raise ValueError(f"max_depth must be >= 0, got {max_depth}")
    query = (
        f"MATCH (c:SnomedConcept) "
        f"WHERE c.id IN $candidate_concept_ids "
        f"MATCH (c)-[:IS_A*0..{max_depth}]->(anchor:SnomedConcept) "
        f"WHERE anchor.id IN $anchor_concept_ids "
        f"MATCH (anchor)-[:HAS_RED_FLAG]->(rf:RedFlag)-[:ASKS]->(q:FollowupQuestion) "
        f"OPTIONAL MATCH (rf)-[:PART_OF]->(cluster:RedFlagCluster) "
        f"RETURN DISTINCT c.id AS candidate_id, "
        f"anchor.id AS anchor_id, "
        f"rf.indicator AS indicator, "
        f"rf.ctas_level AS ctas_level, "
        f"rf.app_severity AS app_severity, "
        f"q.text AS followup_question, "
        f"cluster.name AS cluster_name"
    )
    return query, {
        "candidate_concept_ids": candidate_concept_ids,
        "anchor_concept_ids": anchor_concept_ids,
    }
