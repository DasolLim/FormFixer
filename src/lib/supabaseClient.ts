const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep this non-throwing in v0 so placeholder pages still run.
  console.warn('Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}

type QueryOptions = {
  table: string;
  select?: string;
  limit?: number;
};

/**
 * Minimal Supabase REST helper for v0 setup.
 * Swap this to `@supabase/supabase-js` client in v1 if preferred.
 */
export async function testSupabaseConnection({ table, select = '*', limit = 1 }: QueryOptions) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { data: null, error: 'Missing Supabase environment variables.' };
  }

  const url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${limit}`;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return { data: null, error: data };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Connection test pattern (optional for v0):
// const { data, error } = await testSupabaseConnection({ table: 'profiles' });
// console.log({ data, error });
