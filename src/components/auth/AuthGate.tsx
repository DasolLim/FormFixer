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
    const timeout = window.setTimeout(() => {
      if (!mounted) return;
      setError('Session check timed out. Please refresh or log in again.');
    }, 8000);

    getSupabaseClient()
      .then((supabase) => supabase.auth.getUser())
      .then(({ data }: { data: { user: { id: string } | null } }) => {
        if (!mounted) return;
        window.clearTimeout(timeout);

        if (!data.user) {
          router.replace('/login');
          return;
        }

        setReady(true);
      })
      .catch((err) => {
        if (!mounted) return;
        window.clearTimeout(timeout);
        setError(err instanceof Error ? err.message : 'Unable to verify login session.');
      });

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [router]);

  if (error) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
        <button
          type="button"
          onClick={() => window.location.assign('/login')}
          style={{ width: 'fit-content', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }}
        >
          Go to login
        </button>
      </div>
    );
  }

  if (!ready) return <p style={{ color: 'var(--muted)' }}>Checking login...</p>;
  return <>{children}</>;
}
