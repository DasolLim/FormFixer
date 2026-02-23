import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { NotificationRow } from '@/lib/social/types';

const labelByType: Record<NotificationRow['type'], string> = {
  friend_request_received: 'Friend Request',
  friend_request_accepted: 'Request Accepted',
  gym_invite: 'Gym Invite'
};

export function NotificationItem({
  notification,
  onMarkRead
}: {
  notification: NotificationRow;
  onMarkRead: () => void;
}) {
  return (
    <Card title={labelByType[notification.type]} description={notification.message}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(notification.created_at).toLocaleString()}</span>
        {notification.read_at ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>Read</span> : <Button variant="ghost" onClick={onMarkRead}>Mark Read</Button>}
      </div>
    </Card>
  );
}
