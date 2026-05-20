'use client'

import { useState } from 'react'
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
  { label: string; gradient: string }
> = {
  beginner:     { label: 'Beginner',     gradient: 'linear-gradient(135deg, #16a34a 0%, #4ade80 100%)' },
  intermediate: { label: 'Intermediate', gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)' },
  advanced:     { label: 'Advanced',     gradient: 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)' },
}

const FILTER_OPTIONS = ['All', 'Beginner', 'Intermediate', 'Advanced'] as const
type FilterOption = typeof FILTER_OPTIONS[number]

const EQUIPMENT_ICONS: Array<[RegExp, LucideIcon]> = [
  [/barbell|bench|rack/i, Dumbbell],
  [/dumbbell/i,           Dumbbell],
  [/bodyweight|calisthenics/i, Activity],
  [/hiit|cardio|interval/i, Zap],
  [/core|abs|plank/i,    Target],
  [/strength|power/i,    Flame],
]

function getProgramIcon(program: ProgramTemplate): LucideIcon {
  const haystack = [program.title, program.description ?? '', ...program.required_equipment].join(' ')
  for (const [pattern, Icon] of EQUIPMENT_ICONS) {
    if (pattern.test(haystack)) return Icon
  }
  return Shield
}

// ── Featured in-progress card (full-width) ────────────────────────────────────
function FeaturedProgramCard({ program, progress }: { program: ProgramTemplate; progress: ProgressRow }) {
  const diff = DIFFICULTY_CONFIG[program.difficulty]
  const pct  = progress.completion_percent
  const week = progress.current_week

  return (
    <article
      className="card"
      style={{ background: diff.gradient, marginBottom: 32 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)',
            display: 'block', marginBottom: 4,
          }}>
            In Progress · {diff.label}
          </span>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
            {program.title}
          </h2>
        </div>
        <span style={{ fontSize: 24, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {pct}%
        </span>
      </div>

      {program.description && (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: '0 0 16px', lineHeight: 1.5 }}>
          {program.description}
        </p>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            Week {week} of {program.weeks}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            {program.workout_days.length} days/cycle
          </span>
        </div>
        <div className="form-gauge-track" style={{ background: 'rgba(0,0,0,0.25)' }}>
          <div
            className="form-gauge-fill"
            style={{ width: `${pct}%`, background: 'rgba(255,255,255,0.9)' }}
          />
        </div>
      </div>

      <Link href={`/programs/${program.slug}`} className="btn btn-dark" style={{ width: 'fit-content' }}>
        Continue Week {week}
      </Link>
    </article>
  )
}

// ── Regular program card (2-col grid) ─────────────────────────────────────────
function ProgramCard({ program, progress }: { program: ProgramTemplate; progress?: ProgressRow }) {
  const diff         = DIFFICULTY_CONFIG[program.difficulty]
  const Icon         = getProgramIcon(program)
  const pct          = progress?.completion_percent ?? 0
  const isStarted    = !!progress
  const totalEx      = program.workout_days.reduce((acc, d) => acc + d.exercises.length, 0)

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
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.transform = ''
        ;(e.currentTarget as HTMLElement).style.boxShadow = ''
      }}
    >
      {/* Gradient header */}
      <div style={{
        background: diff.gradient,
        padding: '20px 20px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'inline-block', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.85)', marginBottom: 6,
          }}>
            {diff.label}
          </span>
          <h3 style={{
            margin: 0, fontSize: 17, fontWeight: 700, color: '#fff',
            lineHeight: 1.3, textShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }}>
            {program.title}
          </h3>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={22} color="#fff" />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {program.description && (
          <p style={{
            margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {program.description}
          </p>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
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
          {totalEx > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Target size={13} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                {totalEx} exercises
              </span>
            </div>
          )}
        </div>

        {/* Equipment tags */}
        {program.required_equipment.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {program.required_equipment.map(eq => (
              <span key={eq} className="tag tag-dark">
                {eq.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            ))}
          </div>
        )}

        {/* Progress bar (if in progress) */}
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
            <div className="form-gauge-track">
              <div className="form-gauge-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* CTA */}
        <Link
          href={`/programs/${program.slug}`}
          className={isStarted ? 'btn btn-primary' : 'btn btn-ghost'}
          style={{ marginTop: 'auto' }}
        >
          {isStarted ? 'Continue Program' : 'Start Program'}
          <ChevronRight size={14} />
        </Link>
      </div>
    </article>
  )
}

// ── AI custom plan card ────────────────────────────────────────────────────────
function AIPlanCard() {
  return (
    <Link
      href="/programs/generate"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '32px 20px',
        borderRadius: 16,
        border: '1px dashed var(--border)',
        background: 'var(--bg-card)',
        textDecoration: 'none',
        minHeight: 220,
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'var(--accent-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Zap size={24} color="var(--accent)" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
          Build custom plan
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          Generate a personalized program with AI
        </p>
      </div>
      <span className="tag tag-lime">Generate with AI</span>
    </Link>
  )
}

// ── Main grid ─────────────────────────────────────────────────────────────────
export default function ProgramGrid({ programs, progressMap }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterOption>('All')

  const inProgress = programs.filter(p => !!progressMap[p.id])
  const notStarted = programs.filter(p => !progressMap[p.id])

  const featured     = inProgress[0] ?? null
  const gridRaw      = [...inProgress.slice(1), ...notStarted]
  const gridPrograms = activeFilter === 'All'
    ? gridRaw
    : gridRaw.filter(p => p.difficulty === activeFilter.toLowerCase())

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
    <div style={{ paddingBottom: 40 }}>

      {/* Filter pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
        {FILTER_OPTIONS.map(f => (
          <button
            key={f}
            type="button"
            className={f === activeFilter ? 'tag tag-lime' : 'tag tag-outline'}
            style={{ cursor: 'pointer', fontFamily: 'inherit', ...(f === activeFilter ? { border: 'none' } : {}) }}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Featured in-progress card */}
      {featured && (
        <section>
          <h2 style={{
            fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 14px',
          }}>
            In Progress
          </h2>
          <FeaturedProgramCard program={featured} progress={progressMap[featured.id]} />
        </section>
      )}

      {/* All Programs 2-column grid */}
      <section>
        {featured && (
          <h2 style={{
            fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 14px',
          }}>
            All Programs
          </h2>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {gridPrograms.map(p => (
            <ProgramCard key={p.slug} program={p} progress={progressMap[p.id]} />
          ))}
          <AIPlanCard />
        </div>
      </section>

    </div>
  )
}
