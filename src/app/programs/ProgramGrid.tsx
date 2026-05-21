'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Dumbbell, Zap, Target, Activity, Flame, Shield,
  ChevronRight, Clock, BarChart2, MoreVertical, Pencil, Trash2, X, Check,
} from 'lucide-react'
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
  userId: string
}

const DIFFICULTY_CONFIG: Record<
  ProgramTemplate['difficulty'],
  { label: string; gradient: string; glow: string }
> = {
  beginner:     { label: 'Beginner',     gradient: 'linear-gradient(135deg, #16a34a 0%, #4ade80 100%)', glow: 'rgba(74,222,128,0.15)' },
  intermediate: { label: 'Intermediate', gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)', glow: 'rgba(251,191,36,0.15)' },
  advanced:     { label: 'Advanced',     gradient: 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)', glow: 'rgba(248,113,113,0.15)' },
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

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({
  program,
  onSave,
  onClose,
}: {
  program: ProgramTemplate
  onSave: (title: string, description: string) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle]       = useState(program.title)
  const [desc, setDesc]         = useState(program.description ?? '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    try {
      await onSave(title.trim(), desc.trim())
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 440,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Edit Program
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--bg-input)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Title
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={80}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--text-primary)',
                fontSize: 14, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-active)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Description
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              maxLength={400}
              rows={3}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--text-primary)',
                fontSize: 14, fontFamily: 'inherit', outline: 'none',
                resize: 'vertical', lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-active)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 13, color: 'var(--danger)', marginTop: 10 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={handleSave}
            disabled={saving}
          >
            <Check size={15} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card overflow menu ─────────────────────────────────────────────────────────
