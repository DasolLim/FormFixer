'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    getSupabaseClient().then((supabase) => supabase.auth.getUser()).then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!mounted) return;
      if (!data.user) {
        router.replace('/login');
        return;
      }
      setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  if (!ready) return <p style={{ color: 'var(--muted)' }}>Checking login...</p>;
  return <>{children}</>;
}
