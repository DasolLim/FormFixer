import Link from 'next/link'
import { Zap } from 'lucide-react'
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
      <header style={{ padding: '32px 0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Program Library
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
              Guided training programs tailored to your equipment.
            </p>
          </div>
          <Link href="/programs/generate" className="btn btn-primary" style={{ flexShrink: 0, height: 44, fontSize: 14, whiteSpace: 'nowrap' }}>
            <Zap size={15} strokeWidth={2} />
            Generate with AI
          </Link>
        </div>
      </header>
      <ProgramGrid programs={filtered} progressMap={progressMap} />
    </div>
  )
}
