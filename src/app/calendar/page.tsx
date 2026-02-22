'use client';

import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { type DateClickArg, type EventClickArg } from '@fullcalendar/interaction';
import type { EventContentArg, EventInput } from '@fullcalendar/core';
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

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      events.map((event) => ({
        id: String(event.id),
        title: event.is_completed ? `✅ ${toSafeText(event.title, 'Workout')}` : toSafeText(event.title, 'Workout'),
        start: event.scheduled_date,
        allDay: true
      })),
    [events]
  );

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

  function handleDateClick(arg: DateClickArg) {
    setScheduledDate(arg.dateStr);
    setMessage(`Selected ${new Date(arg.dateStr).toDateString()}.`);
    console.log('dateClick', arg.dateStr);
  }

  function handleEventClick(arg: EventClickArg) {
    const row = events.find((event) => String(event.id) === arg.event.id);
    if (row) void handleToggleComplete(row);
  }

  function renderEventContent(info: EventContentArg) {
    // Debug only:
    // console.log('calendarEvents', calendarEvents);
    // console.log('eventContent info', info);

    const safeTime = toSafeText(info.timeText, '');
    const safeTitle = toSafeText(info.event.title, 'Workout');

    return (
      <div>
        {safeTime ? <b>{safeTime}</b> : null}
        <i style={{ marginLeft: safeTime ? 6 : 0 }}>{safeTitle}</i>
      </div>
    );
  }

  return (
    <Section title="Workout Calendar" subtitle="Planning" description="Schedule workouts and click events to mark sessions complete.">
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
              selectable
              editable={false}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventContent={renderEventContent}
              height="auto"
            />
          </div>
        </Card>
      </div>

      {message ? <p style={{ color: 'var(--muted)' }}>{message}</p> : null}
    </Section>
  );
}
