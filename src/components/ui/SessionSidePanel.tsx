type ExerciseOption = { id: string; name: string };

type CueItem = {
  text: string;
  voiceText: string;
  severity: 'error' | 'warning' | 'positive';
};

type SessionSidePanelProps = {
  exercises: ExerciseOption[];
  allExercises?: ExerciseOption[];
  selectedExercise: string;
  onExerciseChange: (id: string) => void;
  formScore: number;
  topCues: CueItem[];
  primaryCue: string;
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
  onSave: () => void;
  isCameraRunning: boolean;
};

function cueDotColor(severity: CueItem['severity']): string {
  return severity === 'positive' ? 'var(--color-good)' : 'var(--color-warn)';
}

export function SessionSidePanel({
  exercises,
  allExercises,
  selectedExercise,
  onExerciseChange,
  formScore,
  topCues,
  primaryCue,
  voiceEnabled,
  onVoiceToggle,
  onSave,
  isCameraRunning,
}: SessionSidePanelProps) {
  const extraExercises = allExercises?.filter(ex => !exercises.some(e => e.id === ex.id)) ?? [];
  const selectedIsExtra = extraExercises.some(e => e.id === selectedExercise);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Form score ── */}
      <div className="card">
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
          Form score
        </p>
        <p style={{
          fontSize: 28, fontWeight: 800, margin: '0 0 10px', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)',
        }}>
          {formScore}
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 2 }}>/100</span>
        </p>
        <div className="form-gauge-track" style={{ marginBottom: 14 }}>
          <div
            className="form-gauge-fill"
            style={{
              width: `${formScore}%`,
              background: formScore >= 70 ? 'var(--accent)' : 'var(--color-warn)',
            }}
          />
        </div>
        {topCues.length > 0 ? (
          <div className="feedback-cue-list">
            {topCues.map((c, i) => (
              <div key={i} className="feedback-cue-item">
                <span className="feedback-cue-dot" style={{ background: cueDotColor(c.severity) }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    {c.text}
                  </span>
                  {c.voiceText !== c.text && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                      {c.voiceText}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="feedback-cue-wrap">
            <p className="feedback-cue-text">{primaryCue}</p>
          </div>
        )}
      </div>

      {/* ── Popular exercises grid + browse all ── */}
      <div className="card">
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
          Popular Exercises
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {exercises.slice(0, 6).map(ex => {
            const isActive = ex.id === selectedExercise;
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => onExerciseChange(ex.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: isActive ? 'var(--accent-muted)' : 'var(--bg-card-raised)',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                  lineHeight: 1.3,
                }}
              >
                {ex.name}
              </button>
            );
          })}
        </div>

        {extraExercises.length > 0 && (
          <div style={{ marginTop: 12, position: 'relative' }}>
            <select
              value={selectedIsExtra ? selectedExercise : ''}
              onChange={e => { if (e.target.value) onExerciseChange(e.target.value); }}
              style={{
                width: '100%',
                height: 40,
                padding: '0 36px 0 12px',
                borderRadius: 10,
                border: selectedIsExtra ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: selectedIsExtra ? 'var(--accent-muted)' : 'var(--bg-card-raised)',
                color: selectedIsExtra ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: selectedIsExtra ? 700 : 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23${selectedIsExtra ? 'D5FF5F' : '8892A0'}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                outline: 'none',
              }}
            >
              <option value="" disabled>More exercises…</option>
              {extraExercises.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Voice cues toggle ── */}
      <div className="card" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Voice cues</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Spoken feedback on reps</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={voiceEnabled}
            onClick={onVoiceToggle}
            style={{
              position: 'relative',
              flexShrink: 0,
              width: 44,
              height: 26,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: voiceEnabled ? 'var(--accent)' : 'var(--bg-input)',
              transition: 'background 0.2s ease',
              padding: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: voiceEnabled ? 21 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: voiceEnabled ? 'var(--text-on-lime)' : 'var(--text-muted)',
                transition: 'left 0.2s ease',
                display: 'block',
              }}
            />
          </button>
        </div>
      </div>

      {/* ── End session & save ── */}
      <button
        type="button"
        className="btn btn-primary btn-full"
        onClick={onSave}
        disabled={!isCameraRunning}
      >
        End session & save
      </button>

    </div>
  );
}
