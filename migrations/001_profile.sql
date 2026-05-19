-- =============================================================
-- Profile table, auth trigger, backfill existing users, RLS
-- =============================================================

-- 1. Table
create table if not exists public.profile (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id)
                          on delete cascade,
  getting_started_done    boolean not null default false,
  location_preference     text not null default 'ask'
                          check (location_preference in ('always', 'ask')),
  emergency_contact_name  text,
  emergency_contact_phone text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id)
);

-- 2. updated_at trigger
create or replace function public.set_profile_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profile_set_updated_at
  before update on public.profile
  for each row execute function public.set_profile_updated_at();

-- 3. Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profile (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Backfill existing users
insert into public.profile (user_id)
select id from auth.users
where id not in (select user_id from public.profile);

-- 5. Row Level Security
alter table public.profile enable row level security;

-- Users can read their own profile only
create policy "profile_select_own"
  on public.profile for select
  using (auth.uid() = user_id);

-- Users can update their own profile only
create policy "profile_update_own"
  on public.profile for update
  using (auth.uid() = user_id);

-- Insert handled by trigger (service role) — no client insert policy
