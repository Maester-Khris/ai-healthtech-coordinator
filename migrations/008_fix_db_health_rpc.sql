-- Fix ORDER BY alias reference inside jsonb_agg — PostgreSQL cannot resolve
-- column aliases defined in the same SELECT within an aggregate's ORDER BY clause.
-- Solution: build the jsonb object in a subquery, then aggregate with ORDER BY on
-- the extracted value from the resulting jsonb object.

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
    -- 1. Refresh planner stats after bulk UPDATEs
    ANALYZE public.facilities;
    ANALYZE public.facilities_clean;
    ANALYZE public.wait_times;

    -- 2. Dead tuple ratio
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

    -- 3. Long-running queries > 30s
    -- Subquery required: ORDER BY inside jsonb_agg cannot reference aliases from
    -- the same SELECT list — must extract from the already-built jsonb value.
    SELECT jsonb_agg(q ORDER BY (q->>'duration_seconds')::numeric DESC)
    INTO v_long_queries
    FROM (
        SELECT jsonb_build_object(
            'pid',              pid,
            'state',            state,
            'wait_event_type',  wait_event_type,
            'duration_seconds', round(extract(epoch from (now() - query_start))::numeric, 1),
            'query_preview',    left(query, 120)
        ) AS q
        FROM pg_stat_activity
        WHERE state != 'idle'
          AND query_start IS NOT NULL
          AND (now() - query_start) > interval '30 seconds'
          AND pid != pg_backend_pid()
    ) sub;

    -- 4. Deadlock counter
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

GRANT EXECUTE ON FUNCTION public.medi_db_health_check() TO service_role;
