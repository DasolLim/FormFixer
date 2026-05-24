import { getSupabaseServer } from '@/lib/supabaseServer';
import { ProgressClient } from './ProgressClient';

export default async function ProgressPage() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="ui-section" style={{ maxWidth: 480, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Sign in to view your progress.</p>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('weight_unit')
    .eq('id', user.id)
    .single();

  return (
    <ProgressClient
      userId={user.id}
      defaultWeightUnit={(profile?.weight_unit as 'kg' | 'lb') ?? 'kg'}
    />
  );
}
