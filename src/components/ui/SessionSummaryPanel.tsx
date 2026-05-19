'use client';

import { useEffect, useRef, useState } from 'react';
import type { SessionScore } from '@/lib/workouts/types';

function AnimatedScore({ target, color }: { target: number; color: string }) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const DURATION = 800;

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startTimeRef.current = null;

    function tick(timestamp: number) {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target]);

  return (
    <span
      style={{ fontSize: '72px', fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
      aria-live="polite"
      aria-label={`Session score: ${target} out of 100`}
    >
      {displayed}
    </span>
  );
}

// Static map of issue IDs → human-readable labels. Extended in Phase 5 as more engines are added.
const ISSUE_LABELS: Record<string, string> = {
  squat_depth:      'Squat depth',
  squat_torso_lean: 'Torso lean',
  squat_knee_cave:  'Knee cave',
  squat_heel_lift:  'Heel lift',
  squat_tempo:      'Rep tempo',
  push_up_depth:    'Push-up depth',
  body_alignment:   'Body alignment',
  arm_symmetry:     'Arm symmetry',
  wrist_placement:  'Wrist placement',
  push_up_speed:    'Rep speed',
};

function scoreColor(score: number): string {
  if (score >= 80) return '#4CAF50';
  if (score >= 60) return '#FF8C00';
  return 'var(--danger, #EF4444)';
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = scoreColor(score);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 36px', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

export interface SessionSummaryPanelProps {
  sessionScore: SessionScore;
  exerciseName: string;
  onDone: () => void;
  onAnotherSet: () => void;
}

export function SessionSummaryPanel({ sessionScore, exerciseName, onDone, onAnotherSet }: SessionSummaryPanelProps) {
  const { averageOverall, averageDepth, averageSymmetry, averageForm, formTrend, topIssues, repScores, repCount, durationMs } = sessionScore;
  const overallColor = scoreColor(averageOverall);

  const trendLabel = formTrend === 'improving' ? '↑ Improving' : formTrend === 'declining' ? '↓ Declining' : '→ Stable';
  const trendColor = formTrend === 'improving' ? '#4CAF50' : formTrend === 'declining' ? 'var(--danger, #EF4444)' : 'var(--muted)';

  const durationSec = Math.round(durationMs / 1000);
  const durationLabel = durationSec >= 60
    ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
    : `${durationSec}s`;

  // Count how many reps each issue appeared in.
  const issueRepCounts = new Map<string, number>();
  repScores.forEach(r => r.issueIds.forEach(id => issueRepCounts.set(id, (issueRepCounts.get(id) ?? 0) + 1)));

  return (
    // Overlay backdrop
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onDone(); }}
    >
      <div style={{ background: 'var(--surface, #0F172A)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{exerciseName}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>{repCount} reps · {durationLabel}</p>
          </div>
          <button
            onClick={onDone}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Overall score + trend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <AnimatedScore target={averageOverall} color={overallColor} />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Form Score</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <span style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: trendColor, padding: '3px 10px', borderRadius: 12, border: `1px solid ${trendColor}`, alignSelf: 'flex-start' }}>
              {trendLabel}
            </span>
            <ScoreBar score={averageDepth} label="Depth" />
            <ScoreBar score={averageSymmetry} label="Symmetry" />
            <ScoreBar score={averageForm} label="Form" />
          </div>
        </div>

        {/* Rep sparkline */}
        {repScores.length > 0 && (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>REP BREAKDOWN</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {repScores.map(r => (
                <div
                  key={r.repNumber}
                  title={`Rep ${r.repNumber}: Overall ${r.overall} | Depth ${r.depth} | Sym ${r.symmetry} | Form ${r.form} | Tempo ${r.tempo}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: scoreColor(r.overall),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#fff',
                    cursor: 'default',
                  }}
                >
                  {r.repNumber}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top issues */}
        {topIssues.length > 0 && (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>TOP ISSUES</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topIssues.map(id => {
                const count = issueRepCounts.get(id) ?? 0;
                const label = ISSUE_LABELS[id] ?? id;
                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 10px', borderRadius: 8, background: 'var(--bg, #020817)', border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text)' }}>{label}</span>
                    <span style={{ color: 'var(--muted)' }}>{count} of {repCount} rep{repCount !== 1 ? 's' : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button
            onClick={onAnotherSet}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 10, background: 'var(--primary, #3B82F6)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Do Another Set
          </button>
          <button
            onClick={onDone}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 10, background: 'none', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
