import logging
import os
import sys
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import scraper

_RECORD = {
    "facility_id": "f1", "facility_name": "A", "category": "hospital",
    "source_facility_type": "general", "accepted_severity": ["emergent"],
    "address": "123 St", "lat": 1.0, "lng": 2.0, "phone": "555",
    "google_place_id": "p1", "business_status": "OPERATIONAL", "weekday_hours": "[]",
}


def _places_responses(address, lat, lng):
    search_resp = MagicMock(status_code=200)
    search_resp.raise_for_status = lambda: None
    search_resp.json = lambda: {"candidates": [{"place_id": "place-1"}]}

    details_resp = MagicMock(status_code=200)
    details_resp.raise_for_status = lambda: None
    details_resp.json = lambda: {
        "result": {
            "name": "Test Hospital",
            "formatted_address": address,
            "formatted_phone_number": "555-1234",
            "opening_hours": {"weekday_text": []},
            "business_status": "OPERATIONAL",
            "geometry": {"location": {"lat": lat, "lng": lng}},
        }
    }
    return [search_resp, details_resp]


class TestResolveUnmatchedFacility:
    @patch("scraper.requests.get")
    def test_inside_toronto_bounds_returns_facility(self, mock_get):
        mock_get.side_effect = _places_responses("123 Main St, Toronto, ON", lat=43.70, lng=-79.40)

        result = scraper.resolve_unmatched_facility("Test Hospital")

        assert result is not None
        assert result["lat"] == 43.70

    @patch("scraper.requests.get")
    def test_outside_toronto_bounds_returns_none(self, mock_get):
        mock_get.side_effect = _places_responses("123 Bank St, Ottawa, ON", lat=45.42, lng=-75.69)

        result = scraper.resolve_unmatched_facility("Ottawa General")

        assert result is None

    @patch("scraper.requests.get")
    def test_real_toronto_hospital_without_literal_toronto_in_address_matches(self, mock_get):
        # Regression for finding #3: real prod row "the Scarborough Hospital -
        # Grace Campus" has no literal "toronto" substring in its address.
        mock_get.side_effect = _places_responses(
            "3030 birchmount rd. scarborough on m1w 3w3", lat=43.80, lng=-79.31
        )

        result = scraper.resolve_unmatched_facility("the Scarborough Hospital - Grace Campus")

        assert result is not None

    @patch("scraper.requests.get")
    def test_network_error_raises_transient_lookup_error(self, mock_get):
        mock_get.side_effect = scraper.requests.ConnectionError("timeout")

        with pytest.raises(scraper.TransientLookupError):
            scraper.resolve_unmatched_facility("Test Hospital")


class TestFetchExistingPlaceIds:
    @patch("scraper.requests.get")
    def test_returns_place_id_to_facility_id_map(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200)
        mock_get.return_value.raise_for_status = lambda: None
        mock_get.return_value.json = lambda: [
            {"id": "fac-1", "google_place_id": "place-1"},
            {"id": "fac-2", "google_place_id": "place-2"},
        ]

        result = scraper.fetch_existing_place_ids("https://x.supabase.co", {})

        assert result == {"place-1": "fac-1", "place-2": "fac-2"}


class TestBuildFacilityMapIdempotency:
    @patch("scraper.insert_new_facilities", return_value=set())
    @patch("scraper.resolve_unmatched_facility")
    @patch("scraper.fetch_existing_place_ids", return_value={"place-99": "existing-fac-id"})
    @patch("scraper.fuzz_process.extractOne", return_value=None)
    def test_reuses_existing_facility_instead_of_recreating(
        self, mock_extract, mock_fetch_existing, mock_resolve, mock_insert
    ):
        mock_resolve.return_value = {
            "facility_name": "New Name", "category": "hospital",
            "source_facility_type": "general", "accepted_severity": ["emergent"],
            "address": "x", "lat": 1.0, "lng": 1.0, "phone": None,
            "google_place_id": "place-99", "business_status": "OPERATIONAL",
            "weekday_hours": "[]",
        }
        redis_client = MagicMock()
        redis_client.smembers.return_value = set()

        result = scraper.build_facility_map(
            {"clean name": {"official_name": "Clean Name"}}, {}, {},
            "https://x.supabase.co", {}, redis_client,
        )

        assert result["clean name"] == "existing-fac-id"
        mock_insert.assert_called_once_with("https://x.supabase.co", {}, [])
        redis_client.sadd.assert_called_once_with(scraper.NEGATIVE_CACHE_KEY, "Clean Name")


