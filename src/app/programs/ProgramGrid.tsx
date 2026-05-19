'use client'

import Link from 'next/link'
import { Dumbbell, Zap, Target, Activity, Flame, Shield, ChevronRight, Clock, BarChart2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ProgramTemplate } from '@/lib/programs/types'

type ProgressRow = {
  program_id: string | null
  current_week: number
  completed_workouts: number
  completion_percent: number
}

type Props = {
  programs: ProgramTemplate[]
  progressMap: Record<string, ProgressRow>
}

const DIFFICULTY_CONFIG: Record<
  ProgramTemplate['difficulty'],
  { label: string; gradient: string; badge: string; text: string }
> = {
  beginner:     { label: 'Beginner',     gradient: 'linear-gradient(135deg, #16a34a 0%, #4ade80 100%)', badge: '#dcfce7', text: '#166534' },
  intermediate: { label: 'Intermediate', gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)', badge: '#fef3c7', text: '#92400e' },
  advanced:     { label: 'Advanced',     gradient: 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)', badge: '#fee2e2', text: '#991b1b' },
}

const EQUIPMENT_ICONS: Array<[RegExp, LucideIcon]> = [
  [/barbell|bench|rack/i, Dumbbell],
  [/dumbbell/i, Dumbbell],
  [/bodyweight|calisthenics/i, Activity],
  [/hiit|cardio|interval/i, Zap],
  [/core|abs|plank/i, Target],
  [/strength|power/i, Flame],
]

function getProgramIcon(program: ProgramTemplate): LucideIcon {
  const haystack = [program.title, program.description ?? '', ...program.required_equipment].join(' ')
  for (const [pattern, Icon] of EQUIPMENT_ICONS) {
    if (pattern.test(haystack)) return Icon
  }
  return Shield
}

function EquipmentBadge({ label }: { label: string }) {
  const display = label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        padding: '2px 8px',
        borderRadius: 999,
        background: 'var(--bg-input)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border)',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {display}
    </span>
  )
}

function ProgramCard({ program, progress }: { program: ProgramTemplate; progress?: ProgressRow }) {
  const diff = DIFFICULTY_CONFIG[program.difficulty]
  const Icon = getProgramIcon(program)
  const pct = progress?.completion_percent ?? 0
  const isStarted = !!progress
  const totalExercises = program.workout_days.reduce((acc, d) => acc + d.exercises.length, 0)

  return (
    <article
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.transform = ''
        ;(e.currentTarget as HTMLElement).style.boxShadow = ''
      }}
    >
      {/* Gradient header */}
      <div
        style={{
          background: diff.gradient,
          padding: '20px 20px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.85)',
              marginBottom: 6,
            }}
          >
            {diff.label}
          </span>
          <h3
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.3,
              textShadow: '0 1px 3px rgba(0,0,0,0.25)',
            }}
          >
            {program.title}
          </h3>
        </div>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={22} color="#fff" />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Description */}
        {program.description && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {program.description}
          </p>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Clock size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              {program.weeks} {program.weeks === 1 ? 'week' : 'weeks'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <BarChart2 size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              {program.workout_days.length} days/cycle
            </span>
          </div>
          {totalExercises > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Target size={13} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                {totalExercises} exercises
              </span>
            </div>
          )}
        </div>

        {/* Equipment badges */}
        {program.required_equipment.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {program.required_equipment.map((eq) => (
              <EquipmentBadge key={eq} label={eq} />
            ))}
          </div>
        )}

        {/* Progress bar */}
        {isStarted && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Week {progress!.current_week} of {program.weeks}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
                {pct}%
              </span>
            </div>
            <div
              style={{
                height: 5,
                background: 'var(--bg-input)',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  borderRadius: 999,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* CTA */}
        <Link
          href={`/programs/${program.slug}`}
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 16px',
            borderRadius: 999,
            background: isStarted ? 'var(--accent)' : 'var(--bg-input)',
            color: isStarted ? 'var(--accent-fg)' : 'var(--text-primary)',
            fontWeight: 600,
            fontSize: 13,
            textDecoration: 'none',
            border: isStarted ? 'none' : '1px solid var(--border)',
            transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
        >
          {isStarted ? 'Continue Program' : 'Start Program'}
          <ChevronRight size={14} />
        </Link>
      </div>
    </article>
  )
}

export default function ProgramGrid({ programs, progressMap }: Props) {
  const inProgress = programs.filter((p) => !!progressMap[p.id])
  const notStarted = programs.filter((p) => !progressMap[p.id])

  if (programs.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <Shield size={48} color="var(--text-muted)" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          No programs available
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
          Update your equipment profile to unlock more training programs.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 0' }}>
      {inProgress.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              margin: '0 0 16px',
            }}
          >
            In Progress
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: 16,
            }}
          >
            {inProgress.map((p) => (
              <ProgramCard key={p.slug} program={p} progress={progressMap[p.id]} />
            ))}
          </div>
        </section>
      )}

      <section>
        {inProgress.length > 0 && (
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              margin: '0 0 16px',
            }}
          >
            All Programs
          </h2>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: 16,
          }}
        >
          {notStarted.map((p) => (
            <ProgramCard key={p.slug} program={p} />
          ))}
        </div>
      </section>
    </div>
  )
}
