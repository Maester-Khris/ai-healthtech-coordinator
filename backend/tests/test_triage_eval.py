import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.triage_eval import check_facility_groundedness

FACILITY = {
    "id": "fac-001",
    "name": "Toronto General Hospital",
    "address": "200 Elizabeth St, Toronto",
    "distanceKm": 1.2,
}


class TestCheckFacilityGroundedness:
    def test_grounded_when_facility_name_present(self):
        text = "Please head to Toronto General Hospital right away."
        result = check_facility_groundedness(text, FACILITY)
        assert result == {"grounded": True, "facility_name": "Toronto General Hospital"}

    def test_not_grounded_when_facility_name_absent(self):
        text = "Please head to the nearest hospital right away."
        result = check_facility_groundedness(text, FACILITY)
        assert result == {"grounded": False, "facility_name": "Toronto General Hospital"}

    def test_case_insensitive_match(self):
        text = "please head to toronto general hospital right away."
        result = check_facility_groundedness(text, FACILITY)
        assert result["grounded"] is True

    def test_no_facility_returns_none_grounded(self):
        result = check_facility_groundedness("Call 211 or search online.", None)
        assert result == {"grounded": None, "facility_name": None}
