import { getSupabaseServer } from '@/lib/supabaseServer';
import type { WorkoutEventRow } from '@/lib/calendar/sessions';

export async function fetchTodayWorkoutEvent(userId: string): Promise<WorkoutEventRow | null> {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from('workout_events')
    .select('id,title,scheduled_date,is_completed,notes')
    .eq('user_id', userId)
    .eq('scheduled_date', today)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
