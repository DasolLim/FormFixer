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

  return <CalendarClient initialUnavailableDays={unavailableDays} />;
}
