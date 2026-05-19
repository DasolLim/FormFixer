'use client';

import { useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { addWorkoutEvent, fetchWorkoutEvents, toggleWorkoutEventCompletion, type WorkoutEventRow } from '@/lib/calendar/sessions';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

type Props = {
  initialUnavailableDays: number[];
};

export default function CalendarClient({ initialUnavailableDays }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<WorkoutEventRow[]>([]);
  const [title, setTitle] = useState('Workout Session');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState('');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [unavailableDays, setUnavailableDays] = useState<Set<number>>(new Set(initialUnavailableDays));
  const [scheduleGenerating, setScheduleGenerating] = useState(false);
  const [savingUnavailable, setSavingUnavailable] = useState(false);

  async function loadEvents(currentUserId: string) {
    const result = await fetchWorkoutEvents(currentUserId);
    if (!result.error) setEvents(result.data);
  }

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      await loadEvents(data.user.id);
    })();
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

  async function toggleUnavailableDay(dayIndex: number) {
    if (!userId) return;
    const next = new Set(unavailableDays);
    if (next.has(dayIndex)) {
      next.delete(dayIndex);
    } else {
      next.add(dayIndex);
    }
    setUnavailableDays(next);
    setSavingUnavailable(true);
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('profiles')
        .update({ unavailable_days: Array.from(next) as unknown as import('@/lib/database.types').Json })
        .eq('id', userId);
    } finally {
      setSavingUnavailable(false);
    }
  }

  async function handleGenerateSchedule() {
    if (!userId) { setMessage('Login required.'); return; }
    setScheduleGenerating(true);
    setMessage('');
    try {
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unavailableDays: Array.from(unavailableDays), weeksAhead: 4 }),
      });
      const json = await res.json() as { count?: number; error?: string };
      if (!res.ok || json.error) {
        setMessage(json.error ?? 'Schedule generation failed');
        return;
      }
      setMessage(`Generated ${json.count ?? 0} workout events.`);
      await loadEvents(userId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error');
    } finally {
      setScheduleGenerating(false);
    }
  }

  function goPrevMonth() {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goNextMonth() {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  return (
    <Section title="Workout Calendar" subtitle="Smart Calendar" description="Schedule workouts manually or use AI to generate a smart schedule based on your programs.">

      {/* Unavailable days */}
      <Card title="Unavailable Days">
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 10 }}>
          Mark days you cannot train. These will be skipped when generating your schedule.
          {savingUnavailable && ' Saving...'}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FULL_DAY_NAMES.map((name, i) => {
            const blocked = unavailableDays.has(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => void toggleUnavailableDay(i)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: `1px solid ${blocked ? 'var(--color-warn)' : 'var(--border)'}`,
                  background: blocked ? 'rgba(239,68,68,0.12)' : 'var(--surface)',
                  color: blocked ? 'var(--color-warn)' : 'var(--text)',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                {name}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Smart schedule */}
      <Card title="Generate Smart Schedule">
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 10 }}>
          AI will generate 4 weeks of workout events based on your active programs and availability.
        </p>
        <Button onClick={() => void handleGenerateSchedule()} disabled={scheduleGenerating}>
          {scheduleGenerating ? 'Generating...' : 'Generate 4-Week Schedule'}
        </Button>
      </Card>

      {/* Manual schedule */}
      <Card title="Schedule Workout">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ minWidth: 220, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }}
          />
          <input
            type="date"
            value={scheduledDate}
            onChange={e => setScheduledDate(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }}
          />
          <Button onClick={() => void handleAddEvent()}>Add Workout</Button>
        </div>
      </Card>

      {/* Calendar view */}
      <div style={{ marginTop: 16 }}>
        <Card title="Calendar View">
          <div className="calendar-shell">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Button variant="ghost" onClick={goPrevMonth}>Prev</Button>
              <strong>{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>
              <Button variant="ghost" onClick={goNextMonth}>Next</Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginBottom: 8, color: 'var(--muted)' }}>
              {DAY_NAMES.map(label => (
                <div key={label} style={{ textAlign: 'center', fontSize: 12 }}>{label}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
              {monthDays.map(day => {
                const key = toDateKey(day);
                const dayEvents = eventsByDate.get(key) ?? [];
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isSelected = key === scheduledDate;
                const dayOfWeek = day.getDay();
                const isUnavailable = unavailableDays.has(dayOfWeek);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setScheduledDate(key)}
                    style={{
                      minHeight: 100,
                      borderRadius: 10,
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: isUnavailable
                        ? 'rgba(239,68,68,0.05)'
                        : isCurrentMonth ? '#0d1629' : '#0a1222',
                      color: isCurrentMonth ? 'var(--text)' : 'var(--muted)',
                      textAlign: 'left',
                      padding: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{day.getDate()}</span>
                      {isUnavailable && <span style={{ fontSize: 10, color: 'var(--color-warn)' }}>off</span>}
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {dayEvents.slice(0, 2).map(event => (
                        <span
                          key={event.id}
                          onClick={e => { e.stopPropagation(); void handleToggleComplete(event); }}
                          style={{
                            display: 'block',
                            fontSize: 11,
                            borderRadius: 6,
                            padding: '2px 6px',
                            background: event.is_completed ? 'rgba(77,226,197,0.25)' : 'rgba(79,124,255,0.25)',
                          }}
                        >
                          {event.is_completed ? '✅ ' : ''}
                          {toSafeText(event.title, 'Workout')}
                        </span>
                      ))}
                      {dayEvents.length > 2 ? (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>+{dayEvents.length - 2} more</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {message ? <p style={{ color: 'var(--muted)', marginTop: 8 }}>{message}</p> : null}
    </Section>
  );
}
