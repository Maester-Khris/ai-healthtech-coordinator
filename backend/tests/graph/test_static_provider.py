import json
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import pytest
from graph.static_provider import StaticLookupProvider

FIXTURE = [
    {
        "nacrs_code": "003",
        "name": "Chest pain (cardiac features)",
        "aliases": ["chest pain"],
        "red_flags": [
            {"indicator": "Shock", "ctas_level": 1, "app_severity": "emergent",
             "followup_question": "Are they feeling faint, dizzy, or cold and clammy?"},
        ],
    },
    {
        "nacrs_code": "751",
        "name": "Substance misuse / Intoxication",
        "aliases": ["overdose", "intoxication"],
        "red_flags": [
            {"indicator": "Unconscious (GCS 3-9)", "ctas_level": 1, "app_severity": "emergent",
             "followup_question": "Are they able to respond to you at all?"},
        ],
    },
]


@pytest.fixture
def provider(tmp_path):
    data_path = tmp_path / "symptom_triage_data.json"
    data_path.write_text(json.dumps(FIXTURE))
    return StaticLookupProvider(data_path=data_path)


def test_matches_on_latest_message(provider):
    result = provider.get_symptom_graph_context("I have chest pain", [])
    assert result.matched is True
    assert result.complaint_name == "Chest pain (cardiac features)"
    assert result.red_flags[0].indicator == "Shock"


def test_no_match_returns_empty(provider):
    result = provider.get_symptom_graph_context("I have a headache", [])
    assert result.matched is False
    assert result.red_flags == []


def test_turn_union_carries_forward_earlier_match(provider):
    # Turn 1 mentioned chest pain; turn 3's message alone has no match, but the
    # red flag from turn 1 must still surface via recent_messages (design §5).
    result = provider.get_symptom_graph_context(
        "it started yesterday",
        recent_messages=["I have chest pain", "it comes and goes"],
    )
    assert result.matched is True
    assert result.red_flags[0].indicator == "Shock"


def test_dedups_repeated_indicator_across_turns(provider):
    result = provider.get_symptom_graph_context(
        "chest pain again", recent_messages=["I have chest pain"],
    )
    assert len(result.red_flags) == 1


def test_match_entry_prefers_longest_alias_not_first_inserted(tmp_path):
    """Task 1 fix regression test: 'cough' is inserted BEFORE 'coughing up
    water' in the fixture, so the pre-fix first-match-wins behavior would
    return 'Complaint Short'. The fix must return the more specific,
    longer-alias match instead — see docs/superpowers/plans/
    2026-08-05-v1-v2-retrieval-eval-fairness.md Task 1."""
    fixture = [
        {"nacrs_code": "900", "name": "Complaint Short", "aliases": ["cough"], "red_flags": []},
        {"nacrs_code": "901", "name": "Complaint Long", "aliases": ["coughing up water"], "red_flags": []},
    ]
    data_path = tmp_path / "symptom_triage_data.json"
    data_path.write_text(json.dumps(fixture))
    provider = StaticLookupProvider(data_path=data_path)

    result = provider.get_symptom_graph_context(
        "my son is coughing up water and I am worried", []
    )

    assert result.complaint_name == "Complaint Long"


def test_debug_all_matches_returns_every_matching_complaint(tmp_path):
    """New eval-only method exposes every matching complaint, not just the
    one _match_entry() selects as most specific."""
    fixture = [
        {"nacrs_code": "900", "name": "Complaint Short", "aliases": ["cough"], "red_flags": []},
        {"nacrs_code": "901", "name": "Complaint Long", "aliases": ["coughing up water"], "red_flags": []},
    ]
    data_path = tmp_path / "symptom_triage_data.json"
    data_path.write_text(json.dumps(fixture))
    provider = StaticLookupProvider(data_path=data_path)

    matches = provider.debug_all_matches("my son is coughing up water and I am worried")

    assert set(matches) == {"Complaint Short", "Complaint Long"}
