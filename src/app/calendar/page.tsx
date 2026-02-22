'use client';

import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Section } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { addWorkoutEvent, fetchWorkoutEvents, toggleWorkoutEventCompletion, type WorkoutEventRow } from '@/lib/calendar/sessions';

function toSafeText(value: unknown, fallback: string) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return fallback;
}

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<WorkoutEventRow[]>([]);
  const [title, setTitle] = useState('Workout Session');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState('');

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
        title: event.is_completed ? `✅ ${toSafeText(event.title, 'Workout')}` : toSafeText(event.title, 'Workout'),
        start: event.scheduled_date,
        allDay: true,
        extendedProps: {
          isCompleted: event.is_completed
        }
      })),
    [events]
  );

  const weekStats = useMemo(() => {
    const now = new Date();
    const first = new Date(now);
    first.setDate(now.getDate() - now.getDay());
    first.setHours(0, 0, 0, 0);

    const last = new Date(first);
    last.setDate(first.getDate() + 6);
    last.setHours(23, 59, 59, 999);

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
    <Section title="Workout Calendar" subtitle="FullCalendar" description="Plan sessions in a real month/week calendar and click events to toggle completion.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Card title="Planned This Week" description={`${weekStats.planned}`} />
        <Card title="Completed This Week" description={`${weekStats.completed}`} />
        <Card title="Consistency" description={weekStats.planned ? `${Math.round((weekStats.completed / weekStats.planned) * 100)}%` : '0%'} />
      </div>

      <Card title="Schedule Workout">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ minWidth: 220, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }}
          />
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }}
          />
          <Button onClick={handleAddEvent}>Add Workout</Button>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title="Calendar View">
          <div className="calendar-shell">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
              events={calendarEvents}
              dateClick={(arg: { dateStr: string }) => {
                setScheduledDate(arg.dateStr);
                setMessage(`Selected ${new Date(arg.dateStr).toDateString()}.`);
              }}
              eventClick={(arg: { event: { id: string } }) => {
                const row = events.find((event) => event.id === arg.event.id);
                if (row) void handleToggleComplete(row);
              }}
              height="auto"
            />
          </div>
          <p style={{ color: 'var(--muted)', marginTop: 8, marginBottom: 0 }}>Tip: click a date to set the schedule input, or click an event to toggle complete/planned.</p>
        </Card>
      </div>

      {message ? <p style={{ color: 'var(--muted)' }}>{message}</p> : null}
    </Section>
  );
}
