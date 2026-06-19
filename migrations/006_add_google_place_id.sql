ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS google_place_id   TEXT,
  ADD COLUMN IF NOT EXISTS last_enriched_at  TIMESTAMPTZ;

-- Speeds up the enricher's "stale or missing" filter query
CREATE INDEX IF NOT EXISTS idx_facilities_google_place_id
  ON facilities (google_place_id)
  WHERE google_place_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_facilities_last_enriched_at
  ON facilities (last_enriched_at);
