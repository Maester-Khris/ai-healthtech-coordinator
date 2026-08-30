import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.vignette_loader import build_vignette, load_all_vignettes

RAW_SINGLE_STAGE = {
    "case_id": "2",
    "scenario": "A 36 year old unresponsive female...",
    "patient_index": None,
    "questions": [{"prompt": "What is the Arrival CTAS Level?", "ctas_level": 1, "rationale": "..."}],
    "source": "Ontario MOHLTC Prehospital CTAS Paramedic Guide v2.0",
    "source_pages": "p.73, p.81",
}

RAW_TWO_STAGE = {
    "case_id": "4",
    "scenario": "...",
    "patient_index": None,
    "questions": [
        {"prompt": "What was this Patient's Arrival CTAS Level?", "ctas_level": 2, "rationale": "..."},
        {"prompt": "What is the Departure CTAS Level?", "ctas_level": 3, "rationale": "..."},
    ],
    "source": "Ontario MOHLTC Prehospital CTAS Paramedic Guide v2.0",
    "source_pages": "p.74",
}

CHECKLIST = {
    "opening_message": "I feel dizzy and almost fainted.",
    "disclosure_items": [
        {"feature_id": "syncope", "category": "history",
         "first_person_phrasing": "I passed out.", "reveal_only_if_asked": True}
    ],
    "update_message": None,
}


class TestBuildVignette:
    def test_single_stage_maps_ctas_to_app_severity(self):
        vignette = build_vignette(RAW_SINGLE_STAGE, CHECKLIST)
        assert vignette.case_id == "2"
        assert vignette.gold_severity == "emergent"  # CTAS 1 -> emergent
        assert vignette.gold_ctas_level == 1
        assert vignette.update_message is None
        assert vignette.disclosure_items[0].feature_id == "syncope"

    def test_two_stage_carries_departure_severity(self):
        vignette = build_vignette(RAW_TWO_STAGE, CHECKLIST)
        assert vignette.gold_severity == "emergent"      # CTAS 2 -> emergent
        assert vignette.updated_gold_severity == "urgent"  # CTAS 3 -> urgent


class TestLoadAllVignettes:
    def test_skips_vignettes_without_a_checklist(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw_path = os.path.join(tmp, "raw.json")
            checklists_dir = os.path.join(tmp, "checklists")
            os.makedirs(checklists_dir)

            with open(raw_path, "w") as f:
                json.dump([RAW_SINGLE_STAGE, RAW_TWO_STAGE], f)
            with open(os.path.join(checklists_dir, "2.json"), "w") as f:
                json.dump(CHECKLIST, f)
            # no checklist written for case_id "4" — must be skipped, not error

            vignettes = load_all_vignettes(raw_path=raw_path, checklists_dir=checklists_dir)

            assert len(vignettes) == 1
            assert vignettes[0].case_id == "2"
