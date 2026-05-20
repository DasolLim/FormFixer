'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/auth/AuthGate';
import { Card } from '@/components/ui/Card';
import { TodayCard } from '@/components/ui/TodayCard';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { fetchWorkoutSessions, fetchFormScoreHistory, fetchSessionRepScores } from '@/lib/workouts/sessions';
import type { WorkoutSessionRow } from '@/lib/workouts/types';
import type { ExerciseFormHistory } from '@/lib/workouts/sessions';
import type { RepScore } from '@/lib/workouts/types';
import { fetchProgramProgress, type ProgramProgressRow } from '@/lib/programs/sessions';
import { fetchDailyMealItems } from '@/lib/nutrition/sessions';
import type { WorkoutEventRow } from '@/lib/calendar/sessions';
import type { WeeklyFrequency } from '@/lib/workouts/frequency';
import FrequencyChart from '@/components/ui/FrequencyChart';
import { ChevronRight } from 'lucide-react';

function safeExerciseName(exerciseId: string | null | undefined, fallback: string): string {
  if (!exerciseId) return fallback.toUpperCase();
  const names: Record<string, string> = {
    squat: 'Squat', push_up: 'Push-Up', sit_up: 'Sit-Up', bicep_curl: 'Bicep Curl',
    lateral_raise: 'Lateral Raise', overhead_press: 'Overhead Press',
    leg_raise: 'Leg Raise', knee_raise: 'Knee Raise', crunch: 'Crunch', pull_up: 'Pull-Up',
  };
  return names[exerciseId] ?? exerciseId;
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

function scoreToY(score: number, height: number): number {
  return height - (score / 100) * height;
}
function dateToX(date: string, minDate: number, maxDate: number, width: number): number {
  const t = new Date(date).getTime();
  if (maxDate === minDate) return width / 2;
  return ((t - minDate) / (maxDate - minDate)) * width;
}

function FormScoreChart({ history }: { history: ExerciseFormHistory }) {
  const W = 300; const H = 72; const PAD = 8;
  const w = W - PAD * 2; const h = H - PAD * 2;
  const sessions = history.sessions;
  const mostRecent = sessions[sessions.length - 1];
  const trend = mostRecent?.formTrend ?? 'stable';
  const lineColor = trend === 'improving' ? 'var(--color-good)' : trend === 'declining' ? 'var(--color-warn)' : 'var(--color-neutral)';
  // Frozen at first render so server and client produce identical SVG coordinates
  const [now] = useState(() => Date.now());
  const minDate = now - 30 * 24 * 60 * 60 * 1000;
  const maxDate = now;
  const points = sessions.map(s => ({
    x: PAD + dateToX(s.recordedAt, minDate, maxDate, w),
    y: PAD + scoreToY(s.averageFormScore, h),
    score: s.averageFormScore,
  }));
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
          {safeExerciseName(history.exerciseId, history.exerciseId)}
        </span>
        <span style={{ fontSize: 22, fontWeight: 700, color: scoreColor(mostRecent?.averageFormScore ?? 0), lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {mostRecent?.averageFormScore ?? 0}
        </span>
        <span style={{ fontSize: 13, color: lineColor }}>{trendIcon(trend)}</span>
      </div>
      <svg width={W} height={H} style={{ display: 'block', borderRadius: 10, background: 'var(--bg-input)', width: '100%' }}>
        {[25, 50, 75].map(v => (
          <line key={v} x1={PAD} y1={PAD + scoreToY(v, h)} x2={PAD + w} y2={PAD + scoreToY(v, h)}
            stroke="var(--border-light)" strokeWidth={1} strokeDasharray="4 4" />
        ))}
        {points.length > 1 && (
          <polyline points={polyline} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={scoreColor(p.score)} />
        ))}
      </svg>
    </div>
  );
}

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
  const date = new Date(session.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

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
    <div style={{ borderRadius: 14, background: 'var(--bg-card)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
      <button
        onClick={handleExpand}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 52 }}
      >
        <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{exerciseName}</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{session.rep_count} reps</span>
        {score > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-on-dark)', background: scoreColor(score), padding: '3px 8px', borderRadius: 999 }}>
            {score}
          </span>
        )}
        {trend && (
          <span style={{ fontSize: 13, color: trend === 'improving' ? 'var(--color-good)' : trend === 'declining' ? 'var(--color-warn)' : 'var(--text-muted)' }}>
            {trendIcon(trend)}
          </span>
        )}
        <span suppressHydrationWarning style={{ fontSize: 12, color: 'var(--text-muted)' }}>{date}</span>
        <ChevronRight size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {expanded && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border-light)' }}>
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

