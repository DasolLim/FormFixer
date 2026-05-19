-- FormFixer — complete idempotent schema (Phases 0-4)
-- Safe to re-run on an existing or fresh Supabase project.
-- The DROP POLICY IF EXISTS lines are safe rewrites, not data loss.

create extension if not exists pgcrypto;

-- ─── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  username     text,
  privacy_mode text not null default 'public',
  created_at   timestamptz not null default now()
);

alter table public.profiles add column if not exists username     text;
alter table public.profiles add column if not exists is_private   boolean not null default false;
alter table public.profiles add column if not exists privacy_mode text not null default 'public';
alter table public.profiles drop constraint if exists profiles_privacy_mode_check;
alter table public.profiles add constraint profiles_privacy_mode_check
  check (privacy_mode in ('public', 'private'));
create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username)) where username is not null;

-- ─── Workout sessions ─────────────────────────────────────────────────────────
create table if not exists public.workout_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  exercise_type       text not null default 'squat',
  exercise_id         text,
  rep_count           int not null default 0,
  form_score          int not null default 0,
  form_summary        text not null default '',
  average_form_score  int,
  form_trend          text check (form_trend in ('improving', 'declining', 'stable')),
  top_issues          jsonb,
  rep_scores          jsonb,
  duration_ms         int,
  recorded_at         timestamptz,
  created_at          timestamptz not null default now()
);

-- Add Phase 4 columns to existing tables (no-op if already present)
alter table public.workout_sessions add column if not exists exercise_id        text;
alter table public.workout_sessions add column if not exists average_form_score int;
alter table public.workout_sessions add column if not exists form_trend         text;
alter table public.workout_sessions add column if not exists top_issues         jsonb;
alter table public.workout_sessions add column if not exists rep_scores         jsonb;
alter table public.workout_sessions add column if not exists duration_ms        int;
alter table public.workout_sessions add column if not exists recorded_at        timestamptz;
-- Remove old restrictive exercise_type constraint (exercise_id is now canonical)
alter table public.workout_sessions drop constraint if exists workout_sessions_exercise_type_check;

-- ─── Phase 1: Programs table ──────────────────────────────────────────────────
create table if not exists public.programs (
  id                 uuid        primary key default gen_random_uuid(),
  slug               text        unique not null,
  title              text        not null,
  description        text,
  difficulty         text        not null check (difficulty in ('beginner','intermediate','advanced')),
  weeks              int         not null check (weeks > 0),
  author_id          uuid        references auth.users(id) on delete set null,
  is_public          boolean     default true,
  is_ai_generated    boolean     default false,
  required_equipment jsonb       default '["bodyweight"]',
  workout_days       jsonb       not null,
  created_at         timestamptz default now()
);

-- Phase 1: new columns on existing tables (all additive / nullable)
alter table public.profiles
  add column if not exists onboarding_complete       boolean     default false,
  add column if not exists movement_baseline         jsonb       default null,
  add column if not exists equipment_profile         jsonb       default '[]',
  add column if not exists current_streak            int         default 0,
  add column if not exists longest_streak            int         default 0,
  add column if not exists current_weekly_streak     int         default 0,
  add column if not exists last_session_date         date        default null,
  add column if not exists nutrition_goals           jsonb       default null,
  add column if not exists target_sessions_per_week  int         default 3,
  add column if not exists default_rest_seconds      int         default 60,
  add column if not exists weight_unit               text        default 'kg',
  add column if not exists target_weight_kg          numeric     default null,
  add column if not exists theme_preference          text        default 'light',
  add column if not exists unavailable_days          jsonb       default '[]',
  add column if not exists best_form_score           int         default 0,
  add column if not exists email_digest              boolean     default false;

alter table public.workout_sessions
  add column if not exists program_id  uuid  references public.programs(id) on delete set null,
  add column if not exists set_results jsonb default null,
  add column if not exists load_kg     jsonb default null;

alter table public.workout_events
  add column if not exists program_day_id uuid default null,
  add column if not exists exercise_id    text default null;

alter table public.notifications
  add column if not exists invite_date        timestamptz default null,
  add column if not exists invite_exercise_id text        default null,
  add column if not exists invite_status      text        default null;

alter table public.user_program_progress
  add column if not exists program_id uuid references public.programs(id) on delete set null;

create unique index if not exists uq_user_program_progress_program_id
  on public.user_program_progress(user_id, program_id)
  where program_id is not null;

