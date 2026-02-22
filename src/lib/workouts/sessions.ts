import { getSupabaseClient } from '@/lib/supabaseClient';
import type { ExerciseType, WorkoutSessionRow } from '@/lib/workouts/types';

export async function saveWorkoutSession(payload: {
  userId: string;
  exerciseType: ExerciseType;
  repCount: number;
  formScore: number;
  formSummary: string;
}) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('workout_sessions').insert({
    user_id: payload.userId,
    exercise_type: payload.exerciseType,
    rep_count: payload.repCount,
    form_score: payload.formScore,
    form_summary: payload.formSummary
  });

  return { error };
}

export async function fetchWorkoutSessions(userId: string) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id,created_at,exercise_type,rep_count,form_score,form_summary')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  return { data: (data ?? []) as WorkoutSessionRow[], error };
}

export async function fetchPlanTier(userId: string): Promise<'free' | 'pro'> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.from('subscriptions').select('plan_tier,status').eq('user_id', userId).maybeSingle();
  if (error || !data) return 'free';
  return data.status === 'active' && data.plan_tier === 'pro' ? 'pro' : 'free';
}
