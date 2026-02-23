'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Section } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getProgramBySlug } from '@/lib/programs/catalog';
import { assignProgram, fetchProgramProgress, markProgramWorkoutComplete } from '@/lib/programs/sessions';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function ProgramDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const program = getProgramBySlug(slug);

  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [progressId, setProgressId] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [completedWorkouts, setCompletedWorkouts] = useState(0);
  const [currentWeek, setCurrentWeek] = useState(1);

  useEffect(() => {
    getSupabaseClient().then((supabase) =>
      supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
        if (!data.user || !program) return;
        setUserId(data.user.id);
        const progress = await fetchProgramProgress(data.user.id);
        const active = progress.data.find((item) => item.program_slug === program.slug);
        if (!active) return;
        setProgressId(active.id);
        setProgressPercent(active.completion_percent);
        setCompletedWorkouts(active.completed_workouts);
        setCurrentWeek(active.current_week);
      })
    );
  }, [program]);

  if (!program) {
    return (
      <Section title="Program not found" subtitle="Error" description="The requested program does not exist.">
        <Card description="Go back to program library and choose another program." />
      </Section>
    );
  }

  const programData = program;

  async function handleStartProgram() {
    if (!userId) {
      setMessage('Login required before assigning a program.');
      return;
    }

    const totalWorkouts = programData.days.length * programData.durationWeeks;
    const result = await assignProgram(userId, programData.slug, totalWorkouts);
    setMessage(result.error ? result.error.message : 'Program assigned. Progress started at Week 1.');

    const progress = await fetchProgramProgress(userId);
    const active = progress.data.find((item) => item.program_slug === programData.slug);
    if (active) {
      setProgressId(active.id);
      setProgressPercent(active.completion_percent);
      setCompletedWorkouts(active.completed_workouts);
      setCurrentWeek(active.current_week);
    }
  }

  async function handleMarkWorkoutDone() {
    if (!progressId) {
      setMessage('Start program first to track progress.');
      return;
    }

    const result = await markProgramWorkoutComplete(progressId);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage('Workout marked complete.');
    if (userId) {
      const progress = await fetchProgramProgress(userId);
      const active = progress.data.find((item) => item.program_slug === programData.slug);
      if (active) {
        setProgressPercent(active.completion_percent);
        setCompletedWorkouts(active.completed_workouts);
        setCurrentWeek(active.current_week);
      }
    }
  }

  return (
    <Section title={programData.title} subtitle="Program Details" description={programData.description}>
      <Card>
        <p style={{ color: 'var(--muted)' }}>
          {programData.difficulty} · {programData.durationWeeks} weeks · Coach {programData.coachName}
        </p>
        <p style={{ color: 'var(--muted)' }}>Structure: {programData.structure}</p>
        <p style={{ color: 'var(--muted)' }}>Exercises: {programData.exercises.join(', ')}</p>
      </Card>

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {programData.days.map((day) => (
          <Card key={day.dayNumber} title={`${day.title}`} description={day.workoutFocus} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <Button onClick={handleStartProgram}>Start Program</Button>
        <Button variant="ghost" onClick={handleMarkWorkoutDone}>
          Mark Workout Complete
        </Button>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <Card title="Current Week" description={`${currentWeek}`} />
        <Card title="Completed Workouts" description={`${completedWorkouts}`} />
        <Card title="Completion" description={`${progressPercent}%`} />
      </div>

      {message ? <p style={{ color: 'var(--muted)' }}>{message}</p> : null}
    </Section>
  );
}
