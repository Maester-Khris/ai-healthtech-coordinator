# Task: Profile + Onboarding — SQL Migrations + Frontend Shell

**ID:** 007
**Scope:** `frontend`, `migrations`
**Branch:** `feat/profile-chat`
**Tests required:** no

---

## Context

Two new features: a profile onboarding modal shown after first signup,
and the chat UI shell (no backend integration yet — that is task 008).

This task is frontend-only. SQL migrations are written to the `migrations/`
folder for reference and manual execution in Supabase SQL editor.

---

## Branch setup

```bash
git switch preview
git pull origin preview
git checkout -b feat/profile-chat
git push -u origin feat/profile-chat
```

---

## Part 1 — SQL Migrations

Create `migrations/` folder at repo root with the following files.
These are NOT auto-applied — they are run manually in the Supabase SQL editor
in numeric order. Each file is idempotent (safe to re-run).

### `migrations/README.md`

```markdown
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
```

### `migrations/001_profile.sql`

```sql
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
```

### `migrations/002_sessions.sql`

```sql
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
```

### `migrations/003_messages.sql`

```sql
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
```

---

## Part 2 — Frontend: Onboarding Modal + Chat Shell

### Files to create

**`webapp/src/components/onboarding/GettingStartedModal.tsx`**

Centered modal overlay. Shown when `profile.getting_started_done === false`
after login. Dismissed only when user completes and saves.

Requirements:
- Full-screen backdrop (same z-index pattern as LoginModal — `position: fixed`,
  `z-index: 50`, backdrop `rgba(0,0,0,0.4)`)
- Modal card centered, `max-width: 480px`
- Title: "Welcome to MediCoord" with subtitle "Let's set up your profile"
- Progress indicator: two steps shown as numbered circles (1 active, 2 inactive)
  — only step 1 is implemented now, step 2 is placeholder
- Step 1 — Location preference:
  - Heading: "Location access"
  - Description: "MediCoord uses your location to find nearby health facilities."
  - Two option cards (selectable, not radio buttons):
    - "Always allow" — "We'll use your saved location each time"
    - "Ask each time" — "You'll be prompted when you start a session"
  - Default selection: "Ask each time"
- Step 1 — Emergency contact (below location):
  - Heading: "Emergency contact (optional)"
  - Two inputs: Name (`emergency_contact_name`), Phone (`emergency_contact_phone`)
  - Both nullable — user can skip
- "Save and continue" button — calls `onComplete(profileData)` prop, disabled while saving
- No "Skip" option — user must click "Save and continue" (even with defaults)
- No close button — modal cannot be dismissed without completing

Props:
```typescript
interface GettingStartedModalProps {
  onComplete: (data: {
    location_preference: 'always' | 'ask'
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
  }) => Promise<void>
}
```

**`webapp/src/components/chat/ChatPanel.tsx`**

Replace or update the existing static chat panel (right side of the home page).
This task defines the UI shell only — no API calls yet.

New elements to add:

**Header row (top of chat panel):**
- "AI Health Assistant" title + "ONLINE" indicator (existing — keep)
- Add: "New conversation" button — top right of the chat header
  Style: small, ghost button, `+` icon + text
  Behaviour: stub — `onClick` logs "new conversation" to console for now
  Disabled and visually muted when `user` is null

**Past conversations dropdown:**
- Below the chat header, above the empty state / message list
- Shows only when `user` is not null
- Collapsed by default — a single row: "Past conversations ▾"
- On click: expands to show a list of conversation stubs
  (hardcoded placeholder data for now — 3 items with fake titles and dates)
- On conversation item click: logs `session_id` to console (stub)
- When `user` is null: section is hidden entirely

**Input area:**
- Existing textarea and send button — keep
- Send button: disabled and visually muted when `user` is null
- Placeholder text when disabled: "Sign in to start a conversation"
- Placeholder text when enabled: "Describe how you feel…" (existing)

**`webapp/src/hooks/useProfile.ts`**

Hook to fetch and cache the user's profile. Reads directly from Supabase
(profile has client-side RLS — this is the one Supabase direct access allowed).

```typescript
import { useState, useEffect } from "react"
import { supabase } from "../lib/supabaseClient"
import { useAuth } from "../auth/AuthContext"

interface Profile {
  id: string
  user_id: string
  getting_started_done: boolean
  location_preference: 'always' | 'ask'
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
}

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) { setProfile(null); return }
    setLoading(true)
    supabase
      .from('profile')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setProfile(data)
        setLoading(false)
      })
  }, [user?.id])

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return
    const { data } = await supabase
      .from('profile')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single()
    if (data) setProfile(data)
  }

  return { profile, loading, updateProfile }
}
```

### Files to modify

**`webapp/src/App.tsx`**

- Call `useProfile()` at app level (alongside `useFacilities`)
- If `user` is not null and `profile?.getting_started_done === false`:
  render `<GettingStartedModal onComplete={handleOnboardingComplete} />`
- `handleOnboardingComplete`: calls `updateProfile({ ...data, getting_started_done: true })`
- Pass `user` and `profile` as props (or via context) to `ChatPanel`

---

## Part 2 — Commits (max 3)

```bash
# Commit 1 — migrations
git add migrations/
git commit -m "chore(migrations): profile, sessions, messages SQL — table definitions, triggers, RLS"

# Commit 2 — profile hook + onboarding modal
git add webapp/src/hooks/useProfile.ts \
        webapp/src/components/onboarding/GettingStartedModal.tsx
git commit -m "feat(frontend): profile hook and getting started onboarding modal"

# Commit 3 — chat panel shell + App.tsx wiring
git add webapp/src/components/chat/ChatPanel.tsx \
        webapp/src/App.tsx
git commit -m "feat(frontend): chat panel shell — new conversation button, past conversations dropdown, disabled state when unauthed"
```

---

## Verification checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run dev` starts without console errors
- [ ] After login: `useProfile` fetches profile from Supabase (check Network tab)
- [ ] If `getting_started_done = false`: onboarding modal appears centered, blocking
- [ ] Location preference selection works (card highlight toggles)
- [ ] "Save and continue" calls `onComplete` and modal disappears
- [ ] Chat panel shows "New conversation" button when logged in, hidden when not
- [ ] Past conversations dropdown expands/collapses on click
- [ ] Send button disabled when `user` is null
- [ ] Send button enabled when `user` is not null
- [ ] Migrations folder present with README and 3 SQL files

---

## Out of Scope

- Backend API for sessions/messages — task 008
- Actual message sending — task 008
- Real past conversations from API — task 008
- LLM integration — separate sprint