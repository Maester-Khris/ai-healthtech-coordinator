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
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

_RESOURCES = Path(__file__).resolve().parent.parent / "triage" / "resources"


def normalize_name(name: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace. Does not fix
    formatting-only mismatches like a missing comma — those need an explicit
    alias_overrides entry (see build_alias_overrides()).

    '<' and '>' are translated to words, not stripped: on real data,
    "Pregnancy issue < 20 weeks" and "Pregnancy issue > 20 weeks" are
    clinically distinct complaints (early vs. late pregnancy) that would
    otherwise both normalize to "pregnancy issue 20 weeks" and silently
    collide — see _build_adult_index's collision guard for the second line
    of defense against exactly this."""
    text = name.lower().replace("<", " under ").replace(">", " over ")
    stripped = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", stripped).strip()


@dataclass
class MatchResult:
    matched: list[tuple[dict, dict]] = field(default_factory=list)
    cot_only: list[dict] = field(default_factory=list)
    adult_only: list[dict] = field(default_factory=list)


def _build_adult_index(adult_entries: list[dict]) -> dict[str, dict]:
    """Fail loud on a normalization collision instead of silently letting the
    second entry overwrite the first — two adult complaints that normalize to
    the same key are either duplicate data (fine to investigate) or, as found
    against the real data (Pregnancy issue < / > 20 weeks), two genuinely
    different complaints that normalize_name needs a fix for, not a silent
    merge."""
    index: dict[str, dict] = {}
    for a in adult_entries:
        key = normalize_name(a["presenting_complaint"])
        existing = index.get(key)
        if existing is not None and existing["presenting_complaint"] != a["presenting_complaint"]:
            raise ValueError(
                f"Normalization collision: {existing['presenting_complaint']!r} and "
                f"{a['presenting_complaint']!r} both normalize to {key!r} — these "
                "look like different complaints; fix normalize_name or the source data."
            )
        index[key] = a
    return index


def match_complaints(
    cot_entries: list[dict],
    adult_entries: list[dict],
    alias_overrides: dict[str, str],
) -> MatchResult:
    """alias_overrides maps a normalized cot name -> the exact adult
    presenting_complaint string it should be treated as equal to. Every
    override must be a reviewed, hand-verified pair — never a fuzzy guess."""
    adult_by_normalized = _build_adult_index(adult_entries)
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
    can't fix on its own (punctuation/case/</> differences already resolve
    automatically; see normalize_name). Found by running main() against the
    real source files and eyeballing reconciliation_report.json's
    adult_only_unmatched list against cot_only. Every entry below was
    manually verified — never a fuzzy guess. 8 of the original 20 cot_only
    entries (infant/pediatric complaints like "Newly Born", "Neonatal
    jaundice") have no adult-file counterpart at all and correctly stay
    unmatched — not listed here."""
    return {
        # PDF text-wrap duplication artifacts in cot's raw name field.
        normalize_name("Chest pain (non cardiac features) Chest pain (non"):
            "Chest pain (non cardiac features)",
        normalize_name("Palpitations / Irregular heart beat Palpit ations"):
            "Palpitations / irregular heart beat",
        normalize_name("General weakness Gener"):
            "General weakness",
        # Genuine wording/spelling variants between the two authoring passes.
        normalize_name("Dental / Gum problems"):
            "Dental / gum problem",
        normalize_name("Vaginal bleed"):
            "Vaginal bleeding",
        normalize_name("Pregnancy issues < 20 wks"):
            "Pregnancy issue < 20 weeks",
        normalize_name("Pregnancy issues > 20 wks"):
            "Pregnancy issue > 20 weeks",
        normalize_name("Concern for patient's welfare"):
            "Concern for the patient's welfare",
        normalize_name("Pruritus"):
            "Pruritis",
        normalize_name("Removal staples / sutures"):
            "Removal staples / stitches",
        normalize_name("Isolated chest trauma – penetrating"):
            "Isolated chest – penetrating",
        normalize_name("Post-operative complications"):
            "Postoperative complications",
    }


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


def main() -> None:
    cot_entries = json.loads((_RESOURCES / "cot_triage_data.json").read_text())
    adult_entries = json.loads((_RESOURCES / "ctas_complaint_list_adult.json").read_text())

    result = match_complaints(cot_entries, adult_entries, build_alias_overrides())

    canonical = [transform_entry(cot, adult) for cot, adult in result.matched]
    canonical += [transform_entry(cot, None) for cot in result.cot_only]

    needs_authoring = [
        {"nacrs_code": e["nacrs_code"], "name": e["name"], "indicator": rf["indicator"]}
        for e in canonical
        for rf in e["red_flags"]
        if rf["followup_question"] == "NEEDS_AUTHORING"
    ]
    report = {
        "total_canonical_entries": len(canonical),
        "matched_count": len(result.matched),
        "cot_only_count": len(result.cot_only),
        "adult_only_unmatched": [a["presenting_complaint"] for a in result.adult_only],
        "needs_authoring_count": len(needs_authoring),
        "needs_authoring": needs_authoring,
    }

    (_RESOURCES / "symptom_triage_data.json").write_text(json.dumps(canonical, indent=2))
    (_RESOURCES / "reconciliation_report.json").write_text(json.dumps(report, indent=2))
    print(f"Wrote {len(canonical)} canonical entries.")
    print(f"Matched: {len(result.matched)}, cot-only: {len(result.cot_only)}, "
          f"adult-only unmatched: {len(result.adult_only)}")
    print(f"Needs-authoring red flags: {len(needs_authoring)} (see reconciliation_report.json)")


if __name__ == "__main__":
    main()
