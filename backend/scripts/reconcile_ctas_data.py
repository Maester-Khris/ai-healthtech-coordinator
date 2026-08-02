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
_ARTIFACTS = Path(__file__).resolve().parent.parent.parent / "artifacts"


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


def build_indicator_overrides() -> dict[str, dict[str, dict]]:
    """Loads artifacts/followup_question_bank_v3.json (165 complaints, 591
    hand-verified red flags, 0 placeholders — see
    artifacts/2026-07-29-snomed-ctas-followup-corpus-documentation.md §2 for
    how it was built) and indexes it by nacrs_code -> {indicator: v3
    red-flag dict}. transform_entry consults this *before* falling back to
    _adult_question_for's adult-file matching (kept as defense-in-depth,
    even though v3's 165/591 coverage means it should never need to fire
    against the current source data).

    This map alone resolves the common case: an exact (nacrs_code,
    indicator) match between cot_triage_data.json's own extraction and v3,
    overriding followup_question (~588 entries). Two additional hand-
    verified exceptions, documented in the corpus doc's §2 Step 6, aren't
    reachable by exact-key lookup and are handled explicitly in
    transform_entry rather than here — never a fuzzy guess:

      - nacrs_code 551 (Back pain): v3 has a cauda-equina/AAA red flag
        ("Severe pain with fever, saddle anesthesia, bowel/bladder
        dysfunction (cauda equina concern), or pulsatile abdominal mass
        (AAA concern)") with no cot-side indicator at all — cot's raw
        extraction only ever collapses this into the generic "Acute central
        severe pain (8-10)" tag. transform_entry injects it as a brand-new
        red flag when a v3 indicator for a complaint is never matched by
        any of that complaint's cot-extracted indicators.
      - nacrs_code 608 (Concern for patient's welfare): cot's raw indicator
        ("and there is no acute") is a corrupted PDF-table-extraction
        fragment of a definitional footnote, not real red-flag text.
        INDICATOR_TEXT_CORRECTIONS (below) renames it to v3's corrected
        text ("Risk of flight or ongoing abuse") before this map is
        consulted, so it resolves through the same common-case lookup.

    Verified against the real data: every other nacrs_code in v3 exists in
    cot_triage_data.json, and every other v3 indicator exact-matches one of
    that complaint's cot-extracted indicators — these two are the only
    exceptions."""
    v3_entries = json.loads((_ARTIFACTS / "followup_question_bank_v3.json").read_text())
    overrides: dict[str, dict[str, dict]] = {}
    for entry in v3_entries:
        per_complaint = overrides.setdefault(entry["nacrs_code"], {})
        for rf in entry.get("red_flags", []):
            per_complaint[rf["indicator"]] = rf
    return overrides


# Hand-verified correction to cot_triage_data.json's own raw indicator
# text — not a followup_question override, a correction of the indicator
# string itself, applied before build_indicator_overrides()'s
# (nacrs_code, indicator) lookup happens. See corpus doc §2 Step 6,
# "Concern for patient's welfare's indicator corrected". Confirmed against
# the real source file: cot's level-2 criteria for nacrs_code 608 is the
# single-element list ["and there is no acute"] — a corrupted extraction of
# a definitional footnote, not a real red flag; v3 corrects it to the real
# COT level-2 criterion.
INDICATOR_TEXT_CORRECTIONS: dict[tuple[str, str], str] = {
    ("608", "and there is no acute"): "Risk of flight or ongoing abuse",
}


def transform_entry(
    cot: dict,
    adult: dict | None,
    indicator_overrides: dict[str, dict[str, dict]] | None = None,
) -> dict:
    """Canonical schema per design §1. cot is the base (broader coverage,
    full per-level criteria); adult supplies aliases and per-indicator
    followup_questions where available.

    indicator_overrides (from build_indicator_overrides()) is the
    highest-priority source for followup_question, consulted before
    adult's per-indicator matching. See build_indicator_overrides() and
    INDICATOR_TEXT_CORRECTIONS for how the two non-common-case exceptions
    (a corrected indicator string, a genuinely new indicator) are handled."""
    indicator_overrides = indicator_overrides or {}
    v3_for_complaint = indicator_overrides.get(cot["nacrs_code"], {})

    indicators: list[str] = []
    for level in cot["triage_levels"]:
        if level["level"] <= 2:
            for text in [*level["criteria"], *level["modifiers"]]:
                if text not in indicators:
                    indicators.append(text)

    red_flags: list[dict] = []
    matched_v3_indicators: set[str] = set()
    for indicator in indicators:
        corrected_indicator = INDICATOR_TEXT_CORRECTIONS.get(
            (cot["nacrs_code"], indicator), indicator
        )
        ctas_level = next(
            lvl["level"] for lvl in cot["triage_levels"]
            if lvl["level"] <= 2 and indicator in [*lvl["criteria"], *lvl["modifiers"]]
        )
        v3_match = v3_for_complaint.get(corrected_indicator)
        if v3_match is not None:
            matched_v3_indicators.add(corrected_indicator)
        red_flags.append({
            "indicator": corrected_indicator,
            "ctas_level": ctas_level,
            "app_severity": CTAS_TO_APP_SEVERITY[ctas_level],
            "followup_question": (
                v3_match["followup_question"] if v3_match is not None
                else _adult_question_for(corrected_indicator, adult)
            ),
        })

    # Case 2 — a v3 red flag for this complaint with no cot-side indicator
    # at all (e.g. nacrs_code 551's cauda-equina/AAA entry): add it as a
    # brand-new red flag rather than an override, using v3's own ctas_level.
    for v3_indicator, v3_rf in v3_for_complaint.items():
        if v3_indicator in matched_v3_indicators:
            continue
        red_flags.append({
            "indicator": v3_indicator,
            "ctas_level": v3_rf["ctas_level"],
            "app_severity": CTAS_TO_APP_SEVERITY[v3_rf["ctas_level"]],
            "followup_question": v3_rf["followup_question"],
        })

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
    indicator_overrides = build_indicator_overrides()

    canonical = [transform_entry(cot, adult, indicator_overrides) for cot, adult in result.matched]
    canonical += [transform_entry(cot, None, indicator_overrides) for cot in result.cot_only]

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
