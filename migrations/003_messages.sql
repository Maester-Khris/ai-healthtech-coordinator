-- =============================================================
-- Chat messages table, indexes, RLS
-- =============================================================

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- Indexes
create index if not exists messages_session_created_idx
  on public.messages (session_id, created_at desc);

create index if not exists messages_user_id_idx
  on public.messages (user_id);

-- RLS — service role only
alter table public.messages enable row level security;

-- No client-side policies — all access via backend service role
