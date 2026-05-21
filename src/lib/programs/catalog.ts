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

// Fetches public programs + the user's own AI-generated programs
export async function fetchAllProgramsForUser(userId: string): Promise<ProgramTemplate[]> {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .or(`is_public.eq.true,author_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[fetchAllProgramsForUser]', error)
    return []
  }
  // Deduplicate by id (guards against edge-case double-rows from OR filter)
  const seen = new Set<string>()
  return (data ?? []).filter(p => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  }) as ProgramTemplate[]
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
