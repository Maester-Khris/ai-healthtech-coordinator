-- 1. Add the column
ALTER TABLE facilities_clean
ADD COLUMN coordinates geography(POINT, 4326);

-- 2. Populate from existing lat/lng
UPDATE facilities_clean
SET coordinates = ST_SetSRID(
  ST_MakePoint(lng, lat),
  4326
)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- 1b. add indexing on colum
CREATE INDEX idx_facility_coordinates_gist
ON facilities_clean
USING GIST (coordinates);

analyze facilities_clean;

