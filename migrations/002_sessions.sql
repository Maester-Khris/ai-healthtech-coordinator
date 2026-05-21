-- =============================================================
-- Chat sessions table, indexes, RLS
-- =============================================================

create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'New conversation',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_session_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger session_set_updated_at
  before update on public.sessions
  for each row execute function public.set_session_updated_at();

-- Indexes
create index if not exists sessions_user_id_idx
  on public.sessions (user_id, updated_at desc);

-- RLS — service role only (backend uses service key, no client access)
alter table public.sessions enable row level security;

-- No client-side policies — all access via backend service role
