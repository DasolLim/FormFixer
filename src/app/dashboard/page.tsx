import { getSupabaseServer } from '@/lib/supabaseServer';
import { fetchTodayWorkoutEvent } from '@/lib/calendar/server';
import { fetchWorkoutFrequency, type WeeklyFrequency } from '@/lib/workouts/frequency';
import { EXERCISE_LABELS } from '@/lib/workouts/challenges';
import { DashboardClient } from './DashboardClient';
import type { ProgramProgressRow } from '@/lib/programs/sessions';
import { redirect } from 'next/navigation';

export type ServerChallenge = {
  id: string;
  exercise_id: string;
  exercise_label: string;
  target_reps: number;
};

export type ServerChallengeProgress = {
  current_reps: number;
  completed: boolean;
};

export default async function DashboardPage() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let currentStreak = 0;
  let longestStreak = 0;
  let targetSessionsPerWeek = 3;
  let todayEvent = null;
  let frequency: WeeklyFrequency[] = [];
  let todayCalories = 0;
  let activeProgram: ProgramProgressRow | null = null;
  let challenge: ServerChallenge | null = null;
  let challengeProgress: ServerChallengeProgress | null = null;

  const today = new Date().toISOString().slice(0, 10);

  const [profileRes, todayRes, freqRes, caloriesRes, programRes, challengeRaw] = await Promise.all([
      supabase
        .from('profiles')
        .select('current_streak,longest_streak,target_sessions_per_week')
        .eq('id', user.id)
        .maybeSingle(),
      fetchTodayWorkoutEvent(user.id),
      fetchWorkoutFrequency(user.id),
      supabase
        .from('meal_items')
        .select('calories')
        .eq('user_id', user.id)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lte('created_at', `${today}T23:59:59.999Z`),
      supabase
        .from('user_program_progress')
        .select('id,program_id,program_slug,current_week,completed_workouts,total_workouts,completion_percent,created_at,updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      supabase.rpc('get_or_create_weekly_challenge'),
    ]);

    currentStreak = profileRes.data?.current_streak ?? 0;
    longestStreak = profileRes.data?.longest_streak ?? 0;
    targetSessionsPerWeek = profileRes.data?.target_sessions_per_week ?? 3;
    todayEvent = todayRes;
    frequency = freqRes;
    todayCalories = caloriesRes.data?.reduce((sum, i) => sum + i.calories, 0) ?? 0;
    const rawProgress = programRes.data ?? null;
    if (rawProgress) {
      const programId = (rawProgress as typeof rawProgress & { program_id?: string }).program_id;
      if (programId) {
        const { data: programRow } = await supabase.from('programs').select('title').eq('id', programId).maybeSingle();
        activeProgram = { ...rawProgress, programTitle: programRow?.title ?? null } as ProgramProgressRow & { programTitle: string | null };
      } else {
        activeProgram = rawProgress;
      }
    }

    if (challengeRaw.data) {
      const row = typeof challengeRaw.data === 'string' ? JSON.parse(challengeRaw.data) : challengeRaw.data;
      challenge = { id: row.id, exercise_id: row.exercise_id, exercise_label: EXERCISE_LABELS[row.exercise_id] ?? row.exercise_id, target_reps: row.target_reps };

      const progressRes = await supabase
        .from('user_challenge_progress')
        .select('current_reps,completed')
        .eq('user_id', user.id)
        .eq('challenge_id', row.id)
        .maybeSingle();
      challengeProgress = progressRes.data
        ? { current_reps: progressRes.data.current_reps, completed: progressRes.data.completed }
        : { current_reps: 0, completed: false };
    }

  return (
    <DashboardClient
      currentStreak={currentStreak}
      longestStreak={longestStreak}
      todayEvent={todayEvent}
      frequency={frequency}
      targetSessionsPerWeek={targetSessionsPerWeek}
      todayCalories={todayCalories}
      activeProgram={activeProgram}
      challenge={challenge}
      challengeProgress={challengeProgress}
    />
  );
}
