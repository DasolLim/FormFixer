import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export function getSupabaseServer() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(cookieStore as any).set(name, value, options)
          } catch {
            // Server Components cannot mutate cookies; middleware handles refresh
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(cookieStore as any).set(name, '', options)
          } catch {
            // Server Components cannot mutate cookies; middleware handles refresh
          }
        },
      },
    }
  )
}
