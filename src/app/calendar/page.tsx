'use client';

import { useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { addWorkoutEvent, fetchWorkoutEvents, toggleWorkoutEventCompletion, type WorkoutEventRow } from '@/lib/calendar/sessions';

function toSafeText(value: unknown, fallback: string) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return fallback;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildMonthGrid(current: Date) {
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
  const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const days: Date[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<WorkoutEventRow[]>([]);
  const [title, setTitle] = useState('Workout Session');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState('');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

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

  const eventsByDate = useMemo(() => {
    const map = new Map<string, WorkoutEventRow[]>();
    for (const event of events) {
      const key = event.scheduled_date;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const monthDays = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

  async function handleToggleComplete(row: WorkoutEventRow) {
    const result = await toggleWorkoutEventCompletion(row.id, !row.is_completed);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (userId) await loadEvents(userId);
  }

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

  function goPrevMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goNextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  return (
    <Section title="Workout Calendar" subtitle="Manual Calendar" description="Simple built-in calendar: click a day to schedule and click an event to toggle completion.">
      <Card title="Schedule Workout">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ minWidth: 220, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
          <Button onClick={handleAddEvent}>Add Workout</Button>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title="Calendar View">
          <div className="calendar-shell">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Button variant="ghost" onClick={goPrevMonth}>Prev</Button>
              <strong>{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>
              <Button variant="ghost" onClick={goNextMonth}>Next</Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginBottom: 8, color: 'var(--muted)' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                <div key={label} style={{ textAlign: 'center', fontSize: 12 }}>{label}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
              {monthDays.map((day) => {
                const key = toDateKey(day);
                const dayEvents = eventsByDate.get(key) ?? [];
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isSelected = key === scheduledDate;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setScheduledDate(key)}
                    style={{
                      minHeight: 100,
                      borderRadius: 10,
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: isCurrentMonth ? '#0d1629' : '#0a1222',
                      color: isCurrentMonth ? 'var(--text)' : 'var(--muted)',
                      textAlign: 'left',
                      padding: 8,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontSize: 12, marginBottom: 6 }}>{day.getDate()}</div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {dayEvents.slice(0, 2).map((event) => (
                        <span
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleComplete(event);
                          }}
                          style={{
                            display: 'block',
                            fontSize: 11,
                            borderRadius: 6,
                            padding: '2px 6px',
                            background: event.is_completed ? 'rgba(77,226,197,0.25)' : 'rgba(79,124,255,0.25)'
                          }}
                        >
                          {event.is_completed ? '✅ ' : ''}
                          {toSafeText(event.title, 'Workout')}
                        </span>
                      ))}
                      {dayEvents.length > 2 ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>+{dayEvents.length - 2} more</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {message ? <p style={{ color: 'var(--muted)' }}>{message}</p> : null}
    </Section>
  );
}
