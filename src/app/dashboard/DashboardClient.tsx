'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { Card } from '@/components/ui/Card';
import { TodayCard } from '@/components/ui/TodayCard';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { fetchWorkoutSessions, fetchSessionRepScores } from '@/lib/workouts/sessions';
import type { WorkoutSessionRow } from '@/lib/workouts/types';
import type { RepScore } from '@/lib/workouts/types';
import type { WorkoutEventRow } from '@/lib/calendar/sessions';
import type { WeeklyFrequency } from '@/lib/workouts/frequency';
import type { ProgramProgressRow } from '@/lib/programs/sessions';
import FrequencyChart from '@/components/ui/FrequencyChart';
import { Bell, ChevronRight, Flame, Trophy, X, Zap } from 'lucide-react';
import type { ServerChallenge, ServerChallengeProgress } from './page';
import { getExerciseConfig } from '@/features/form-engine/exercise-config';

const LOGIN_ALERTS_KEY = 'gymfxr_login_alerts';

// ─── Login Alert Banner ───────────────────────────────────────────────────────

function LoginAlertBanner() {
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOGIN_ALERTS_KEY);
      if (raw) setAlerts(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }, []);

  function dismiss(idx: number) {
    const next = alerts.filter((_, i) => i !== idx);
    setAlerts(next);
    localStorage.setItem(LOGIN_ALERTS_KEY, JSON.stringify(next));
  }

  if (alerts.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {alerts.map((msg, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--accent-muted)', border: '1px solid var(--border-active)' }}>
          <Bell size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45 }}>{msg}</span>
          <button
            type="button"
            onClick={() => dismiss(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', flexShrink: 0 }}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeExerciseName(exerciseId: string | null | undefined, fallback: string): string {
  if (!exerciseId) return fallback.toUpperCase();
  try { return getExerciseConfig(exerciseId).name; } catch { return exerciseId; }
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--color-good)';
  if (score >= 60) return '#F5C842';
  return 'var(--color-warn)';
}

function trendIcon(trend: string | null | undefined): string {
  if (trend === 'improving') return '↑';
  if (trend === 'declining') return '↓';
  return '→';
}

// ─── Streak styling based on tier ────────────────────────────────────────────

const STREAK_MILESTONES = [3, 7, 10, 14, 20, 21, 28, 30, 100, 365];

function getStreakStyle(streak: number): { color: string; glow: string; bg: string; border: string } {
  if (streak >= 365) return { color: '#FFD700', glow: '0 0 18px #FFD700, 0 0 36px rgba(255,200,0,0.4)', bg: 'rgba(255,215,0,0.08)', border: '#FFD700' };
  if (streak >= 100) return { color: '#FF4500', glow: '0 0 16px rgba(255,69,0,0.9), 0 0 32px rgba(255,69,0,0.4)', bg: 'rgba(255,69,0,0.08)', border: '#FF4500' };
  if (streak >= 30)  return { color: '#EF4444', glow: '0 0 14px rgba(239,68,68,0.8)', bg: 'rgba(239,68,68,0.07)', border: '#EF4444' };
  if (streak >= 21)  return { color: '#F97316', glow: '0 0 12px rgba(249,115,22,0.7)', bg: 'rgba(249,115,22,0.07)', border: '#F97316' };
  if (streak >= 14)  return { color: '#A855F7', glow: '0 0 12px rgba(168,85,247,0.7)', bg: 'rgba(168,85,247,0.07)', border: '#A855F7' };
  if (streak >= 7)   return { color: '#3B82F6', glow: '0 0 10px rgba(59,130,246,0.7)', bg: 'rgba(59,130,246,0.07)', border: '#3B82F6' };
  if (streak >= 3)   return { color: 'var(--accent)', glow: '0 0 8px var(--accent)', bg: 'var(--accent-muted)', border: 'var(--border-active)' };
  return { color: 'var(--text-secondary)', glow: 'none', bg: 'var(--bg-card)', border: 'var(--border)' };
}

function getHighestMilestone(streak: number): number | null {
  for (const m of [...STREAK_MILESTONES].reverse()) {
    if (streak >= m) return m;
  }
  return null;
}

function milestoneBadgeLabel(m: number): string {
  if (m >= 365) return '1 Year';
  if (m >= 100) return '100 Days';
  return `${m} Day${m === 1 ? '' : 's'}`;
}

// ─── Weekly Form Progress Chart ───────────────────────────────────────────────

function WeeklyFormChart({ sessions }: { sessions: WorkoutSessionRow[] }) {
  const W = 320; const H = 140;
  const PX = 28; const PY = 16; const LH = 18;
  const cW = W - PX * 2;
  const cH = H - PY * 2 - LH;

  const [weekDays] = useState<Date[]>(() => {
    const today = new Date();
    const offset = (today.getDay() + 6) % 7;
    const mon = new Date(today);
    mon.setDate(today.getDate() - offset);
    mon.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });
  });

  const [todayIdx] = useState<number>(() => (new Date().getDay() + 6) % 7);
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const dayScores = useMemo<(number | null)[]>(() => {
    const acc: { sum: number; count: number }[] = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
    sessions.forEach(s => {
      const d = new Date(s.created_at);
      d.setHours(0, 0, 0, 0);
      const idx = weekDays.findIndex(w => w.getTime() === d.getTime());
      if (idx === -1) return;
      const score = s.average_form_score ?? s.form_score ?? 0;
      if (score > 0) { acc[idx].sum += score; acc[idx].count += 1; }
    });
    return acc.map(a => a.count > 0 ? Math.round(a.sum / a.count) : null);
  }, [sessions, weekDays]);

  const dots = weekDays
    .map((_, i) => {
      const score = dayScores[i];
      if (score === null || i > todayIdx) return null;
      return { x: PX + (i / 6) * cW, y: PY + (1 - score / 100) * cH, score, i };
    })
    .filter((d): d is { x: number; y: number; score: number; i: number } => d !== null);

  const polyline = dots.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {[25, 50, 75].map(v => (
          <line key={v} x1={PX} y1={PY + (1 - v / 100) * cH} x2={W - PX} y2={PY + (1 - v / 100) * cH}
            stroke="var(--border-light)" strokeWidth={1} strokeDasharray="3 3" />
        ))}
        <rect x={PX + (todayIdx / 6) * cW - 12} y={PY} width={24} height={cH}
          rx={4} fill="var(--accent)" opacity={0.07} />
        {dots.length > 1 && (
          <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" opacity={0.75} />
        )}
        {dots.map(p => (
          <g key={p.i}>
            <circle cx={p.x} cy={p.y} r={5} fill={scoreColor(p.score)} stroke="var(--bg-card)" strokeWidth={2} />
            <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={9} fill={scoreColor(p.score)} fontWeight="700">{p.score}</text>
          </g>
        ))}
        {DAY_LABELS.map((label, i) => (
          <text key={i} x={PX + (i / 6) * cW} y={H - 3} textAnchor="middle" fontSize={10}
            fill={i === todayIdx ? 'var(--accent)' : 'var(--text-muted)'}
            fontWeight={i === todayIdx ? '700' : '400'}>{label}</text>
        ))}
        {[25, 50, 75].map(v => (
          <text key={v} x={PX - 5} y={PY + (1 - v / 100) * cH + 4}
            textAnchor="end" fontSize={8} fill="var(--text-muted)">{v}</text>
        ))}
      </svg>
      {dots.length === 0 && (
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
          Complete a workout this week to see your form progress.
        </p>
      )}
    </div>
  );
}

