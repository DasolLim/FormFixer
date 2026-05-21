import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

type Params = { params: { id: string } }

async function resolveOwnership(programId: string, userId: string) {
  const supabase = getSupabaseServer()
  const { data } = await supabase
    .from('programs')
    .select('id, author_id')
    .eq('id', programId)
    .single()
  if (!data) return 'not_found'
  if (data.author_id !== userId) return 'forbidden'
  return 'ok'
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ownership = await resolveOwnership(params.id, user.id)
  if (ownership === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (ownership === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabase.from('user_program_progress').delete().eq('program_id', params.id)
  const { error } = await supabase.from('programs').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ownership = await resolveOwnership(params.id, user.id)
  if (ownership === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (ownership === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { title?: string; description?: string }
  const updates: { title?: string; description?: string } = {}
  if (body.title?.trim()) updates.title = body.title.trim()
  if (body.description !== undefined) updates.description = body.description.trim()

  const { data: updated, error } = await supabase
    .from('programs')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ program: updated })
}
