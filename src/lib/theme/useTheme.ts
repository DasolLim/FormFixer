'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

export type Theme = 'light' | 'dark' | 'gym';

const THEMES: Theme[] = ['dark', 'light', 'gym'];
const STORAGE_KEY = 'ff-theme';

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'gym') return stored;
  } catch {}
  return 'dark';
}

export function useTheme(userId?: string | null) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const initial = readStoredTheme();
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  async function setTheme(t: Theme) {
    setThemeState(t);
    applyTheme(t);
    if (userId) {
      const supabase = getSupabaseClient();
      await supabase
        .from('profiles')
        .update({ theme_preference: t })
        .eq('id', userId);
    }
  }

  function cycleTheme() {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
  }

  return { theme, setTheme, cycleTheme };
}
