'use client';

import { useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useXPStore } from '@/store/xpStore';

async function loadXPFromDB(userId: string) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('profiles')
    .select('xp_total, xp_level')
    .eq('id', userId)
    .single();
  if (data) {
    useXPStore.getState().init(data.xp_total ?? 0, data.xp_level ?? 1);
  }
}

export function XPProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = getSupabaseClient();

    // Load for any session already active on mount
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) loadXPFromDB(data.user.id);
    });

    // Re-hydrate on every sign-in; reset on sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        loadXPFromDB(session.user.id);
      }
      if (event === 'SIGNED_OUT') {
        useXPStore.getState().init(0, 1);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
