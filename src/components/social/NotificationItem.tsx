'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { acceptGymInvite, declineGymInvite } from '@/lib/social/sessions'
import type { NotificationRow } from '@/lib/social/types'

const labelByType: Record<NotificationRow['type'], string> = {
  friend_request_received: 'Friend Request',
  friend_request_accepted: 'Request Accepted',
  gym_invite:              'Gym Invite',
  workout_alert:           'Workout Alert',
}

function GymInviteActions({
  notificationId,
  userId,
  status,
}: {
  notificationId: string
  userId: string
  status: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (status === 'accepted') {
    return (
      <span style={{ color: 'var(--accent)', fontSize: '13px' }}>
        ✓ Accepted — added to calendar
      </span>
    )
  }
  if (status === 'declined') {
    return <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Declined</span>
  }

  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
      <button
        onClick={() =>
          startTransition(async () => {
            await acceptGymInvite(notificationId, userId)
            router.refresh()
          })
        }
        disabled={isPending}
        className="btn btn-primary"
        style={{ fontSize: '13px', padding: '4px 14px', height: 'auto', minHeight: 0 }}
      >
        Accept
      </button>
      <button
        onClick={() =>
          startTransition(async () => {
            await declineGymInvite(notificationId)
            router.refresh()
          })
        }
        disabled={isPending}
        className="btn btn-secondary"
        style={{ fontSize: '13px', padding: '4px 14px', height: 'auto', minHeight: 0 }}
      >
        Decline
      </button>
    </div>
  )
}

export function NotificationItem({
  notification,
  userId,
  onMarkRead,
}: {
  notification: NotificationRow
  userId?: string
  onMarkRead: () => void
}) {
  const isGymInvite = notification.type === 'gym_invite'

  return (
    <Card title={labelByType[notification.type]} description={notification.message}>
      {isGymInvite && notification.invite_date && (
        <p suppressHydrationWarning style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          {new Date(notification.invite_date).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
          {notification.invite_exercise_id && (
            <> · {notification.invite_exercise_id.replace(/_/g, ' ')}</>
          )}
        </p>
      )}

      {isGymInvite && userId && (
        <GymInviteActions
          notificationId={notification.id}
          userId={userId}
          status={notification.invite_status}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span suppressHydrationWarning style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {new Date(notification.created_at).toLocaleString()}
        </span>
        {notification.read_at ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Read</span>
        ) : (
          <Button variant="ghost" onClick={onMarkRead}>
            Mark Read
          </Button>
        )}
      </div>
    </Card>
  )
}
