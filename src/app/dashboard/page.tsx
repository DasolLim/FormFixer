'use client';

import { useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { fetchWorkoutSessions } from '@/lib/workouts/sessions';
import type { WorkoutSessionRow } from '@/lib/workouts/types';
import { fetchProgramProgress, type ProgramProgressRow } from '@/lib/programs/sessions';
import { fetchDailyMealItems } from '@/lib/nutrition/sessions';

export default function DashboardPage() {
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([]);
  const [programs, setPrograms] = useState<ProgramProgressRow[]>([]);
  const [dailyCalories, setDailyCalories] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupabaseClient().then((supabase) =>
      supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
        if (!data.user) {
          setLoading(false);
          return;
        }

        const [sessionResult, programResult, mealResult] = await Promise.all([
          fetchWorkoutSessions(data.user.id),
          fetchProgramProgress(data.user.id),
          fetchDailyMealItems(data.user.id, new Date().toISOString().slice(0, 10))
        ]);

        if (sessionResult.error) setError(sessionResult.error.message);
        else setSessions(sessionResult.data);

        if (!programResult.error) setPrograms(programResult.data);
        if (!mealResult.error) setDailyCalories(mealResult.data.reduce((sum, item) => sum + item.calories, 0));

        setLoading(false);
      })
    );
  }, []);

  const totalReps = useMemo(() => sessions.reduce((sum, session) => sum + session.rep_count, 0), [sessions]);
  const activeProgram = programs[0];

  return (
    <AuthGate>
      <Section title="Dashboard" subtitle="Platform Overview" description="Your training, program, and nutrition progress in one place.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
          <Card title="Workout Sessions" description={`${sessions.length}`} />
          <Card title="Total Reps" description={`${totalReps}`} />
          <Card title="Today's Calories" description={`${Math.round(dailyCalories)}`} />
          <Card
            title="Active Program"
            description={activeProgram ? `${activeProgram.program_slug} · ${activeProgram.completion_percent}%` : 'No program started'}
          />
        </div>

        {loading ? <p style={{ color: 'var(--muted)' }}>Loading dashboard...</p> : null}
        {error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}

        {activeProgram ? (
          <div style={{ marginBottom: 12 }}>
            <Card
              title="Program Progress"
              description={`Week ${activeProgram.current_week} · ${activeProgram.completed_workouts}/${activeProgram.total_workouts} workouts complete`}
            />
          </div>
        ) : null}

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
