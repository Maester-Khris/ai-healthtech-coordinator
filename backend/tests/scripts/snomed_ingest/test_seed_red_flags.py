# backend/tests/scripts/snomed_ingest/test_seed_red_flags.py
import inspect
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))

from scripts.snomed_ingest import seed_red_flags
from graph.snomed_neo4j.anchor_mapping import AnchorMapping
from scripts.snomed_ingest.seed_red_flags import build_rows, load_red_flag_lookup


def test_build_rows_flattens_one_row_per_red_flag():
    mappings = [
        AnchorMapping(
            ctas_alias="Chest pain (cardiac features)",
            anchor_concept_id="426396005",
            fsn="Cardiac chest pain (finding)",
            rationale="test",
        ),
    ]
    red_flag_lookup = {
        "Chest pain (cardiac features)": [
            {
                "indicator": "Shock",
                "ctas_level": 1,
                "app_severity": "emergent",
                "followup_question": "Are you feeling faint or pale/sweaty?",
            },
            {
                "indicator": "Moderate respiratory distress",
                "ctas_level": 2,
                "app_severity": "urgent",
                "followup_question": "Are you having trouble breathing?",
            },
        ],
    }

    rows = build_rows(mappings, red_flag_lookup)

    assert rows == [
        {
            "anchor_id": "426396005",
            "indicator": "Shock",
            "ctas_level": 1,
            "app_severity": "emergent",
            "followup_question": "Are you feeling faint or pale/sweaty?",
        },
        {
            "anchor_id": "426396005",
            "indicator": "Moderate respiratory distress",
            "ctas_level": 2,
            "app_severity": "urgent",
            "followup_question": "Are you having trouble breathing?",
        },
    ]


def test_build_rows_writes_exactly_one_row_per_red_flag_not_per_followup():
    # Regression test for the plan document's bug: followup_question is a single
    # string per red flag, not a list called "followups" to loop over. One red
    # flag with one followup_question must produce exactly one row, never zero
    # and never more than one.
    mappings = [
        AnchorMapping(ctas_alias="X", anchor_concept_id="1", fsn="f", rationale="r"),
    ]
    red_flag_lookup = {
        "X": [
            {"indicator": "I1", "ctas_level": 1, "app_severity": "emergent", "followup_question": "Q1?"},
        ],
    }

    rows = build_rows(mappings, red_flag_lookup)

    assert len(rows) == 1
    assert rows[0]["followup_question"] == "Q1?"


def test_build_rows_skips_complaints_absent_from_the_lookup():
    # A mapping whose ctas_alias has no entry in red_flag_lookup (e.g. complaint
    # has zero red flags in the source JSON) must contribute zero rows, not raise.
    mappings = [
        AnchorMapping(ctas_alias="No red flags here", anchor_concept_id="1", fsn="f", rationale="r"),
    ]
    rows = build_rows(mappings, red_flag_lookup={})
    assert rows == []


def test_load_red_flag_lookup_keys_by_exact_complaint_name(tmp_path):
    complaints_path = tmp_path / "symptom_triage_data.json"
    complaints_path.write_text(
        json.dumps(
            [
                {
                    "nacrs_code": "003",
                    "name": "Chest pain (cardiac features)",
                    "aliases": [],
                    "clinical_criteria": [],
                    "red_flags": [
                        {
                            "indicator": "Shock",
                            "ctas_level": 1,
                            "app_severity": "emergent",
                            "followup_question": "Are you feeling faint?",
                        },
                    ],
                    "source": "CTAS",
                    "source_pages": "1",
                },
            ]
        )
    )

    lookup = load_red_flag_lookup(complaints_path)

    assert lookup == {
        "Chest pain (cardiac features)": [
            {
                "indicator": "Shock",
                "ctas_level": 1,
                "app_severity": "emergent",
                "followup_question": "Are you feeling faint?",
            },
        ],
    }


def test_seed_red_flags_never_writes_layer_1_labels():
    # Structural isolation check (opposite direction of load_rf2.py's own
    # "never reference Layer 2 labels" test the plan document specifies): this
    # script must never MERGE/SET/CREATE anything labeled :SnomedConcept or
    # :Description -- Layer 1 is load_rf2.py's exclusive write responsibility.
    # A simple regex check on the Cypher strings is sufficient here (per the
    # task brief); no real Cypher parsing needed.
    source = inspect.getsource(seed_red_flags)

    forbidden_patterns = [
        r"MERGE\s*\([^)]*:SnomedConcept",
        r"MERGE\s*\([^)]*:Description",
        r"CREATE\s*\([^)]*:SnomedConcept",
        r"CREATE\s*\([^)]*:Description",
        r"SET\s+\w+\s*:\s*SnomedConcept",
        r"SET\s+\w+\s*:\s*Description",
        r"FOR\s*\([^)]*:SnomedConcept",
        r"FOR\s*\([^)]*:Description",
    ]
    for pattern in forbidden_patterns:
        assert not re.search(pattern, source), (
            f"seed_red_flags.py must never MERGE/SET/CREATE :SnomedConcept or "
            f":Description, nor create a constraint on them -- Layer 1 is "
            f"load_rf2.py's exclusive write responsibility (matched pattern: {pattern!r})"
        )

    # Positive control: the module must still genuinely reference SnomedConcept
    # (read-only MATCH, to anchor red flags to it) -- otherwise the assertions
    # above would pass vacuously by the label simply never being mentioned.
    assert "SnomedConcept" in source
    assert re.search(r"MATCH\s*\([^)]*:SnomedConcept", source), (
        "expected a read-only MATCH on :SnomedConcept -- if this is genuinely "
        "gone, the positive control itself needs updating, not just deleting"
    )


def test_seed_red_flags_writes_are_merge_on_key_not_create():
    # All writes must be MERGE-on-key (idempotent, safe to rerun), never a bare
    # CREATE for RedFlag or FollowupQuestion nodes.
    source = inspect.getsource(seed_red_flags)
    assert "MERGE (anchor)-[:HAS_RED_FLAG]->(rf:RedFlag {anchor_id: row.anchor_id, indicator: row.indicator})" in source
    assert "MERGE (q:FollowupQuestion {text:" in source
    assert "CREATE (rf:RedFlag" not in source
    assert "CREATE (q:FollowupQuestion" not in source

def test_seeding_query_scopes_red_flag_by_anchor_not_just_indicator():
    """I-1/I-2 regression guard: the MERGE pattern must key RedFlag on
    (anchor_id, indicator), not indicator alone — otherwise two different
    anchors sharing an indicator string collapse onto one shared node,
    which is exactly what caused the false cross-symptom-cluster signal
    and the nondeterministic follow-up question."""
    source = inspect.getsource(seed_red_flags.seed)
    assert "MERGE (anchor)-[:HAS_RED_FLAG]->(rf:RedFlag {anchor_id: row.anchor_id, indicator: row.indicator})" in source
    assert "MERGE (rf:RedFlag {indicator: row.indicator})" not in source
    assert "REQUIRE rf.indicator IS UNIQUE" not in source


def test_seed_pilot_clusters_merges_cluster_and_part_of_edges():
    from unittest.mock import MagicMock
    from scripts.snomed_ingest.seed_red_flags import seed_pilot_clusters, PILOT_CLUSTERS

    session = MagicMock()
    seed_pilot_clusters(session)

    assert session.run.call_count == len(PILOT_CLUSTERS) * 2
    first_call_query = session.run.call_args_list[0][0][0]
    assert "MERGE (cluster:RedFlagCluster" in first_call_query
