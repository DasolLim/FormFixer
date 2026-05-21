'use client';

import { useState } from 'react';
import type { ActivityLevel, GoalType, NutritionGoals } from '@/lib/nutrition/types';
import { calculateMacroGoals } from '@/lib/nutrition/types';

interface NutritionGoalsModalProps {
  goals: NutritionGoals | null;
  onSave: (goals: NutritionGoals) => void;
  onClose: () => void;
}

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary:          'Sedentary (desk job, no exercise)',
  lightly_active:     'Lightly active (1–3 workouts/week)',
  moderately_active:  'Moderately active (3–5 workouts/week)',
  very_active:        'Very active (6–7 intense sessions/week)',
};

export function NutritionGoalsModal({ goals, onSave, onClose }: NutritionGoalsModalProps) {
  const [weightKg,      setWeightKg]      = useState(70);
  const [goalType,      setGoalType]      = useState<GoalType>(goals?.goalType ?? 'maintain');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderately_active');
  const [preview,       setPreview]       = useState<NutritionGoals | null>(goals);

  function handleGenerate() {
    setPreview(calculateMacroGoals(weightKg, goalType, activityLevel));
  }

  function handleSave() {
    if (preview) onSave(preview);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Nutrition Goals</h3>

        <div className="field-group">
          <label className="field-label">
            Body weight (kg)
            <input
              type="number"
              min={30}
              max={250}
              value={weightKg}
              onChange={e => setWeightKg(Number(e.target.value) || 70)}
              className="field-input"
            />
          </label>

          <label className="field-label">
            Goal
            <select
              value={goalType}
              onChange={e => setGoalType(e.target.value as GoalType)}
              className="exercise-select"
            >
              <option value="lose_weight">Lose weight</option>
              <option value="maintain">Maintain weight</option>
              <option value="build_muscle">Build muscle</option>
            </select>
          </label>

          <label className="field-label">
            Activity level
            <select
              value={activityLevel}
              onChange={e => setActivityLevel(e.target.value as ActivityLevel)}
              className="exercise-select"
            >
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(level => (
                <option key={level} value={level}>{ACTIVITY_LABELS[level]}</option>
              ))}
            </select>
          </label>

          <button type="button" className="btn btn-secondary" onClick={handleGenerate}>
            Calculate
          </button>
        </div>

        {preview && (
          <div className="modal-goals-preview">
            <div className="goals-row"><span>Calories</span><span>{preview.calorieGoal} kcal</span></div>
            <div className="goals-row"><span>Protein</span><span>{preview.proteinGoal}g</span></div>
            <div className="goals-row"><span>Carbs</span><span>{preview.carbGoal}g</span></div>
            <div className="goals-row"><span>Fat</span><span>{preview.fatGoal}g</span></div>
          </div>
        )}

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-solid" onClick={handleSave} disabled={!preview}>
            Save Goals
          </button>
        </div>
      </div>
    </div>
  );
}
