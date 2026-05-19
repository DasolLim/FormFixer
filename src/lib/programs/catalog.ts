import { getSupabaseServer } from '../supabaseServer'
import type { ProgramTemplate } from './types'

export async function fetchAllPrograms(): Promise<ProgramTemplate[]> {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[fetchAllPrograms]', error)
    return []
  }
  return (data ?? []) as ProgramTemplate[]
}

export async function fetchProgramBySlug(slug: string): Promise<ProgramTemplate | null> {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) return null
  return data as ProgramTemplate
}

export async function fetchProgramsByEquipment(
  userEquipment: string[]
): Promise<ProgramTemplate[]> {
  const all = await fetchAllPrograms()
  return all.filter((p) =>
    p.required_equipment.every((eq) => userEquipment.includes(eq))
  )
}
