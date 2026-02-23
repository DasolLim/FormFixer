'use client';

import { useEffect, useState } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/Button';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { fetchPlanTier } from '@/lib/workouts/sessions';
import { fetchMyProfile, updateMyProfileSettings } from '@/lib/social/sessions';
import type { PrivacyMode } from '@/lib/social/types';

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const [username, setUsername] = useState('');
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('public');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getSupabaseClient().then((supabase) =>
      supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string; email?: string } | null } }) => {
        if (!data.user) return;
        setUserId(data.user.id);
        setEmail(data.user.email ?? '');
        setTier(await fetchPlanTier(data.user.id));

        const profileResult = await fetchMyProfile(data.user.id);
        if (!profileResult.error && profileResult.data) {
          setUsername(profileResult.data.username ?? '');
          setPrivacyMode(profileResult.data.privacy_mode);
        }
      })
    );
  }, []);

  async function handleSaveSocialSettings() {
    setMessage('');
    if (!userId) return;

    const result = await updateMyProfileSettings({ userId, username, privacyMode });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage('Profile settings updated.');
  }

  return (
    <AuthGate>
      <Section title="Profile" subtitle="Account" description="Account plan and social visibility settings.">
        <Card title="Email" description={email || 'No email available'} />
        <div style={{ marginTop: 12 }}>
          <Card title="Plan" description={tier === 'pro' ? 'Pro' : 'Free'} />
        </div>

        <div style={{ marginTop: 12 }}>
          <Card title="Social Settings" description="Set a unique username and privacy mode.">
            <div style={{ display: 'grid', gap: 10 }}>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username (3-20 chars)"
                style={{ minWidth: 220, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }}
              />
              <select
                value={privacyMode}
                onChange={(e) => setPrivacyMode(e.target.value as PrivacyMode)}
                style={{ width: 220, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }}
              >
                <option value="public">Public (instant friend add)</option>
                <option value="private">Private (request + accept)</option>
              </select>
              <div>
                <Button onClick={handleSaveSocialSettings}>Save Social Settings</Button>
              </div>
              {message ? <p style={{ color: 'var(--muted)', margin: 0 }}>{message}</p> : null}
            </div>
          </Card>
        </div>
      </Section>
    </AuthGate>
  );
}
