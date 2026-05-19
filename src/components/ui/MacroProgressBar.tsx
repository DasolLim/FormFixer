import type { NutritionGoals } from '@/lib/nutrition/types';

interface MacroProgressBarProps {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit?: string;
}

export function MacroProgressBar({ label, current, goal, color, unit = 'g' }: MacroProgressBarProps) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  return (
    <div className="macro-bar-wrap">
      <div className="macro-bar-header">
        <span className="macro-bar-label">{label}</span>
        <span className="macro-bar-value">
          {Math.round(current)}{unit} / {goal}{unit}
        </span>
      </div>
      <div className="macro-bar-track">
        <div className="macro-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

interface MacroSummaryProps {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  goals: NutritionGoals;
}

export function MacroSummary({ calories, protein, carbs, fats, goals }: MacroSummaryProps) {
  return (
    <div className="macro-summary">
      <MacroProgressBar label="Calories" current={calories} goal={goals.calorieGoal} color="var(--accent)" unit=" kcal" />
      <MacroProgressBar label="Protein" current={protein} goal={goals.proteinGoal} color="#4ADED0" />
      <MacroProgressBar label="Carbs" current={carbs} goal={goals.carbGoal} color="#F5C842" />
      <MacroProgressBar label="Fat" current={fats} goal={goals.fatGoal} color="#FF6B6B" />
    </div>
  );
}
