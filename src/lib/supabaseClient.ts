'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

// Synchronous — safe to use with `await getSupabaseClient()` for backwards compat
export function getSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
