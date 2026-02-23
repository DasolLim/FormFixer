import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ProfileRow } from '@/lib/social/types';

export function FriendCard({
  profile,
  onNotify
}: {
  profile: ProfileRow;
  onNotify: () => void;
}) {
  return (
    <Card title={profile.username ?? 'Unnamed user'} description={profile.email ?? 'No email'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{profile.privacy_mode === 'private' ? 'Private account' : 'Public account'}</span>
        <Button variant="ghost" onClick={onNotify}>Notify Friend</Button>
      </div>
    </Card>
  );
}
