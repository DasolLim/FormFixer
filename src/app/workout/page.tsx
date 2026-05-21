'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { saveWorkoutSession } from '@/lib/workouts/sessions'
import type { SessionScore } from '@/lib/workouts/types'
import {
  ArrowLeft, CheckCircle2, Clock, Minus, Plus, Play, Flag, SkipForward,
} from 'lucide-react'

type DayExercise = { exercise_id: string; sets: number; reps: number; rest_seconds: number }
type DaySession  = { programId: string; programSlug: string; dayIndex: number; dayLabel: string; exercises: DayExercise[] }
type Phase = 'idle' | 'active' | 'resting' | 'complete'

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

function buildScore(exerciseId: string, totalReps: number, durationMs: number): SessionScore {
  return {
    exerciseId, repCount: totalReps,
    repScores: [], averageOverall: 0, averageDepth: 0,
    averageSymmetry: 0, averageForm: 0,
    formTrend: 'stable', topIssues: [], durationMs,
  }
}

export default function WorkoutPage() {
  const router = useRouter()
  const [daySession, setDaySession]         = useState<DaySession | null>(null)
  const [userId, setUserId]                 = useState<string | null>(null)
  const [phase, setPhase]                   = useState<Phase>('idle')
  const [currentExIdx, setCurrentExIdx]     = useState(0)
  const [currentSet, setCurrentSet]         = useState(1)
  const [manualReps, setManualReps]         = useState(0)
  const [restRemaining, setRestRemaining]   = useState(0)
  const [elapsed, setElapsed]               = useState(0)
  // completedSets[exIdx] = array of rep counts per completed set
  const [completedSets, setCompletedSets]   = useState<number[][]>([])
  // restOverrides[exIdx] = custom rest seconds (overrides ex.rest_seconds)
  const [restOverrides, setRestOverrides]   = useState<Record<number, number>>({})
  const [saving, setSaving]                 = useState(false)
  const [saveError, setSaveError]           = useState<string | null>(null)

  const restRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Track rest duration for the progress bar
  const restTotalRef = useRef(60)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('workout_day_session')
      if (!raw) { router.replace('/programs'); return }
      const ds = JSON.parse(raw) as DaySession
      setDaySession(ds)
      setCompletedSets(ds.exercises.map(() => []))
    } catch {
      router.replace('/programs')
    }
    getSupabaseClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
    return () => {
      if (restRef.current) clearInterval(restRef.current)
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
  }, [])

  function startElapsed() {
    if (elapsedRef.current) return
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }

  function stopElapsed() {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }
  }

  function startRest(seconds: number) {
    restTotalRef.current = seconds
    setRestRemaining(seconds)
    setPhase('resting')
    if (restRef.current) clearInterval(restRef.current)
    restRef.current = setInterval(() => {
      setRestRemaining(r => {
        if (r <= 1) {
          clearInterval(restRef.current!); restRef.current = null
          setPhase('active'); setManualReps(0)
          return 0
        }
        return r - 1
      })
    }, 1000)
  }

  function skipRest() {
    if (restRef.current) { clearInterval(restRef.current); restRef.current = null }
    setPhase('active'); setManualReps(0); setRestRemaining(0)
  }

  function handleStart() {
    setPhase('active')
    startElapsed()
  }

  function getRestSeconds(exIdx: number, ds: DaySession) {
    return restOverrides[exIdx] ?? ds.exercises[exIdx].rest_seconds
  }

  function adjustRest(delta: number) {
    setRestRemaining(r => Math.max(5, r + delta))
    setRestOverrides(prev => ({
      ...prev,
      [currentExIdx]: Math.max(5, (prev[currentExIdx] ?? restTotalRef.current) + delta),
    }))
  }

  function handleCompleteSet() {
    if (!daySession || phase !== 'active') return
    const ex   = daySession.exercises[currentExIdx]
    const reps = manualReps

    setCompletedSets(prev => {
      const next = prev.map(a => [...a])
      next[currentExIdx] = [...next[currentExIdx], reps]
      return next
    })

    const isLastSet      = currentSet >= ex.sets
    const isLastExercise = currentExIdx >= daySession.exercises.length - 1

    if (!isLastSet) {
      setCurrentSet(s => s + 1)
      startRest(getRestSeconds(currentExIdx, daySession))
    } else if (!isLastExercise) {
      setCurrentExIdx(i => i + 1)
      setCurrentSet(1)
      startRest(getRestSeconds(currentExIdx, daySession))
    } else {
      stopElapsed()
      setPhase('complete')
    }
  }

  async function handleFinish() {
    if (!daySession || !userId || saving) return
    setSaving(true)
    setSaveError(null)

    const lastCompletedIdx = daySession.exercises.reduce(
      (last, _, i) => (completedSets[i]?.length ?? 0) > 0 ? i : last, -1
    )

    for (let i = 0; i < daySession.exercises.length; i++) {
      const ex   = daySession.exercises[i]
      const sets = completedSets[i] ?? []
      if (sets.length === 0) continue

      const isLast     = i === lastCompletedIdx
      const totalReps  = sets.reduce((a, b) => a + b, 0)
      const setResults = sets.map((r, si) => ({ setNumber: si + 1, repCount: r, formScore: 0 }))
      const score      = buildScore(ex.exercise_id, totalReps, elapsed * 1000)

      const { error } = await saveWorkoutSession(userId, ex.exercise_id, totalReps, score, {
        programId:  daySession.programId,
        // Only pass dayIndex on the last exercise so markProgramWorkoutComplete fires once
        dayIndex:   isLast ? daySession.dayIndex : undefined,
        setResults,
      })
      if (error) { setSaveError(error.message); setSaving(false); return }
    }

    sessionStorage.removeItem('workout_day_session')
    router.push(`/programs/${daySession.programSlug}`)
  }

  if (!daySession) return null

  const ex                   = daySession.exercises[currentExIdx]
  const setsForCurrent       = completedSets[currentExIdx]?.length ?? 0
  const totalSetsCompleted   = completedSets.reduce((acc, s) => acc + s.length, 0)
  const totalSets            = daySession.exercises.reduce((acc, e) => acc + e.sets, 0)
  const overallPct           = totalSets > 0 ? Math.round((totalSetsCompleted / totalSets) * 100) : 0
  const restPct              = restTotalRef.current > 0 ? (restRemaining / restTotalRef.current) * 100 : 0

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingTop: 80 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'inherit' }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Clock size={13} color="var(--text-muted)" />
          <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>
            {fmt(elapsed)}
          </span>
        </div>
      </div>

      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
        {daySession.dayLabel}
      </p>

      {phase !== 'complete' && (
        <>
          {/* Overall progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Overall</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{overallPct}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-input)' }}>
              <div style={{ height: '100%', width: `${overallPct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.4s ease', boxShadow: '0 0 8px rgba(213,255,95,0.35)' }} />
            </div>
          </div>

          {/* Current exercise card */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '24px 20px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 4 }}>
              Exercise {currentExIdx + 1} of {daySession.exercises.length}
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 4 }}>
              {ex.exercise_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>
              {ex.sets} sets × {ex.reps} reps · {restOverrides[currentExIdx] ?? ex.rest_seconds}s rest
            </p>

            {/* Set progress dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              {Array.from({ length: ex.sets }, (_, si) => (
                <div
                  key={si}
                  style={{
                    height: 8, borderRadius: 4, transition: 'all 0.3s ease',
                    width: si < setsForCurrent ? 28 : 10,
                    background: si < setsForCurrent
                      ? 'var(--accent)'
                      : si === setsForCurrent
                        ? 'rgba(213,255,95,0.3)'
                        : 'var(--border)',
                  }}
                />
              ))}
            </div>

            {phase === 'idle' && (
              <button type="button" onClick={handleStart} className="btn btn-primary btn-full" style={{ height: 52, fontSize: 15 }}>
                <Play size={18} strokeWidth={2.5} /> Start Workout
              </button>
            )}

            {phase === 'resting' && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Rest
                </p>
                <div style={{ fontSize: 52, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', marginBottom: 12 }}>
                  {fmt(restRemaining)}
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-input)', marginBottom: 16, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: 'var(--accent)', width: `${restPct}%`, transition: 'width 0.9s linear' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => adjustRest(-15)}
                    style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
                  >
                    −15s
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustRest(15)}
                    style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
                  >
                    +15s
                  </button>
                </div>
                <button type="button" onClick={skipRest} className="btn btn-secondary btn-full">
                  <SkipForward size={14} /> Skip Rest
                </button>
              </div>
            )}

            {phase === 'active' && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Set {currentSet} of {ex.sets} · Target {ex.reps} reps
                </p>
                <div style={{ fontSize: 68, fontWeight: 800, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 4 }}>
                  {manualReps}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>reps completed</p>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 18 }}>
                  <button
                    type="button"
                    onClick={() => setManualReps(r => Math.max(0, r - 1))}
                    style={{ width: 56, height: 56, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Minus size={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualReps(r => r + 1)}
                    style={{ width: 56, height: 56, borderRadius: 14, border: 'none', background: 'var(--accent)', color: 'var(--text-on-lime)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Plus size={24} />
                  </button>
                </div>

                <button type="button" onClick={handleCompleteSet} className="btn btn-primary btn-full" style={{ height: 52, fontSize: 15 }}>
                  <Flag size={16} /> Complete Set {currentSet}
                </button>
              </div>
            )}
          </div>

          {/* Exercise mini-list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {daySession.exercises.map((e, i) => {
              const done      = (completedSets[i]?.length ?? 0) >= e.sets
              const isCurrent = i === currentExIdx
              const sets      = completedSets[i]?.length ?? 0
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 12,
                    background: isCurrent ? 'var(--accent-muted)' : 'var(--bg-card)',
                    border: `1px solid ${isCurrent ? 'var(--border-active)' : 'var(--border)'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  {done
                    ? <CheckCircle2 size={16} color="var(--accent)" />
                    : <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`, flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.exercise_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {sets}/{e.sets}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Completion screen */}
      {phase === 'complete' && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={36} color="var(--accent)" />
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            Day Complete!
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>{daySession.dayLabel}</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            {fmt(elapsed)} · {totalSetsCompleted} sets · {daySession.exercises.length} exercises
          </p>

          {/* Per-exercise summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', marginBottom: 28, marginTop: 20 }}>
            {daySession.exercises.map((e, i) => {
              const sets    = completedSets[i] ?? []
              const totalR  = sets.reduce((a, b) => a + b, 0)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <CheckCircle2 size={15} color="var(--accent)" />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
                    {e.exercise_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {sets.length}/{e.sets} sets · {totalR} reps
                  </span>
                </div>
              )
            })}
          </div>

          {saveError && <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{saveError}</p>}

          <button type="button" onClick={handleFinish} disabled={saving} className="btn btn-primary btn-full" style={{ height: 52, fontSize: 15 }}>
            {saving ? 'Saving...' : 'Save & Back to Program'}
          </button>
        </div>
      )}
    </div>
  )
}
