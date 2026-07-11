import json
import os
import sys
from unittest.mock import patch, call

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.eval_seed.seed_eval_db import chunk_list, seed_table, load_export, with_scraped_at


class TestChunkList:
    def test_splits_into_even_chunks(self):
        assert chunk_list([1, 2, 3, 4], 2) == [[1, 2], [3, 4]]

    def test_last_chunk_is_partial(self):
        assert chunk_list([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]]

    def test_empty_input_returns_empty_list(self):
        assert chunk_list([], 200) == []


class TestSeedTable:
    @patch("scripts.eval_seed.seed_eval_db.supabase_insert")
    def test_inserts_in_chunks(self, mock_insert):
        rows = [{"facility_id": str(i)} for i in range(5)]
        mock_insert.return_value = []

        total = seed_table("facilities_clean", rows, chunk_size=2)

        assert total == 5
        assert mock_insert.call_count == 3
        mock_insert.assert_has_calls([
            call("facilities_clean", rows[0:2]),
            call("facilities_clean", rows[2:4]),
            call("facilities_clean", rows[4:5]),
        ])

    @patch("scripts.eval_seed.seed_eval_db.supabase_insert")
    def test_empty_rows_skips_insert_entirely(self, mock_insert):
        total = seed_table("facilities_clean", [], chunk_size=200)

        assert total == 0
        mock_insert.assert_not_called()

    @patch("scripts.eval_seed.seed_eval_db.supabase_insert")
    def test_failure_on_later_chunk_reports_rows_already_inserted_and_reraises(self, mock_insert, caplog):
        rows = [{"facility_id": str(i)} for i in range(5)]
        mock_insert.side_effect = [None, Exception("PostgREST 400")]

        with caplog.at_level("ERROR"), pytest.raises(Exception, match="PostgREST 400"):
            seed_table("facilities_clean", rows, chunk_size=2)

        failure_records = [r for r in caplog.records if r.message == "seed_chunk_failed"]
        assert len(failure_records) == 1
        assert failure_records[0].rows_inserted_before_failure == 2


class TestWithScrapedAt:
    def test_copies_recorded_at_into_scraped_at(self):
        rows = [{"facility_id": "a", "recorded_at": "2026-07-10T03:08:00+00:00"}]

        result = with_scraped_at(rows)

        assert result == [{
            "facility_id": "a",
            "recorded_at": "2026-07-10T03:08:00+00:00",
            "scraped_at": "2026-07-10T03:08:00+00:00",
        }]

    def test_does_not_mutate_input(self):
        rows = [{"facility_id": "a", "recorded_at": "2026-07-10T03:08:00+00:00"}]

        with_scraped_at(rows)

        assert "scraped_at" not in rows[0]


class TestLoadExport:
    def test_reads_json_file(self, tmp_path):
        path = tmp_path / "facilities.json"
        path.write_text(json.dumps([{"facility_id": "a"}]))

        result = load_export(str(path))

        assert result == [{"facility_id": "a"}]
