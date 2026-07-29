# backend/tests/scripts/snomed_ingest/test_complaint_seeds.py
import json

from backend.scripts.snomed_ingest.complaint_seeds import (
    load_complaint_keywords, find_seed_concept_ids,
)
from backend.scripts.snomed_ingest.rf2_reader import DescriptionRow


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
