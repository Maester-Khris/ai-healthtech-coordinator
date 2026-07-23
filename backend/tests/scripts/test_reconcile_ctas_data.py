import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

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
