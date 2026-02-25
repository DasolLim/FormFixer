'use client';

import { useEffect, useState } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { Section } from '@/components/layout/Section';
import { NotificationItem } from '@/components/social/NotificationItem';
import { Card } from '@/components/ui/Card';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { fetchNotifications, markNotificationRead } from '@/lib/social/sessions';
import type { NotificationRow } from '@/lib/social/types';

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
    getSupabaseClient().then((supabase) =>
      supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
        if (!data.user) return;
        setUserId(data.user.id);
        await load(data.user.id);
      })
    );
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
      <Section title="Notifications" subtitle="Social" description="Friend requests, accepted requests, and gym invites.">
        <div style={{ display: 'grid', gap: 10 }}>
          {notifications.length ? (
            notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onMarkRead={() => handleMarkRead(notification.id)} />
            ))
          ) : (
            <Card title="All caught up" description="No notifications yet." />
          )}
        </div>
        {message ? <p style={{ color: 'var(--muted)' }}>{message}</p> : null}
      </Section>
    </AuthGate>
  );
}
