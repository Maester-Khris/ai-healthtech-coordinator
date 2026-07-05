import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import Facility, NearbyFacilityResult


class TestFacilityWaitMinutes:
    def test_defaults_to_none(self):
        f = Facility(
            name="X", category="hospital", source_facility_type="general",
            accepted_severity=["routine"], address="123 St", lat=0.0, lng=0.0,
        )
        assert f.wait_minutes is None

    def test_accepts_explicit_value(self):
        f = Facility(
            name="X", category="hospital", source_facility_type="general",
            accepted_severity=["routine"], address="123 St", lat=0.0, lng=0.0,
            wait_minutes=15,
        )
        assert f.wait_minutes == 15


class TestNearbyFacilityResultWaitMinutes:
    def test_accepts_explicit_value(self):
        r = NearbyFacilityResult(
            facility_id="a", facility_name="X", category="hospital", address="123",
            phone=None, is_operational=True, distance_m=1, eta_walk_min=1,
            eta_transit_min=1, eta_drive_min=1, wait_minutes=15,
        )
        assert r.wait_minutes == 15

    def test_defaults_to_none(self):
        r = NearbyFacilityResult(
            facility_id="a", facility_name="X", category="hospital", address="123",
            phone=None, is_operational=True, distance_m=1, eta_walk_min=1,
            eta_transit_min=1, eta_drive_min=1,
        )
        assert r.wait_minutes is None
