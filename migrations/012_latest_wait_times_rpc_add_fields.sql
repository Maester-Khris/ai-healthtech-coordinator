-- Extends latest_wait_times() to also return raw_wait/source so the
-- backend's cache-aside fallback can write back the same Redis hash
-- shape workers/scraper.py writes (previously only wait_minutes), per
-- 2026-06-30 review finding #6.
CREATE OR REPLACE FUNCTION latest_wait_times()
RETURNS TABLE (
  facility_id  uuid,
  wait_minutes integer,
  raw_wait     text,
  source       text,
  recorded_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (facility_id)
    facility_id,
    wait_minutes,
    raw_wait,
    source,
    recorded_at
  FROM wait_times
  ORDER BY facility_id, recorded_at DESC;
$$;
