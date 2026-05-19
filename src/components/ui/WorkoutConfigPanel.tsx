'use client';

export type WorkoutConfig = {
  targetSets: number;
  targetReps: number;
  restSeconds: number;
};

interface WorkoutConfigPanelProps {
  config: WorkoutConfig;
  onChange: (config: WorkoutConfig) => void;
}

export function WorkoutConfigPanel({ config, onChange }: WorkoutConfigPanelProps) {
  function update(key: keyof WorkoutConfig, value: number) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="field-group">
      <p className="cam-panel-label">Workout Config</p>
      <div className="field-row">
        <label className="field-label">
          Sets
          <input
            type="number"
            min={1}
            max={10}
            value={config.targetSets}
            onChange={e => update('targetSets', Math.max(1, Number(e.target.value) || 1))}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Reps
          <input
            type="number"
            min={1}
            max={50}
            value={config.targetReps}
            onChange={e => update('targetReps', Math.max(1, Number(e.target.value) || 1))}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Rest (s)
          <input
            type="number"
            min={10}
            max={300}
            step={5}
            value={config.restSeconds}
            onChange={e => update('restSeconds', Math.max(10, Number(e.target.value) || 10))}
            className="field-input"
          />
        </label>
      </div>
    </div>
  );
}
