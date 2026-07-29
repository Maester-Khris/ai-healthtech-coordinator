# backend/tests/scripts/snomed_ingest/test_rf2_reader.py
from backend.scripts.snomed_ingest.rf2_reader import read_concepts


def test_read_concepts_parses_tab_separated_rf2_row(tmp_path):
    rf2_file = tmp_path / "sct2_Concept_Snapshot_CanadianEdition_20260531.txt"
    rf2_file.write_text(
        "id\teffectiveTime\tactive\tmoduleId\tdefinitionStatusId\n"
        "404684003\t20170731\t1\t900000000000207008\t900000000000074008\n"
    )
    rows = list(read_concepts(rf2_file))
    assert len(rows) == 1
    assert rows[0].id == "404684003"
    assert rows[0].active is True
    assert rows[0].module_id == "900000000000207008"
    assert rows[0].effective_time == "20170731"


def test_subset_keeps_only_clinical_finding_descendants_and_root():
    # concept 404684003 = root; 22253000 = "Pain" is a real, verified descendant;
    # 71388002 = "Procedure" is NOT a descendant and must be excluded
    from backend.scripts.snomed_ingest.load_rf2 import concept_ids_in_subset
    from backend.scripts.snomed_ingest.rf2_reader import RelationshipRow

    relationships = [
        # 22253000 --IS_A--> 404684003 (Pain is a Clinical finding)
        RelationshipRow("1", "20170731", True, "900000000000207008",
                         "22253000", "404684003", "0", "116680003",
                         "900000000000011006", "900000000000451002"),
    ]
    result = concept_ids_in_subset(relationships, root="404684003")
    assert "22253000" in result
    assert "404684003" in result
    assert "71388002" not in result
