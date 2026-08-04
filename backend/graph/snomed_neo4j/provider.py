"""
backend/graph/snomed_neo4j/provider.py

Neo4jSnomedProvider — v2 GraphContextProvider backed by the live Neo4j graph
(Layer 1 SNOMED CT terminology + Layer 2 CTAS red-flag overlay).

This is the only file in the request path that knows about the graph's schema.
It implements _lookup() only — the public get_symptom_graph_context() entry
point is inherited from GraphContextProvider and must NOT be overridden: the
base class's try/except is what guarantees a Neo4j outage (including AuraDB
Free's 72h auto-pause) degrades to GraphContext(matched=False) rather than
breaking triage.

neo4j.Record objects never leave client.py — this module works only with the
plain dicts run_query() returns. GraphContext/RedFlagMatch are assembled here
and nowhere else in the request path.

Global constraints (binding, same as every prior task in this pipeline):
- LLMAgent / prompts.py import only graph.base.GraphContextProvider/GraphContext
  — never graph.snomed_neo4j.* directly.
- Severity classification is the LLM's job, unconditionally.
"""
import logging
import os
from collections import defaultdict

from graph.base import GraphContext, GraphContextProvider, RedFlagMatch
from graph.snomed_neo4j.client import Neo4jClient
from graph.snomed_neo4j.queries import (
    build_concept_lookup_query,
    build_red_flag_traversal_query_batch,
)
from graph.snomed_neo4j.anchor_mapping import ANCHOR_MAPPINGS

logger = logging.getLogger(__name__)

class Neo4jSnomedProvider(GraphContextProvider):
    """v2 provider — reads the live Neo4j KG built by Phases 0-3.

    __init__ establishes the driver once; _lookup() is called per request.
    Credentials come from NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD env vars
    (injected via Doppler per repo convention — never hardcoded).
    """

    def __init__(self) -> None:
        missing = [v for v in ("NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD") if not os.environ.get(v)]
        if missing:
            raise ValueError(
                f"Neo4jSnomedProvider requires env vars: {', '.join(missing)}. "
                "Inject via Doppler or set before constructing the provider."
            )
        uri = os.environ["NEO4J_URI"]
        username = os.environ["NEO4J_USERNAME"]
        password = os.environ["NEO4J_PASSWORD"]
        self._client = Neo4jClient(uri, (username, password))

    def close(self) -> None:
        """Release the underlying Neo4j driver. Call at application shutdown
        (e.g. FastAPI lifespan teardown). The base class 'never-raises' contract
        applies only to _lookup(); the driver itself is not auto-closed."""
        self._client.close()

    def _lookup(self, user_message: str, recent_messages: list[str]) -> GraphContext:
        all_text = " ".join([user_message, *recent_messages]).strip()

        lookup_query, lookup_params = build_concept_lookup_query()
        lookup_params = {**lookup_params, "text": all_text}
        concept_rows = self._client.run_query(lookup_query, lookup_params)
        if not concept_rows:
            return GraphContext(matched=False)

        candidate_ids = [row["concept_id"] for row in concept_rows]
        rows_by_anchor = self._traverse_all_anchors(candidate_ids)
        self._log_cross_symptom_clusters(rows_by_anchor)

        red_flags: list[RedFlagMatch] = []
        seen_indicators: set[str] = set()
        complaint_name: str | None = None

        for mapping in ANCHOR_MAPPINGS:
            rows = rows_by_anchor.get(mapping.anchor_concept_id, [])
            if not rows:
                continue
            # First anchor in ANCHOR_MAPPINGS order that produces red flags
            # becomes complaint_name — preserved exactly, batching only
            # changes how the rows are fetched, not this reassembly order.
            if complaint_name is None:
                complaint_name = mapping.ctas_alias

            for row in rows:
                indicator = row["indicator"]
                if indicator not in seen_indicators:
                    seen_indicators.add(indicator)
                    red_flags.append(
                        RedFlagMatch(
                            indicator=indicator,
                            ctas_level=row["ctas_level"],
                            app_severity=row["app_severity"],
                            followup_question=row["followup_question"],
                        )
                    )

        if not red_flags:
            return GraphContext(matched=False)

        # Design §4 point 4 / §8 — precedence rule, explicit not learned:
        # most severe (lowest ctas_level) first, regardless of traversal order.
        red_flags.sort(key=lambda rf: rf.ctas_level)
        return GraphContext(matched=True, complaint_name=complaint_name, red_flags=red_flags)

    def _traverse_all_anchors(self, candidate_ids: list[str]) -> dict[str, list[dict]]:
        """Groups ANCHOR_MAPPINGS by max_depth and issues one batched query per
        distinct depth (C2 fix) instead of one query per anchor. Returns rows
        keyed by anchor_id so _lookup() can reassemble them in ANCHOR_MAPPINGS's
        own order."""
        anchors_by_depth: dict[int, list[str]] = defaultdict(list)
        for mapping in ANCHOR_MAPPINGS:
            anchors_by_depth[mapping.max_depth].append(mapping.anchor_concept_id)

        rows_by_anchor: dict[str, list[dict]] = defaultdict(list)
        for max_depth, anchor_ids in anchors_by_depth.items():
            query, params = build_red_flag_traversal_query_batch(
                candidate_ids, anchor_ids, max_depth
            )
            for row in self._client.run_query(query, params):
                rows_by_anchor[row["anchor_id"]].append(row)
        return rows_by_anchor

    def _log_cross_symptom_clusters(self, rows_by_anchor: dict[str, list[dict]]) -> None:
        """Design §4 point 3 (disclosed deviation: single-pass, not a second
        query — see plan I9). Detection/logging only — does not affect
        severity classification, per the same restraint as I3."""
        anchors_by_cluster: dict[str, set[str]] = defaultdict(set)
        for anchor_id, rows in rows_by_anchor.items():
            for row in rows:
                cluster_name = row.get("cluster_name")
                if cluster_name:
                    anchors_by_cluster[cluster_name].add(anchor_id)

        for cluster_name, anchor_ids in anchors_by_cluster.items():
            if len(anchor_ids) >= 2:
                logger.info(
                    "cross_symptom_cluster_matched",
                    extra={"cluster_name": cluster_name, "anchor_count": len(anchor_ids)},
                )
