'use client';

import { useEffect, useState } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { NotificationItem } from '@/components/social/NotificationItem';
import { Card } from '@/components/ui/Card';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { fetchNotifications, markNotificationRead } from '@/lib/social/sessions';
import type { NotificationRow } from '@/lib/social/types';
import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [message, setMessage] = useState('');

  async function load(currentUserId: string) {
    const result = await fetchNotifications(currentUserId);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setNotifications(result.data);
  }

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      await load(data.user.id);
    })();
  }, []);

  async function handleMarkRead(notificationId: string) {
    const result = await markNotificationRead(notificationId);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (userId) await load(userId);
  }

  return (
    <AuthGate>
      <div className="ui-section">
        <div className="desktop-centered-col">
          {notifications.length ? (
          <Card title="Notifications">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={() => handleMarkRead(notification.id)}
                />
              ))}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={24} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>All caught up</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>No notifications yet.</p>
          </div>
        )}
          {message && <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{message}</p>}
        </div>
      </div>
    </AuthGate>
  );
}
