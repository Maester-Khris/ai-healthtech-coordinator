import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.facilities import get_all_facilities, apply_wait_filter


class TestGetAllFacilities:
    @patch("services.facilities.supabase_select")
    def test_always_on_operational_filter(self, mock_select):
        mock_select.return_value = []

        get_all_facilities()

        params = mock_select.call_args.args[1]
        assert params["is_operational"] == "eq.true"
        assert "category" not in params
        assert "accepted_severity" not in params

    @patch("services.facilities.supabase_select")
    def test_category_and_severity_filters_forwarded(self, mock_select):
        mock_select.return_value = []

        get_all_facilities(category="hospital", severity="urgent")

        params = mock_select.call_args.args[1]
        assert params["category"] == "eq.hospital"
        assert params["accepted_severity"] == "cs.{urgent}"

    @patch("services.facilities.supabase_select")
    def test_weekday_hours_json_string_parsed_to_list(self, mock_select):
        mock_select.return_value = [{"weekday_hours": '["Monday: 9-5"]'}]

        result = get_all_facilities()

        assert result[0]["weekday_hours"] == ["Monday: 9-5"]

    @patch("services.facilities.supabase_select")
    def test_weekday_hours_none_becomes_empty_list(self, mock_select):
        mock_select.return_value = [{"weekday_hours": None}]

        result = get_all_facilities()

        assert result[0]["weekday_hours"] == []


class TestApplyWaitFilter:
    def test_annotates_wait_minutes_from_map(self):
        records = [{"id": "a"}, {"id": "b"}]
        result = apply_wait_filter(records, "id", None, {"a": 10, "b": 50})

        assert result[0]["wait_minutes"] == 10
        assert result[1]["wait_minutes"] == 50

    def test_no_threshold_returns_all_records(self):
        records = [{"id": "a"}, {"id": "b"}]
        result = apply_wait_filter(records, "id", None, {"a": 10, "b": 50})

        assert len(result) == 2

    def test_excludes_records_above_threshold(self):
        records = [{"id": "a"}, {"id": "b"}]
        result = apply_wait_filter(records, "id", 30, {"a": 10, "b": 50})

        assert [r["id"] for r in result] == ["a"]

    def test_at_threshold_is_included(self):
        records = [{"id": "a"}]
        result = apply_wait_filter(records, "id", 30, {"a": 30})

        assert len(result) == 1

    def test_missing_wait_data_always_passes(self):
        records = [{"id": "a"}]
        result = apply_wait_filter(records, "id", 5, {})

        assert len(result) == 1
        assert result[0]["wait_minutes"] is None

    def test_works_with_facility_id_key(self):
        records = [{"facility_id": "x"}]
        result = apply_wait_filter(records, "facility_id", 10, {"x": 5})

        assert len(result) == 1
        assert result[0]["wait_minutes"] == 5
