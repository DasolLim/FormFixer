'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();

  const verifySession = useCallback(async () => {
    setIsChecking(true);
    setError('');

    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Session check timed out. Please refresh or log in again.')), 12000);
    });

    try {
      const supabase = await getSupabaseClient();
      const result = (await Promise.race([supabase.auth.getUser(), timeoutPromise])) as { data: { user: { id: string } | null } };

      if (!result.data.user) {
        router.replace('/login');
        return;
      }

      setReady(true);
    } catch (err) {
      setReady(false);
      setError(err instanceof Error ? err.message : 'Unable to verify login session.');
    } finally {
      setIsChecking(false);
    }
  }, [router]);

  useEffect(() => {
    void verifySession();
  }, [verifySession]);

  if (error) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void verifySession()}
            style={{ width: 'fit-content', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }}
          >
            Retry session check
          </button>
          <button
            type="button"
            onClick={() => window.location.assign('/login')}
            style={{ width: 'fit-content', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }}
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  if (!ready || isChecking) return <p style={{ color: 'var(--muted)' }}>Checking login...</p>;
  return <>{children}</>;
}
