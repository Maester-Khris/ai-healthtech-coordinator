"""
Tests for graph-context injection in LLMAgent._build_messages.
No real LLM calls — client is mocked; graph provider is a stub/fake.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from unittest.mock import MagicMock
from graph.base import GraphContext, GraphContextProvider, RedFlagMatch
from services.llm_agent import LLMAgent

MATCHED_CONTEXT = GraphContext(
    matched=True,
    complaint_name="Chest pain (cardiac features)",
    red_flags=[
        RedFlagMatch(
            indicator="Shock", ctas_level=1, app_severity="emergent",
            followup_question="Are they feeling faint or cold and clammy?",
        )
    ],
)
EMPTY_CONTEXT = GraphContext(matched=False)


class _StubProvider(GraphContextProvider):
    def __init__(self, context: GraphContext):
        self._context = context

    def _lookup(self, user_message, recent_messages):
        return self._context


class _CapturingProvider(GraphContextProvider):
    def __init__(self):
        self.captured: dict = {}

    def _lookup(self, user_message, recent_messages):
        self.captured["user_message"] = user_message
        self.captured["recent_messages"] = recent_messages
        return EMPTY_CONTEXT


class TestLLMAgentGraphContextInjection:
    def test_graph_block_injected_when_matched(self):
        agent = LLMAgent(client=MagicMock(), graph_provider=_StubProvider(MATCHED_CONTEXT))
        msgs = agent._build_messages("I have chest pain", [])
        system_content = msgs[0].content
        assert "Chest pain (cardiac features)" in system_content
        assert "Are they feeling faint or cold and clammy?" in system_content

    def test_no_injection_when_no_match(self):
        agent = LLMAgent(client=MagicMock(), graph_provider=_StubProvider(EMPTY_CONTEXT))
        msgs = agent._build_messages("hello", [])
        assert "Clinical Reference" not in msgs[0].content

    def test_default_provider_is_off_unless_env_set(self, monkeypatch):
        monkeypatch.delenv("GRAPH_RAG_PROVIDER", raising=False)
        agent = LLMAgent(client=MagicMock())
        msgs = agent._build_messages("I have chest pain", [])
        assert "Clinical Reference" not in msgs[0].content

    def test_recent_history_passed_to_provider(self):
        provider = _CapturingProvider()
        agent = LLMAgent(client=MagicMock(), graph_provider=provider)
        history = [
            {"role": "user", "content": "turn one"},
            {"role": "assistant", "content": "ok"},
            {"role": "user", "content": "turn two"},
        ]
        agent._build_messages("turn three", history)
        assert provider.captured["user_message"] == "turn three"
        assert provider.captured["recent_messages"] == ["turn one", "turn two"]

    def test_matched_context_is_logged_for_eval_attribution(self, caplog):
        import logging
        agent = LLMAgent(client=MagicMock(), graph_provider=_StubProvider(MATCHED_CONTEXT))
        with caplog.at_level(logging.INFO, logger="services.llm_agent"):
            agent._build_messages("I have chest pain", [])
        matches = [r for r in caplog.records if r.message == "graph_context_matched"]
        assert len(matches) == 1
        assert matches[0].indicators == ["Shock"]

    def test_no_log_when_no_match(self, caplog):
        import logging
        agent = LLMAgent(client=MagicMock(), graph_provider=_StubProvider(EMPTY_CONTEXT))
        with caplog.at_level(logging.INFO, logger="services.llm_agent"):
            agent._build_messages("hello", [])
        assert not any(r.message == "graph_context_matched" for r in caplog.records)
