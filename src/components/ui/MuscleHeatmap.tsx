'use client'

type MuscleIntensity = Record<string, number> // 0–1 normalized

type Props = {
  intensities: MuscleIntensity
  neglectedMuscles?: string[]
}

const MUSCLE_REGIONS: Array<{ id: string; label: string; d: string }> = [
  { id: 'shoulders',   label: 'Shoulders',   d: 'M60,55 Q50,45 45,60 Q55,65 65,60Z M140,55 Q150,45 155,60 Q145,65 135,60Z' },
  { id: 'chest',       label: 'Chest',       d: 'M65,60 Q100,70 135,60 L130,95 Q100,105 70,95Z' },
  { id: 'biceps',      label: 'Biceps',      d: 'M42,62 Q35,75 38,95 Q48,92 52,78Z M158,62 Q165,75 162,95 Q152,92 148,78Z' },
  { id: 'triceps',     label: 'Triceps',     d: 'M40,65 Q30,78 34,98 Q42,95 46,80Z M160,65 Q170,78 166,98 Q158,95 154,80Z' },
  { id: 'core',        label: 'Core',        d: 'M70,95 Q100,105 130,95 L125,145 Q100,155 75,145Z' },
  { id: 'quads',       label: 'Quads',       d: 'M75,155 Q90,160 100,160 L98,220 Q85,222 78,218Z M125,155 Q110,160 100,160 L102,220 Q115,222 122,218Z' },
  { id: 'hamstrings',  label: 'Hamstrings',  d: 'M78,218 Q82,235 80,260 Q88,262 95,260 L96,220Z M122,218 Q118,235 120,260 Q112,262 105,260 L104,220Z' },
  { id: 'glutes',      label: 'Glutes',      d: 'M72,145 Q100,158 128,145 L125,165 Q100,175 75,165Z' },
  { id: 'calves',      label: 'Calves',      d: 'M80,260 Q78,285 82,305 Q90,307 94,305 L95,260Z M120,260 Q122,285 118,305 Q110,307 106,305 L105,260Z' },
  { id: 'hip_flexors', label: 'Hip Flexors', d: 'M75,148 Q86,152 100,154 Q90,162 78,158Z M125,148 Q114,152 100,154 Q110,162 122,158Z' },
  { id: 'back',        label: 'Back',        d: '' },
]

function intensityToColor(intensity: number): string {
  if (intensity === 0) return 'var(--bg-card-raised)'
  if (intensity < 0.35) return '#f59e0b'
  if (intensity < 0.7)  return '#ef4444'
  return 'var(--accent)'
}

function intensityLabel(v: number): string {
  if (v === 0)    return 'Untrained'
  if (v < 0.35)   return 'Light'
  if (v < 0.7)    return 'Moderate'
  return 'Heavy'
}

export default function MuscleHeatmap({ intensities, neglectedMuscles = [] }: Props) {
  const active = MUSCLE_REGIONS.filter((m) => (intensities[m.id] ?? 0) > 0 && m.d)
  const visibleRegions = MUSCLE_REGIONS.filter((m) => m.d)

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* SVG silhouette */}
      <figure aria-label="Muscle group heatmap" style={{ margin: 0, flex: '0 0 auto', width: 120 }}>
        <svg viewBox="0 0 200 320" width="100%" aria-hidden="true" style={{ display: 'block' }}>
          <ellipse cx="100" cy="35" rx="22" ry="25" fill="var(--bg-card-raised)" stroke="var(--border)" strokeWidth="1" />
          <rect x="55" y="58" width="90" height="100" rx="10" fill="var(--bg-card-raised)" stroke="var(--border)" strokeWidth="1" />
          <rect x="73" y="155" width="54" height="110" rx="8" fill="var(--bg-card-raised)" stroke="var(--border)" strokeWidth="1" />
          {visibleRegions.map(({ id, label, d }) => {
            const intensity = intensities[id] ?? 0
            const isNeglected = neglectedMuscles.includes(id)
            return (
              <g key={id}>
                <path
                  d={d}
                  fill={intensityToColor(intensity)}
                  opacity={intensity === 0 ? 0.25 : 0.85}
                  aria-label={`${label}: ${Math.round(intensity * 100)}%`}
                >
                  {isNeglected && (
                    <animate attributeName="opacity" values="0.85;0.3;0.85" dur="2s" repeatCount="indefinite" />
                  )}
                </path>
              </g>
            )
          })}
        </svg>
      </figure>

      {/* Activity bars */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {active.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0' }}>
            No muscle data for the past 7 days. Complete a workout to see activity.
          </p>
        ) : (
          active
            .sort((a, b) => (intensities[b.id] ?? 0) - (intensities[a.id] ?? 0))
            .map(({ id, label }) => {
              const pct = Math.round((intensities[id] ?? 0) * 100)
              const color = intensityToColor(intensities[id] ?? 0)
              const isNeglected = neglectedMuscles.includes(id)
              return (
                <div key={id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: isNeglected ? 'var(--color-warn)' : 'var(--text-secondary)', fontWeight: 500 }}>
                      {label}{isNeglected ? ' ⚠' : ''}
                    </span>
                    <span style={{ fontSize: 11, color: color, fontWeight: 600 }}>
                      {intensityLabel(intensities[id] ?? 0)}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: color,
                        borderRadius: 999,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                </div>
              )
            })
        )}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
          {[
            { label: 'Light',    color: '#f59e0b' },
            { label: 'Moderate', color: '#ef4444' },
            { label: 'Heavy',    color: 'var(--accent)' },
          ].map(({ label, color }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
