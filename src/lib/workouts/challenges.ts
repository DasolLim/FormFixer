import { getSupabaseClient } from '@/lib/supabaseClient';

export const EXERCISE_LABELS: Record<string, string> = {
  push_up: 'Push-Ups', sit_up: 'Sit-Ups', pull_up: 'Pull-Ups',
  squat: 'Squats', bicep_curl: 'Bicep Curls',
  lateral_raise: 'Lateral Raises', overhead_press: 'Overhead Press',
};

export type WeeklyChallenge = {
  id: string;
  exercise_id: string;
  exercise_label: string;
  target_reps: number;
  week_start: string;
};

export type ChallengeProgress = {
  current_reps: number;
  completed: boolean;
  xp_awarded: number;
};

export async function getOrCreateWeeklyChallenge(): Promise<WeeklyChallenge | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_or_create_weekly_challenge');
  if (error || !data) return null;
  const row = typeof data === 'string' ? JSON.parse(data) : data;
  return { ...row, exercise_label: EXERCISE_LABELS[row.exercise_id] ?? row.exercise_id };
}

export async function fetchChallengeProgress(userId: string, challengeId: string): Promise<ChallengeProgress> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('user_challenge_progress')
    .select('current_reps,completed,xp_awarded')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .maybeSingle();
  return { current_reps: data?.current_reps ?? 0, completed: data?.completed ?? false, xp_awarded: data?.xp_awarded ?? 0 };
}

export async function updateChallengeProgress(
  userId: string,
  challengeId: string,
  addReps: number,
  targetReps: number,
  _sessionXP: number,
): Promise<{ justCompleted: boolean }> {
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('user_challenge_progress')
    .select('current_reps,completed')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .maybeSingle();

  if (existing?.completed) return { justCompleted: false };

  const newReps = (existing?.current_reps ?? 0) + addReps;
  const justCompleted = newReps >= targetReps;

  await supabase.from('user_challenge_progress').upsert({
    user_id: userId,
    challenge_id: challengeId,
    current_reps: newReps,
    completed: justCompleted,
    xp_awarded: 0,
    completed_at: justCompleted ? new Date().toISOString() : null,
  }, { onConflict: 'user_id,challenge_id' });

  return { justCompleted };
}
