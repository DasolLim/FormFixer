'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgramTemplate } from '@/lib/programs/types';
import { rlLimited, rlRemaining, rlIncrement, rlResetLabel } from '@/lib/rate-limit';

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
  const [generating, setGenerating]         = useState(false);
  const [generatedProgram, setGeneratedProgram] = useState<ProgramTemplate | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [remaining, setRemaining]           = useState(AI_GEN_MAX);

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
      const json = await res.json() as { program?: ProgramTemplate; error?: string; details?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? 'Generation failed');
        setGenerating(false);
        return;
      }
      setGeneratedProgram(json.program ?? null);
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
            <h1 className="onboarding-title">{generatedProgram.title}</h1>
            <p className="onboarding-subtitle">{generatedProgram.description}</p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
              <span className="rest-chip">{generatedProgram.difficulty}</span>
              <span className="rest-chip">{generatedProgram.weeks} weeks</span>
              <span className="rest-chip">{generatedProgram.workout_days.length}x / week</span>
              <span className="rest-chip">{generatedProgram.required_equipment.join(', ')}</span>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              {generatedProgram.workout_days.map(day => (
                <div key={day.dayIndex} style={{ marginBottom: 12 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{day.label}</p>
                  {day.exercises.map((ex, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.82rem', color: 'var(--muted)', paddingLeft: 8, marginBottom: 2 }}>
                      <span>{ex.exercise_id}</span>
                      <span>{ex.sets} x {ex.reps}</span>
                      <span>{ex.rest_seconds}s rest</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={() => router.push('/programs')}>
              Start This Program
            </button>
            <button
              type="button"
              style={{ marginTop: 8, width: '100%', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', padding: '6px 0' }}
              onClick={() => { setStep(5); setGeneratedProgram(null); setError(null); }}
            >
              Generate another
            </button>
          </>
        )}
      </div>
    </div>
  );
}
