CREATE OR REPLACE FUNCTION nearby_facilities(
  user_lat      double precision,
  user_lng      double precision,
  radius_m      int DEFAULT 5000,
  facility_types text[] DEFAULT NULL,
  candidate_ids  uuid[] DEFAULT NULL,
  result_limit   int DEFAULT 10
)
RETURNS TABLE (
  facility_id    uuid,
  facility_name  text,
  category       text,
  address        text,
  phone          text,
  is_operational boolean,
  distance_m     int,
  eta_walk_min   int,
  eta_transit_min int,
  eta_drive_min  int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    f.facility_id,
    f.facility_name,
    f.category,
    f.address,
    f.phone,
    f.is_operational,
    ST_Distance(
      f.coordinates,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    )::int AS distance_m,
    -- ETA constants: walk 1.4 m/s, transit 6 m/s, drive 11 m/s
    ROUND(ST_Distance(f.coordinates, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) / 1.4 / 60)::int AS eta_walk_min,
    ROUND(ST_Distance(f.coordinates, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) / 6.0 / 60)::int AS eta_transit_min,
    ROUND(ST_Distance(f.coordinates, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) / 11.0 / 60)::int AS eta_drive_min
  FROM facilities_clean f
  WHERE
    f.coordinates IS NOT NULL
    AND f.is_operational = true
    AND ST_DWithin(
      f.coordinates,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      LEAST(radius_m, 50000)   -- hard cap: 50km max
    )
    AND (candidate_ids IS NULL OR f.facility_id = ANY(candidate_ids))
    AND (facility_types IS NULL OR f.category = ANY(facility_types))
  ORDER BY distance_m ASC
  LIMIT LEAST(result_limit, 50);  -- hard cap: 50 results max
$$;