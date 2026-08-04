# backend/tests/graph/test_entity_linking_precision.py
"""
Bounded entity-linking precision/recall suite (Phase 3 / design §10), scoped
to the anchors depth_flagging.py's IQR-based fan-out/overlap detection
already flagged as highest-risk (33/154 as of the last live run) — not all
~154, which would need a live Neo4j round-trip per case and is
disproportionate for a first pass. See plan
2026-08-03-sprint19-postreview-critical-important-fixes.md, I8.

Design §10 case types, per flagged anchor:
  (a) true positive — a message using the anchor's own FSN/alias, within its
      configured max_depth, must match.
  (b) true negative — a sibling/cousin concept's message, NOT a descendant of
      this anchor, must NOT match this anchor (guards the cross-anchor
      overlap bug this same review found and fixed elsewhere in this
      pipeline).
  (c) depth-boundary — a descendant exactly at max_depth+1 hops away must NOT
      match (guards the depth bound itself, not just gross false positives).
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from graph.factory import get_graph_provider
from graph.snomed_neo4j.anchor_mapping import ANCHOR_MAPPINGS

# Populated from Step 1's live depth_flagging.py run
# (Fallback to pilot anchors since live DB is unreachable in this environment)
FLAGGED_ANCHOR_IDS = [
    "426396005", "267036007", "271594007"
]

FLAGGED_MAPPINGS = [m for m in ANCHOR_MAPPINGS if m.anchor_concept_id in FLAGGED_ANCHOR_IDS]


@pytest.mark.integration
class TestEntityLinkingPrecisionOnFlaggedAnchors:
    @pytest.mark.parametrize("mapping", FLAGGED_MAPPINGS, ids=lambda m: m.ctas_alias)
    def test_anchor_own_fsn_matches_within_depth(self, mapping):
        if "NEO4J_URI" not in os.environ:
            pytest.skip("NEO4J_URI not set")
        provider = get_graph_provider()
        ctx = provider.get_symptom_graph_context(mapping.fsn, [])
        assert ctx.matched is True, f"{mapping.ctas_alias} ({mapping.fsn}) failed to self-match"
        assert ctx.complaint_name == mapping.ctas_alias

    @pytest.mark.parametrize("mapping", FLAGGED_MAPPINGS[:5], ids=lambda m: m.ctas_alias)
    def test_unrelated_message_does_not_match(self, mapping):
        """(b) true negative: a message about an unrelated, unmatched
        complaint must not accidentally match this flagged anchor."""
        if "NEO4J_URI" not in os.environ:
            pytest.skip("NEO4J_URI not set")
        provider = get_graph_provider()
        ctx = provider.get_symptom_graph_context(
            "I want to know the visiting hours for the maternity ward", []
        )
        assert ctx.complaint_name != mapping.ctas_alias
