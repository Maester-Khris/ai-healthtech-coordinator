"""
backend/graph/snomed_neo4j/client.py

Thin Neo4j driver/session wrapper — Framework & Drivers layer (Clean
Architecture). All neo4j.Record → dict conversion happens here so provider.py
never touches raw neo4j.Record objects.
"""
from neo4j import GraphDatabase


class Neo4jClient:
    """Thin driver wrapper. One instance per provider; opened once in __init__,
    closed in close(). Not a context manager — provider owns the lifecycle."""

    def __init__(self, uri: str, auth: tuple[str, str]) -> None:
        self._driver = GraphDatabase.driver(uri, auth=auth)

    def run_query(self, query: str, params: dict) -> list[dict]:
        """Execute a read-only Cypher query, return records as plain dicts.
        Opens a session, runs, collects, closes. Raises neo4j driver exceptions
        on failure — the caller (provider.py's _lookup(), wrapped by the base
        class's get_symptom_graph_context() try/except) handles them."""
        with self._driver.session() as session:
            result = session.run(query, params)
            return [dict(record) for record in result]

    def close(self) -> None:
        self._driver.close()
