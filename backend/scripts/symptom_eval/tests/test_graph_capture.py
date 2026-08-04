import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from graph.base import GraphContext, GraphContextProvider, RedFlagMatch
from scripts.symptom_eval.graph_capture import CapturingGraphProvider

MATCHED = GraphContext(
    matched=True, complaint_name="Chest pain (cardiac features)",
    red_flags=[RedFlagMatch("Shock", 1, "emergent", "Are you feeling faint?")],
)


class _StubProvider(GraphContextProvider):
    def __init__(self, context):
        self._context = context

    def _lookup(self, user_message, recent_messages):
        return self._context


class TestCapturingGraphProvider:
    def test_delegates_and_records_context(self):
        capturing = CapturingGraphProvider(_StubProvider(MATCHED))
        result = capturing.get_symptom_graph_context("chest pain", [])

        assert result == MATCHED
        assert capturing.last_context == MATCHED

    def test_starts_with_no_context(self):
        capturing = CapturingGraphProvider(_StubProvider(MATCHED))
        assert capturing.last_context is None
