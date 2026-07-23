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
