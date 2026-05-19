import { fetchProgramBySlug } from '@/lib/programs/catalog'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { notFound, redirect } from 'next/navigation'
import ProgramDetail from './ProgramDetail'

type Props = { params: { slug: string } }

export default async function ProgramPage({ params }: Props) {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const program = await fetchProgramBySlug(params.slug)
  if (!program) notFound()

  const { data: progress } = await supabase
    .from('user_program_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('program_id', program.id)
    .maybeSingle()

  return (
    <ProgramDetail
      program={program}
      progress={progress ?? null}
      userId={user.id}
    />
  )
}
