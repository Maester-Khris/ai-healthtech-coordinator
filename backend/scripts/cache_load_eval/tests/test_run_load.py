import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.cache_load_eval.run_load import compute_hit_rate_stats

BEFORE_METRICS = """\
wait_times_cache_outcome_total{outcome="redis_hit"} 10.0
wait_times_cache_outcome_total{outcome="supabase_fallback"} 2.0
wait_times_cache_outcome_total{outcome="total_failure"} 0.0
"""

AFTER_METRICS = """\
wait_times_cache_outcome_total{outcome="redis_hit"} 305.0
wait_times_cache_outcome_total{outcome="supabase_fallback"} 3.0
wait_times_cache_outcome_total{outcome="total_failure"} 0.0
"""


class TestComputeHitRateStats:
    def test_computes_deltas_and_hit_rate(self):
        stats = compute_hit_rate_stats(BEFORE_METRICS, AFTER_METRICS)
        assert stats == {
            "redis_hit_delta": 295,
            "supabase_fallback_delta": 1,
            "total_failure_delta": 0,
            "hit_rate": round(295 / 296, 4),
        }

    def test_zero_new_calls_returns_zero_hit_rate_not_a_crash(self):
        stats = compute_hit_rate_stats(BEFORE_METRICS, BEFORE_METRICS)
        assert stats == {
            "redis_hit_delta": 0,
            "supabase_fallback_delta": 0,
            "total_failure_delta": 0,
            "hit_rate": 0.0,
        }
