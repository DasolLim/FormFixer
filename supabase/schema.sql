-- Safe, idempotent schema for FormFixer v4 (social foundation)
-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  privacy_mode text not null default 'public' check (privacy_mode in ('public', 'private')),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists privacy_mode text not null default 'public';
alter table public.profiles drop constraint if exists profiles_privacy_mode_check;
alter table public.profiles add constraint profiles_privacy_mode_check check (privacy_mode in ('public', 'private'));
create unique index if not exists profiles_username_unique_idx on public.profiles (lower(username)) where username is not null;

-- Workout sessions (from form fixer)
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_type text not null check (exercise_type in ('squat', 'pushup', 'lunge')),
  rep_count int not null default 0,
  form_score int not null default 0,
  form_summary text not null default '',
  created_at timestamptz not null default now()
);

-- Program progress tracking
create table if not exists public.user_program_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_slug text not null,
  current_week int not null default 1,
  completed_workouts int not null default 0,
  total_workouts int not null default 1,
  completion_percent int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, program_slug)
);

-- Nutrition logs
create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text not null,
  serving_amount numeric not null default 100,
  serving_unit text not null default 'g',
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fats_g numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Calendar events
create table if not exists public.workout_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  scheduled_date date not null,
  is_completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- Social: friend requests
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create unique index if not exists friend_requests_unique_pair_idx on public.friend_requests (requester_id, receiver_id);

-- Social: friendships (store directed edges for easy querying)
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_id <> friend_id),
  unique (user_id, friend_id)
);

-- Social: notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('friend_request_received', 'friend_request_accepted', 'gym_invite')),
  message text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.user_program_progress enable row level security;
alter table public.meal_items enable row level security;
alter table public.workout_events enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.notifications enable row level security;

-- Re-runnable policy setup
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

DROP POLICY IF EXISTS "sessions_select_own" ON public.workout_sessions;
DROP POLICY IF EXISTS "sessions_insert_own" ON public.workout_sessions;

DROP POLICY IF EXISTS "program_progress_select_own" ON public.user_program_progress;
DROP POLICY IF EXISTS "program_progress_insert_own" ON public.user_program_progress;
DROP POLICY IF EXISTS "program_progress_update_own" ON public.user_program_progress;

DROP POLICY IF EXISTS "meal_items_select_own" ON public.meal_items;
DROP POLICY IF EXISTS "meal_items_insert_own" ON public.meal_items;

DROP POLICY IF EXISTS "workout_events_select_own" ON public.workout_events;
DROP POLICY IF EXISTS "workout_events_insert_own" ON public.workout_events;
DROP POLICY IF EXISTS "workout_events_update_own" ON public.workout_events;

DROP POLICY IF EXISTS "friend_requests_select_involved" ON public.friend_requests;
DROP POLICY IF EXISTS "friend_requests_insert_requester" ON public.friend_requests;
DROP POLICY IF EXISTS "friend_requests_update_involved" ON public.friend_requests;

DROP POLICY IF EXISTS "friendships_select_own" ON public.friendships;
DROP POLICY IF EXISTS "friendships_insert_own" ON public.friendships;
DROP POLICY IF EXISTS "friendships_delete_own" ON public.friendships;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_actor" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

create policy "profiles_select_authenticated" on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "sessions_select_own" on public.workout_sessions for select using (auth.uid() = user_id);
create policy "sessions_insert_own" on public.workout_sessions for insert with check (auth.uid() = user_id);

create policy "program_progress_select_own" on public.user_program_progress for select using (auth.uid() = user_id);
create policy "program_progress_insert_own" on public.user_program_progress for insert with check (auth.uid() = user_id);
create policy "program_progress_update_own" on public.user_program_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "meal_items_select_own" on public.meal_items for select using (auth.uid() = user_id);
create policy "meal_items_insert_own" on public.meal_items for insert with check (auth.uid() = user_id);

create policy "workout_events_select_own" on public.workout_events for select using (auth.uid() = user_id);
create policy "workout_events_insert_own" on public.workout_events for insert with check (auth.uid() = user_id);
create policy "workout_events_update_own" on public.workout_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "friend_requests_select_involved" on public.friend_requests
for select using (auth.uid() = requester_id or auth.uid() = receiver_id);

create policy "friend_requests_insert_requester" on public.friend_requests
for insert with check (auth.uid() = requester_id and requester_id <> receiver_id);

create policy "friend_requests_update_involved" on public.friend_requests
for update using (auth.uid() = requester_id or auth.uid() = receiver_id)
with check (auth.uid() = requester_id or auth.uid() = receiver_id);

create policy "friendships_select_own" on public.friendships for select using (auth.uid() = user_id);
create policy "friendships_insert_own" on public.friendships for insert with check (auth.uid() = user_id and user_id <> friend_id);
create policy "friendships_delete_own" on public.friendships for delete using (auth.uid() = user_id);

create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_insert_actor" on public.notifications for insert with check (auth.uid() = actor_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger to create default profile row for new users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
