"""
v1: alias/substring match against a static, git-reviewed CTAS lookup table.
No embeddings, no LLM extraction — see
artifacts/2026-07-19-graphrag-neo4j-integration-plan.md.
"""
import json
import re
from pathlib import Path

from graph.base import GraphContext, GraphContextProvider, RedFlagMatch

_DATA_PATH = (
    Path(__file__).resolve().parent.parent
    / "triage" / "resources" / "symptom_triage_data.json"
)


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9\s]", " ", text.lower()).strip()


class StaticLookupProvider(GraphContextProvider):
    def __init__(self, data_path: Path = _DATA_PATH) -> None:
        raw = json.loads(data_path.read_text())
        self._alias_index: dict[str, dict] = {}
        for entry in raw:
            for name in [entry["name"], *entry.get("aliases", [])]:
                self._alias_index[_normalize(name)] = entry

    def _match_entry(self, text: str) -> dict | None:
        normalized = _normalize(text)
        for alias, entry in self._alias_index.items():
            # ponytail: skip aliases under 4 chars — avoids trivial
            # false-positive substring matches ("ent" inside "different").
            # Real precision tuning is a measured v1.1 concern (see design
            # §6 trigger list), not a v1 blocker.
            if len(alias) >= 4 and alias in normalized:
                return entry
        return None

    def _lookup(self, user_message: str, recent_messages: list[str]) -> GraphContext:
        matched_entry: dict | None = None
        seen_indicators: set[str] = set()
        red_flags: list[RedFlagMatch] = []

        for text in [user_message, *recent_messages]:
            entry = self._match_entry(text)
            if entry is None:
                continue
            if matched_entry is None:
                matched_entry = entry
            for rf in entry.get("red_flags", []):
                if rf["indicator"] not in seen_indicators:
                    seen_indicators.add(rf["indicator"])
                    red_flags.append(RedFlagMatch(**rf))

        if matched_entry is None:
            return GraphContext(matched=False)
        return GraphContext(
            matched=True,
            complaint_name=matched_entry["name"],
            red_flags=red_flags,
        )
