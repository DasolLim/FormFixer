import { getSupabaseClient } from '@/lib/supabaseClient';
import type { ExerciseType, WorkoutSessionRow, SessionScore, RepScore } from '@/lib/workouts/types';
import { checkAndUpdatePRs, type PRCheckResult } from './records';
import { evaluateAchievements, type Achievement } from './achievements';

export type { PRCheckResult } from './records';
export type { Achievement } from './achievements';

export type SetResult = {
  setNumber: number
  repCount: number
  formScore: number
}

export async function saveWorkoutSession(
  userId: string,
  exerciseId: string,
  repCount: number,
  sessionScore: SessionScore,
  options?: {
    programId?: string
    dayIndex?: number
    setResults?: SetResult[]
    loadKg?: number[]
  }
): Promise<{ error: Error | null; prResult: PRCheckResult | null; newAchievements: Achievement[] }> {
  const supabase = getSupabaseClient();
  const { data: session, error } = await supabase.from('workout_sessions').insert({
    user_id: userId,
    exercise_id: exerciseId,
    exercise_type: exerciseId as ExerciseType,
    rep_count: repCount,
    form_score: sessionScore.averageOverall,
    form_summary: `trend:${sessionScore.formTrend}`,
    average_form_score: sessionScore.averageOverall,
    form_trend: sessionScore.formTrend,
    top_issues: sessionScore.topIssues as unknown as import('@/lib/database.types').Json,
    rep_scores: sessionScore.repScores as unknown as import('@/lib/database.types').Json,
    duration_ms: sessionScore.durationMs,
    recorded_at: new Date().toISOString(),
    program_id: options?.programId ?? null,
    set_results: options?.setResults ?? null,
    load_kg: options?.loadKg ?? null,
  }).select().single();

  if (error) return { error: new Error(error.message), prResult: null, newAchievements: [] };

  if (options?.programId && options.dayIndex !== undefined && session) {
    await markProgramWorkoutComplete(userId, options.programId, options.dayIndex);
  }

  const totalVolume = options?.setResults?.reduce((acc, set, i) => {
    return acc + set.repCount * (options.loadKg?.[i] ?? 0)
  }, 0) ?? 0;

  const [prResult, newAchievements] = await Promise.all([
    checkAndUpdatePRs(userId, exerciseId, sessionScore.averageOverall, repCount, totalVolume),
    evaluateAchievements(userId),
  ]);

  return { error: null, prResult, newAchievements };
}

async function markProgramWorkoutComplete(
  userId: string,
  programId: string,
  _dayIndex: number
) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('user_program_progress')
    .select('completed_workouts,total_workouts,current_week')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .maybeSingle();

  if (!data) return;

  const completed = Number(data.completed_workouts) + 1;
  const total = Math.max(1, Number(data.total_workouts ?? 1));
  const percent = Math.min(100, Math.round((completed / total) * 100));
  const week = Math.max(1, Math.ceil(completed / 3));

  await supabase
    .from('user_program_progress')
    .update({ completed_workouts: completed, completion_percent: percent, current_week: week })
    .eq('user_id', userId)
    .eq('program_id', programId);
}

export async function fetchWorkoutSessions(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id,created_at,exercise_type,exercise_id,rep_count,form_score,form_summary,average_form_score,form_trend')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  return { data: (data ?? []) as WorkoutSessionRow[], error };
}

export async function fetchSessionRepScores(sessionId: string): Promise<{ repScores: RepScore[] | null; topIssues: string[] | null }> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('workout_sessions')
    .select('rep_scores,top_issues')
    .eq('id', sessionId)
    .single();
  return {
    repScores: (data?.rep_scores ?? null) as RepScore[] | null,
    topIssues: (data?.top_issues ?? null) as string[] | null,
  };
}

export interface ExerciseFormHistory {
  exerciseId: string;
  sessions: { recordedAt: string; repCount: number; averageFormScore: number; formTrend: string }[];
}

export async function fetchFormScoreHistory(userId: string, exerciseId?: string, limitDays = 30): Promise<ExerciseFormHistory[]> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - limitDays * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('workout_sessions')
    .select('exercise_id,recorded_at,rep_count,average_form_score,form_trend')
    .eq('user_id', userId)
    .not('exercise_id', 'is', null)
    .not('recorded_at', 'is', null)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true });

  if (exerciseId) query = query.eq('exercise_id', exerciseId);

  const { data } = await query;
  if (!data) return [];

  const grouped = new Map<string, ExerciseFormHistory>();
  for (const row of data) {
    if (!row.exercise_id) continue;
    if (!grouped.has(row.exercise_id)) {
      grouped.set(row.exercise_id, { exerciseId: row.exercise_id, sessions: [] });
    }
    grouped.get(row.exercise_id)!.sessions.push({
      recordedAt: row.recorded_at,
      repCount: row.rep_count,
      averageFormScore: row.average_form_score ?? 0,
      formTrend: row.form_trend ?? 'stable',
    });
  }

  return [...grouped.values()];
}

export async function fetchPlanTier(userId: string): Promise<'free' | 'pro'> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('subscriptions').select('plan_tier,status').eq('user_id', userId).maybeSingle();
  if (error || !data) return 'free';
  return data.status === 'active' && data.plan_tier === 'pro' ? 'pro' : 'free';
}

export type { WeeklyFrequency } from './frequency'
