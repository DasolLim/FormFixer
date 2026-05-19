import { getSupabaseClient } from '../supabaseClient'

export type PersonalRecord = {
  exercise_id: string
  best_form_score: number
  best_rep_count: number
  best_volume: number
  achieved_at: string
}

export type PRCheckResult = {
  newPR: boolean
  metrics: Array<{ metric: string; previous: number; new: number }>
}

export async function checkAndUpdatePRs(
  userId: string,
  exerciseId: string,
  formScore: number,
  repCount: number,
  totalVolume: number
): Promise<PRCheckResult> {
  const supabase = getSupabaseClient()

  const { data: current } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .maybeSingle()

  const prev = {
    best_form_score: current?.best_form_score ?? 0,
    best_rep_count: current?.best_rep_count ?? 0,
    best_volume: current?.best_volume ?? 0,
  }
  const newMetrics: PRCheckResult['metrics'] = []
  let bestFormScore = prev.best_form_score
  let bestRepCount = prev.best_rep_count
  let bestVolume = prev.best_volume

  if (formScore > prev.best_form_score) {
    bestFormScore = formScore
    newMetrics.push({ metric: 'form_score', previous: prev.best_form_score, new: formScore })
  }
  if (repCount > prev.best_rep_count) {
    bestRepCount = repCount
    newMetrics.push({ metric: 'rep_count', previous: prev.best_rep_count, new: repCount })
  }
  if (totalVolume > prev.best_volume) {
    bestVolume = totalVolume
    newMetrics.push({ metric: 'volume', previous: prev.best_volume, new: totalVolume })
  }

  if (newMetrics.length === 0) {
    return { newPR: false, metrics: [] }
  }

  await supabase
    .from('personal_records')
    .upsert(
      {
        user_id: userId,
        exercise_id: exerciseId,
        best_form_score: bestFormScore,
        best_rep_count: bestRepCount,
        best_volume: bestVolume,
        achieved_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,exercise_id' }
    )

  return { newPR: true, metrics: newMetrics }
}
