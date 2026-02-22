'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Section } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { addWorkoutEvent, fetchWorkoutEvents, toggleWorkoutEventCompletion, type WorkoutEventRow } from '@/lib/calendar/sessions';

type FullCalendarComponentProps = {
  plugins: unknown[];
  initialView: string;
  headerToolbar: { left: string; center: string; right: string };
  events: Array<{ id: string; title: string; start: string; allDay: boolean }>;
  selectable?: boolean;
  editable?: boolean;
  dateClick?: (arg: { dateStr: string }) => void;
  eventClick?: (arg: { event: { id: string } }) => void;
  eventContent?: (arg: { timeText: string; event: { title: string } }) => JSX.Element;
  height?: string;
};

type CalendarBundle = {
  CalendarComponent: ComponentType<FullCalendarComponentProps>;
  dayGridPlugin: unknown;
  timeGridPlugin: unknown;
  interactionPlugin: unknown;
};

function normalizeModule(mod: unknown): unknown {
  const candidate = mod as { default?: { default?: unknown } | unknown };
  if (candidate?.default && typeof candidate.default === 'object' && 'default' in candidate.default) {
    return (candidate.default as { default?: unknown }).default ?? candidate.default;
  }
  return candidate?.default ?? mod;
}

function isComponentType(value: unknown): value is ComponentType<FullCalendarComponentProps> {
  if (typeof value === 'function') return true;
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  const looksLikeReactElementObject = '$$typeof' in candidate && 'type' in candidate && 'props' in candidate;
  if (looksLikeReactElementObject) return false;

  return '$$typeof' in candidate || 'render' in candidate;
}

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
  const [calendarBundle, setCalendarBundle] = useState<CalendarBundle | null>(null);

  useEffect(() => {
    const importer = new Function('u', 'return import(/* webpackIgnore: true */ u)') as (url: string) => Promise<unknown>;

    Promise.all([
      importer('https://esm.sh/@fullcalendar/react@6.1.17?bundle'),
      importer('https://esm.sh/@fullcalendar/daygrid@6.1.17?bundle'),
      importer('https://esm.sh/@fullcalendar/timegrid@6.1.17?bundle'),
      importer('https://esm.sh/@fullcalendar/interaction@6.1.17?bundle')
    ])
      .then(([reactMod, dayGridMod, timeGridMod, interactionMod]) => {
        const CalendarComponent = normalizeModule(reactMod);
        const dayGridPlugin = normalizeModule(dayGridMod);
        const timeGridPlugin = normalizeModule(timeGridMod);
        const interactionPlugin = normalizeModule(interactionMod);

        if (!isComponentType(CalendarComponent)) {
          setMessage('Calendar component failed to load. Please refresh.');
          return;
        }

        setCalendarBundle({ CalendarComponent, dayGridPlugin, timeGridPlugin, interactionPlugin });
      })
      .catch(() => setMessage('Calendar failed to load. Check network and refresh.'));
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
        id: String(event.id),
        title: event.is_completed ? `✅ ${toSafeText(event.title, 'Workout')}` : toSafeText(event.title, 'Workout'),
        start: event.scheduled_date,
        allDay: true
      })),
    [events]
  );

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

  function renderEventContent(info: { timeText: string; event: { title: string } }) {
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

  const CalendarComponent = calendarBundle?.CalendarComponent;

  return (
    <Section title="Workout Calendar" subtitle="Planning" description="Schedule workouts and click events to mark sessions complete.">
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
            {CalendarComponent ? (
              <CalendarComponent
                plugins={[calendarBundle.dayGridPlugin, calendarBundle.timeGridPlugin, calendarBundle.interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
                events={calendarEvents}
                selectable
                editable={false}
                dateClick={(arg) => {
                  setScheduledDate(arg.dateStr);
                  setMessage(`Selected ${new Date(arg.dateStr).toDateString()}.`);
                  console.log('dateClick', arg.dateStr);
                }}
                eventClick={(arg) => {
                  const row = events.find((event) => String(event.id) === arg.event.id);
                  if (row) void handleToggleComplete(row);
                }}
                eventContent={renderEventContent}
                height="auto"
              />
            ) : (
              <p style={{ color: 'var(--muted)' }}>Loading calendar...</p>
            )}
          </div>
        </Card>
      </div>

      {message ? <p style={{ color: 'var(--muted)' }}>{message}</p> : null}
    </Section>
  );
}
