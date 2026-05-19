'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabaseClient } from '../supabaseClient'

export type Theme = 'light' | 'dark' | 'gym'
const THEMES: Theme[] = ['light', 'dark', 'gym']
const STORAGE_KEY = 'formfixer-theme'

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme-changing', '')
  document.documentElement.setAttribute('data-theme', theme)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.removeAttribute('data-theme-changing')
    })
  })
}

export function useTheme(userId?: string) {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'light'
    setThemeState(saved)
    applyTheme(saved)
  }, [])

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme(newTheme)

    if (userId) {
      const supabase = getSupabaseClient()
      await supabase
        .from('profiles')
        .update({ theme_preference: newTheme })
        .eq('id', userId)
    }
  }, [userId])

  const cycleTheme = useCallback(() => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
    setTheme(next)
  }, [theme, setTheme])

  return { theme, setTheme, cycleTheme }
}
