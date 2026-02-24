import { getSupabaseClient } from '@/lib/supabaseClient';

export type WorkoutEventRow = {
  id: string;
  title: string;
  scheduled_date: string;
  is_completed: boolean;
  notes: string | null;
};

export async function fetchWorkoutEvents(userId: string) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('workout_events')
    .select('id,title,scheduled_date,is_completed,notes')
    .eq('user_id', userId)
    .order('scheduled_date', { ascending: true });
  return { data: (data ?? []) as WorkoutEventRow[], error };
}

export async function addWorkoutEvent(payload: { userId: string; title: string; scheduledDate: string; notes?: string }) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('workout_events').insert({
    user_id: payload.userId,
    title: payload.title,
    scheduled_date: payload.scheduledDate,
    notes: payload.notes ?? null,
    is_completed: false
  });
  return { error };
}

export async function toggleWorkoutEventCompletion(eventId: string, nextValue: boolean) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('workout_events').update({ is_completed: nextValue }).eq('id', eventId);
  return { error };
}
