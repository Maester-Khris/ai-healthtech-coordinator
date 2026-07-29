import json
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import pytest
from scripts.reconcile_ctas_data import normalize_name, match_complaints

COT_FIXTURE = [
    {"nacrs_code": "003", "name": "Chest pain (cardiac features)"},
    {"nacrs_code": "752", "name": "Overdose ingestion"},
    {"nacrs_code": "869", "name": "Newly Born"},
]
ADULT_FIXTURE = [
    {"presenting_complaint": "Chest pain (cardiac features)"},
    {"presenting_complaint": "Drug overdose"},
    {"presenting_complaint": "General weakness"},
]


def test_normalize_strips_punctuation_and_case():
    assert normalize_name("Foreign body, ear") == "foreign body ear"
    assert normalize_name("Chest Pain (Cardiac Features)") == "chest pain cardiac features"


def test_exact_match_after_normalization():
    result = match_complaints(COT_FIXTURE, ADULT_FIXTURE, alias_overrides={})
    matched_names = {cot["name"] for cot, _ in result.matched}
    assert "Chest pain (cardiac features)" in matched_names


def test_unmatched_without_alias_override_falls_to_cot_only_and_adult_only():
    result = match_complaints(COT_FIXTURE, ADULT_FIXTURE, alias_overrides={})
    # "Overdose ingestion" (cot) vs "Drug overdose" (adult) are genuinely
    # different strings after normalization — punctuation-stripping alone
    # can't reconcile a real wording difference, only a reviewed alias can.
    assert any(e["name"] == "Overdose ingestion" for e in result.cot_only)
    assert any(e["presenting_complaint"] == "Drug overdose" for e in result.adult_only)


def test_alias_override_resolves_near_miss():
    overrides = {normalize_name("Overdose ingestion"): "Drug overdose"}
    result = match_complaints(COT_FIXTURE, ADULT_FIXTURE, alias_overrides=overrides)
    matched_names = {cot["name"] for cot, _ in result.matched}
    assert "Overdose ingestion" in matched_names
    assert not any(e["name"] == "Overdose ingestion" for e in result.cot_only)


def test_no_match_lands_in_cot_only():
    result = match_complaints(COT_FIXTURE, ADULT_FIXTURE, alias_overrides={})
    assert any(e["name"] == "Newly Born" for e in result.cot_only)


def test_no_match_lands_in_adult_only():
    result = match_complaints(COT_FIXTURE, ADULT_FIXTURE, alias_overrides={})
    assert any(e["presenting_complaint"] == "General weakness" for e in result.adult_only)


def test_comparison_operators_are_not_stripped_to_the_same_key():
    # Regression: "< 20 weeks" and "> 20 weeks" are clinically different
    # complaints (early vs. late pregnancy) — must not normalize identically.
    assert normalize_name("Pregnancy issue < 20 weeks") != normalize_name("Pregnancy issue > 20 weeks")


def test_normalization_collision_between_distinct_complaints_raises():
    # Punctuation-only difference that still collides after normalization —
    # the guard must catch any two different original strings mapping to the
    # same key, not just the specific </> case already fixed above.
    colliding_adult = [
        {"presenting_complaint": "Foo (Bar)"},
        {"presenting_complaint": "Foo Bar"},
    ]
    with pytest.raises(ValueError, match="Normalization collision"):
        match_complaints(COT_FIXTURE, colliding_adult, alias_overrides={})


from scripts.reconcile_ctas_data import transform_entry, CTAS_TO_APP_SEVERITY

COT_CHEST_PAIN = {
    "nacrs_code": "003",
    "name": "Chest pain (cardiac features)",
    "triage_levels": [
        {"level": 1, "criteria": [], "modifiers": ["Shock", "Unconscious (GCS 3-9)"]},
        {"level": 3, "criteria": ["VS, PSC, PSP, chronicity"], "modifiers": ["Fever (looks unwell)"]},
    ],
    "red_flags": ["Shock", "Unconscious (GCS 3-9)"],
    "followup_questions": ["When did this start?"],
}
ADULT_CHEST_PAIN = {
    "presenting_complaint": "Chest pain (cardiac features)",
    "aliases": ["chest pain"],
    "red_flags": [
        {"indicator": "Shock", "ctas_level": 1,
         "followup_question": "Are they feeling faint, dizzy, or cold and clammy?"},
    ],
    "source": "CTAS Participant Manual v2.5b (Nov 2013)",
    "source_pages": "p.17",
}
COT_ONLY_ENTRY = {
    "nacrs_code": "652",
    "name": "Respiratory arrest",
    "triage_levels": [{"level": 1, "criteria": ["Respiratory arrest"], "modifiers": []}],
    "red_flags": ["Respiratory arrest"],
    "followup_questions": ["Is the person breathing at all?"],
}


