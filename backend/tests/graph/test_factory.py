import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import pytest
from graph.base import NullGraphProvider
from graph.factory import get_graph_provider
from graph.static_provider import StaticLookupProvider


def test_default_is_null_provider(monkeypatch):
    monkeypatch.delenv("GRAPH_RAG_PROVIDER", raising=False)
    assert isinstance(get_graph_provider(), NullGraphProvider)


def test_off_is_null_provider(monkeypatch):
    monkeypatch.setenv("GRAPH_RAG_PROVIDER", "off")
    assert isinstance(get_graph_provider(), NullGraphProvider)


def test_static_returns_static_provider(monkeypatch):
    monkeypatch.setenv("GRAPH_RAG_PROVIDER", "static")
    assert isinstance(get_graph_provider(), StaticLookupProvider)


def test_neo4j_returns_neo4j_provider(monkeypatch):
    """factory.py neo4j branch: deferred import + construction, no real connection."""
    monkeypatch.setenv("GRAPH_RAG_PROVIDER", "neo4j")
    monkeypatch.setenv("NEO4J_URI", "bolt://mock:7687")
    monkeypatch.setenv("NEO4J_USERNAME", "neo4j")
    monkeypatch.setenv("NEO4J_PASSWORD", "mock")

    from unittest.mock import patch
    from graph.snomed_neo4j.provider import Neo4jSnomedProvider

    with patch.object(Neo4jSnomedProvider, "__init__", lambda self: None):
        result = get_graph_provider()
    assert isinstance(result, Neo4jSnomedProvider)
