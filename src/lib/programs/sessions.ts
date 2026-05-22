import { getSupabaseClient } from '@/lib/supabaseClient';

export type ProgramProgressRow = {
  id: string;
  program_slug: string;
  current_week: number;
  completed_workouts: number;
  total_workouts: number;
  completion_percent: number;
  created_at: string;
  updated_at: string | null;
  programTitle?: string | null;
};

export async function assignProgram(userId: string, programSlug: string, totalWorkouts: number) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('user_program_progress').upsert(
    {
      user_id: userId,
      program_slug: programSlug,
      current_week: 1,
      completed_workouts: 0,
      total_workouts: totalWorkouts,
      completion_percent: 0
    },
    { onConflict: 'user_id,program_slug' }
  );

  return { error };
}

export async function fetchProgramProgress(userId: string) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('user_program_progress')
    .select('id,program_slug,current_week,completed_workouts,total_workouts,completion_percent,created_at,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false, nullsFirst: false });

  return { data: (data ?? []) as ProgramProgressRow[], error };
}

export async function markProgramWorkoutComplete(progressId: string) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.from('user_program_progress').select('*').eq('id', progressId).single();
  if (error || !data) return { error: error ?? { message: 'Progress not found' } };

  const completed = Number(data.completed_workouts) + 1;
  const total = Math.max(1, Number(data.total_workouts));
  const percent = Math.min(100, Math.round((completed / total) * 100));
  const week = Math.max(1, Math.ceil(completed / 3));

  const { error: updateError } = await supabase
    .from('user_program_progress')
    .update({ completed_workouts: completed, completion_percent: percent, current_week: week, updated_at: new Date().toISOString() })
    .eq('id', progressId);

  return { error: updateError };
}
