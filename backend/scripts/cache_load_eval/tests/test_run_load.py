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

    def test_all_redis_hits_treats_absent_label_as_zero_not_a_crash(self):
        # A Prometheus Counter only emits a line for a label combination once
        # it has been incremented at least once — supabase_fallback/total_failure
        # are legitimately absent from the text on a backend that has only ever
        # served redis_hit, not an error condition.
        before = 'wait_times_cache_outcome_total{outcome="redis_hit"} 1.0\n'
        after = 'wait_times_cache_outcome_total{outcome="redis_hit"} 21.0\n'

        stats = compute_hit_rate_stats(before, after)

        assert stats == {
            "redis_hit_delta": 20,
            "supabase_fallback_delta": 0,
            "total_failure_delta": 0,
            "hit_rate": 1.0,
        }
