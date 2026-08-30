import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

import pytest

from scripts.graphrag_eval.scenarios import (
    LAY_SCENARIOS,
    SCENARIOS,
    _entries_by_name,
    expected_red_flag_indicators,
    verified_intersection,
)


class TestScenarios:
    def test_has_between_15_and_20_positive_scenarios(self):
        positive = [s for s in SCENARIOS if s["expected_complaint"] is not None]
        assert 15 <= len(positive) <= 20

    def test_has_at_least_two_no_match_scenarios(self):
        no_match = [s for s in SCENARIOS if s["expected_complaint"] is None]
        assert len(no_match) >= 2

    def test_every_scenario_has_required_keys(self):
        for scenario in SCENARIOS:
            assert set(scenario.keys()) == {"message", "expected_complaint"}
            assert isinstance(scenario["message"], str) and scenario["message"]

    def test_positive_scenarios_are_full_sentences_not_bare_aliases(self):
        for scenario in SCENARIOS:
            if scenario["expected_complaint"] is not None:
                assert len(scenario["message"].split()) >= 5

    def test_no_match_scenario_messages_are_unique(self):
        no_match_messages = [
            s["message"] for s in SCENARIOS if s["expected_complaint"] is None
        ]
        assert len(no_match_messages) == len(set(no_match_messages))


class TestVerifiedIntersection:
    def test_intersection_is_non_trivial(self):
        # Sanity check the intersection check itself isn't vacuously empty —
        # anchor_mapping.py's own docstring claims 154 of 165 resolved.
        intersection = verified_intersection()
        assert len(intersection) >= 100

    def test_every_scenario_expected_complaint_is_in_verified_intersection(self):
        intersection = verified_intersection()
        for scenario in SCENARIOS:
            if scenario["expected_complaint"] is not None:
                assert scenario["expected_complaint"] in intersection


class TestExpectedRedFlagIndicators:
    def test_returns_non_empty_list_for_known_complaint(self):
        indicators = expected_red_flag_indicators("Chest pain (cardiac features)")
        assert indicators
        assert all(isinstance(i, str) for i in indicators)

    def test_returns_empty_list_for_unknown_complaint(self):
        assert expected_red_flag_indicators("Not a real complaint") == []


def test_lay_scenarios_avoid_every_v1_alias_and_name_substring():
    """Task 3: a vocabulary-neutral scenario subset, per scenarios.py's own
    disclosed-bias note and docs/superpowers/plans/
    2026-08-05-v1-v2-retrieval-eval-fairness.md Step 2. Don't hand-pick and
    hope: assert programmatically, the same way verified_intersection()
    already does for the main SCENARIOS list, that no LAY_SCENARIOS message
    contains any v1 alias or complaint name as a substring — using the
    exact normalization StaticLookupProvider itself uses, so this test
    fails the moment a lay scenario accidentally reuses v1's own
    vocabulary. If this fails against the real data, rephrase the
    offending scenario until it passes — that's the intended guard, not a
    bug in the test."""
    from graph.static_provider import _normalize

    entries = _entries_by_name()
    all_terms = set()
    for entry in entries.values():
        all_terms.add(entry["name"])
        all_terms.update(entry.get("aliases", []))

    for scenario in LAY_SCENARIOS:
        normalized_message = _normalize(scenario["message"])
        for term in all_terms:
            normalized_term = _normalize(term)
            if len(normalized_term) >= 4 and normalized_term in normalized_message:
                pytest.fail(
                    f"Lay scenario {scenario['message']!r} contains v1 term "
                    f"{term!r} — defeats the purpose of a vocabulary-neutral subset"
                )


def test_lay_scenarios_expected_complaints_are_in_verified_intersection():
    """Same ground-truth-identity-space guarantee as the main SCENARIOS
    list — see verified_intersection()'s own docstring."""
    intersection = verified_intersection()
    for scenario in LAY_SCENARIOS:
        assert scenario["expected_complaint"] in intersection
