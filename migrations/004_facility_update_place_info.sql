alter table facilities
  add column if not exists phone           text,
  add column if not exists business_status text,
  add column if not exists open_now        boolean,
  add column if not exists weekday_hours   text,
  add column if not exists updated_at      timestamptz;