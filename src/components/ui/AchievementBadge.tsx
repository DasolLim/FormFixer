'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Dumbbell, Trophy, Medal, GraduationCap, Star, Sparkles,
  Scale, Flame, Zap, Apple,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  Dumbbell, Trophy, Medal, GraduationCap, Star, Sparkles, Scale, Flame, Zap, Apple,
}

type Props = {
  name: string
  description: string
  iconName: string
  earnedAt?: string
  locked?: boolean
}

export default function AchievementBadge({ name, description, iconName, earnedAt, locked = false }: Props) {
  const Icon = ICON_MAP[iconName] ?? Dumbbell

  return (
    <div
      role="listitem"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '1rem',
        borderRadius: '12px',
        border: `1px solid ${locked ? 'var(--border)' : 'var(--accent)'}`,
        background: locked ? 'var(--bg-card)' : 'color-mix(in srgb, var(--accent) 8%, var(--bg-card))',
        opacity: locked ? 0.45 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: locked ? 'var(--bg-card-raised)' : 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: locked ? 'var(--text-secondary)' : 'var(--text-on-lime)',
        }}
      >
        <Icon size={22} aria-hidden="true" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 500, marginBottom: '2px', color: 'var(--text-primary)' }}>{name}</p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {description}
        </p>
        {earnedAt && (
          <p suppressHydrationWarning style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Earned {new Date(earnedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}
