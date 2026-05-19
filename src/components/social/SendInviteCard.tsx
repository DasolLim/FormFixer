'use client'

import { useState, useTransition } from 'react'
import { sendGymInvite } from '@/lib/social/sessions'
import { EXERCISE_IDS } from '@/features/form-engine/engine-factory'
import { getExerciseConfig } from '@/features/form-engine/exercise-config'

type Props = {
  actorId: string
  targetId: string
  targetUsername: string
  onSent: () => void
}

export default function SendInviteCard({ actorId, targetId, targetUsername, onSent }: Props) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().split('T')[0]

  const [date, setDate] = useState(defaultDate)
  const [exerciseId, setExerciseId] = useState<string>(EXERCISE_IDS[0])
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSend() {
    startTransition(async () => {
      await sendGymInvite({ actorId, targetId, inviteDate: date, exerciseId, message })
      onSent()
    })
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <h3 style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
        Invite {targetUsername} to work out
      </h3>

      <label className="field-group">
        <span>Date</span>
        <input
          type="date"
          value={date}
          min={defaultDate}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <label className="field-group">
        <span>Exercise</span>
        <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
          {EXERCISE_IDS.map((id) => (
            <option key={id} value={id}>
              {getExerciseConfig(id).name}
            </option>
          ))}
        </select>
      </label>

      <label className="field-group">
        <span>Message (optional)</span>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Let's get it!"
          maxLength={120}
        />
      </label>

      <button onClick={handleSend} disabled={isPending} className="btn btn-primary btn-full">
        {isPending ? 'Sending…' : 'Send invite →'}
      </button>
    </div>
  )
}
