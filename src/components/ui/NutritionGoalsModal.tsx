'use client';

import React, { useState, useMemo } from 'react';
import type { GoalType, NutritionGoals } from '@/lib/nutrition/types';
import {
  calculateTDEE, calculateBMI, getBMICategory, calculateMacros,
  getBMIContextNote, BMI_CATEGORY_LABELS, BMI_CATEGORY_COLORS,
  type ActivityLevel, type BiologicalSex, type Goal, type MacroTargets, type BodyMetricsUpdate,
} from '@/lib/nutrition';

const toKg = (lb: number)  => Math.round(lb * 0.453592 * 10) / 10;
const toLb = (kg: number)  => Math.round(kg * 2.20462 * 10) / 10;
const toCm = (ft: number, inches: number) => Math.round(ft * 30.48 + inches * 2.54);

const GOAL_TO_NEW: Record<GoalType, Goal> = {
  lose_weight:  'weight_loss',
  build_muscle: 'muscle_gain',
  maintain:     'maintain',
};

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary',         label: 'Sedentary',         desc: 'little or no exercise' },
  { value: 'lightly_active',    label: 'Lightly active',    desc: 'light exercise 1–3 days/week' },
  { value: 'moderately_active', label: 'Moderately active', desc: 'moderate exercise 3–5 days/week' },
  { value: 'very_active',       label: 'Very active',       desc: 'hard exercise 6–7 days/week' },
  { value: 'extremely_active',  label: 'Extremely active',  desc: 'very hard exercise, physical job' },
];

const SEX_OPTIONS: { value: BiologicalSex; label: string }[] = [
  { value: 'male',                  label: 'Male' },
  { value: 'female',                label: 'Female' },
  { value: 'prefer_not_to_answer',  label: 'Prefer not to answer' },
];

const BMI_ZONES = [
  { from: 15, to: 18.5, color: '#3b82f6' },
  { from: 18.5, to: 25, color: '#22c55e' },
  { from: 25,   to: 30, color: '#f59e0b' },
  { from: 30,   to: 35, color: '#f97316' },
  { from: 35,   to: 40, color: '#ef4444' },
  { from: 40,   to: 45, color: '#991b1b' },
];
const BMI_MIN = 15, BMI_MAX = 45;

export type ProfileForModal = {
  target_weight_kg: number | null;
  weight_unit:      string | null;
  height_cm:        number | null;
  height_unit:      string | null;
  age:              number | null;
  biological_sex:   string | null;
  activity_level:   string | null;
};

interface NutritionGoalsModalProps {
  goals:   NutritionGoals | null;
  profile: ProfileForModal | null;
  onSave:  (goals: NutritionGoals, metrics: BodyMetricsUpdate) => void;
  onClose: () => void;
}