// ─── Grouped Workouts (date accordion + scroll) ───────────────────────────────

function RepSparkline({ repScores }: { repScores: RepScore[] }) {
  if (repScores.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
      {repScores.map(r => (
        <div key={r.repNumber} title={`Rep ${r.repNumber}: ${r.overall}`}
          style={{ width: 24, height: 24, borderRadius: 6, background: scoreColor(r.overall), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
          {r.repNumber}
        </div>
      ))}
    </div>
  );
}

function SessionRow({ session }: { session: WorkoutSessionRow }) {
  const [expanded, setExpanded] = useState(false);
  const [repScores, setRepScores] = useState<RepScore[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const exerciseName = safeExerciseName(session.exercise_id, session.exercise_type);
  const score = session.average_form_score ?? session.form_score;
  const trend = session.form_trend;
  const time = new Date(session.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const handleExpand = useCallback(async () => {
    if (!expanded && repScores === null && !loadingDetail) {
      setLoadingDetail(true);
      const { repScores: rs } = await fetchSessionRepScores(session.id);
      setRepScores(rs);
      setLoadingDetail(false);
    }
    setExpanded(e => !e);
  }, [expanded, repScores, loadingDetail, session.id]);

  return (
    <div className="session-row-card">
      <button onClick={handleExpand} className="session-row-btn">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {exerciseName}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            {time} · {session.rep_count} reps
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {score > 0 && (
            <span className="session-row-score" style={{ background: scoreColor(score) }}>{score}</span>
          )}
          {trend && (
            <span style={{ fontSize: 13, color: trend === 'improving' ? 'var(--color-good)' : trend === 'declining' ? 'var(--color-warn)' : 'var(--text-muted)' }}>
              {trendIcon(trend)}
            </span>
          )}
          <ChevronRight size={14} strokeWidth={1.5}
            style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
        </div>
      </button>
      {expanded && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--border-light)' }}>
          {loadingDetail && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Loading...</p>}
          {repScores && repScores.length > 0 && <RepSparkline repScores={repScores} />}
          {repScores && repScores.length === 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>No per-rep data for this session.</p>
          )}
        </div>
      )}
    </div>
  );
}

function relativeDate(dateKey: string): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  if (dateKey === fmt(new Date())) return 'Today';
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === fmt(yesterday)) return 'Yesterday';
  return dateKey;
}

