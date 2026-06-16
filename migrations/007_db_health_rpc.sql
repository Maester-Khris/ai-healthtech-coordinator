-- Health-check RPC called by dbt-runner Lambda after dbt test completes.
-- SECURITY DEFINER: function runs as its owner (postgres/superuser), giving it
-- access to pg_stat_activity, pg_stat_user_tables, and permission to ANALYZE.
-- Caller only needs EXECUTE on this function — no direct system catalog access required.

CREATE OR REPLACE FUNCTION public.medi_db_health_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_dead_tuples  jsonb;
    v_long_queries jsonb;
    v_deadlocks    bigint;
BEGIN
    -- 1. Refresh planner stats after bulk UPDATEs (MVCC bloat degrades seq-scan estimates)
    ANALYZE public.facilities;
    ANALYZE public.facilities_clean;
    ANALYZE public.wait_times;

    -- 2. Dead tuple ratio — signals autovacuum is lagging after enrichment batch
    SELECT jsonb_agg(
        jsonb_build_object(
            'table',          relname,
            'live_tuples',    n_live_tup,
            'dead_tuples',    n_dead_tup,
            'dead_ratio_pct', CASE
                                  WHEN (n_live_tup + n_dead_tup) > 0
                                  THEN round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 1)
                                  ELSE 0
                              END
        )
        ORDER BY relname
    )
    INTO v_dead_tuples
    FROM pg_stat_user_tables
    WHERE relname IN ('facilities', 'facilities_clean', 'wait_times');

    -- 3. Long-running queries > 30s — may hold row locks blocking reads
    SELECT jsonb_agg(
        jsonb_build_object(
            'pid',              pid,
            'state',            state,
            'wait_event_type',  wait_event_type,
            'duration_seconds', round(extract(epoch from (now() - query_start))::numeric, 1),
            'query_preview',    left(query, 120)
        )
        ORDER BY duration_seconds DESC
    )
    INTO v_long_queries
    FROM pg_stat_activity
    WHERE state != 'idle'
      AND query_start IS NOT NULL
      AND (now() - query_start) > interval '30 seconds'
      AND pid != pg_backend_pid();  -- exclude this function's own connection

    -- 4. Cumulative deadlock counter since last pg_stat_reset
    SELECT deadlocks
    INTO v_deadlocks
    FROM pg_stat_database
    WHERE datname = current_database();

    RETURN jsonb_build_object(
        'analyzed_at',  now(),
        'dead_tuples',  COALESCE(v_dead_tuples,  '[]'::jsonb),
        'long_queries', COALESCE(v_long_queries, '[]'::jsonb),
        'deadlocks',    jsonb_build_object('count', COALESCE(v_deadlocks, 0))
    );
END;
$$;

-- PostgREST calls RPC with the service_role JWT
GRANT EXECUTE ON FUNCTION public.medi_db_health_check() TO service_role;
