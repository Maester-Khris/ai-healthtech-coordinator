# backend/tests/graph/test_factory.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from graph.base import GraphContext, GraphContextProvider
from graph import factory


class _FakeProvider(GraphContextProvider):
    """Records whether close() was called — the real Neo4jSnomedProvider isn't
    constructible without live env vars, so factory-level caching/close
    behavior is tested against a fake, not the real provider."""

    def __init__(self):
        self.closed = False

    def _lookup(self, user_message, recent_messages):
        return GraphContext(matched=False)

    def close(self):
        self.closed = True


class TestGetGraphProvider:
    def setup_method(self):
        factory._provider_cache.clear()

    def test_returns_same_instance_for_repeated_calls_with_same_provider_value(self, monkeypatch):
        monkeypatch.setenv("GRAPH_RAG_PROVIDER", "off")
        first = factory.get_graph_provider()
        second = factory.get_graph_provider()
        assert first is second

    def test_returns_a_fresh_instance_when_provider_value_changes(self, monkeypatch):
        monkeypatch.setenv("GRAPH_RAG_PROVIDER", "off")
        off_instance = factory.get_graph_provider()
        monkeypatch.setenv("GRAPH_RAG_PROVIDER", "static")
        static_instance = factory.get_graph_provider()
        assert off_instance is not static_instance


class TestCloseGraphProvider:
    def setup_method(self):
        factory._provider_cache.clear()

    def test_closes_every_cached_provider_that_supports_close(self):
        fake = _FakeProvider()
        factory._provider_cache["off"] = fake
        factory.close_graph_provider()
        assert fake.closed is True

    def test_clears_the_cache_after_closing(self):
        factory._provider_cache["off"] = _FakeProvider()
        factory.close_graph_provider()
        assert factory._provider_cache == {}

    def test_tolerates_providers_without_close(self, monkeypatch):
        monkeypatch.setenv("GRAPH_RAG_PROVIDER", "off")
        factory.get_graph_provider()  # NullGraphProvider has no close()
        factory.close_graph_provider()  # must not raise
