import { getSupabaseServer } from '@/lib/supabaseServer';
import { fetchTodayWorkoutEvent } from '@/lib/calendar/server';
import { fetchWorkoutFrequency, type WeeklyFrequency } from '@/lib/workouts/frequency';
import { fetchMuscleGroupVolume, normalizeMuscleIntensity } from '@/lib/workouts/muscle-volume';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  let currentStreak = 0;
  let longestStreak = 0;
  let targetSessionsPerWeek = 3;
  let todayEvent = null;
  let frequency: WeeklyFrequency[] = [];
  let muscleIntensities: Record<string, number> = {};

  if (user) {
    const [profileRes, todayRes, freqRes, volumeRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('current_streak,longest_streak,target_sessions_per_week')
        .eq('id', user.id)
        .maybeSingle(),
      fetchTodayWorkoutEvent(user.id),
      fetchWorkoutFrequency(user.id),
      fetchMuscleGroupVolume(user.id),
    ]);
    currentStreak = profileRes.data?.current_streak ?? 0;
    longestStreak = profileRes.data?.longest_streak ?? 0;
    targetSessionsPerWeek = profileRes.data?.target_sessions_per_week ?? 3;
    todayEvent = todayRes;
    frequency = freqRes;
    muscleIntensities = normalizeMuscleIntensity(volumeRes);
  }

  return (
    <DashboardClient
      currentStreak={currentStreak}
      longestStreak={longestStreak}
      todayEvent={todayEvent}
      frequency={frequency}
      muscleIntensities={muscleIntensities}
      targetSessionsPerWeek={targetSessionsPerWeek}
    />
  );
}
