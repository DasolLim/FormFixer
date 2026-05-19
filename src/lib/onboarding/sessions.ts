import { getSupabaseClient } from '../supabaseClient'
import type { MovementBaseline, EquipmentId } from './types'

export async function saveMovementBaseline(
  userId: string,
  baseline: MovementBaseline
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      movement_baseline: baseline as unknown as import('@/lib/database.types').Json,
      onboarding_complete: true,
    })
    .eq('id', userId)
  if (error) throw error
}

export async function saveEquipmentProfile(
  userId: string,
  equipment: EquipmentId[]
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('profiles')
    .update({ equipment_profile: equipment as unknown as import('@/lib/database.types').Json })
    .eq('id', userId)
  if (error) throw error
}

export async function fetchOnboardingStatus(userId: string) {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('profiles')
    .select('onboarding_complete, equipment_profile')
    .eq('id', userId)
    .single()
  return data
}
