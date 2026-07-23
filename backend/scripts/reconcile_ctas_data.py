"""
One-time, rerunnable reconciliation of cot_triage_data.json (165 entries,
richer per-level criteria, keyed by nacrs_code) and ctas_complaint_list_adult.json
(157 entries, per-red-flag {indicator, ctas_level, followup_question} shape, no
shared key) into one canonical symptom_triage_data.json.

See docs/superpowers/specs/2026-07-23-symptom-understanding-v1-design.md §1.

Run: python scripts/reconcile_ctas_data.py
Output: triage/resources/symptom_triage_data.json
Report: triage/resources/reconciliation_report.json
"""
import re
from dataclasses import dataclass, field


def normalize_name(name: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace. Does not fix
    formatting-only mismatches like a missing comma — those need an explicit
    alias_overrides entry (see build_alias_overrides())."""
    stripped = re.sub(r"[^a-z0-9\s]", " ", name.lower())
    return re.sub(r"\s+", " ", stripped).strip()


@dataclass
class MatchResult:
    matched: list[tuple[dict, dict]] = field(default_factory=list)
    cot_only: list[dict] = field(default_factory=list)
    adult_only: list[dict] = field(default_factory=list)


def match_complaints(
    cot_entries: list[dict],
    adult_entries: list[dict],
    alias_overrides: dict[str, str],
) -> MatchResult:
    """alias_overrides maps a normalized cot name -> the exact adult
    presenting_complaint string it should be treated as equal to. Every
    override must be a reviewed, hand-verified pair — never a fuzzy guess."""
    adult_by_normalized = {
        normalize_name(a["presenting_complaint"]): a for a in adult_entries
    }
    result = MatchResult()
    matched_adult_keys: set[str] = set()

    for cot in cot_entries:
        cot_norm = normalize_name(cot["name"])
        target_norm = normalize_name(alias_overrides.get(cot_norm, cot_norm))
        adult_match = adult_by_normalized.get(target_norm)
        if adult_match is not None:
            result.matched.append((cot, adult_match))
            matched_adult_keys.add(normalize_name(adult_match["presenting_complaint"]))
        else:
            result.cot_only.append(cot)

    for norm_key, adult in adult_by_normalized.items():
        if norm_key not in matched_adult_keys:
            result.adult_only.append(adult)

    return result


# Design §2 — monotonic, never rounds a more-urgent CTAS level down.
CTAS_TO_APP_SEVERITY: dict[int, str] = {
    1: "emergent",
    2: "emergent",
    3: "urgent",
    4: "moderate",
    5: "routine",
}


def build_alias_overrides() -> dict[str, str]:
    """Hand-reviewed near-miss pairs — real wording differences normalize_name
    can't fix on its own (punctuation/case differences already resolve
    automatically; see normalize_name). Starts empty: populated after
    inspecting reconciliation_report.json against the real source files.
    Every entry must be a manually verified pair — never a fuzzy guess."""
    return {}


def _adult_question_for(indicator: str, adult: dict | None) -> str:
    if adult is None:
        return "NEEDS_AUTHORING"
    for rf in adult.get("red_flags", []):
        if rf["indicator"] == indicator:
            return rf["followup_question"]
    return "NEEDS_AUTHORING"


def transform_entry(cot: dict, adult: dict | None) -> dict:
    """Canonical schema per design §1. cot is the base (broader coverage,
    full per-level criteria); adult supplies aliases and per-indicator
    followup_questions where available."""
    indicators: list[str] = []
    for level in cot["triage_levels"]:
        if level["level"] <= 2:
            for text in [*level["criteria"], *level["modifiers"]]:
                if text not in indicators:
                    indicators.append(text)

    red_flags = [
        {
            "indicator": indicator,
            "ctas_level": next(
                lvl["level"] for lvl in cot["triage_levels"]
                if lvl["level"] <= 2 and indicator in [*lvl["criteria"], *lvl["modifiers"]]
            ),
            "app_severity": CTAS_TO_APP_SEVERITY[
                next(
                    lvl["level"] for lvl in cot["triage_levels"]
                    if lvl["level"] <= 2 and indicator in [*lvl["criteria"], *lvl["modifiers"]]
                )
            ],
            "followup_question": _adult_question_for(indicator, adult),
        }
        for indicator in indicators
    ]

    return {
        "nacrs_code": cot["nacrs_code"],
        "name": cot["name"],
        "aliases": adult.get("aliases", []) if adult else [],
        "clinical_criteria": cot["triage_levels"],
        "red_flags": red_flags,
        "source": adult.get("source", "CTAS COT 2012 (English Canada v02.03)") if adult else "CTAS COT 2012 (English Canada v02.03)",
        "source_pages": adult.get("source_pages", "") if adult else "",
    }
