-- ─── Fix: missing RLS DELETE policies + widen notifications type ──────────────

-- 1. workout_events — DELETE was missing; calendar delete silently did nothing
drop policy if exists "workout_events_delete_own" on public.workout_events;
create policy "workout_events_delete_own" on public.workout_events
  for delete using (auth.uid() = user_id);

-- 2. meal_items — DELETE was missing
drop policy if exists "meal_items_delete_own" on public.meal_items;
create policy "meal_items_delete_own" on public.meal_items
  for delete using (auth.uid() = user_id);

-- 3. user_program_progress — DELETE was missing; program cleanup in API was silently failing
drop policy if exists "program_progress_delete_own" on public.user_program_progress;
create policy "program_progress_delete_own" on public.user_program_progress
  for delete using (auth.uid() = user_id);

-- 4. notifications — type CHECK didn't include 'workout_alert'; social alerts were failing
do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class rel on rel.oid = con.conrelid
  join pg_catalog.pg_namespace nsp on nsp.oid = con.connamespace
  where nsp.nspname = 'public'
    and rel.relname = 'notifications'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%gym_invite%';

  if v_conname is not null then
    execute 'alter table public.notifications drop constraint ' || quote_ident(v_conname);
  end if;
end $$;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'friend_request_received',
    'friend_request_accepted',
    'gym_invite',
    'workout_alert'
  ));
