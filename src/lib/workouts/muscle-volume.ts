import { getSupabaseServer } from '../supabaseServer'
import exercisesData from '@/features/form-engine/exercises.json'

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'hip_flexors'

type ExercisesConfig = { exercises: Record<string, { primary_muscles?: string[] }> }

const EXERCISE_MUSCLES: Record<string, string[]> = Object.fromEntries(
  Object.entries((exercisesData as ExercisesConfig).exercises).map(([id, cfg]) => [
    id,
    cfg.primary_muscles ?? [],
  ])
)

export async function fetchMuscleGroupVolume(
  userId: string,
  days = 7
): Promise<Record<string, number>> {
  const supabase = getSupabaseServer()
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data } = await supabase
    .from('workout_sessions')
    .select('exercise_id, rep_count')
    .eq('user_id', userId)
    .gte('recorded_at', since.toISOString())

  const totals: Record<string, number> = {}

  for (const session of data ?? []) {
    const muscles = EXERCISE_MUSCLES[session.exercise_id ?? ''] ?? []
    for (const muscle of muscles) {
      totals[muscle] = (totals[muscle] ?? 0) + (session.rep_count ?? 0)
    }
  }

  return totals
}

export function normalizeMuscleIntensity(
  volumes: Record<string, number>
): Record<string, number> {
  const values = Object.values(volumes)
  if (values.length === 0) return {}
  const max = Math.max(...values)
  if (max === 0) return {}
  return Object.fromEntries(Object.entries(volumes).map(([k, v]) => [k, v / max]))
}