interface DashboardClientProps {
  currentStreak: number;
  longestStreak: number;
  todayEvent: WorkoutEventRow | null;
  frequency: WeeklyFrequency[];
  targetSessionsPerWeek: number;
}

export function DashboardClient({ currentStreak, longestStreak, todayEvent, frequency, targetSessionsPerWeek }: DashboardClientProps) {
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([]);
  const [formHistory, setFormHistory] = useState<ExerciseFormHistory[]>([]);
  const [programs, setPrograms] = useState<ProgramProgressRow[]>([]);
  const [dailyCalories, setDailyCalories] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) { setLoading(false); return; }

      const [sessionResult, programResult, mealResult, historyResult] = await Promise.all([
        fetchWorkoutSessions(data.user.id),
        fetchProgramProgress(data.user.id),
        fetchDailyMealItems(data.user.id, new Date().toISOString().slice(0, 10)),
        fetchFormScoreHistory(data.user.id),
      ]);

      if (sessionResult.error) setError(sessionResult.error.message);
      else setSessions(sessionResult.data);

      if (!programResult.error) setPrograms(programResult.data);
      if (!mealResult.error) setDailyCalories(mealResult.data.reduce((sum, item) => sum + item.calories, 0));
      setFormHistory(historyResult);
      setLoading(false);
    })();
  }, []);

  const totalReps = useMemo(() => sessions.reduce((sum, s) => sum + s.rep_count, 0), [sessions]);
  const activeProgram = programs[0];
  const chartsWithData = formHistory.filter(h => h.sessions.length >= 1);

  return (
    <AuthGate>
      <div className="ui-section">
        {/* 1 — Stat grid */}
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-card-value">{sessions.length}</span>
            <span className="stat-card-label">Sessions</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-value">{totalReps}</span>
            <span className="stat-card-label">Total Reps</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-value">{currentStreak}</span>
            <span className="stat-card-label">Day Streak</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-value" style={{ fontSize: activeProgram ? 16 : 28 }}>
              {activeProgram ? `${activeProgram.completion_percent}%` : '—'}
            </span>
            <span className="stat-card-label">
              {activeProgram ? activeProgram.program_slug : 'No program'}
            </span>
          </div>
        </div>

        {loading && <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center' }}>Loading dashboard...</p>}
        {error && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}

        {/* 2 — Day Streak highlighted card */}
        <div
          className="stat-card"
          style={{
            background: 'var(--accent-muted)',
            border: '1px solid var(--border-active)',
            alignSelf: 'flex-start',
          }}
        >
          <span className="stat-card-value">{currentStreak}</span>
          <span className="stat-card-label">Day Streak</span>
        </div>

        {/* 3 — Today's Schedule / Browse Programs */}
        <TodayCard event={todayEvent} />

        {/* 4 — Form Progress */}
        {/* 5 — Recent Workouts  (both above Frequency + Muscle Activity) */}
        <div className="dashboard-desktop-grid">
          <Card title="Form Progress (Last 30 Days)">
            {chartsWithData.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, padding: '20px 0' }}>
                Complete a workout and save it to see your form score history.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {chartsWithData.map(h => <FormScoreChart key={h.exerciseId} history={h} />)}
              </div>
            )}
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Recent Workouts">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {sessions.map(session => <SessionRow key={session.id} session={session} />)}
                {!loading && sessions.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
                    No sessions yet — head to Camera to start tracking.
                  </p>
                )}
              </div>
            </Card>

            {activeProgram && (
              <Card title="Active Program">
                <p className="ui-card-description">{activeProgram.program_slug}</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                  Week {activeProgram.current_week} · {activeProgram.completed_workouts}/{activeProgram.total_workouts} workouts complete
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* 6 — Weekly Frequency */}
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
