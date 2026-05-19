'use client'

import { useRouter } from 'next/navigation'
import { useTransition, useOptimistic } from 'react'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { Section } from '@/components/layout/Section'
import type { ProgramTemplate, ProgramDay } from '@/lib/programs/types'

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

export default function ProgramDetail({ program, progress, userId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [optimisticProgress, addOptimistic] = useOptimistic(
    progress,
    (_state, next: NonNullable<ProgressRow>) => next
  )

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
    await supabase.from('user_program_progress').upsert(
      {
        user_id: userId,
        program_id: program.id,
        program_slug: program.slug,
        current_week: 1,
        completed_workouts: 0,
        total_workouts: totalWorkouts,
        completion_percent: 0,
      },
      { onConflict: 'user_id,program_id' }
    )
    router.refresh()
  }

  function buildCameraUrl(day: ProgramDay, dayIndex: number): string {
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

  const totalDays = program.workout_days.length

  return (
    <Section title={program.title} subtitle="Program Details" description={program.description ?? undefined}>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{
          padding: '3px 10px', borderRadius: 99,
          background: 'var(--surface-2)', color: 'var(--muted)', fontSize: '0.82rem',
        }}>
          {program.difficulty}
        </span>
        <span style={{
          padding: '3px 10px', borderRadius: 99,
          background: 'var(--surface-2)', color: 'var(--muted)', fontSize: '0.82rem',
        }}>
          {program.weeks} weeks
        </span>
        {program.required_equipment.map((eq) => (
          <span key={eq} style={{
            padding: '3px 10px', borderRadius: 99,
            background: 'var(--surface-2)', color: 'var(--muted)', fontSize: '0.82rem',
          }}>
            {eq}
          </span>
        ))}
      </div>

      {!optimisticProgress && (
        <button
          onClick={() => startTransition(handleEnroll)}
          disabled={isPending}
          style={{
            padding: '10px 22px', borderRadius: 8, fontWeight: 600,
            background: 'var(--primary)', color: '#fff', border: 'none',
            cursor: isPending ? 'not-allowed' : 'pointer', marginBottom: 20,
          }}
        >
          {isPending ? 'Starting…' : 'Start Program'}
        </button>
      )}

      {optimisticProgress && (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: 'var(--surface-2)', marginBottom: 20,
        }}>
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>
            Week {optimisticProgress.current_week} of {program.weeks}
          </p>
          <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: '0.88rem' }}>
            {optimisticProgress.completed_workouts} / {totalDays} workouts complete
          </p>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: 'var(--primary)',
              width: `${optimisticProgress.completion_percent}%`,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>Program Days</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {program.workout_days.map((day, idx) => (
          <div key={idx} style={{
            padding: '14px 16px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--surface)',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 600 }}>{day.label}</h3>
            <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: 'var(--muted)', fontSize: '0.88rem' }}>
              {day.exercises.map((ex) => (
                <li key={ex.exercise_id}>
                  {ex.exercise_id} — {ex.sets}×{ex.reps} @ {ex.rest_seconds}s rest
                </li>
              ))}
            </ul>
            <a
              href={buildCameraUrl(day, idx)}
              style={{
                display: 'inline-block', padding: '7px 16px',
                borderRadius: 7, background: 'var(--primary)',
                color: '#fff', fontWeight: 600, fontSize: '0.88rem',
                textDecoration: 'none',
              }}
            >
              Start Workout →
            </a>
          </div>
        ))}
      </div>
    </Section>
  )
}