export function NutritionGoalsModal({ goals, profile, onSave, onClose }: NutritionGoalsModalProps) {
  // ── Weight ───────────────────────────────────────────────────────────────────
  const [weightKg,   setWeightKg]   = useState(profile?.target_weight_kg ?? 70);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>((profile?.weight_unit as 'kg' | 'lb') ?? 'kg');

  // ── Height ───────────────────────────────────────────────────────────────────
  const [heightCm,   setHeightCm]   = useState<number | null>(profile?.height_cm ?? null);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft_in'>((profile?.height_unit as 'cm' | 'ft_in') ?? 'cm');
  const [heightFt,   setHeightFt]   = useState(() => {
    const cm = profile?.height_cm;
    return cm ? Math.floor((cm / 2.54) / 12) : 5;
  });
  const [heightIn,   setHeightIn]   = useState(() => {
    const cm = profile?.height_cm;
    return cm ? Math.round((cm / 2.54) % 12) : 8;
  });

  // ── Demographics ─────────────────────────────────────────────────────────────
  const [age,          setAge]          = useState<number | null>(profile?.age ?? null);
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>((profile?.biological_sex as BiologicalSex) ?? null);

  // ── Goal + activity ───────────────────────────────────────────────────────────
  const [goalType,      setGoalType]      = useState<GoalType>(goals?.goalType ?? 'maintain');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>((profile?.activity_level as ActivityLevel) ?? 'moderately_active');

  // ── Macro overrides ───────────────────────────────────────────────────────────
  const [calories,  setCalories]  = useState(goals?.calorieGoal ?? 2000);
  const [protein_g, setProtein]   = useState(goals?.proteinGoal ?? 150);
  const [carbs_g,   setCarbs]     = useState(goals?.carbGoal    ?? 200);
  const [fat_g,     setFat]       = useState(goals?.fatGoal     ?? 60);
  const [hasCalculated, setHasCalculated] = useState(!!goals);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const bmi      = heightCm && weightKg ? calculateBMI(weightKg, heightCm) : null;
  const bmiCat   = bmi ? getBMICategory(bmi) : null;
  const bmiColor = bmiCat ? BMI_CATEGORY_COLORS[bmiCat] : 'var(--text-muted)';

  const tdee = useMemo(
    () => calculateTDEE(weightKg, heightCm, age, biologicalSex, activityLevel),
    [weightKg, heightCm, age, biologicalSex, activityLevel],
  );

  const displayWeight = weightUnit === 'lb' ? toLb(weightKg) : weightKg;

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function handleWeightChange(val: number) {
    setWeightKg(weightUnit === 'lb' ? toKg(val) : val);
  }

  function handleWeightUnitToggle(unit: 'kg' | 'lb') {
    setWeightUnit(unit);
  }

  function handleHeightCmChange(val: number) {
    const cm = val || null;
    setHeightCm(cm);
    if (cm) {
      const totalIn = cm / 2.54;
      setHeightFt(Math.floor(totalIn / 12));
      setHeightIn(Math.round(totalIn % 12));
    }
  }

  function handleHeightFtInChange(ft: number, inches: number) {
    setHeightFt(ft);
    setHeightIn(inches);
    const cm = toCm(ft, inches);
    setHeightCm(cm || null);
  }

  function handleHeightUnitToggle(unit: 'cm' | 'ft_in') {
    setHeightUnit(unit);
    if (unit === 'ft_in' && heightCm) {
      const totalIn = heightCm / 2.54;
      setHeightFt(Math.floor(totalIn / 12));
      setHeightIn(Math.round(totalIn % 12));
    }
  }

  function handleProteinChange(val: number) {
    setProtein(val);
    setCalories(Math.round(val * 4 + carbs_g * 4 + fat_g * 9));
  }

  function handleCarbsChange(val: number) {
    setCarbs(val);
    setCalories(Math.round(protein_g * 4 + val * 4 + fat_g * 9));
  }

  function handleFatChange(val: number) {
    setFat(val);
    setCalories(Math.round(protein_g * 4 + carbs_g * 4 + val * 9));
  }

  function handleCalculate() {
    const result: MacroTargets = calculateMacros(weightKg, tdee, GOAL_TO_NEW[goalType]);
    setCalories(result.calories);
    setProtein(result.protein_g);
    setCarbs(result.carbs_g);
    setFat(result.fat_g);
    setHasCalculated(true);
  }

  function handleSave() {
    onSave(
      { goalType, calorieGoal: calories, proteinGoal: protein_g, carbGoal: carbs_g, fatGoal: fat_g },
      {
        target_weight_kg: weightKg,
        height_cm:        heightCm,
        age,
        biological_sex:   biologicalSex,
        activity_level:   activityLevel,
        height_unit:      heightUnit,
        weight_unit:      weightUnit,
      },
    );
  }

  // TDEE diff display
  const diff      = calories - tdee;
  const diffAbs   = Math.abs(diff);
  const diffLabel = diffAbs <= 50
    ? 'at maintenance'
    : diff < 0
      ? `−${diffAbs} kcal below TDEE`
      : `+${diffAbs} kcal above TDEE`;
  const diffColor = diffAbs <= 50 ? 'var(--text-muted)' : diff < 0 ? '#22c55e' : '#f59e0b';

  // Recommended ranges
  const proteinMin   = Math.round(weightKg * 1.6);
  const proteinMax   = Math.round(weightKg * 2.4);
  const fatMin       = Math.round(weightKg * 0.7);
  const fatMax       = Math.round(weightKg * 1.2);
  const proteinWarn  = hasCalculated && (protein_g < proteinMin || protein_g > proteinMax);
  const fatWarn      = hasCalculated && (fat_g < fatMin || fat_g > fatMax);

  // Shared inline style fragments
  const radioRow: React.CSSProperties = {
    display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6,
  };
  const radioBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 20,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-muted)' : 'var(--bg-input)',
    cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 500,
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontFamily: 'inherit',
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '88vh', overflowY: 'auto' }}
      >
        <h3 className="modal-title">Nutrition Goals</h3>

        <div className="field-group">

          {/* Weight */}
          <div>
            <p className="field-label" style={{ marginBottom: 6 }}>Body weight</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                min={30}
                max={500}
                step={0.1}
                value={displayWeight}
                onChange={e => handleWeightChange(Number(e.target.value) || 70)}
                className="field-input"
                style={{ flex: 1 }}
              />
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                {(['kg', 'lb'] as const).map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleWeightUnitToggle(u)}
                    style={{
                      padding: '6px 14px', border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                      background: weightUnit === u ? 'var(--accent)' : 'var(--bg-input)',
                      color: weightUnit === u ? 'var(--text-on-lime)' : 'var(--text-secondary)',
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Height */}
          <div>
            <p className="field-label" style={{ marginBottom: 6 }}>Height</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {heightUnit === 'cm' ? (
                <input
                  type="number"
                  min={100}
                  max={250}
                  value={heightCm ?? ''}
                  placeholder="e.g. 175"
                  onChange={e => handleHeightCmChange(Number(e.target.value))}
                  className="field-input"
                  style={{ flex: 1 }}
                />
              ) : (
                <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                  <input
                    type="number"
                    min={3}
                    max={8}
                    value={heightFt}
                    onChange={e => handleHeightFtInChange(Number(e.target.value) || 0, heightIn)}
                    className="field-input"
                    placeholder="ft"
                  />
                  <input
                    type="number"
                    min={0}
                    max={11}
                    value={heightIn}
                    onChange={e => handleHeightFtInChange(heightFt, Number(e.target.value) || 0)}
                    className="field-input"
                    placeholder="in"
                  />
                </div>
              )}
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                {(['cm', 'ft_in'] as const).map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleHeightUnitToggle(u)}
                    style={{
                      padding: '6px 10px', border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                      background: heightUnit === u ? 'var(--accent)' : 'var(--bg-input)',
                      color: heightUnit === u ? 'var(--text-on-lime)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {u === 'cm' ? 'cm' : 'ft / in'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Age */}
          <label className="field-label">
            Age
            <input
              type="number"
              min={10}
              max={100}
              value={age ?? ''}
              placeholder="e.g. 28"
              onChange={e => setAge(Number(e.target.value) || null)}
              className="field-input"
            />
          </label>

          {/* Biological sex */}
          <div>
            <p className="field-label" style={{ marginBottom: 0 }}>Biological sex</p>
            <div style={radioRow}>
              {SEX_OPTIONS.map(opt => (
                <button key={opt.value} type="button" style={radioBtn(biologicalSex === opt.value)}
                  onClick={() => setBiologicalSex(opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* BMI display */}
          {bmi !== null && bmiCat !== null && (
            <div style={{
              background: 'var(--bg-input)', borderRadius: 10, padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: bmiColor, fontVariantNumeric: 'tabular-nums' }}>{bmi}</span>
                <span style={{ fontSize: 13, color: bmiColor, fontWeight: 600 }}>{BMI_CATEGORY_LABELS[bmiCat]}</span>
              </div>
              {/* BMI bar */}
              <div style={{ position: 'relative', height: 10, borderRadius: 5, display: 'flex', overflow: 'hidden', marginBottom: 4 }}>
                {BMI_ZONES.map(z => (
                  <div
                    key={z.from}
                    style={{ width: `${((z.to - z.from) / (BMI_MAX - BMI_MIN)) * 100}%`, background: z.color }}
                  />
                ))}
                <div style={{
                  position: 'absolute',
                  left: `${Math.min(100, Math.max(0, ((bmi - BMI_MIN) / (BMI_MAX - BMI_MIN)) * 100))}%`,
                  top: -2, width: 2, height: 14,
                  background: '#fff', borderRadius: 1,
                  transform: 'translateX(-1px)',
                  boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {[15, 18.5, 25, 30, 35, 40, 45].map(v => (
                  <span key={v} style={{ fontSize: 9, color: 'var(--text-muted)' }}>{v}</span>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '8px 0 0', lineHeight: 1.5 }}>
                {getBMIContextNote(bmiCat, GOAL_TO_NEW[goalType])}
              </p>
            </div>
          )}

          {/* Activity level */}
          <div>
            <p className="field-label" style={{ marginBottom: 4 }}>Activity level</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ACTIVITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setActivityLevel(opt.value)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    background: activityLevel === opt.value ? 'var(--accent-muted)' : 'var(--bg-input)',
                    outline: activityLevel === opt.value ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: activityLevel === opt.value ? 700 : 500, color: activityLevel === opt.value ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div>
            <p className="field-label" style={{ marginBottom: 4 }}>Goal</p>
            <div style={radioRow}>
              {(['lose_weight', 'maintain', 'build_muscle'] as GoalType[]).map(g => {
                const labels: Record<GoalType, string> = { lose_weight: 'Lose weight', maintain: 'Maintain', build_muscle: 'Build muscle' };
                return (
                  <button key={g} type="button" style={radioBtn(goalType === g)} onClick={() => setGoalType(g)}>
                    {labels[g]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Estimated TDEE */}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0' }}>
            Estimated TDEE: <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tdee} kcal/day</span>
            {(!heightCm || !age || !biologicalSex) && (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}> (add height, age &amp; sex for accurate Mifflin-St Jeor)</span>
            )}
          </p>

          <button type="button" className="btn btn-secondary" onClick={handleCalculate} style={{ marginTop: 4 }}>
            Calculate Targets
          </button>
        </div>

        {/* Macro override fields */}
        {hasCalculated && (
          <div style={{
            background: 'var(--bg-input)', borderRadius: 12,
            padding: '14px 16px', margin: '12px 0',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Macro targets
              </p>
              <span style={{ fontSize: 11, color: diffColor, fontWeight: 600 }}>{diffLabel}</span>
            </div>

            {/* Calories */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', width: 60, flexShrink: 0 }}>Calories</label>
                <input
                  type="number"
                  min={1000}
                  max={9000}
                  value={calories}
                  onChange={e => setCalories(Number(e.target.value) || 0)}
                  className="field-input"
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>kcal</span>
              </div>
            </div>

            {/* Protein */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', width: 60, flexShrink: 0 }}>Protein</label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={protein_g}
                  onChange={e => handleProteinChange(Number(e.target.value) || 0)}
                  className="field-input"
                  style={{ flex: 1, outline: proteinWarn ? '1.5px solid #f59e0b' : undefined }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>g</span>
              </div>
              <p style={{ fontSize: 10, color: proteinWarn ? '#f59e0b' : 'var(--text-muted)', margin: '3px 0 0 68px' }}>
                Recommended: {proteinMin}–{proteinMax} g{proteinWarn ? ' ⚠ outside range' : ''}
              </p>
            </div>

            {/* Carbs */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', width: 60, flexShrink: 0 }}>Carbs</label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={carbs_g}
                  onChange={e => handleCarbsChange(Number(e.target.value) || 0)}
                  className="field-input"
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>g</span>
              </div>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '3px 0 0 68px' }}>
                Residual after protein and fat
              </p>
            </div>

            {/* Fat */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', width: 60, flexShrink: 0 }}>Fat</label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={fat_g}
                  onChange={e => handleFatChange(Number(e.target.value) || 0)}
                  className="field-input"
                  style={{ flex: 1, outline: fatWarn ? '1.5px solid #f59e0b' : undefined }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>g</span>
              </div>
              <p style={{ fontSize: 10, color: fatWarn ? '#f59e0b' : 'var(--text-muted)', margin: '3px 0 0 68px' }}>
                Recommended: {fatMin}–{fatMax} g{fatWarn ? ' ⚠ outside range' : ''}
              </p>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-solid" onClick={handleSave} disabled={!hasCalculated}>
            Save Goals
          </button>
        </div>
      </div>
    </div>
  );
}
