'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import type { PRCheckResult } from '@/lib/workouts/records'

type Props = { result: PRCheckResult }

export default function PRBadge({ result }: Props) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(t)
  }, [])

  if (!result.newPR || !visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="New personal record achieved"
      style={{
        position: 'absolute',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--accent)',
        color: 'var(--text-on-lime)',
        padding: '0.75rem 1.5rem',
        borderRadius: '999px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontWeight: 600,
        fontSize: '15px',
        animation: 'pr-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        zIndex: 100,
        whiteSpace: 'nowrap',
      }}
    >
      <Trophy size={18} aria-hidden="true" />
      New PR! {result.metrics.map((m) => m.metric.replace('_', ' ')).join(' · ')}
      <style>{`
        @keyframes pr-pop {
          from { transform: translateX(-50%) scale(0.7); opacity: 0; }
          to   { transform: translateX(-50%) scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}