-- ─── Subscriptions ────────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  plan_tier  text not null default 'free' check (plan_tier in ('free', 'pro')),
  status     text not null default 'inactive' check (status in ('active', 'inactive', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- ─── Program progress ─────────────────────────────────────────────────────────
create table if not exists public.user_program_progress (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  program_slug        text not null,
  current_week        int not null default 1,
  completed_workouts  int not null default 0,
  total_workouts      int not null default 1,
  completion_percent  int not null default 0,
  created_at          timestamptz not null default now(),
  unique (user_id, program_slug)
);

-- ─── Nutrition logs ───────────────────────────────────────────────────────────
create table if not exists public.meal_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  meal_type      text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name      text not null,
  serving_amount numeric not null default 100,
  serving_unit   text not null default 'g',
  calories       numeric not null default 0,
  protein_g      numeric not null default 0,
  carbs_g        numeric not null default 0,
  fats_g         numeric not null default 0,
  created_at     timestamptz not null default now()
);

-- ─── Calendar events ──────────────────────────────────────────────────────────
create table if not exists public.workout_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  scheduled_date date not null,
  is_completed   boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now()
);

-- ─── Social: friend requests ──────────────────────────────────────────────────
create table if not exists public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  receiver_id  uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);
create unique index if not exists friend_requests_unique_pair_idx
  on public.friend_requests (requester_id, receiver_id);

-- ─── Social: friendships ──────────────────────────────────────────────────────
create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  friend_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_id <> friend_id),
  unique (user_id, friend_id)
);

-- ─── Social: follows ──────────────────────────────────────────────────────────
create table if not exists public.follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  check (follower_id <> following_id),
  unique (follower_id, following_id)
);

-- ─── Social: follow requests ──────────────────────────────────────────────────
create table if not exists public.follow_requests (
  id             uuid primary key default gen_random_uuid(),
  requester_id   uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  status         text not null default 'pending'
                 check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (requester_id <> target_user_id),
  unique (requester_id, target_user_id)
);

-- ─── Social: notifications ────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  actor_id   uuid references auth.users(id) on delete set null,
  type       text not null
             check (type in ('friend_request_received', 'friend_request_accepted', 'gym_invite')),
  message    text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

-- ─── Row-level security ───────────────────────────────────────────────────────
alter table public.profiles              enable row level security;
alter table public.workout_sessions      enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.user_program_progress enable row level security;
alter table public.meal_items            enable row level security;
alter table public.workout_events        enable row level security;
alter table public.friend_requests       enable row level security;
alter table public.friendships           enable row level security;
alter table public.follows               enable row level security;
alter table public.follow_requests       enable row level security;
alter table public.notifications         enable row level security;

-- ─── Policies (drop-then-create for idempotency) ─────────────────────────────
drop policy if exists "profiles_select_own"           on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_insert_own"           on public.profiles;
drop policy if exists "profiles_update_own"           on public.profiles;

drop policy if exists "sessions_select_own" on public.workout_sessions;
drop policy if exists "sessions_insert_own" on public.workout_sessions;

drop policy if exists "subscriptions_select_own" on public.subscriptions;

drop policy if exists "program_progress_select_own" on public.user_program_progress;
drop policy if exists "program_progress_insert_own" on public.user_program_progress;
drop policy if exists "program_progress_update_own" on public.user_program_progress;

drop policy if exists "meal_items_select_own" on public.meal_items;
drop policy if exists "meal_items_insert_own" on public.meal_items;

drop policy if exists "workout_events_select_own" on public.workout_events;
drop policy if exists "workout_events_insert_own" on public.workout_events;
drop policy if exists "workout_events_update_own" on public.workout_events;

drop policy if exists "friend_requests_select_involved"  on public.friend_requests;
drop policy if exists "friend_requests_insert_requester" on public.friend_requests;
drop policy if exists "friend_requests_update_involved"  on public.friend_requests;

drop policy if exists "friendships_select_own" on public.friendships;
drop policy if exists "friendships_insert_own" on public.friendships;
drop policy if exists "friendships_delete_own" on public.friendships;

drop policy if exists "follows_select_own_or_target" on public.follows;
drop policy if exists "follows_insert_own"           on public.follows;
drop policy if exists "follows_delete_own"           on public.follows;

drop policy if exists "follow_requests_select_involved"              on public.follow_requests;
drop policy if exists "follow_requests_insert_requester"             on public.follow_requests;
drop policy if exists "follow_requests_update_target_or_requester"   on public.follow_requests;

drop policy if exists "notifications_select_own"  on public.notifications;
drop policy if exists "notifications_insert_actor" on public.notifications;
drop policy if exists "notifications_update_own"  on public.notifications;

-- Profiles
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Workout sessions
create policy "sessions_select_own" on public.workout_sessions
  for select using (auth.uid() = user_id);
create policy "sessions_insert_own" on public.workout_sessions
  for insert with check (auth.uid() = user_id);

-- Subscriptions
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Program progress
create policy "program_progress_select_own" on public.user_program_progress
  for select using (auth.uid() = user_id);
create policy "program_progress_insert_own" on public.user_program_progress
  for insert with check (auth.uid() = user_id);
