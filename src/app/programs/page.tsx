import { fetchAllPrograms } from '@/lib/programs/catalog'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import ProgramGrid from './ProgramGrid'

export const dynamic = 'force-dynamic'

export default async function ProgramsPage() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('equipment_profile')
    .eq('id', user.id)
    .single()

  const equipment: string[] = (profile?.equipment_profile as string[]) ?? ['bodyweight']

  const [allPrograms, userProgressResult] = await Promise.all([
    fetchAllPrograms(),
    supabase
      .from('user_program_progress')
      .select('*')
      .eq('user_id', user.id),
  ])

  const filtered = allPrograms.filter((p) =>
    p.required_equipment.every((eq) => equipment.includes(eq))
  )

  const progressMap = Object.fromEntries(
    (userProgressResult.data ?? [])
      .filter((p) => p.program_id != null)
      .map((p) => [p.program_id as string, p])
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
      <header style={{ padding: '32px 0 8px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
          Program Library
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
          Guided training programs tailored to your equipment — pick one and follow along session by session.
        </p>
      </header>
      <ProgramGrid programs={filtered} progressMap={progressMap} />
    </div>
  )
}
