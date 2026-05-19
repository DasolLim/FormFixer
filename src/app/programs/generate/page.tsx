'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgramTemplate } from '@/lib/programs/types';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

type WizardState = {
  difficulty: Difficulty;
  daysPerWeek: number;
  weeks: number;
};

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; description: string }[] = [
  { value: 'beginner',     label: 'Beginner',     description: 'New to training or returning after a break' },
  { value: 'intermediate', label: 'Intermediate', description: 'Consistent training for 6+ months' },
  { value: 'advanced',     label: 'Advanced',     description: 'Serious athlete with 2+ years of training' },
];

const WEEK_OPTIONS = [4, 8, 12];

export default function GenerateProgramPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState<WizardState>({
    difficulty: 'beginner',
    daysPerWeek: 3,
    weeks: 8,
  });
  const [generating, setGenerating] = useState(false);
  const [generatedProgram, setGeneratedProgram] = useState<ProgramTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
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
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  }

  function handleStartProgram() {
    router.push('/programs');
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card" style={{ maxWidth: 560 }}>
        {/* Step indicator */}
        <div className="wizard-steps">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`wizard-step${step >= s ? ' wizard-step-active' : ''}${step > s ? ' wizard-step-done' : ''}`}
            />
          ))}
        </div>

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

        {step === 2 && (
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
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(3)}>Next</button>
            </div>
          </>
        )}

        {step === 3 && (
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
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(2)}>Back</button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={generate}
                disabled={generating}
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

        {step === 4 && generatedProgram && (
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

            <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={handleStartProgram}>
              Start This Program
            </button>
            <button
              type="button"
              style={{ marginTop: 8, width: '100%', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', padding: '6px 0' }}
              onClick={() => { setStep(3); setGeneratedProgram(null); setError(null); }}
            >
              Generate another
            </button>
          </>
        )}
      </div>
    </div>
  );
}