def test_severity_mapping_is_monotonic_and_complete():
    assert CTAS_TO_APP_SEVERITY == {
        1: "emergent", 2: "emergent", 3: "urgent", 4: "moderate", 5: "routine",
    }


def test_transform_matched_entry_prefers_adult_followup_question():
    entry = transform_entry(COT_CHEST_PAIN, ADULT_CHEST_PAIN)
    assert entry["nacrs_code"] == "003"
    assert entry["aliases"] == ["chest pain"]
    shock_flag = next(rf for rf in entry["red_flags"] if rf["indicator"] == "Shock")
    assert shock_flag["ctas_level"] == 1
    assert shock_flag["app_severity"] == "emergent"
    assert shock_flag["followup_question"] == "Are they feeling faint, dizzy, or cold and clammy?"


def test_transform_matched_entry_flags_indicators_missing_adult_question():
    entry = transform_entry(COT_CHEST_PAIN, ADULT_CHEST_PAIN)
    gcs_flag = next(rf for rf in entry["red_flags"] if rf["indicator"] == "Unconscious (GCS 3-9)")
    # No adult-file question exists for this indicator — must be flagged for
    # human authoring, never silently fabricated.
    assert gcs_flag["followup_question"] == "NEEDS_AUTHORING"


def test_transform_retains_clinical_criteria():
    entry = transform_entry(COT_CHEST_PAIN, ADULT_CHEST_PAIN)
    assert entry["clinical_criteria"] == COT_CHEST_PAIN["triage_levels"]


def test_transform_cot_only_entry_derives_severity_and_flags_all_questions():
    entry = transform_entry(COT_ONLY_ENTRY, None)
    assert entry["aliases"] == []
    flag = entry["red_flags"][0]
    assert flag["indicator"] == "Respiratory arrest"
    assert flag["ctas_level"] == 1
    assert flag["app_severity"] == "emergent"
    assert flag["followup_question"] == "NEEDS_AUTHORING"


# --- build_indicator_overrides() / v3 corpus merge --------------------------
#
# artifacts/followup_question_bank_v3.json is gitignored (design-artifact
# convention, not committed) — tests exercise build_indicator_overrides()'s
# real file-reading/indexing logic against a small temp fixture instead of
# depending on that file being present, so this suite works from a clean
# checkout. transform_entry's three merge cases are tested with inline,
# real-fixture-shaped dicts, same style as the rest of this file.

import scripts.reconcile_ctas_data as reconcile_ctas_data
from scripts.reconcile_ctas_data import build_indicator_overrides, INDICATOR_TEXT_CORRECTIONS


def test_build_indicator_overrides_indexes_by_nacrs_code_and_indicator(tmp_path, monkeypatch):
    v3_fixture = [
        {
            "nacrs_code": "003",
            "name": "Chest pain (cardiac features)",
            "red_flags": [
                {"indicator": "Shock", "ctas_level": 1, "app_severity": "emergent",
                 "followup_question": "v3's corrected shock question"},
            ],
        },
        {
            "nacrs_code": "551",
            "name": "Back pain",
            "red_flags": [
                {"indicator": "Cauda equina concern", "ctas_level": 2,
                 "app_severity": "emergent", "followup_question": "v3 cauda equina question"},
            ],
        },
    ]
    artifacts_dir = tmp_path / "artifacts"
    artifacts_dir.mkdir()
    (artifacts_dir / "followup_question_bank_v3.json").write_text(json.dumps(v3_fixture))
    monkeypatch.setattr(reconcile_ctas_data, "_ARTIFACTS", artifacts_dir)

    overrides = build_indicator_overrides()

    assert overrides["003"]["Shock"]["followup_question"] == "v3's corrected shock question"
    assert overrides["551"]["Cauda equina concern"]["followup_question"] == "v3 cauda equina question"


def test_transform_entry_indicator_override_takes_priority_over_adult_question():
    # Case 1 (the common ~588-entry case): an exact (nacrs_code, indicator)
    # match in v3 must win even when the adult file already has its own
    # (older/unreviewed) question for the same indicator.
    indicator_overrides = {
        "003": {
            "Shock": {
                "indicator": "Shock", "ctas_level": 1, "app_severity": "emergent",
                "followup_question": "v3's corrected shock question",
            },
        },
    }
    entry = transform_entry(COT_CHEST_PAIN, ADULT_CHEST_PAIN, indicator_overrides)
    shock_flag = next(rf for rf in entry["red_flags"] if rf["indicator"] == "Shock")
    assert shock_flag["followup_question"] == "v3's corrected shock question"
    # Untouched indicator with no v3 entry still falls back to adult/NEEDS_AUTHORING.
    gcs_flag = next(rf for rf in entry["red_flags"] if rf["indicator"] == "Unconscious (GCS 3-9)")
    assert gcs_flag["followup_question"] == "NEEDS_AUTHORING"


