'use client';

import { useRef } from 'react';

export type WorkoutConfig = {
  targetSets: number;
  targetReps: number;
  restSeconds: number;
};

interface WorkoutConfigPanelProps {
  config: WorkoutConfig;
  onChange: (config: WorkoutConfig) => void;
}

const DEBOUNCE_MS = 250;

export function WorkoutConfigPanel({ config, onChange }: WorkoutConfigPanelProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(key: keyof WorkoutConfig, value: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange({ ...config, [key]: value });
    }, DEBOUNCE_MS);
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
            max={100}
            value={config.targetSets}
            onChange={e => update('targetSets', Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Reps
          <input
            type="number"
            min={1}
            max={1000}
            value={config.targetReps}
            onChange={e => update('targetReps', Math.min(1000, Math.max(1, Number(e.target.value) || 1)))}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Rest (s)
          <input
            type="number"
            min={10}
            max={10000}
            step={5}
            value={config.restSeconds}
            onChange={e => update('restSeconds', Math.min(10000, Math.max(10, Number(e.target.value) || 10)))}
            className="field-input"
          />
        </label>
      </div>
    </div>
  );
}
