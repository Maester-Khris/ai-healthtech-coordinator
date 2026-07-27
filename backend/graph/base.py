"""
GraphContextProvider — Strategy interface both v1 (static lookup) and the
deferred v2 (Neo4j) implementation satisfy. Mirrors BaseLLMClient
(backend/llm/base.py). See design §3.
"""
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class RedFlagMatch:
    indicator: str
    ctas_level: int
    app_severity: str
    followup_question: str


@dataclass
class GraphContext:
    matched: bool
    complaint_name: str | None = None
    red_flags: list[RedFlagMatch] = field(default_factory=list)


class GraphContextProvider(ABC):
    """
    LLMAgent only interacts with this interface — never a concrete provider
    directly.
    """

    def get_symptom_graph_context(
        self, user_message: str, recent_messages: list[str]
    ) -> GraphContext:
        """Public entry point. Never raises — this is enrichment, not a hard
        dependency (unlike BaseLLMClient or find_nearest_facilities, which can
        surface a 503). Any failure in a subclass's _lookup() degrades to an
        empty GraphContext, logged but never propagated."""
        try:
            return self._lookup(user_message, recent_messages)
        except Exception:
            logger.exception(
                "graph_context_lookup_failed",
                extra={"provider": type(self).__name__},
            )
            return GraphContext(matched=False)

    @abstractmethod
    def _lookup(self, user_message: str, recent_messages: list[str]) -> GraphContext:
        ...


class NullGraphProvider(GraphContextProvider):
    """GRAPH_RAG_PROVIDER=off (the default). Zero behavior change."""

    def _lookup(self, user_message: str, recent_messages: list[str]) -> GraphContext:
        return GraphContext(matched=False)
