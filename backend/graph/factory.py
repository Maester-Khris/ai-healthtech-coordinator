"""
Factory. Reads GRAPH_RAG_PROVIDER env var. Mirrors get_llm_client()
(backend/services/llm_agent.py) — deferred imports so unused provider
packages don't cause ImportError.
"""
import os

from graph.base import GraphContextProvider, NullGraphProvider


def get_graph_provider() -> GraphContextProvider:
    provider = os.environ.get("GRAPH_RAG_PROVIDER", "off").lower()
    if provider == "static":
        from graph.static_provider import StaticLookupProvider
        return StaticLookupProvider()
    if provider == "neo4j":
        from graph.snomed_neo4j.provider import Neo4jSnomedProvider
        return Neo4jSnomedProvider()
    return NullGraphProvider()