const DAY_PREVIEW = 4;

function DaySection({
  dateKey, dateSessions, isOpen, isToday, onToggle,
}: {
  dateKey: string;
  dateSessions: WorkoutSessionRow[];
  isOpen: boolean;
  isToday: boolean;
  onToggle: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const hasMore = dateSessions.length > DAY_PREVIEW;
  const visible = showAll ? dateSessions : dateSessions.slice(0, DAY_PREVIEW);

  return (
    <div className={`date-group${isOpen ? ' date-group--open' : ''}${isToday ? ' date-group--today' : ''}`}>
      <button type="button" onClick={onToggle} className="date-group-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="date-group-label">{relativeDate(dateKey)}</span>
          <span className="date-group-count">{dateSessions.length}</span>
        </div>
        <ChevronRight size={14} strokeWidth={1.5}
          style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.22s ease', flexShrink: 0 }} />
      </button>

      <div className={`date-group-body${isOpen ? ' date-group-body--open' : ''}`}>
        <div className="date-group-inner">
          {visible.map(s => <SessionRow key={s.id} session={s} />)}
          {hasMore && !showAll && (
            <button type="button" onClick={() => setShowAll(true)} className="date-group-view-all">
              View all {dateSessions.length} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupedWorkouts({ sessions, loading }: { sessions: WorkoutSessionRow[]; loading: boolean }) {
  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutSessionRow[]>();
    sessions.forEach(s => {
      const key = new Date(s.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries());
  }, [sessions]);

  const todayKey = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    []
  );

  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && grouped.length > 0) {
      setOpenDates(new Set([grouped[0][0]]));
      setInitialized(true);
    }
  }, [grouped, initialized]);

  const toggle = useCallback((key: string) => {
    setOpenDates(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  if (!loading && grouped.length === 0) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
        No sessions yet — head to Camera to start tracking.
      </p>
    );
  }

  return (
    <div className="grouped-workouts-list">
      {grouped.map(([dateKey, dateSessions]) => (
        <DaySection
          key={dateKey}
          dateKey={dateKey}
          dateSessions={dateSessions}
          isOpen={openDates.has(dateKey)}
          isToday={dateKey === todayKey}
          onToggle={() => toggle(dateKey)}
        />
      ))}
    </div>
  );
}

// ─── Weekly Challenge Card ────────────────────────────────────────────────────

function ChallengeCard({ challenge, progress }: {
  challenge: ServerChallenge;
  progress: ServerChallengeProgress;
}) {
  const pct = Math.min(100, Math.round((progress.current_reps / challenge.target_reps) * 100));
  const bonusXP = Math.round(challenge.target_reps * 100 * 10); // rough estimate for display

  return (
    <Card title="Weekly Challenge">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            {challenge.target_reps} {challenge.exercise_label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {progress.current_reps} / {challenge.target_reps} reps
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#F5C842', fontWeight: 600 }}>
          <Zap size={13} />
          +{bonusXP.toLocaleString()} XP bonus
        </div>
      </div>
      {progress.completed ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}>
          <Trophy size={14} style={{ color: '#34D399' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#34D399' }}>Challenge complete!</span>
        </div>
      ) : (
        <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: pct >= 100 ? '#34D399' : pct >= 60 ? '#F5C842' : 'var(--accent)',
            borderRadius: 4, transition: 'width 0.5s ease',
          }} />
        </div>
      )}
    </Card>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

interface DashboardClientProps {
  currentStreak: number;
  longestStreak: number;
  todayEvent: WorkoutEventRow | null;
  frequency: WeeklyFrequency[];
  targetSessionsPerWeek: number;
  todayCalories: number;
  activeProgram: ProgramProgressRow | null;
  challenge: ServerChallenge | null;
  challengeProgress: ServerChallengeProgress | null;
}

export function DashboardClient({
  currentStreak, longestStreak, todayEvent, frequency, targetSessionsPerWeek,
  todayCalories, activeProgram, challenge, challengeProgress,
}: DashboardClientProps) {
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) { setLoading(false); return; }
      const result = await fetchWorkoutSessions(data.user.id);
      if (result.error) setError(result.error.message);
      else setSessions(result.data);
      setLoading(false);
    })();
  }, []);

  const totalReps = useMemo(() => sessions.reduce((sum, s) => sum + s.rep_count, 0), [sessions]);
  const streakStyle = getStreakStyle(currentStreak);
  const milestone = getHighestMilestone(currentStreak);

  return (
    <AuthGate>
      <div className="ui-section">

        <LoginAlertBanner />

        {/* ── Stat Grid: streak | sessions | reps | program | calories ── */}
        <div className="stat-grid stat-grid-5">

          {/* Day Streak — accented with tier glow */}
          <div className="stat-card stat-card-streak"
            style={{ background: streakStyle.bg, border: `1px solid ${streakStyle.border}`, boxShadow: streakStyle.glow !== 'none' ? streakStyle.glow : undefined }}>
            <span className="stat-card-value" style={{ color: streakStyle.color }}>{currentStreak}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Flame size={12} style={{ color: streakStyle.color }} />
              <span className="stat-card-label">Day Streak</span>
            </div>
            {milestone && (
              <span style={{ fontSize: 9, fontWeight: 700, color: streakStyle.color, background: `${streakStyle.color}22`, borderRadius: 4, padding: '1px 5px', marginTop: 2, letterSpacing: '0.03em' }}>
                {milestoneBadgeLabel(milestone)}
              </span>
            )}
            {longestStreak > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Best: {longestStreak}</span>
            )}
          </div>

          <div className="stat-card">
            <span className="stat-card-value">{sessions.length}</span>
            <span className="stat-card-label">Sessions</span>
          </div>

          <div className="stat-card">
            <span className="stat-card-value">{totalReps}</span>
            <span className="stat-card-label">Total Reps</span>
          </div>

          <div className="stat-card">
            <span className="stat-card-value">
              {activeProgram ? `${activeProgram.completion_percent}%` : '—'}
            </span>
            <span className="stat-card-label" style={{ fontSize: 11, lineHeight: 1.3, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeProgram ? (activeProgram.programTitle ?? activeProgram.program_slug.replace(/^ai-[a-f0-9]+-\d+$/, 'AI Program')) : 'No program'}
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-card-value" style={{ fontSize: todayCalories > 9999 ? 18 : 28 }}>
              {todayCalories > 0 ? todayCalories.toLocaleString() : '—'}
            </span>
            <span className="stat-card-label">Calories Today</span>
          </div>
        </div>

        {loading && <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center' }}>Loading...</p>}
        {error && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}

        {/* ── Today's Schedule ── */}
        <TodayCard event={todayEvent} activeProgram={activeProgram} />

        {/* ── Weekly Challenge ── */}
        {challenge && challengeProgress && (
          <ChallengeCard challenge={challenge} progress={challengeProgress} />
        )}

        {/* ── Form Progress + Recent Workouts ── */}
        <div className="dashboard-desktop-grid">
          <Card title="Form Progress (This Week)">
            <WeeklyFormChart sessions={sessions} />
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Fixed-height Recent Workouts — title pinned, list scrolls internally */}
            <article className="recent-workouts-card">
              <div className="recent-workouts-header">
                <h3 className="ui-card-title" style={{ margin: 0 }}>Recent Workouts</h3>
              </div>
              <div className="recent-workouts-scroll">
                <GroupedWorkouts sessions={sessions} loading={loading} />
              </div>
              <div className="recent-workouts-fade" aria-hidden="true" />
            </article>

          </div>
        </div>

        {/* ── Weekly Frequency ── */}
        <Card title="Weekly Frequency">
          {frequency.length > 0
            ? <FrequencyChart data={frequency} targetSessionsPerWeek={targetSessionsPerWeek} />
            : <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', padding: '12px 0' }}>No workout data yet.</p>
          }
        </Card>

      </div>
    </AuthGate>
  );
}
