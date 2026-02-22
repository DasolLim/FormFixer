'use client';

import { useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { addWorkoutEvent, fetchWorkoutEvents, toggleWorkoutEventCompletion, type WorkoutEventRow } from '@/lib/calendar/sessions';

type CalendarBundle = {
  CalendarComponent: any;
  dayGridPlugin: any;
  timeGridPlugin: any;
  interactionPlugin: any;
};

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<WorkoutEventRow[]>([]);
  const [title, setTitle] = useState('Workout Session');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState('');
  const [calendarBundle, setCalendarBundle] = useState<CalendarBundle | null>(null);

  useEffect(() => {
    const importer = new Function('u', 'return import(/* webpackIgnore: true */ u)') as (url: string) => Promise<any>;
    Promise.all([
      importer('https://esm.sh/@fullcalendar/react@6.1.17'),
      importer('https://esm.sh/@fullcalendar/daygrid@6.1.17'),
      importer('https://esm.sh/@fullcalendar/timegrid@6.1.17'),
      importer('https://esm.sh/@fullcalendar/interaction@6.1.17')
    ]).then(([reactMod, dayGridMod, timeGridMod, interactionMod]) => {
      setCalendarBundle({
        CalendarComponent: reactMod.default,
        dayGridPlugin: dayGridMod.default,
        timeGridPlugin: timeGridMod.default,
        interactionPlugin: interactionMod.default
      });
    });
  }, []);

  async function loadEvents(currentUserId: string) {
    const result = await fetchWorkoutEvents(currentUserId);
    if (!result.error) setEvents(result.data);
  }

  useEffect(() => {
    getSupabaseClient().then((supabase) =>
      supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
        if (!data.user) return;
        setUserId(data.user.id);
        await loadEvents(data.user.id);
      })
    );
  }, []);

  const calendarEvents = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.is_completed ? `✅ ${event.title}` : event.title,
        start: event.scheduled_date
      })),
    [events]
  );

  const weekStats = useMemo(() => {
    const now = new Date();
    const first = new Date(now);
    first.setDate(now.getDate() - now.getDay());
    const last = new Date(first);
    last.setDate(first.getDate() + 6);

    const weekly = events.filter((event) => {
      const day = new Date(event.scheduled_date);
      return day >= first && day <= last;
    });

    const completed = weekly.filter((event) => event.is_completed).length;
    return { planned: weekly.length, completed };
  }, [events]);

  async function handleAddEvent() {
    setMessage('');
    if (!userId) {
      setMessage('Login required to schedule workouts.');
      return;
    }

    const result = await addWorkoutEvent({ userId, title, scheduledDate });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage('Workout scheduled.');
    await loadEvents(userId);
  }

  async function handleToggleComplete(row: WorkoutEventRow) {
    const result = await toggleWorkoutEventCompletion(row.id, !row.is_completed);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (userId) await loadEvents(userId);
  }

  return (
    <Section title="Workout Calendar" subtitle="Planning" description="Schedule workouts, view monthly/weekly plan, and mark sessions complete.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Card title="Planned This Week" description={`${weekStats.planned}`} />
        <Card title="Completed This Week" description={`${weekStats.completed}`} />
        <Card title="Consistency" description={weekStats.planned ? `${Math.round((weekStats.completed / weekStats.planned) * 100)}%` : '0%'} />
      </div>

      <Card title="Schedule Workout">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ minWidth: 200, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
          <Button onClick={handleAddEvent}>Add</Button>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title="Calendar View">
          {calendarBundle ? (
            <calendarBundle.CalendarComponent
              plugins={[calendarBundle.dayGridPlugin, calendarBundle.timeGridPlugin, calendarBundle.interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
              events={calendarEvents}
              height="auto"
            />
          ) : (
            <p style={{ color: 'var(--muted)' }}>Loading calendar...</p>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        {events.map((event) => (
          <Card key={event.id} title={event.title} description={`${new Date(event.scheduled_date).toDateString()} · ${event.is_completed ? 'Completed' : 'Planned'}`}>
            <Button variant="ghost" onClick={() => handleToggleComplete(event)}>
              {event.is_completed ? 'Mark Planned' : 'Mark Complete'}
            </Button>
          </Card>
        ))}
      </div>

      {message ? <p style={{ color: 'var(--muted)' }}>{message}</p> : null}
    </Section>
  );
}
