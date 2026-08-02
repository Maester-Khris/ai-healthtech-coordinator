# backend/tests/scripts/snomed_ingest/test_complaint_seeds.py
import json
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))

from scripts.snomed_ingest.complaint_seeds import (
    load_complaint_keywords, find_seed_concept_ids,
)
from scripts.snomed_ingest.rf2_reader import DescriptionRow


def test_load_complaint_keywords_flattens_name_and_aliases(tmp_path):
    complaints_file = tmp_path / "complaints.json"
    complaints_file.write_text(json.dumps([
        {"nacrs_code": "003", "name": "Chest pain (cardiac features)",
         "aliases": ["heart attack symptoms", "angina"]},
    ]))
    keywords = load_complaint_keywords(complaints_file)
    assert "chest pain (cardiac features)" in keywords
    assert "heart attack symptoms" in keywords
    assert "angina" in keywords


def test_find_seed_concept_ids_matches_active_english_fsn_only():
    matching_fsn = DescriptionRow(
        "1", "20170731", True, "900000000000207008", "22253000",
        "en", "900000000000003001", "Pain (finding)", "900000000000448009",
    )
    french_fsn_same_term = DescriptionRow(
        "2", "20170731", True, "900000000000207008", "99999999",
        "fr", "900000000000003001", "douleur (pain)", "900000000000448009",
    )
    inactive_match = DescriptionRow(
        "3", "20170731", False, "900000000000207008", "88888888",
        "en", "900000000000003001", "Pain in leg (finding)", "900000000000448009",
    )
    non_fsn_match = DescriptionRow(
        "4", "20170731", True, "900000000000207008", "77777777",
        "en", "900000000000013009", "Pain", "900000000000448009",
    )
    result = find_seed_concept_ids(
        [matching_fsn, french_fsn_same_term, inactive_match, non_fsn_match],
        keywords=["pain"],
    )
    assert result == {"22253000"}


def test_find_seed_concept_ids_requires_word_boundary_not_bare_substring():
    # "cut" must not match "acute" (real false positive measured on live data:
    # 2,953 of 3,999 unrestricted matches for "cut" were "acute"-only hits).
    false_positive = DescriptionRow(
        "1", "20170731", True, "900000000000207008", "11111111",
        "en", "900000000000003001", "Acute nasopharyngitis (disorder)", "900000000000448009",
    )
    true_positive = DescriptionRow(
        "2", "20170731", True, "900000000000207008", "22222222",
        "en", "900000000000003001", "Cut of hand (finding)", "900000000000448009",
    )
    result = find_seed_concept_ids([false_positive, true_positive], keywords=["cut"])
    assert result == {"22222222"}


def test_find_seed_concept_ids_matches_keyword_ending_in_punctuation():
    # Regression test for fix round 2: an earlier \b...\b version anchored on
    # the *keyword's own* edge character, so a keyword ending in ")" (real
    # case: CTAS complaint 003 "Chest pain (cardiac features)") could never
    # match even an exact, legitimate occurrence — \b requires a word/non-word
    # transition at the pattern's own boundary, and ")" followed by a space
    # has no such transition. The fixed lookaround version checks the *target
    # text's* surrounding characters instead, so this must match.
    exact_match = DescriptionRow(
        "1", "20170731", True, "900000000000207008", "33333333",
        "en", "900000000000003001",
        "Chest pain (cardiac features) NOS (finding)", "900000000000448009",
    )
    result = find_seed_concept_ids(
        [exact_match], keywords=["chest pain (cardiac features)"]
    )
    assert result == {"33333333"}
