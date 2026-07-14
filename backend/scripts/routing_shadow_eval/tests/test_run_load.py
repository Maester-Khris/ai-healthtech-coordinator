import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.routing_shadow_eval.run_load import compute_shadow_stats

BEFORE_METRICS = """\
routing_shadow_error_km_sum 12.0
routing_shadow_error_km_count 20.0
"""

AFTER_METRICS = """\
routing_shadow_error_km_sum 32.0
routing_shadow_error_km_count 60.0
"""


class TestComputeShadowStats:
    def test_computes_delta_count_and_mean(self):
        stats = compute_shadow_stats(BEFORE_METRICS, AFTER_METRICS)
        assert stats == {"shadow_samples": 40, "mean_error_km": 0.5}

    def test_zero_new_samples_returns_zero_mean_not_a_crash(self):
        stats = compute_shadow_stats(BEFORE_METRICS, BEFORE_METRICS)
        assert stats == {"shadow_samples": 0, "mean_error_km": 0.0}