create policy "program_progress_update_own" on public.user_program_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Meal items
create policy "meal_items_select_own" on public.meal_items
  for select using (auth.uid() = user_id);
create policy "meal_items_insert_own" on public.meal_items
  for insert with check (auth.uid() = user_id);

-- Workout events
create policy "workout_events_select_own" on public.workout_events
  for select using (auth.uid() = user_id);
create policy "workout_events_insert_own" on public.workout_events
  for insert with check (auth.uid() = user_id);
create policy "workout_events_update_own" on public.workout_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Friend requests
create policy "friend_requests_select_involved" on public.friend_requests
  for select using (auth.uid() = requester_id or auth.uid() = receiver_id);
create policy "friend_requests_insert_requester" on public.friend_requests
  for insert with check (auth.uid() = requester_id and requester_id <> receiver_id);
create policy "friend_requests_update_involved" on public.friend_requests
  for update using  (auth.uid() = requester_id or auth.uid() = receiver_id)
  with check        (auth.uid() = requester_id or auth.uid() = receiver_id);

-- Friendships
create policy "friendships_select_own" on public.friendships
  for select using (auth.uid() = user_id);
create policy "friendships_insert_own" on public.friendships
  for insert with check (
    user_id <> friend_id
    and (
      auth.uid() = user_id
      or (
        auth.uid() = friend_id
        and exists (
          select 1 from public.friend_requests fr
          where fr.requester_id = public.friendships.user_id
            and fr.receiver_id  = auth.uid()
            and fr.status       = 'accepted'
        )
      )
    )
  );
create policy "friendships_delete_own" on public.friendships
  for delete using (auth.uid() = user_id);

-- Follows
create policy "follows_select_own_or_target" on public.follows
  for select using (auth.uid() = follower_id or auth.uid() = following_id);
create policy "follows_insert_own" on public.follows
  for insert with check (auth.uid() = follower_id and follower_id <> following_id);
create policy "follows_delete_own" on public.follows
  for delete using (auth.uid() = follower_id);

-- Follow requests
create policy "follow_requests_select_involved" on public.follow_requests
  for select using (auth.uid() = requester_id or auth.uid() = target_user_id);
create policy "follow_requests_insert_requester" on public.follow_requests
  for insert with check (auth.uid() = requester_id and requester_id <> target_user_id);
create policy "follow_requests_update_target_or_requester" on public.follow_requests
  for update using  (auth.uid() = requester_id or auth.uid() = target_user_id)
  with check        (auth.uid() = requester_id or auth.uid() = target_user_id);

-- Notifications
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications_insert_actor" on public.notifications
  for insert with check (auth.uid() = actor_id);
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Auto-create profile on signup ───────────────────────────────────────────
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

-- ─── Phase 1: Programs RLS ─────────────────────────────────────────────────
alter table public.programs enable row level security;

drop policy if exists "programs_public_read" on public.programs;
create policy "programs_public_read" on public.programs
  for select using (is_public = true or author_id = auth.uid());

drop policy if exists "programs_author_all" on public.programs;
create policy "programs_author_all" on public.programs
  for all using (author_id = auth.uid());

-- ─── Phase 1: Streak trigger ──────────────────────────────────────────────
create or replace function public.update_streak_on_session()
returns trigger language plpgsql as $$
begin
  update public.profiles set
    current_streak = case
      when last_session_date = current_date - interval '1 day' then current_streak + 1
      when last_session_date = current_date                     then current_streak
      else 1
    end,
    longest_streak = greatest(
      longest_streak,
      case
        when last_session_date = current_date - interval '1 day' then current_streak + 1
        else 1
      end
    ),
    last_session_date = current_date
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists on_session_insert_update_streak on public.workout_sessions;
create trigger on_session_insert_update_streak
  after insert on public.workout_sessions
  for each row execute function public.update_streak_on_session();

-- ─── Phase 1: Best form score trigger ────────────────────────────────────
create or replace function public.update_best_form_score()
returns trigger language plpgsql as $$
begin
  update public.profiles
  set best_form_score = greatest(best_form_score, new.form_score)
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists on_session_insert_update_best_score on public.workout_sessions;
create trigger on_session_insert_update_best_score
  after insert on public.workout_sessions
  for each row execute function public.update_best_form_score();

-- ─── Phase 1: Indexes ────────────────────────────────────────────────────
create index if not exists idx_workout_sessions_user_recorded
  on public.workout_sessions(user_id, recorded_at desc);

create index if not exists idx_workout_sessions_program
  on public.workout_sessions(program_id) where program_id is not null;

create index if not exists idx_workout_events_user_date
  on public.workout_events(user_id, scheduled_date desc);

create index if not exists idx_programs_public
  on public.programs(created_at desc) where is_public = true;
