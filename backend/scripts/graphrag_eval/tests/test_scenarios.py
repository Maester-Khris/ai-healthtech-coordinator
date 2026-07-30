import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.graphrag_eval.scenarios import (
    SCENARIOS,
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
