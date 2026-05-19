import { getSupabaseServer } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import AchievementBadge from '@/components/ui/AchievementBadge'

export const dynamic = 'force-dynamic'

type AchievementRow = {
  id: string
  key: string
  name: string
  description: string
  icon_name: string
}

export default async function AchievementsPage() {
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [allRes, earnedRes] = await Promise.all([
    supabase.from('achievements').select('id,key,name,description,icon_name').order('name'),
    supabase
      .from('user_achievements')
      .select('earned_at, achievements(id,key,name,description,icon_name)')
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false }),
  ])

  const all: AchievementRow[] = (allRes.data ?? []) as AchievementRow[]

  const earnedMap = new Map<string, string>(
    (earnedRes.data ?? []).map((row) => {
      const a = (row.achievements as AchievementRow | null)
      return [a?.id ?? '', row.earned_at ?? ''] as [string, string]
    })
  )

  const sorted = [...all].sort((a, b) => {
    const aEarned = earnedMap.has(a.id)
    const bEarned = earnedMap.has(b.id)
    if (aEarned && !bEarned) return -1
    if (!aEarned && bEarned) return 1
    return 0
  })

  const earnedCount = earnedMap.size

  return (
    <main className="ui-section desktop-centered-col">
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)' }}>Achievements</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
          {earnedCount} of {all.length} unlocked
        </p>
      </header>

      <div
        style={{ height: '6px', background: 'var(--bg-card)', borderRadius: '999px', marginBottom: '2rem' }}
        role="progressbar"
        aria-valuenow={earnedCount}
        aria-valuemax={all.length}
        aria-label={`${earnedCount} of ${all.length} achievements earned`}
      >
        <div
          style={{
            width: `${all.length > 0 ? (earnedCount / all.length) * 100 : 0}%`,
            height: '100%',
            background: 'var(--accent)',
            borderRadius: '999px',
            transition: 'width 0.6s ease',
          }}
        />
      </div>

      <div
        role="list"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}
      >
        {sorted.map((a) => (
          <AchievementBadge
            key={a.id}
            name={a.name}
            description={a.description}
            iconName={a.icon_name}
            earnedAt={earnedMap.get(a.id)}
            locked={!earnedMap.has(a.id)}
          />
        ))}
      </div>
    </main>
  )
}
