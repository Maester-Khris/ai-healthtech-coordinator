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
        raise NotImplementedError(
            "GRAPH_RAG_PROVIDER=neo4j has no v2 trigger yet — see "
            "artifacts/2026-07-19-graphrag-neo4j-integration-plan.md §6. "
            "Use 'static' or leave unset."
        )
    return NullGraphProvider()
