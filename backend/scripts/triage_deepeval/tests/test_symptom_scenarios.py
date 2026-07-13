import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.triage_deepeval.symptom_scenarios import SYMPTOM_SCENARIOS

TORONTO_LAT_RANGE = (43.58, 43.85)
TORONTO_LNG_RANGE = (-79.64, -79.12)


class TestSymptomScenarios:
    def test_has_multiple_scenarios(self):
        assert len(SYMPTOM_SCENARIOS) >= 10

    def test_every_scenario_has_required_keys(self):
        for scenario in SYMPTOM_SCENARIOS:
            assert set(scenario.keys()) == {"message", "lat", "lng"}
            assert isinstance(scenario["message"], str) and scenario["message"]

    def test_coordinates_are_within_toronto_bounds(self):
        for scenario in SYMPTOM_SCENARIOS:
            assert TORONTO_LAT_RANGE[0] <= scenario["lat"] <= TORONTO_LAT_RANGE[1]
            assert TORONTO_LNG_RANGE[0] <= scenario["lng"] <= TORONTO_LNG_RANGE[1]
