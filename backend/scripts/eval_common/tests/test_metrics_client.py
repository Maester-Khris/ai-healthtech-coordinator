import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

import pytest

from scripts.eval_common.metrics_client import parse_metric_value

METRICS_TEXT = """\
# HELP routing_shadow_error_km Absolute error between Haversine estimate and Geoapify real driving distance (km)
# TYPE routing_shadow_error_km summary
routing_shadow_error_km_sum 12.34
routing_shadow_error_km_count 22.0
# HELP wait_times_cache_outcome_total Outcome of each wait-time cache read, by branch
# TYPE wait_times_cache_outcome_total counter
wait_times_cache_outcome_total{outcome="redis_hit"} 154.0
wait_times_cache_outcome_total{outcome="supabase_fallback"} 3.0
"""


class TestParseMetricValue:
    def test_parses_unlabeled_metric(self):
        assert parse_metric_value(METRICS_TEXT, "routing_shadow_error_km_sum") == 12.34

    def test_parses_labeled_metric(self):
        value = parse_metric_value(
            METRICS_TEXT, "wait_times_cache_outcome_total", {"outcome": "redis_hit"}
        )
        assert value == 154.0

    def test_raises_when_metric_missing(self):
        with pytest.raises(ValueError):
            parse_metric_value(METRICS_TEXT, "nonexistent_metric")
