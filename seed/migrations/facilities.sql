-- =============================================================================
-- MediCoord AI — facilities table
-- Run in: Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid() if not already active
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Main table
-- -----------------------------------------------------------------------------
create table if not exists public.facilities (
  id                   uuid        primary key default gen_random_uuid(),

  -- Core identity
  name                 text        not null,
  category             text        not null,   -- 'hospital' | 'ambulatory' | 'residential'
  source_facility_type text        not null,   -- raw ODHF granular type, lowercased

  -- Triage routing
  accepted_severity    text[]      not null,   -- e.g. '{emergent,urgent,moderate,routine}'

  -- Location
  address              text        not null,
  lat                  float8      not null,
  lng                  float8      not null,

  -- Provenance
  source               text        not null default 'odhf',

  -- Audit
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Constraints
-- -----------------------------------------------------------------------------

-- category must be one of the three canonical values
alter table public.facilities
  add constraint facilities_category_check
  check (category in ('hospital', 'ambulatory', 'residential'));

-- accepted_severity values must be within the four canonical levels
-- (Postgres array-contains check: every element must be valid)
alter table public.facilities
  add constraint facilities_severity_values_check
  check (accepted_severity <@ array['emergent','urgent','moderate','routine']::text[]);

-- accepted_severity must not be empty
alter table public.facilities
  add constraint facilities_severity_nonempty_check
  check (cardinality(accepted_severity) > 0);

-- source is currently always 'odhf'; extendable later
alter table public.facilities
  add constraint facilities_source_check
  check (source in ('odhf', 'manual', 'other'));

-- Unique key used by the seeder upsert: on_conflict="name,lat,lng"
-- Allows the script to be re-run safely without creating duplicates
alter table public.facilities
  add constraint facilities_name_lat_lng_unique
  unique (name, lat, lng);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

-- Geospatial proximity queries (Tool 2: find facilities near user)
create index if not exists facilities_lat_lng_idx
  on public.facilities (lat, lng);

-- Filter by category before routing (e.g. emergent → hospital only)
create index if not exists facilities_category_idx
  on public.facilities (category);

-- Filter by accepted_severity using GIN (array containment queries)
-- e.g. WHERE accepted_severity @> ARRAY['emergent']
create index if not exists facilities_severity_gin_idx
  on public.facilities using gin (accepted_severity);

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger facilities_set_updated_at
  before update on public.facilities
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- NOTE: facilities are public read — no auth required to query them.
-- Write access (insert/update/delete) is restricted to service_role only.
-- The seeder uses SUPABASE_ANON_KEY which has read + upsert via the
-- unique constraint; tighten to service_role key for production seeding.
-- -----------------------------------------------------------------------------
alter table public.facilities enable row level security;

-- Public read: any anonymous user can read facility data
create policy "facilities_public_read"
  on public.facilities
  for select
  using (true);

-- Write restricted to service role (backend API, seeder)
-- Anon key cannot insert/update/delete unless this policy is added.
-- For now, seeder should use SUPABASE_SERVICE_ROLE_KEY, not anon key.
-- Uncomment when ready:
-- create policy "facilities_service_write"
--   on public.facilities
--   for all
--   using (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- Verification query — run after seeding to confirm data loaded correctly
-- -----------------------------------------------------------------------------
-- select
--   category,
--   count(*)                              as total,
--   count(*) filter (where address = '')  as missing_address,
--   min(lat) as lat_min, max(lat) as lat_max,
--   min(lng) as lng_min, max(lng) as lng_max
-- from public.facilities
-- group by category
-- order by category;