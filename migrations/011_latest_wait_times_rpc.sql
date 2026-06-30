CREATE OR REPLACE FUNCTION latest_wait_times()
RETURNS TABLE (
  facility_id  uuid,
  wait_minutes integer,
  recorded_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (facility_id)
    facility_id,
    wait_minutes,
    recorded_at
  FROM wait_times
  ORDER BY facility_id, recorded_at DESC;
$$;
