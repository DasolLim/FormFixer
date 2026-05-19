import { getSupabaseClient } from '../supabaseClient'

export type VoiceSettings = {
  enabled: boolean
  rate: number
  pitch: number
}

export async function saveVoiceSettings(
  userId: string,
  settings: VoiceSettings
): Promise<void> {
  const supabase = getSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .update({ voice_settings: settings })
    .eq('id', userId)
  if (error) throw error
}
