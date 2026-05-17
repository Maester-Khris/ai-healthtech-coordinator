# Database Migrations

Run these files in order in the Supabase SQL Editor
(Dashboard → SQL Editor → New query → paste → Run).

Each file is idempotent — safe to re-run.
Files must be run with sufficient privileges (service role or dashboard).

| File | Description | Status |
|---|---|---|
| 001_profile.sql | Profile table, auth trigger, backfill, RLS | pending |
| 002_sessions.sql | Chat sessions table, indexes, RLS | pending |
| 003_messages.sql | Chat messages table, indexes, RLS | pending |

After running each file, update Status to `applied — YYYY-MM-DD`.
