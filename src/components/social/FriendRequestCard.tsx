import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ProfileRow } from '@/lib/social/types';

export function FriendRequestCard({
  requester,
  onAccept,
  onDecline,
  disabled = false
}: {
  requester: ProfileRow | null;
  onAccept: () => void;
  onDecline: () => void;
  disabled?: boolean;
}) {
  return (
    <Card title={requester?.username ?? 'Unknown user'} description={requester?.email ?? 'No email'}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={onAccept} disabled={disabled}>Accept</Button>
        <Button variant="ghost" onClick={onDecline} disabled={disabled}>Decline</Button>
      </div>
    </Card>
  );
}
