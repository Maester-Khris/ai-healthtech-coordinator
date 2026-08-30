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

    def _find_all_matches(self, text: str) -> list[tuple[str, dict]]:
        """All (alias, entry) pairs whose alias is a substring of the
        normalized text — not just the first one found. Iteration order
        still follows self._alias_index (dict insertion order = JSON file
        order), but this returns every match instead of stopping at the
        first, so the caller can rank by specificity (longest alias)
        instead of accepting whichever happened to be inserted first."""
        normalized = _normalize(text)
        return [
            (alias, entry)
            for alias, entry in self._alias_index.items()
            if len(alias) >= 4 and alias in normalized
        ]

    def _match_entry(self, text: str) -> dict | None:
        """Longest-alias-wins: the most specific matching alias is
        returned, not whichever happened to be inserted first into
        self._alias_index (fixed 2026-08-05 — see docs/superpowers/plans/
        2026-08-05-v1-v2-retrieval-eval-fairness.md Task 1). Ties
        (equal-length aliases) preserve the original insertion-order
        tie-break, since max() with a key= returns the first maximal
        element it encounters while iterating in order."""
        matches = self._find_all_matches(text)
        if not matches:
            return None
        return max(matches, key=lambda pair: len(pair[0]))[1]

    def debug_all_matches(self, text: str) -> list[str]:
        """Eval-only introspection for Track A's Recall@k metric (backend/
        scripts/graphrag_eval/run_track_a_retrieval.py): every complaint
        name whose alias matched, not just the one _match_entry() selected
        as most specific. Never called from the request path — LLMAgent
        only calls get_symptom_graph_context()."""
        return [entry["name"] for _, entry in self._find_all_matches(text)]

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
