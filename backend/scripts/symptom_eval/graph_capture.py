"""
Wraps any GraphContextProvider to record the GraphContext returned by each
call — promotes the _CapturingProvider idiom from
backend/tests/llm/test_graph_context_integration.py (test-only) into
reusable eval tooling. Lets RunVignetteConversation (design §6) observe
which red flags/follow-up questions a live provider actually surfaced per
turn, without modifying GraphContextProvider or LLMAgent. As a side effect,
this also closes backend/scripts/graphrag_eval/run_track_b_deepeval.py's
Blocker #2 (no way to capture surfaced_red_flags/surfaced_followup_questions)
— same component, two consumers, no duplication.
"""
from graph.base import GraphContext, GraphContextProvider


class CapturingGraphProvider(GraphContextProvider):
    def __init__(self, wrapped: GraphContextProvider):
        self._wrapped = wrapped
        self.last_context: GraphContext | None = None

    def _lookup(self, user_message: str, recent_messages: list[str]) -> GraphContext:
        context = self._wrapped.get_symptom_graph_context(user_message, recent_messages)
        self.last_context = context
        return context
