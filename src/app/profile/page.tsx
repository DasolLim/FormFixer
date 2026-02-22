'use client';

import { useEffect, useState } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { fetchPlanTier } from '@/lib/workouts/sessions';

export default function ProfilePage() {
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<'free' | 'pro'>('free');

  useEffect(() => {
    getSupabaseClient().then((supabase) =>
      supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string; email?: string } | null } }) => {
        if (!data.user) return;
        setEmail(data.user.email ?? '');
        setTier(await fetchPlanTier(data.user.id));
      })
    );
  }, []);

  return (
    <AuthGate>
      <Section title="Profile" subtitle="Account" description="Your account and current plan status.">
        <Card title="Email" description={email || 'No email available'} />
        <div style={{ marginTop: 12 }}>
          <Card title="Plan" description={tier === 'pro' ? 'Pro' : 'Free'} />
        </div>
      </Section>
    </AuthGate>
  );
}