def test_transform_entry_without_indicator_overrides_behaves_as_before():
    # Backward compatibility: omitting indicator_overrides (as every
    # pre-existing test in this file does) must be identical to today.
    entry = transform_entry(COT_CHEST_PAIN, ADULT_CHEST_PAIN)
    shock_flag = next(rf for rf in entry["red_flags"] if rf["indicator"] == "Shock")
    assert shock_flag["followup_question"] == "Are they feeling faint, dizzy, or cold and clammy?"


# Case 2 — real nacrs_code 551 (Back pain): v3 has a cauda-equina/AAA red
# flag that cot_triage_data.json's own extraction never names at all (COT
# collapses it into the generic "Acute central severe pain (8-10)" tag).
COT_BACK_PAIN = {
    "nacrs_code": "551",
    "name": "Back pain",
    "triage_levels": [
        {"level": 2, "criteria": ["Acute central severe pain (8-10)"], "modifiers": []},
    ],
}


def test_transform_entry_injects_new_red_flag_absent_from_cot_extraction():
    indicator_overrides = {
        "551": {
            "Severe pain with fever, saddle anesthesia, bowel/bladder dysfunction "
            "(cauda equina concern), or pulsatile abdominal mass (AAA concern)": {
                "indicator": (
                    "Severe pain with fever, saddle anesthesia, bowel/bladder "
                    "dysfunction (cauda equina concern), or pulsatile abdominal "
                    "mass (AAA concern)"
                ),
                "ctas_level": 2,
                "app_severity": "emergent",
                "followup_question": (
                    "Do you have any numbness in the groin area, loss of "
                    "bladder/bowel control, fever, or a pulsing sensation in "
                    "your abdomen?"
                ),
            },
        },
    }
    entry = transform_entry(COT_BACK_PAIN, None, indicator_overrides)
    indicators = [rf["indicator"] for rf in entry["red_flags"]]
    # Original cot-derived indicator is retained, not replaced.
    assert "Acute central severe pain (8-10)" in indicators
    # v3's unmatched indicator is added as a brand-new red flag.
    new_flag = next(
        rf for rf in entry["red_flags"]
        if rf["indicator"].startswith("Severe pain with fever")
    )
    assert new_flag["ctas_level"] == 2
    assert new_flag["app_severity"] == "emergent"
    assert new_flag["followup_question"].startswith("Do you have any numbness")
    assert len(entry["red_flags"]) == 2


# Case 3 — real nacrs_code 608 (Concern for patient's welfare): cot's raw
# indicator is a corrupted PDF-table-extraction fragment of a footnote, not
# real red-flag text. INDICATOR_TEXT_CORRECTIONS (the actual production
# mapping, imported directly — not re-declared here) renames it before the
# v3 lookup happens.
COT_WELFARE = {
    "nacrs_code": "608",
    "name": "Concern for patient's welfare",
    "triage_levels": [
        {"level": 2, "criteria": ["and there is no acute"], "modifiers": []},
    ],
}


def test_indicator_text_corrections_contains_the_welfare_fix():
    assert INDICATOR_TEXT_CORRECTIONS[("608", "and there is no acute")] == (
        "Risk of flight or ongoing abuse"
    )


def test_transform_entry_applies_indicator_text_correction_before_override_lookup():
    indicator_overrides = {
        "608": {
            "Risk of flight or ongoing abuse": {
                "indicator": "Risk of flight or ongoing abuse",
                "ctas_level": 2,
                "app_severity": "emergent",
                "followup_question": "Are you currently in an unsafe living situation or relationship?",
            },
        },
    }
    entry = transform_entry(COT_WELFARE, None, indicator_overrides)
    assert len(entry["red_flags"]) == 1
    flag = entry["red_flags"][0]
    # The corrupted raw cot string must never reach the output.
    assert flag["indicator"] == "Risk of flight or ongoing abuse"
    assert flag["followup_question"] == "Are you currently in an unsafe living situation or relationship?"
    assert flag["ctas_level"] == 2
    assert flag["app_severity"] == "emergent"
