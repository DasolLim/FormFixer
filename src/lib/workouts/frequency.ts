import { getSupabaseServer } from '../supabaseServer'

export type WeeklyFrequency = {
  week: string      // ISO date of the Monday that starts the week
  count: number
  targetMet: boolean
}

export async function fetchWorkoutFrequency(
  userId: string,
  weeks = 8
): Promise<WeeklyFrequency[]> {
  const supabase = getSupabaseServer()

  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)

  const { data: profile } = await supabase
    .from('profiles')
    .select('target_sessions_per_week')
    .eq('id', userId)
    .single()

  const target = profile?.target_sessions_per_week ?? 3

  const { data } = await supabase
    .from('workout_sessions')
    .select('recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at')

  const weekCounts: Record<string, number> = {}

  for (const session of data ?? []) {
    const date = new Date(session.recorded_at ?? Date.now())
    const day = date.getDay()
    const monday = new Date(date)
    monday.setDate(date.getDate() - ((day + 6) % 7))
    const weekKey = monday.toISOString().split('T')[0]
    weekCounts[weekKey] = (weekCounts[weekKey] ?? 0) + 1
  }

  const result: WeeklyFrequency[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i * 7 - ((date.getDay() + 6) % 7))
    const weekKey = date.toISOString().split('T')[0]
    const count = weekCounts[weekKey] ?? 0
    result.push({ week: weekKey, count, targetMet: count >= target })
  }

  return result
}
