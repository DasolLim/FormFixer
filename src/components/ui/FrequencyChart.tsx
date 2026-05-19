'use client'

import type { WeeklyFrequency } from '@/lib/workouts/frequency'

type Props = {
  data: WeeklyFrequency[]
  targetSessionsPerWeek: number
}

export default function FrequencyChart({ data, targetSessionsPerWeek }: Props) {
  const maxCount = Math.max(...data.map((d) => d.count), targetSessionsPerWeek, 1)

  return (
    <figure aria-label="Weekly workout frequency chart" style={{ margin: 0 }}>
      <div
        role="img"
        aria-label={`Workout frequency: last ${data.length} weeks`}
        style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px', padding: '0 4px' }}
      >
        {data.map(({ week, count, targetMet }) => {
          const heightPct = count > 0 ? (count / maxCount) * 100 : 4
          const label = new Date(week).toLocaleDateString('en', { month: 'short', day: 'numeric' })
          return (
            <div
              key={week}
              title={`${label}: ${count} session${count !== 1 ? 's' : ''}`}
              aria-label={`Week of ${label}: ${count} sessions`}
              style={{
                flex: 1,
                height: `${heightPct}%`,
                background: targetMet ? 'var(--accent)' : 'var(--text-muted)',
                borderRadius: '4px 4px 0 0',
                minHeight: '4px',
                transition: 'height 0.4s ease',
                opacity: count === 0 ? 0.3 : 1,
              }}
            />
          )
        })}
      </div>

      <figcaption style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', padding: '0 4px' }}>
        <span>
          {data[0]?.week
            ? new Date(data[0].week).toLocaleDateString('en', { month: 'short', day: 'numeric' })
            : ''}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>Goal: {targetSessionsPerWeek}/week</span>
        <span>This week</span>
      </figcaption>
    </figure>
  )
}
