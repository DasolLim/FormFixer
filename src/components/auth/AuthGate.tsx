'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    getSupabaseClient()
      .then((supabase) => supabase.auth.getUser())
      .then(({ data }: { data: { user: { id: string } | null } }) => {
        if (!mounted) return;
        if (!data.user) {
          router.replace('/login');
          return;
        }
        setReady(true);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unable to verify login session.');
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  if (error) return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  if (!ready) return <p style={{ color: 'var(--muted)' }}>Checking login...</p>;
  return <>{children}</>;
}
