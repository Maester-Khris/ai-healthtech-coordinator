import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from graph.base import GraphContextProvider, GraphContext, NullGraphProvider


class _ExplodingProvider(GraphContextProvider):
    def _lookup(self, user_message, recent_messages):
        raise RuntimeError("boom")


def test_lookup_failure_returns_empty_context_not_raise():
    provider = _ExplodingProvider()
    result = provider.get_symptom_graph_context("chest pain", [])
    assert result == GraphContext(matched=False)


def test_null_provider_always_returns_empty_context():
    provider = NullGraphProvider()
    result = provider.get_symptom_graph_context("chest pain", ["can't breathe"])
    assert result == GraphContext(matched=False)


def test_graph_context_default_red_flags_is_empty_list():
    assert GraphContext(matched=False).red_flags == []
