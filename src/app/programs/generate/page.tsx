'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgramTemplate, WeeklyProgression } from '@/lib/programs/types';
import { rlLimited, rlRemaining, rlIncrement, rlResetLabel } from '@/lib/rate-limit';
import { ChevronDown, Zap } from 'lucide-react';

const AI_GEN_KEY = 'ai_generate';
const AI_GEN_MAX = 3;

type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type Goal       = 'lose' | 'maintain' | 'gain';
type Focus      = 'lower' | 'upper' | 'fullbody';

type WizardState = {
  difficulty: Difficulty;
  goal: Goal;
  focus: Focus;
  daysPerWeek: number;
  weeks: number;
};

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; description: string }[] = [
  { value: 'beginner',     label: 'Beginner',     description: 'New to training or returning after a break' },
  { value: 'intermediate', label: 'Intermediate', description: 'Consistent training for 6+ months' },
  { value: 'advanced',     label: 'Advanced',     description: 'Serious athlete with 2+ years of training' },
];

const GOAL_OPTIONS: { value: Goal; label: string; description: string }[] = [
  { value: 'lose',     label: 'Lose Fat',       description: 'Higher reps, shorter rest, calorie-burning focus' },
  { value: 'maintain', label: 'Maintain',        description: 'Balance strength and endurance, stay lean' },
  { value: 'gain',     label: 'Build Muscle',    description: 'Progressive overload, heavier weights, longer rest' },
];

const FOCUS_OPTIONS: { value: Focus; label: string; description: string }[] = [
  { value: 'lower',    label: 'Lower Body',  description: 'Legs, glutes, hamstrings, calves' },
  { value: 'upper',    label: 'Upper Body',  description: 'Chest, back, shoulders, arms' },
  { value: 'fullbody', label: 'Full Body',   description: 'Balanced program hitting every muscle group' },
];

const WEEK_OPTIONS = [4, 8, 12];
const TOTAL_STEPS  = 5;

const PHASE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  base:   { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af', label: 'Base'   },
  build:  { bg: 'rgba(59,130,246,0.18)',  color: '#60a5fa', label: 'Build'  },
  peak:   { bg: 'rgba(245,158,11,0.18)',  color: '#fbbf24', label: 'Peak'   },
  deload: { bg: 'rgba(34,197,94,0.18)',   color: '#4ade80', label: 'Deload' },
};

function PhaseBadge({ phase }: { phase: string }) {
  const s = PHASE_STYLE[phase] ?? PHASE_STYLE.base;
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 700,
      padding: '1px 6px', borderRadius: 4,
      background: s.bg, color: s.color,
      alignSelf: 'center',
    }}>
      {s.label}
    </span>
  );
}

