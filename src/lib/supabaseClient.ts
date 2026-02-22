type SupabaseClientLike = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string; email?: string } | null } }>;
    signUp: (args: { email: string; password: string }) => Promise<{ error: { message: string } | null }>;
    signInWithPassword: (args: { email: string; password: string }) => Promise<{ error: { message: string } | null }>;
    signOut: () => Promise<void>;
    onAuthStateChange: (callback: (event: string, session: { user?: { id: string } } | null) => void) => { data: { subscription: { unsubscribe: () => void } } };
  };
  from: (table: string) => any;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cachedClient: SupabaseClientLike | null = null;

export async function getSupabaseClient(): Promise<SupabaseClientLike> {
  if (cachedClient) return cachedClient;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  const dynamicImporter = new Function('u', 'return import(/* webpackIgnore: true */ u)') as (url: string) => Promise<any>;
  const supabaseModule = await dynamicImporter('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

  cachedClient = supabaseModule.createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) as SupabaseClientLike;

  return cachedClient;
}
