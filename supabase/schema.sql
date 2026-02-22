-- Safe, idempotent schema for FormFixer v2
-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- Workout sessions
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_type text not null check (exercise_type in ('squat', 'pushup', 'lunge')),
  rep_count int not null default 0,
  form_score int not null default 0,
  form_summary text not null default '',
  created_at timestamptz not null default now()
);

-- Subscription / plan status (manual/admin controlled for now)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'pro')),
  status text not null default 'inactive' check (status in ('inactive', 'active')),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.subscriptions enable row level security;

-- Re-runnable policy setup
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

DROP POLICY IF EXISTS "sessions_select_own" ON public.workout_sessions;
DROP POLICY IF EXISTS "sessions_insert_own" ON public.workout_sessions;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "sessions_select_own" on public.workout_sessions
for select using (auth.uid() = user_id);

create policy "sessions_insert_own" on public.workout_sessions
for insert with check (auth.uid() = user_id);

create policy "subscriptions_select_own" on public.subscriptions
for select using (auth.uid() = user_id);

-- Trigger to create defaults for each new auth user
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

  insert into public.subscriptions (user_id, plan_tier, status)
  values (new.id, 'free', 'inactive')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