export default function GenerateProgramPage() {
  const router = useRouter();
  const [step, setStep]                     = useState(1);
  const [wizard, setWizard]                 = useState<WizardState>({
    difficulty: 'beginner',
    goal: 'lose',
    focus: 'lower',
    daysPerWeek: 3,
    weeks: 8,
  });
  const [generating, setGenerating]             = useState(false);
  const [generatedProgram, setGeneratedProgram] = useState<ProgramTemplate | null>(null);
  const [methodologyNotes, setMethodologyNotes] = useState<string | null>(null);
  const [splitType, setSplitType]               = useState<string | null>(null);
  const [volumeSummary, setVolumeSummary]       = useState<Record<string, number> | null>(null);
  const [openProgressions, setOpenProgressions] = useState<Set<string>>(new Set());
  const [error, setError]                       = useState<string | null>(null);
  const [remaining, setRemaining]               = useState(AI_GEN_MAX);

  useEffect(() => { setRemaining(rlRemaining(AI_GEN_KEY, AI_GEN_MAX, 'day')); }, []);

  async function generate() {
    if (rlLimited(AI_GEN_KEY, AI_GEN_MAX, 'day')) {
      setError(`Daily limit reached (${AI_GEN_MAX}/day). Resets at ${rlResetLabel('day')}.`);
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/programs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wizard),
      });
      const json = await res.json() as {
        program?: ProgramTemplate;
        methodology_notes?: string;
        split_type?: string;
        weekly_volume_summary?: Record<string, number>;
        error?: string;
        details?: string;
      };
      if (!res.ok || json.error) {
        setError(json.error ?? 'Generation failed');
        setGenerating(false);
        return;
      }
      setGeneratedProgram(json.program ?? null);
      setMethodologyNotes(json.methodology_notes ?? null);
      setSplitType(json.split_type ?? null);
      setVolumeSummary(json.weekly_volume_summary ?? null);
      setOpenProgressions(new Set());
      const used = rlIncrement(AI_GEN_KEY, 'day');
      setRemaining(Math.max(0, AI_GEN_MAX - used));
      setStep(TOTAL_STEPS + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card" style={{ maxWidth: 560 }}>
        {/* Step indicator */}
        <div className="wizard-steps">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(s => (
            <div
              key={s}
              className={`wizard-step${step >= s ? ' wizard-step-active' : ''}${step > s ? ' wizard-step-done' : ''}`}
            />
          ))}
        </div>

        {/* Step 1 — Difficulty */}
        {step === 1 && (
          <>
            <h1 className="onboarding-title">How experienced are you?</h1>
            <p className="onboarding-subtitle">This determines exercise complexity and volume.</p>
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {DIFFICULTY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`selection-tile${wizard.difficulty === opt.value ? ' selection-tile-active' : ''}`}
                  onClick={() => setWizard(w => ({ ...w, difficulty: opt.value }))}
                >
                  <span className="selection-tile-label">{opt.label}</span>
                  <span className="selection-tile-desc">{opt.description}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 20 }} onClick={() => setStep(2)}>
              Next
            </button>
          </>
        )}

        {/* Step 2 — Goal */}
        {step === 2 && (
          <>
            <h1 className="onboarding-title">What&apos;s your goal?</h1>
            <p className="onboarding-subtitle">Your program will be structured around this outcome.</p>
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {GOAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`selection-tile${wizard.goal === opt.value ? ' selection-tile-active' : ''}`}
                  onClick={() => setWizard(w => ({ ...w, goal: opt.value }))}
                >
                  <span className="selection-tile-label">{opt.label}</span>
                  <span className="selection-tile-desc">{opt.description}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(3)}>Next</button>
            </div>
          </>
        )}

        {/* Step 3 — Focus */}
        {step === 3 && (
          <>
            <h1 className="onboarding-title">Where do you want to focus?</h1>
            <p className="onboarding-subtitle">This shapes which muscle groups are prioritized.</p>
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {FOCUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`selection-tile${wizard.focus === opt.value ? ' selection-tile-active' : ''}`}
                  onClick={() => setWizard(w => ({ ...w, focus: opt.value }))}
                >
                  <span className="selection-tile-label">{opt.label}</span>
                  <span className="selection-tile-desc">{opt.description}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(2)}>Back</button>
              <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(4)}>Next</button>
            </div>
          </>
        )}

        {/* Step 4 — Days per week */}
        {step === 4 && (
          <>
            <h1 className="onboarding-title">Days per week</h1>
            <p className="onboarding-subtitle">How many days can you commit to training?</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 16 }}>
              {[2, 3, 4, 5, 6].map(d => (
                <button
                  key={d}
                  type="button"
                  className={`number-tile${wizard.daysPerWeek === d ? ' number-tile-active' : ''}`}
                  onClick={() => setWizard(w => ({ ...w, daysPerWeek: d }))}
                >
                  {d}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(3)}>Back</button>
              <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(5)}>Next</button>
            </div>
          </>
        )}

        {/* Step 5 — Program length */}
        {step === 5 && (
          <>
            <h1 className="onboarding-title">Program length</h1>
            <p className="onboarding-subtitle">How many weeks do you want the program to run?</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
              {WEEK_OPTIONS.map(w => (
                <button
                  key={w}
                  type="button"
                  className={`number-tile${wizard.weeks === w ? ' number-tile-active' : ''}`}
                  onClick={() => setWizard(wz => ({ ...wz, weeks: w }))}
                >
                  {w}w
                </button>
              ))}
            </div>
            {error && (
              <p style={{ color: 'var(--color-warn)', fontSize: '0.85rem', marginTop: 8 }}>{error}</p>
            )}
            <p style={{ fontSize: 12, color: remaining > 0 ? 'var(--text-muted)' : 'var(--color-warn)', marginTop: 12, textAlign: 'center' }}>
              {remaining > 0
                ? `${remaining} of ${AI_GEN_MAX} generations remaining today`
                : `Daily limit reached — resets at ${rlResetLabel('day')}`}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(4)}>Back</button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={generate}
                disabled={generating || remaining === 0}
              >
                {generating ? 'Generating...' : 'Generate Program'}
              </button>
            </div>
            {generating && (
              <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 10, textAlign: 'center' }}>
                Building your personalized program...
              </p>
            )}
          </>
        )}

        {/* Result */}
        {step === TOTAL_STEPS + 1 && generatedProgram && (
          <>
            {/* Header */}
            <h1 className="onboarding-title" style={{ marginBottom: 4 }}>{generatedProgram.title}</h1>
            {splitType && (
              <span style={{
                display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8,
              }}>
                {splitType}
              </span>
            )}
            {methodologyNotes && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 12px' }}>
                {methodologyNotes}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <span className="rest-chip">{generatedProgram.difficulty}</span>
              <span className="rest-chip">{generatedProgram.weeks} weeks</span>
              <span className="rest-chip">{generatedProgram.workout_days.length}x / week</span>
              {generatedProgram.required_equipment.slice(0, 2).map(eq => (
                <span key={eq} className="rest-chip">{eq.replace(/_/g, ' ')}</span>
              ))}
            </div>

            {/* Weekly volume summary */}
            {volumeSummary && Object.keys(volumeSummary).length > 0 && (
              <div style={{
                background: 'var(--bg-input)', borderRadius: 12, padding: '12px 14px', marginBottom: 16,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                  Weekly Volume
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 16px' }}>
                  {Object.entries(volumeSummary).map(([muscle, sets]) => (
                    <div key={muscle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {muscle.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {sets} sets
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Days with exercise progressions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {generatedProgram.workout_days.map(day => (
                <div key={day.dayIndex} style={{
                  background: 'var(--bg-input)', borderRadius: 12, overflow: 'hidden',
                }}>
                  <p style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                    padding: '10px 14px 8px', margin: 0,
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {day.label}
                  </p>
                  <div style={{ padding: '6px 0' }}>
                    {day.exercises.map((ex, i) => {
                      const key = `${day.dayIndex}-${i}`;
                      const isOpen = openProgressions.has(key);
                      const progression = ex.weekly_progression ?? [];
                      return (
                        <div key={key} style={{ borderBottom: i < day.exercises.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          {/* Exercise row */}
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 14px', gap: 8,
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {ex.exercise_name ?? ex.exercise_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </span>
                                {ex.fst7 && (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                    background: 'rgba(213,255,95,0.15)', color: 'var(--accent)',
                                  }}>
                                    <Zap size={9} />FST-7
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {ex.sets} × {ex.reps} · {ex.rest_seconds}s rest
                              </span>
                            </div>
                            {progression.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setOpenProgressions(prev => {
                                  const next = new Set(prev);
                                  next.has(key) ? next.delete(key) : next.add(key);
                                  return next;
                                })}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  color: 'var(--text-muted)', fontSize: 11, padding: '2px 4px',
                                  flexShrink: 0,
                                }}
                              >
                                Progression
                                <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
                              </button>
                            )}
                          </div>

                          {/* Progression table */}
                          {isOpen && progression.length > 0 && (
                            <div style={{ padding: '0 14px 10px' }}>
                              <div style={{ background: 'var(--bg-card)', borderRadius: 8, overflow: 'hidden' }}>
                                {/* Table header */}
                                <div style={{
                                  display: 'grid', gridTemplateColumns: '40px 1fr 60px 1fr',
                                  padding: '6px 10px', borderBottom: '1px solid var(--border)',
                                }}>
                                  {['Wk', 'Phase', 'Sets×Reps', 'Note'].map(h => (
                                    <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{h}</span>
                                  ))}
                                </div>
                                {progression.map((pw: WeeklyProgression) => (
                                  <div key={pw.week} style={{
                                    display: 'grid', gridTemplateColumns: '40px 1fr 60px 1fr',
                                    padding: '5px 10px', borderBottom: '1px solid var(--border)',
                                    background: pw.phase === 'deload' ? 'rgba(34,197,94,0.06)' : 'transparent',
                                  }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{pw.week}</span>
                                    <PhaseBadge phase={pw.phase} />
                                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                      {pw.sets}×{pw.reps}
                                    </span>
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{pw.coaching_note}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="btn btn-primary btn-full" onClick={() => router.push('/programs')}>
              Start This Program
            </button>
            <button
              type="button"
              style={{ marginTop: 8, width: '100%', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer', padding: '6px 0' }}
              onClick={() => { setStep(5); setGeneratedProgram(null); setError(null); setMethodologyNotes(null); setSplitType(null); setVolumeSummary(null); }}
            >
              Generate another
            </button>
          </>
        )}
      </div>
    </div>
  );
}
