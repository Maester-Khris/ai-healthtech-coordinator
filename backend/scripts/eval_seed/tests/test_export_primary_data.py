import json
import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.eval_seed.export_primary_data import (
    export_facilities,
    export_latest_wait_times,
    write_export,
)

FACILITY_ROW = {
    "facility_id": "665e2daa-cccf-40c1-b0d7-e5b16751ccc3",
    "facility_name": "Rockcliffe Care Community",
    "category": "residential",
    "source_facility_type": "long-term care home",
    "accepted_severity": ["routine"],
    "address": "3015 lawrence avenue e, toronto, ON M1P 2V7",
    "lat": 43.75467751,
    "lng": -79.24789355,
    "phone": "(416) 264-3201",
    "google_place_id": "ChIJubZufszR1IkRp1Y1dHuLQVI",
    "business_status": "OPERATIONAL",
    "is_operational": True,
    "weekday_hours": '["Monday: 8:30 AM - 7:00 PM"]',
    "last_enriched_at": "2026-06-16T08:59:29.214357+00:00",
    "dbt_run_at": "2026-06-16T14:40:52.266742+00:00",
}

WAIT_TIME_ROW = {
    "facility_id": "665e2daa-cccf-40c1-b0d7-e5b16751ccc3",
    "wait_minutes": 42,
    "raw_wait": "42 min",
    "source": "erstat",
    "recorded_at": "2026-07-10T03:08:00+00:00",
}


class TestExportFacilities:
    @patch("scripts.eval_seed.export_primary_data.supabase_select")
    def test_selects_all_columns_no_filter(self, mock_select):
        mock_select.return_value = [FACILITY_ROW]

        result = export_facilities()

        assert result == [FACILITY_ROW]
        mock_select.assert_called_once_with("facilities_clean", {"select": "*"})

    @patch("scripts.eval_seed.export_primary_data.supabase_select")
    def test_raises_on_suspiciously_round_row_count(self, mock_select):
        mock_select.return_value = [FACILITY_ROW] * 1000

        with pytest.raises(RuntimeError, match="1000 rows"):
            export_facilities()


class TestExportLatestWaitTimes:
    @patch("scripts.eval_seed.export_primary_data.supabase_rpc")
    def test_calls_latest_wait_times_rpc(self, mock_rpc):
        mock_rpc.return_value = [WAIT_TIME_ROW]

        result = export_latest_wait_times()

        assert result == [WAIT_TIME_ROW]
        mock_rpc.assert_called_once_with("latest_wait_times", {})


class TestWriteExport:
    def test_writes_valid_json_matching_input(self, tmp_path):
        target = str(tmp_path / "facilities.json")

        written_path = write_export([FACILITY_ROW], target)

        assert written_path == target
        with open(target) as f:
            assert json.load(f) == [FACILITY_ROW]
