'use client';

import { useEffect, useState } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { fetchWorkoutSessions } from '@/lib/workouts/sessions';
import type { WorkoutSessionRow } from '@/lib/workouts/types';

export default function DashboardPage() {
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupabaseClient().then((supabase) =>
      supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
        if (!data.user) {
          setLoading(false);
          return;
        }

        const result = await fetchWorkoutSessions(data.user.id);
        if (result.error) {
          setError(result.error.message);
        } else {
          setSessions(result.data);
        }
        setLoading(false);
      })
    );
  }, []);

  const totalReps = sessions.reduce((sum, session) => sum + session.rep_count, 0);

  return (
    <AuthGate>
      <Section title="Dashboard" subtitle="History" description="Your saved workout sessions.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
          <Card title="Sessions" description={`${sessions.length}`} />
          <Card title="Total Reps" description={`${totalReps}`} />
        </div>

        {loading ? <p style={{ color: 'var(--muted)' }}>Loading sessions...</p> : null}
        {error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {sessions.map((session) => (
            <Card
              key={session.id}
              title={`${session.exercise_type.toUpperCase()} · ${session.rep_count} reps`}
              description={`${new Date(session.created_at).toLocaleString()} · Score ${session.form_score}`}
            >
              <p style={{ margin: 0, color: 'var(--muted)' }}>{session.form_summary}</p>
            </Card>
          ))}
          {!loading && sessions.length === 0 ? <Card title="No sessions yet" description="Complete a workout on the camera page and save it." /> : null}
        </div>
      </Section>
    </AuthGate>
  );
}