class TestNegativeCache:
    @patch("scraper.insert_new_facilities", return_value=set())
    @patch("scraper.resolve_unmatched_facility")
    @patch("scraper.fetch_existing_place_ids", return_value={})
    @patch("scraper.fuzz_process.extractOne", return_value=None)
    def test_skips_resolve_call_for_previously_unresolved_name(
        self, mock_extract, mock_fetch_existing, mock_resolve, mock_insert
    ):
        redis_client = MagicMock()
        redis_client.smembers.return_value = {"Clean Name"}

        result = scraper.build_facility_map(
            {"clean name": {"official_name": "Clean Name"}}, {}, {},
            "https://x.supabase.co", {}, redis_client,
        )

        mock_resolve.assert_not_called()
        assert "clean name" not in result

    @patch("scraper.insert_new_facilities", return_value=set())
    @patch("scraper.resolve_unmatched_facility", return_value=None)
    @patch("scraper.fetch_existing_place_ids", return_value={})
    @patch("scraper.fuzz_process.extractOne", return_value=None)
    def test_adds_to_negative_cache_on_resolve_failure(
        self, mock_extract, mock_fetch_existing, mock_resolve, mock_insert
    ):
        redis_client = MagicMock()
        redis_client.smembers.return_value = set()

        scraper.build_facility_map(
            {"clean name": {"official_name": "Clean Name"}}, {}, {},
            "https://x.supabase.co", {}, redis_client,
        )

        redis_client.sadd.assert_called_once_with(scraper.NEGATIVE_CACHE_KEY, "Clean Name")

    @patch("scraper.insert_new_facilities", return_value=set())
    @patch("scraper.resolve_unmatched_facility")
    @patch("scraper.fetch_existing_place_ids", return_value={})
    @patch("scraper.fuzz_process.extractOne", return_value=None)
    def test_transient_lookup_error_does_not_add_to_negative_cache(
        self, mock_extract, mock_fetch_existing, mock_resolve, mock_insert
    ):
        mock_resolve.side_effect = scraper.TransientLookupError("Clean Name")
        redis_client = MagicMock()
        redis_client.smembers.return_value = set()

        result = scraper.build_facility_map(
            {"clean name": {"official_name": "Clean Name"}}, {}, {},
            "https://x.supabase.co", {}, redis_client,
        )

        redis_client.sadd.assert_not_called()
        assert "clean name" not in result


class TestInsertNewFacilitiesReturnsSucceededIds:
    @patch("scraper.requests.post")
    def test_returns_facility_ids_on_full_success(self, mock_post):
        ok = MagicMock(status_code=201)
        ok.raise_for_status = lambda: None
        mock_post.side_effect = [ok, ok]

        result = scraper.insert_new_facilities("https://x.supabase.co", {}, [_RECORD])

        assert result == {"f1"}

    @patch("scraper.requests.post")
    def test_returns_empty_set_when_facilities_insert_fails(self, mock_post):
        mock_post.side_effect = scraper.requests.RequestException("boom")

        result = scraper.insert_new_facilities("https://x.supabase.co", {}, [_RECORD])

        assert result == set()

    @patch("scraper.requests.post")
    def test_returns_facility_ids_even_if_clean_insert_fails(self, mock_post):
        ok = MagicMock(status_code=201)
        ok.raise_for_status = lambda: None
        mock_post.side_effect = [ok, scraper.requests.RequestException("clean failed")]

        result = scraper.insert_new_facilities("https://x.supabase.co", {}, [_RECORD])

        assert result == {"f1"}


class TestBuildFacilityMapDropsFailedInserts:
    @patch("scraper.insert_new_facilities")
    @patch("scraper.resolve_unmatched_facility")
    @patch("scraper.fetch_existing_place_ids", return_value={})
    @patch("scraper.fuzz_process.extractOne", return_value=None)
    def test_drops_facility_map_entries_for_facilities_that_failed_to_persist(
        self, mock_extract, mock_fetch_existing, mock_resolve, mock_insert
    ):
        mock_resolve.return_value = {
            "facility_name": "New Hospital", "category": "hospital",
            "source_facility_type": "general", "accepted_severity": ["emergent"],
            "address": "x", "lat": 43.7, "lng": -79.4, "phone": None,
            "google_place_id": "place-1", "business_status": "OPERATIONAL", "weekday_hours": "[]",
        }
        mock_insert.return_value = set()  # facilities insert failed
        redis_client = MagicMock()
        redis_client.smembers.return_value = set()

        result = scraper.build_facility_map(
            {"new hospital": {"official_name": "New Hospital"}}, {}, {},
            "https://x.supabase.co", {}, redis_client,
        )

        assert "new hospital" not in result

    @patch("scraper.insert_new_facilities", return_value=set())
    @patch("scraper.resolve_unmatched_facility", return_value=None)
    @patch("scraper.fetch_existing_place_ids", return_value={})
    def test_matched_count_excludes_within_run_dedup_hits(
        self, mock_fetch_existing, mock_resolve, mock_insert, caplog
    ):
        db_corpus = {"existing hospital": "fac-existing"}
        redis_client = MagicMock()
        redis_client.smembers.return_value = set()

        with patch("scraper.fuzz_process.extractOne", return_value=("existing hospital", 90, 0)), \
             caplog.at_level(logging.INFO, logger="scraper"):
            result = scraper.build_facility_map(
                {"existing hospital": {"official_name": "Existing Hospital"}}, {}, db_corpus,
                "https://x.supabase.co", {}, redis_client,
            )

        assert result == {"existing hospital": "fac-existing"}
        assert "1 matched, 0 newly created, 0 unmatched" in caplog.text


class TestInsertNewFacilitiesPayloadShape:
    @patch("scraper.requests.post")
    def test_facilities_and_clean_rows_share_common_fields(self, mock_post):
        ok = MagicMock(status_code=201)
        ok.raise_for_status = lambda: None
        mock_post.side_effect = [ok, ok]

        scraper.insert_new_facilities("https://x.supabase.co", {}, [_RECORD])

        facilities_payload = mock_post.call_args_list[0].kwargs["json"][0]
        clean_payload = mock_post.call_args_list[1].kwargs["json"][0]

        assert facilities_payload["id"] == "f1"
        assert facilities_payload["name"] == "A"
        assert facilities_payload["lat"] == 1.0
        assert facilities_payload["source"] == "manual"
        assert clean_payload["facility_id"] == "f1"
        assert clean_payload["facility_name"] == "A"
        assert clean_payload["is_operational"] is True
        assert clean_payload["business_status"] == "OPERATIONAL"