function CardMenu({
  program,
  onEdit,
  onDelete,
}: {
  program: ProgramTemplate
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
        style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(255,255,255,0.15)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.8)',
          flexShrink: 0,
        }}
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: 'var(--bg-card-raised)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 6,
          minWidth: 130,
          zIndex: 50,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <button
            type="button"
            onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); onEdit() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '8px 12px', borderRadius: 8,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-input)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <Pencil size={13} color="var(--text-secondary)" />
            Edit
          </button>
          <button
            type="button"
            onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); onDelete() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '8px 12px', borderRadius: 8,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--danger)', fontSize: 13, fontWeight: 500,
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,107,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ── In-progress card (compact horizontal card) ────────────────────────────────
function InProgressCard({
  program, progress, userId, onEdit, onDelete,
}: {
  program: ProgramTemplate
  progress: ProgressRow
  userId: string
  onEdit: () => void
  onDelete: () => void
}) {
  const diff    = DIFFICULTY_CONFIG[program.difficulty]
  const pct     = progress.completion_percent
  const week    = progress.current_week
  const isOwned = program.author_id === userId

  return (
    <article style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px ${diff.glow}`
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.transform = ''
        ;(e.currentTarget as HTMLElement).style.boxShadow = ''
      }}
    >
      {/* Gradient strip */}
      <div style={{ background: diff.gradient, padding: '14px 16px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', display: 'block', marginBottom: 3 }}>
            {diff.label}
          </span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.3, textShadow: '0 1px 3px rgba(0,0,0,0.25)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {program.title}
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {pct}%
          </span>
          {isOwned && <CardMenu program={program} onEdit={onEdit} onDelete={onDelete} />}
        </div>
      </div>

      {/* Progress bar + meta */}
      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Week {week} of {program.weeks}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{progress.completed_workouts} workouts done</span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.4s ease', boxShadow: '0 0 8px rgba(213,255,95,0.4)' }} />
        </div>
        <Link href={`/programs/${program.slug}`} className="btn btn-primary btn-full" style={{ fontSize: 13 }}>
          Continue Week {week}
        </Link>
      </div>
    </article>
  )
}

// ── Regular program card ──────────────────────────────────────────────────────
function ProgramCard({
  program, progress, userId, onEdit, onDelete,
}: {
  program: ProgramTemplate
  progress?: ProgressRow
  userId: string
  onEdit: () => void
  onDelete: () => void
}) {
  const diff      = DIFFICULTY_CONFIG[program.difficulty]
  const Icon      = getProgramIcon(program)
  const pct       = progress?.completion_percent ?? 0
  const isStarted = !!progress
  const totalEx   = program.workout_days.reduce((acc, d) => acc + d.exercises.length, 0)
  const isOwned   = program.author_id === userId

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
        ;(e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px ${diff.glow}`
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.transform = ''
        ;(e.currentTarget as HTMLElement).style.boxShadow = ''
      }}
    >
      {/* Gradient header */}
      <div style={{
        background: diff.gradient,
        padding: '18px 16px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'inline-block', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.85)', marginBottom: 5,
          }}>
            {diff.label}
            {isOwned && <span style={{ marginLeft: 6, opacity: 0.7 }}>· AI</span>}
          </span>
          <h3 style={{
            margin: 0, fontSize: 15, fontWeight: 700, color: '#fff',
            lineHeight: 1.3, textShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }}>
            {program.title}
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexShrink: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={19} color="#fff" />
          </div>
          {isOwned && (
            <CardMenu program={program} onEdit={onEdit} onDelete={onDelete} />
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {program.description && (
          <p style={{
            margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {program.description}
          </p>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} color="var(--text-muted)" />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              {program.weeks}w
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <BarChart2 size={12} color="var(--text-muted)" />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              {program.workout_days.length}d/cycle
            </span>
          </div>
          {totalEx > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Target size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                {totalEx} ex
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {isStarted && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Wk {progress!.current_week}/{program.weeks}
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
          style={{ marginTop: 'auto', fontSize: 13 }}
        >
          {isStarted ? 'Continue' : 'Start Program'}
          <ChevronRight size={13} />
        </Link>
      </div>
    </article>
  )
}

// ── AI plan placeholder card ───────────────────────────────────────────────────
function AIPlanCard() {
  return (
    <Link
      href="/programs/generate"
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: '28px 16px',
        borderRadius: 16,
        border: '1px dashed var(--border)',
        background: 'var(--bg-card)',
        textDecoration: 'none',
        minHeight: 200,
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
        ;(e.currentTarget as HTMLElement).style.background = 'var(--accent-muted)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLElement).style.background = 'var(--bg-card)'
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'var(--accent-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Zap size={22} color="var(--accent)" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Build custom plan
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          AI-generated, personalized to you
        </p>
      </div>
      <span className="tag tag-lime">Generate with AI</span>
    </Link>
  )
}

// ── Delete confirmation overlay ───────────────────────────────────────────────
function DeleteConfirm({
  program,
  onConfirm,
  onCancel,
}: {
  program: ProgramTemplate
  onConfirm: () => Promise<void>
  onCancel: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await onConfirm()
    setDeleting(false)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: 24,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(255,107,107,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Trash2 size={20} color="var(--danger)" />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          Delete program?
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
          <strong style={{ color: 'var(--text-primary)' }}>{program.title}</strong> and all your progress will be permanently removed.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            style={{ flex: 1 }}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main grid ─────────────────────────────────────────────────────────────────
export default function ProgramGrid({ programs: initialPrograms, progressMap, userId }: Props) {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState<FilterOption>('All')
  const [programs, setPrograms]         = useState(initialPrograms)
  const [editTarget, setEditTarget]     = useState<ProgramTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProgramTemplate | null>(null)

  const inProgress   = programs.filter(p => !!progressMap[p.id])
  const gridPrograms = activeFilter === 'All'
    ? programs
    : programs.filter(p => p.difficulty === activeFilter.toLowerCase())

  async function handleDelete(program: ProgramTemplate) {
    const res = await fetch(`/api/programs/${program.id}`, { method: 'DELETE' })
    if (!res.ok) return
    setPrograms(prev => prev.filter(p => p.id !== program.id))
    setDeleteTarget(null)
    router.refresh()
  }

  async function handleEdit(program: ProgramTemplate, title: string, description: string) {
    const res = await fetch(`/api/programs/${program.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    })
    if (!res.ok) throw new Error('Failed to save')
    const { program: updated } = await res.json() as { program: ProgramTemplate }
    setPrograms(prev => prev.map(p => p.id === updated.id ? updated : p))
    router.refresh()
  }

  if (programs.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <Shield size={40} color="var(--text-muted)" style={{ marginBottom: 14 }} />
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          No programs available
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Update your equipment profile to unlock training programs.
        </p>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 40 }}>

      {/* Filter pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
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

      {/* In Progress */}
      {inProgress.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 12px',
          }}>
            In Progress
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {inProgress.map(p => (
              <InProgressCard
                key={p.id}
                program={p}
                progress={progressMap[p.id]}
                userId={userId}
                onEdit={() => setEditTarget(p)}
                onDelete={() => setDeleteTarget(p)}
              />
            ))}
          </div>
        </section>
      )}

      {/* All Programs */}
      <section>
        <h2 style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 12px',
        }}>
          All Programs
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {gridPrograms.map(p => (
            <ProgramCard
              key={p.id}
              program={p}
              progress={progressMap[p.id]}
              userId={userId}
              onEdit={() => setEditTarget(p)}
              onDelete={() => setDeleteTarget(p)}
            />
          ))}
          <AIPlanCard />
        </div>
      </section>

      {/* Modals */}
      {editTarget && (
        <EditModal
          program={editTarget}
          onSave={(title, desc) => handleEdit(editTarget, title, desc)}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          program={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
