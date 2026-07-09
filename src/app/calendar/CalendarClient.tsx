'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import {
  addWorkoutEvent,
  addBulkWorkoutEvents,
  deleteWorkoutEvent,
  fetchWorkoutEvents,
  toggleWorkoutEventCompletion,
  updateWorkoutEvent,
  type WorkoutEventRow,
} from '@/lib/calendar/sessions';
import { ChevronLeft, ChevronRight, X, Check, Pencil, Trash2, Bell, Plus, Repeat } from 'lucide-react';

const DAY_ABBR  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toDateKey(d: Date) { return d.toISOString().slice(0, 10); }

function isToday(dateKey: string) { return dateKey === toDateKey(new Date()); }

function buildGrid(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end   = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const grid: Date[] = [];
  const cursor = new Date(start);
  cursor.setDate(1 - start.getDay());
  while (cursor <= end || grid.length % 7 !== 0) {
    grid.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
    if (grid.length > 42) break;
  }
  return grid;
}

// Recurring workout: build list of all dates in the current month that fall on `dayOfWeek`,
// starting from the current week (not past weeks of the month).
function buildRecurringDates(month: Date, dayOfWeek: number): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd   = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  // Find first occurrence >= today and >= monthStart, on that dayOfWeek
  const startFrom = monthStart < today ? today : monthStart;
  // Move to the start of the week containing startFrom
  const weekStart = new Date(startFrom);
  weekStart.setDate(startFrom.getDate() - startFrom.getDay());

  const dates: string[] = [];
  const cursor = new Date(weekStart);
  cursor.setDate(cursor.getDate() + dayOfWeek); // first occurrence of dayOfWeek in that week
  while (cursor <= monthEnd) {
    if (cursor >= today && cursor >= monthStart) {
      dates.push(toDateKey(cursor));
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

type Props = {
  initialUnavailableDays: number[];
  programs?: Array<{ id: string; slug: string; title: string }>;
};

type ModalMode = 'day' | 'add' | 'edit' | 'recurring' | 'notify';

export default function CalendarClient({ initialUnavailableDays, programs = [] }: Props) {
  const [userId, setUserId]             = useState<string | null>(null);
  const [events, setEvents]             = useState<WorkoutEventRow[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [unavailableDays, setUnavailableDays] = useState<Set<number>>(new Set(initialUnavailableDays));
  const [savingUnavail, setSavingUnavail] = useState(false);

  // Selected date and modal
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modal, setModal]               = useState<ModalMode | null>(null);

  // Add form
  const [addTitle, setAddTitle]         = useState('Workout Session');
  const [addNotes, setAddNotes]         = useState('');
  const [addDate, setAddDate]           = useState(toDateKey(new Date()));

  // Edit form
  const [editEvent, setEditEvent]       = useState<WorkoutEventRow | null>(null);
  const [editTitle, setEditTitle]       = useState('');
  const [editNotes, setEditNotes]       = useState('');

  // Recurring form
  const [recurTitle, setRecurTitle]     = useState('Workout Session');
  const [recurDay, setRecurDay]         = useState(1);

  // Notify form (login alert)
  const [notifyText, setNotifyText]     = useState('');
  const [notifyMsg, setNotifyMsg]       = useState('');

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [toast, setToast]               = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  async function reload(uid: string) {
    const r = await fetchWorkoutEvents(uid);
    if (!r.error) setEvents(r.data);
  }

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      await reload(data.user.id);
    })();
  }, []);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, WorkoutEventRow[]>();
    for (const e of events) {
      const list = map.get(e.scheduled_date) ?? [];
      list.push(e);
      map.set(e.scheduled_date, list);
    }
    return map;
  }, [events]);

  const grid = useMemo(() => buildGrid(currentMonth), [currentMonth]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openDayModal(key: string) {
    setSelectedDate(key);
    setModal('day');
  }

  function openAddModal(date: string) {
    setAddDate(date);
    setAddTitle('Workout Session');
    setAddNotes('');
    setModal('add');
  }

  function openEditModal(event: WorkoutEventRow) {
    setEditEvent(event);
    setEditTitle(event.title);
    setEditNotes(event.notes ?? '');
    setModal('edit');
  }

  async function handleToggle(event: WorkoutEventRow) {
    const next = !event.is_completed;
    await toggleWorkoutEventCompletion(event.id, next);
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, is_completed: next } : e));
  }

  async function handleDelete(eventId: string) {
    const { error } = await deleteWorkoutEvent(eventId);
    if (error) {
      showToast('Failed to remove workout.');
      setDeleteConfirmId(null);
      return;
    }
    setEvents(prev => prev.filter(e => e.id !== eventId));
    setDeleteConfirmId(null);
    setModal(null);
    showToast('Workout removed.');
  }

  function confirmDelete(eventId: string) {
    setDeleteConfirmId(eventId);
  }

  async function handleAdd() {
    if (!userId || !addTitle.trim()) return;
    await addWorkoutEvent({ userId, title: addTitle.trim(), scheduledDate: addDate, notes: addNotes.trim() || undefined });
    await reload(userId);
    setModal(null);
    showToast('Workout scheduled.');
  }

  async function handleEditSave() {
    if (!editEvent || !editTitle.trim()) return;
    const title = editTitle.trim();
    const notes = editNotes.trim() || undefined;
    await updateWorkoutEvent(editEvent.id, { title, notes });
    setEvents(prev => prev.map(e => e.id === editEvent.id ? { ...e, title, notes: notes ?? null } : e));
    setModal(null);
    showToast('Workout updated.');
  }

  async function handleAddRecurring() {
    if (!userId || !recurTitle.trim()) return;
    const dates = buildRecurringDates(currentMonth, recurDay);
    if (dates.length === 0) { showToast('No matching dates found this month.'); return; }
    await addBulkWorkoutEvents(dates.map(d => ({ userId, title: recurTitle.trim(), scheduledDate: d })));
    await reload(userId);
    setModal(null);
    showToast(`Added ${dates.length} recurring workouts.`);
  }

  async function toggleUnavail(day: number) {
    if (!userId) return;
    const next = new Set(unavailableDays);
    next.has(day) ? next.delete(day) : next.add(day);
    setUnavailableDays(next);
    setSavingUnavail(true);
    const supabase = getSupabaseClient();
    await supabase.from('profiles').update({ unavailable_days: Array.from(next) as unknown as import('@/lib/database.types').Json }).eq('id', userId);
    setSavingUnavail(false);
  }

  function handleSaveNotify() {
    if (!notifyText.trim()) return;
    // Store login alert in localStorage — shown on next login via dashboard
    const alerts: string[] = JSON.parse(localStorage.getItem('gymfxr_login_alerts') ?? '[]') as string[];
    alerts.push(notifyText.trim());
    localStorage.setItem('gymfxr_login_alerts', JSON.stringify(alerts));
    setNotifyMsg('Alert saved. It will appear on your next login.');
    setNotifyText('');
  }

  const todayKey = toDateKey(new Date());
  const selectedDayEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 20px 40px' }}>

      {/* ── Header ── */}
      <header style={{ padding: '32px 0 24px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Workout Calendar</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Schedule and track your training days.</p>
      </header>

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      {/* ── Unavailable days ── */}
      <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rest days</p>
          {savingUnavail && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saving…</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DAY_FULL.map((name, i) => {
            const blocked = unavailableDays.has(i);
            return (
              <button key={i} type="button" onClick={() => void toggleUnavail(i)}
                style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${blocked ? 'var(--color-warn)' : 'var(--border)'}`, background: blocked ? 'rgba(239,68,68,0.08)' : 'var(--bg-card-raised)', color: blocked ? 'var(--color-warn)' : 'var(--text-secondary)', fontSize: 12, fontWeight: blocked ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                {DAY_ABBR[i]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Calendar card ── */}
      <div className="card" style={{ padding: '20px 20px 24px', marginBottom: 16 }}>

        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button type="button" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card-raised)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
            {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <button type="button" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card-raised)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {DAY_ABBR.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {grid.map(day => {
            const key      = toDateKey(day);
            const inMonth  = day.getMonth() === currentMonth.getMonth();
            const dayEvts  = eventsByDate.get(key) ?? [];
            const isOff    = unavailableDays.has(day.getDay());
            const isNow    = key === todayKey;
            const hasDone  = dayEvts.some(e => e.is_completed);
            const hasPend  = dayEvts.some(e => !e.is_completed);

            return (
              <button
                key={key}
                type="button"
                onClick={() => openDayModal(key)}
                style={{
                  minHeight: 72,
                  borderRadius: 10,
                  border: isNow ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: isOff
                    ? 'rgba(239,68,68,0.04)'
                    : isNow
                      ? 'var(--accent-muted)'
                      : inMonth ? 'var(--bg-card)' : 'var(--bg-page)',
                  opacity: inMonth ? 1 : 0.4,
                  padding: '8px 6px 6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Date number */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: isNow ? 800 : 500, color: isNow ? 'var(--accent)' : inMonth ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {day.getDate()}
                  </span>
                  {isOff && <span style={{ fontSize: 9, color: 'var(--color-warn)', fontWeight: 600 }}>OFF</span>}
                </div>

                {/* Event pills */}
                {dayEvts.slice(0, 2).map(e => (
                  <div key={e.id} style={{ fontSize: 10, borderRadius: 5, padding: '2px 5px', background: e.is_completed ? 'var(--accent-muted)' : 'var(--bg-card-raised)', color: e.is_completed ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.is_completed ? '✓ ' : ''}{e.title}
                  </div>
                ))}
                {dayEvts.length > 2 && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{dayEvts.length - 2} more</span>
                )}

                {/* Status dot */}
                {dayEvts.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, marginTop: 'auto' }}>
                    {hasDone  && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />}
                    {hasPend  && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-warn)' }} />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Quick actions row ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <button type="button" onClick={() => openAddModal(todayKey)}
          className="btn btn-primary"
          style={{ gap: 7, flex: '1 1 140px' }}>
          <Plus size={15} /> Schedule Workout
        </button>
        <button type="button" onClick={() => setModal('recurring')}
          className="btn btn-secondary"
          style={{ gap: 7, flex: '1 1 140px' }}>
          <Repeat size={15} /> Recurring Workout
        </button>
        <button type="button" onClick={() => setModal('notify')}
          className="btn btn-ghost"
          style={{ gap: 7, flex: '1 1 140px' }}>
          <Bell size={15} /> Notify
        </button>
      </div>

      {/* ── Upcoming workouts list ── */}
      {(() => {
        const upcoming = events
          .filter(e => !e.is_completed && e.scheduled_date >= todayKey)
          .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
          .slice(0, 10);
        if (upcoming.length === 0) return null;
        return (
          <div className="card" style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Upcoming</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcoming.map(e => {
                const d = new Date(e.scheduled_date + 'T00:00:00');
                const label = e.scheduled_date === todayKey ? 'Today'
                  : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card-raised)', border: '1px solid var(--border)' }}>
                    <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 44 }}>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d.toLocaleDateString(undefined, { weekday: 'short' })}</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{d.getDate()}</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{label}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button type="button" onClick={() => openEditModal(e)}
                        style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Pencil size={13} />
                      </button>
                      <button type="button" onClick={() => confirmDelete(e.id)}
                        style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--color-warn)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Day popup modal ── */}
      {modal === 'day' && selectedDate && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })}
              </p>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                {selectedDate === todayKey && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 8, fontWeight: 600 }}>Today</span>}
              </h2>
            </div>
            <button type="button" onClick={() => setModal(null)} style={closeBtn}><X size={18} /></button>
          </div>

          {selectedDayEvents.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>No workouts scheduled.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {selectedDayEvents.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card-raised)', border: `1px solid ${e.is_completed ? 'var(--border-active)' : 'var(--border)'}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: e.is_completed ? 'var(--text-muted)' : 'var(--text-primary)', margin: 0, textDecoration: e.is_completed ? 'line-through' : 'none' }}>{e.title}</p>
                    {e.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{e.notes}</p>}
                  </div>
                  <button type="button" onClick={() => void handleToggle(e)} title={e.is_completed ? 'Mark incomplete' : 'Mark complete'}
                    style={{ width: 28, height: 28, borderRadius: 7, border: `1.5px solid ${e.is_completed ? 'var(--accent)' : 'var(--border)'}`, background: e.is_completed ? 'var(--accent-muted)' : 'transparent', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={13} />
                  </button>
                  <button type="button" onClick={() => { setModal(null); openEditModal(e); }}
                    style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Pencil size={12} />
                  </button>
                  <button type="button" onClick={() => confirmDelete(e.id)}
                    style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--color-warn)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="btn btn-primary btn-full" onClick={() => openAddModal(selectedDate)}>
            <Plus size={14} /> Add workout on this day
          </button>
        </Overlay>
      )}

      {/* ── Add workout modal ── */}
      {modal === 'add' && (
        <Overlay onClose={() => setModal(null)}>
          <ModalHeader title="Schedule Workout" onClose={() => setModal(null)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormField label="Title">
              <input className="form-input" value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="e.g. Leg Day" />
            </FormField>
            <FormField label="Date">
              <input className="form-input" type="date" value={addDate} onChange={e => setAddDate(e.target.value)} />
            </FormField>
            {programs.length > 0 && (
              <FormField label="From program (optional)">
                <select className="form-input" onChange={e => { if (e.target.value) setAddTitle(e.target.value); }} defaultValue="">
                  <option value="">— Select program —</option>
                  {programs.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                </select>
              </FormField>
            )}
            <FormField label="Notes (optional)">
              <input className="form-input" value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Any notes…" />
            </FormField>
            <button type="button" className="btn btn-primary btn-full" onClick={() => void handleAdd()}>Add</button>
          </div>
        </Overlay>
      )}

      {/* ── Edit workout modal ── */}
      {modal === 'edit' && editEvent && (
        <Overlay onClose={() => setModal(null)}>
          <ModalHeader title="Edit Workout" onClose={() => setModal(null)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormField label="Title">
              <input className="form-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </FormField>
            <FormField label="Notes">
              <input className="form-input" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Any notes…" />
            </FormField>
            <button type="button" className="btn btn-primary btn-full" onClick={() => void handleEditSave()}>Save</button>
          </div>
        </Overlay>
      )}

      {/* ── Recurring workout modal ── */}
      {modal === 'recurring' && (
        <Overlay onClose={() => setModal(null)}>
          <ModalHeader title="Recurring Workout" onClose={() => setModal(null)} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Add the same workout every week on a chosen day for this month (from the current week onwards).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormField label="Workout name">
              <input className="form-input" value={recurTitle} onChange={e => setRecurTitle(e.target.value)} placeholder="e.g. Upper Body" />
            </FormField>
            {programs.length > 0 && (
              <FormField label="From program (optional)">
                <select className="form-input" onChange={e => { if (e.target.value) setRecurTitle(e.target.value); }} defaultValue="">
                  <option value="">— Select program —</option>
                  {programs.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                </select>
              </FormField>
            )}
            <FormField label="Repeat every">
              <select className="form-input" value={recurDay} onChange={e => setRecurDay(Number(e.target.value))}>
                {DAY_FULL.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </FormField>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Applies to: {buildRecurringDates(currentMonth, recurDay).join(', ') || 'No dates found'}
            </p>
            <button type="button" className="btn btn-primary btn-full" onClick={() => void handleAddRecurring()}>
              <Repeat size={14} /> Add recurring
            </button>
          </div>
        </Overlay>
      )}

      {/* ── Delete confirmation ── */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 24px 24px', maxWidth: 360, width: '100%' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>Delete Workout?</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 24px', lineHeight: 1.5 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={() => void handleDelete(deleteConfirmId)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Login alert modal ── */}
      {modal === 'notify' && (
        <Overlay onClose={() => setModal(null)}>
          <ModalHeader title="Login Alert" onClose={() => setModal(null)} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
            Set a message that appears the next time you log in — a reminder for your upcoming workout.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormField label="Alert message">
              <input className="form-input" value={notifyText} onChange={e => setNotifyText(e.target.value)} placeholder="e.g. Leg day today — don't skip!" maxLength={120} />
            </FormField>
            {notifyMsg && <p style={{ fontSize: 13, color: 'var(--accent)', margin: 0 }}>{notifyMsg}</p>}
            <button type="button" className="btn btn-primary btn-full" onClick={handleSaveNotify}>
              <Bell size={14} /> Save alert
            </button>
          </div>
        </Overlay>
      )}

    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

const closeBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '24px 24px 20px', maxWidth: 440, width: '100%', maxHeight: '90dvh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      <button type="button" onClick={onClose} style={closeBtn}><X size={16} /></button>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      {children}
    </label>
  );
}
