'use client'

import { useRouter } from 'next/navigation'
import { useTransition, useOptimistic, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabaseClient'
import type { ProgramTemplate, ProgramDay } from '@/lib/programs/types'
import {
  ArrowLeft, Calendar, Dumbbell, Play, Clock, Target,
  ChevronDown, Zap, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'

type ProgressRow = {
  id: string
  current_week: number
  completed_workouts: number
  completion_percent: number
  total_workouts: number
} | null

type Props = {
  program: ProgramTemplate
  progress: ProgressRow
  userId: string
}

const DIFFICULTY_CONFIG: Record<string, { label: string; gradient: string; glow: string }> = {
  beginner:     { label: 'Beginner',     gradient: 'linear-gradient(135deg, #16a34a 0%, #4ade80 100%)', glow: '0 12px 40px rgba(74,222,128,0.2)' },
  intermediate: { label: 'Intermediate', gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)', glow: '0 12px 40px rgba(251,191,36,0.2)' },
  advanced:     { label: 'Advanced',     gradient: 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)', glow: '0 12px 40px rgba(248,113,113,0.2)' },
}

function storeDaySession(program: ProgramTemplate, day: ProgramDay, dayIndex: number) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem('workout_day_session', JSON.stringify({
    programId: program.id,
    programSlug: program.slug,
    dayIndex,
    dayLabel: day.label,
    exercises: day.exercises,
  }))
}

function buildCameraUrl(program: ProgramTemplate, day: ProgramDay, dayIndex: number): string {
  const firstEx = day.exercises[0]
  const params = new URLSearchParams({
    programId: program.id,
    programSlug: program.slug,
    dayIndex: String(dayIndex),
    exerciseId: firstEx.exercise_id,
    targetSets: String(firstEx.sets),
    targetReps: String(firstEx.reps),
    restSeconds: String(firstEx.rest_seconds),
  })
  return `/camera?${params}`
}

// ── Day accordion card ─────────────────────────────────────────────────────────
function DayCard({
  day, idx, isEnrolled, isDone, program,
}: {
  day: ProgramDay
  idx: number
  isEnrolled: boolean
  isDone: boolean
  program: ProgramTemplate
}) {
  const router = useRouter()
  const [open, setOpen] = useState(idx === 0)

  function handleBeginDay() {
    storeDaySession(program, day, idx)
    router.push(buildCameraUrl(program, day, idx))
  }

  function handleBeginDayNoCamera() {
    storeDaySession(program, day, idx)
    router.push('/workout')
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
      transition: 'border-color 0.15s ease',
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
          padding: '14px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: isDone ? 'rgba(213,255,95,0.15)' : open ? 'var(--accent-muted)' : 'var(--bg-input)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background 0.15s ease',
          }}>
            {isDone
              ? <CheckCircle2 size={18} color="var(--accent)" />
              : <span style={{ fontSize: 13, fontWeight: 800, color: open ? 'var(--accent)' : 'var(--text-muted)', transition: 'color 0.15s ease' }}>{idx + 1}</span>
            }
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
              {day.label}
            </p>
            <p style={{ fontSize: 11, color: isDone ? 'var(--accent)' : 'var(--text-muted)', margin: '2px 0 0', fontWeight: isDone ? 600 : 400 }}>
              {isDone ? 'Completed' : `${day.exercises.length} exercises`}
            </p>
          </div>
        </div>
        <ChevronDown
          size={15}
          color="var(--text-muted)"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 12 }}>
            {day.exercises.map((ex, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 0',
                  borderBottom: i < day.exercises.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--accent)', flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {ex.exercise_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {ex.sets}&times;{ex.reps}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={10} color="var(--text-muted)" />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ex.rest_seconds}s</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {isEnrolled ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" onClick={handleBeginDay} className="btn btn-primary btn-full" style={{ fontSize: 13 }}>
                <Play size={14} strokeWidth={2.5} />
                {isDone ? 'Redo Day' : `Begin Day ${idx + 1}`}
              </button>
              <button type="button" onClick={handleBeginDayNoCamera} className="btn btn-secondary btn-full" style={{ fontSize: 13 }}>
                <Dumbbell size={13} />
                Train Without Camera
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
              Start the program to unlock this day
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ProgramDetail({ program, progress, userId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [optimisticProgress, addOptimistic] = useOptimistic(
    progress,
    (_state, next: NonNullable<ProgressRow>) => next
  )

  const diff         = DIFFICULTY_CONFIG[program.difficulty] ?? { label: program.difficulty, gradient: 'linear-gradient(135deg, #374151, #6b7280)', glow: 'none' }
  const totalEx      = program.workout_days.reduce((acc, d) => acc + d.exercises.length, 0)
  const isEnrolled   = !!optimisticProgress
  // Approximate which days in the current cycle are done
  const completedInCycle = optimisticProgress
    ? optimisticProgress.completed_workouts % program.workout_days.length
    : 0

  async function handleEnroll() {
    const supabase = getSupabaseClient()
    const totalWorkouts = program.workout_days.length * program.weeks
    addOptimistic({
      id: '',
      current_week: 1,
      completed_workouts: 0,
      completion_percent: 0,
      total_workouts: totalWorkouts,
    })
    const { data: existing } = await supabase
      .from('user_program_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('program_id', program.id)
      .maybeSingle()

    if (!existing) {
      await supabase.from('user_program_progress').insert({
        user_id: userId,
        program_id: program.id,
        program_slug: program.slug,
        current_week: 1,
        completed_workouts: 0,
        total_workouts: totalWorkouts,
        completion_percent: 0,
      })
    }
    router.refresh()
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', paddingBottom: 80 }}>

      {/* Back link */}
      <div style={{ padding: '16px 20px 0' }}>
        <Link
          href="/programs"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500,
            textDecoration: 'none',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
        >
          <ArrowLeft size={15} />
          Programs
        </Link>
      </div>

      {/* Hero */}
      <div style={{
        margin: '14px 20px 0',
        borderRadius: 20,
        overflow: 'hidden',
        background: diff.gradient,
        boxShadow: diff.glow,
      }}>
        <div style={{ padding: '26px 22px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)',
                display: 'block', marginBottom: 6,
              }}>
                {diff.label}
                {program.is_ai_generated && (
                  <span style={{ marginLeft: 8, opacity: 0.7 }}>
                    <Zap size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    AI Generated
                  </span>
                )}
              </span>
              <h1 style={{
                fontSize: 24, fontWeight: 800, color: '#fff',
                lineHeight: 1.2, margin: 0,
                textShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}>
                {program.title}
              </h1>
            </div>
          </div>

          {program.description && (
            <p style={{
              fontSize: 13, color: 'rgba(255,255,255,0.78)',
              lineHeight: 1.6, margin: '0 0 18px',
            }}>
              {program.description}
            </p>
          )}

          {/* Stats */}
          <div style={{
            display: 'flex', gap: 18, flexWrap: 'wrap',
            paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.18)',
          }}>
            {[
              { Icon: Calendar,   label: `${program.weeks} weeks` },
              { Icon: Dumbbell,   label: `${program.workout_days.length} days/cycle` },
              { Icon: Target,     label: `${totalEx} exercises` },
            ].map(({ Icon, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon size={13} color="rgba(255,255,255,0.65)" />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px 0' }}>

        {/* Progress card */}
        {optimisticProgress && (
          <div style={{
            padding: '16px 18px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Week {optimisticProgress.current_week} of {program.weeks}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  {optimisticProgress.completed_workouts} / {optimisticProgress.total_workouts} workouts done
                </p>
              </div>
              <span style={{
                fontSize: 26, fontWeight: 800, color: 'var(--accent)',
                fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              }}>
                {optimisticProgress.completion_percent}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${optimisticProgress.completion_percent}%`,
                background: 'var(--accent)',
                borderRadius: 3,
                transition: 'width 0.4s ease',
                boxShadow: '0 0 10px rgba(213,255,95,0.4)',
              }} />
            </div>
          </div>
        )}

        {/* Enroll CTA */}
        {!isEnrolled && (
          <button
            type="button"
            onClick={() => startTransition(handleEnroll)}
            disabled={isPending}
            className="btn btn-primary btn-full"
            style={{ marginBottom: 12 }}
          >
            <Play size={15} strokeWidth={2.5} />
            {isPending ? 'Starting...' : 'Start Program'}
          </button>
        )}

        {/* Equipment tags */}
        {program.required_equipment.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {program.required_equipment.map(eq => (
              <span key={eq} className="tag tag-dark">
                {eq.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            ))}
          </div>
        )}

        {/* Days heading */}
        <h2 style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--text-muted)',
          margin: '0 0 12px',
        }}>
          Program Days
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {program.workout_days.map((day, idx) => (
            <DayCard
              key={idx}
              day={day}
              idx={idx}
              isEnrolled={isEnrolled}
              isDone={idx < completedInCycle}
              program={program}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
