import os
from groq import Groq
from .base import BaseLLMClient, LLMMessage, LLMResponse, ToolDefinition


class GroqClient(BaseLLMClient):

    def __init__(self) -> None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        self._client = Groq(api_key=api_key)
        self._model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    @property
    def model_name(self) -> str:
        return self._model

    def chat(
        self,
        messages: list[LLMMessage],
        tools: list[ToolDefinition] | None = None,
        temperature: float = 0.2,
        stop: list[str] | None = None,
        force_tool: str | None = None,
    ) -> LLMResponse:
        groq_messages = [self._to_groq_message(m) for m in messages]
        groq_tools = [self._to_groq_tool(t) for t in tools] if tools else None

        tool_choice = None
        if force_tool:
            tool_choice = {"type": "function", "function": {"name": force_tool}}
        elif tools:
            tool_choice = "auto"

        kwargs: dict = dict(
            model=self._model,
            messages=groq_messages,
            temperature=temperature,
        )
        if stop:
            kwargs["stop"] = stop
        if groq_tools:
            kwargs["tools"] = groq_tools
            kwargs["tool_choice"] = tool_choice

        resp = self._client.chat.completions.create(**kwargs)
        choice = resp.choices[0]

        tool_calls = None
        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            tool_calls = [
                {
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                }
                for tc in choice.message.tool_calls
            ]

        return LLMResponse(
            content=choice.message.content,
            tool_calls=tool_calls,
            finish_reason=choice.finish_reason,
            model=self._model,
            usage={
                "prompt_tokens": resp.usage.prompt_tokens,
                "completion_tokens": resp.usage.completion_tokens,
            },
        )

    def _to_groq_message(self, msg: LLMMessage) -> dict:
        m: dict = {"role": msg.role, "content": msg.content or ""}
        if msg.tool_call_id:
            m["tool_call_id"] = msg.tool_call_id
        if msg.name:
            m["name"] = msg.name
        return m

    def _to_groq_tool(self, tool: ToolDefinition) -> dict:
        return {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": {
                    "type": "object",
                    "properties": tool.parameters,
                    "required": tool.required,
                },
            },
        }
