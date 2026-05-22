import { getSupabaseServer } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import CalendarClient from './CalendarClient';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('unavailable_days')
    .eq('id', user.id)
    .single();

  const unavailableDays = (profile?.unavailable_days as number[] | null) ?? [];

  const { data: programRows } = await supabase
    .from('programs')
    .select('id, slug, title')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false });

  const programs = (programRows ?? []).map(p => ({
    id: p.id as string,
    slug: p.slug as string,
    title: (p.title ?? p.slug) as string,
  }));

  return <CalendarClient initialUnavailableDays={unavailableDays} programs={programs} />;
}
