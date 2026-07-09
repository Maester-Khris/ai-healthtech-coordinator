# Database Migrations

Run these files in order in the Supabase SQL Editor
(Dashboard → SQL Editor → New query → paste → Run).

Each file is idempotent — safe to re-run.
Files must be run with sufficient privileges (service role or dashboard).

| File | Description | Status |
|---|---|---|
| 001_profile.sql | Profile table, auth trigger, backfill, RLS | applied |
| 002_sessions.sql | Chat sessions table, indexes, RLS | applied |
| 003_messages.sql | Chat messages table, indexes, RLS | applied |
| 004_facility_update_place_info.sql | Phone, business_status, open_now, weekday_hours columns | applied |
| 005_wait_time_table.sql | wait_times append-only table schema | applied |
| 006_add_google_place_id.sql | google_place_id + last_enriched_at columns | applied |
| 007_db_health_rpc.sql | medi_db_health_check Supabase RPC | applied |
| 008_fix_db_health_rpc.sql | ORDER BY alias bugfix on health RPC | applied |
| 009_facilities_add_geolocation.sql | PostGIS geolocation column on facilities | applied |
| 010_nearby_facilities_rpc.sql | nearby_facilities PostGIS RPC (ST_DWithin + ST_Distance) | applied |
| 011_latest_wait_times_rpc.sql | Latest wait_minutes per facility (DISTINCT ON), cache-aside fallback | applied — 2026-06-30 |
| 012_latest_wait_times_rpc_add_fields.sql | Add is_operational, facility_name fields to latest_wait_times RPC | applied |
| 013_profile_onboarding_extensions.sql | push_enabled, auto_alert_opt_in, allergies, conditions, blood_type, medical_chat_opt_in columns on profile | pending |

After running each file, update Status to `applied — YYYY-MM-DD`.
