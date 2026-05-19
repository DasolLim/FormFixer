import { getSupabaseClient } from '../supabaseClient'

export type Achievement = {
  id: string
  key: string
  name: string
  description: string
  icon_name: string
}

export type UserAchievement = Achievement & {
  earned_at: string
}

export async function evaluateAchievements(userId: string): Promise<Achievement[]> {
  const supabase = getSupabaseClient()

  const { data: existing } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId)

  const earnedIds = new Set((existing ?? []).map((r) => r.achievement_id))

  const { data: all } = await supabase.from('achievements').select('*')
  const unevaluated = (all ?? []).filter((a) => !earnedIds.has(a.id))
  if (unevaluated.length === 0) return []

  const [sessionsRes, profileRes, programsRes, nutritionRes] = await Promise.all([
    supabase
      .from('workout_sessions')
      .select('exercise_id, form_score, rep_scores, recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(100),
    supabase
      .from('profiles')
      .select('current_streak')
      .eq('id', userId)
      .single(),
    supabase
      .from('user_program_progress')
      .select('completion_percent')
      .eq('user_id', userId)
      .gte('completion_percent', 100)
      .limit(1),
    supabase
      .from('meal_items')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const sessions = sessionsRes.data ?? []
  const streak = profileRes.data?.current_streak ?? 0
  const completedPrograms = programsRes.data?.length ?? 0
  const nutritionDays = new Set(
    (nutritionRes.data ?? []).map((m) => m.created_at.split('T')[0])
  ).size

  const newlyEarned: Achievement[] = []

  for (const achievement of unevaluated) {
    const criteria = achievement.criteria as Record<string, unknown>
    let earned = false

    switch (criteria.type) {
      case 'session_count':
        earned = sessions.length >= (criteria.threshold as number)
        break

      case 'program_complete':
        earned = completedPrograms > 0
        break

      case 'avg_form_score': {
        const byExercise: Record<string, number[]> = {}
        for (const s of sessions) {
          const eid = s.exercise_id ?? 'unknown'
          if (!byExercise[eid]) byExercise[eid] = []
          byExercise[eid].push(s.form_score)
        }
        const minSessions = criteria.min_sessions as number
        const threshold = criteria.threshold as number
        earned = Object.values(byExercise).some(
          (scores) =>
            scores.length >= minSessions &&
            scores.slice(0, minSessions).reduce((a, b) => a + b, 0) / minSessions >= threshold
        )
        break
      }

      case 'perfect_rep_score':
        earned = sessions.some((s) => {
          const repScores = s.rep_scores as Array<{ overall: number }> | null
          return repScores?.some((r) => r.overall >= 100) ?? false
        })
        break

      case 'session_symmetry': {
        const threshold = criteria.threshold as number
        earned = sessions.some((s) => {
          const repScores = s.rep_scores as Array<{ symmetry: number }> | null
          if (!repScores || repScores.length === 0) return false
          const avgSym = repScores.reduce((a, r) => a + r.symmetry, 0) / repScores.length
          return avgSym >= threshold
        })
        break
      }

      case 'streak':
        earned = streak >= (criteria.threshold as number)
        break

      case 'nutrition_streak':
        earned = nutritionDays >= (criteria.threshold as number)
        break
    }

    if (earned) newlyEarned.push(achievement as Achievement)
  }

  if (newlyEarned.length > 0) {
    await supabase.from('user_achievements').insert(
      newlyEarned.map((a) => ({ user_id: userId, achievement_id: a.id }))
    )
  }

  return newlyEarned
}
