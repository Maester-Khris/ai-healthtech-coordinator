import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import scraper


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
