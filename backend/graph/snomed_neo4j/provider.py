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
import os

from graph.base import GraphContext, GraphContextProvider, RedFlagMatch
from graph.snomed_neo4j.client import Neo4jClient
from graph.snomed_neo4j.queries import (
    build_concept_lookup_query,
    build_red_flag_traversal_query,
)
from scripts.snomed_ingest.anchor_mapping import ANCHOR_MAPPINGS


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
        """Per-request read: text → candidate concept IDs → IS_A traversal →
        GraphContext. Steps mirror the plan doc's §4 design steps 1-6."""

        # Step 1: build search text
        all_text = " ".join([user_message, *recent_messages]).strip()

        # Step 2: resolve text → candidate SnomedConcept IDs
        lookup_query, lookup_params = build_concept_lookup_query()
        lookup_params = {**lookup_params, "text": all_text}
        concept_rows = self._client.run_query(lookup_query, lookup_params)
        if not concept_rows:
            return GraphContext(matched=False)

        candidate_ids = [row["concept_id"] for row in concept_rows]

        # Step 3-5: for each anchor, walk IS_A upward using that anchor's
        # per-anchor max_depth (Phase 3 schema extension), collect red flags.
        red_flags: list[RedFlagMatch] = []
        seen_indicators: set[str] = set()
        complaint_name: str | None = None

        for mapping in ANCHOR_MAPPINGS:
            traversal_query, traversal_params = build_red_flag_traversal_query(
                candidate_ids, mapping.anchor_concept_id, max_depth=mapping.max_depth
            )
            rows = self._client.run_query(traversal_query, traversal_params)
            if not rows:
                continue

            # First anchor in ANCHOR_MAPPINGS order that produces red flags
            # becomes complaint_name. ANCHOR_MAPPINGS is ordered to match
            # symptom_triage_data.json complaint ordering — this is intentional,
            # not accidental reliance on list order.
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

        # Step 6: no red flags found
        if not red_flags:
            return GraphContext(matched=False)

        return GraphContext(
            matched=True,
            complaint_name=complaint_name,
            red_flags=red_flags,
        )
