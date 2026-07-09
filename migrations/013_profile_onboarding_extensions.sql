-- migrations/013_profile_onboarding_extensions.sql
-- =============================================================
-- Onboarding flow consolidation: push/emergency-alert/medical columns
-- =============================================================

alter table public.profile
  add column if not exists push_enabled boolean not null default false,
  add column if not exists auto_alert_opt_in boolean not null default false,
  add column if not exists allergies text,
  add column if not exists conditions text,
  add column if not exists blood_type text,
  add column if not exists medical_chat_opt_in boolean not null default false;
