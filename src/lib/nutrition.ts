// ── CHANGE 2 — Mifflin-St Jeor TDEE ────────────────────────────────────────────

export type BiologicalSex = 'male' | 'female' | 'prefer_not_to_answer';

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extremely_active';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary:          1.2,
  lightly_active:     1.375,
  moderately_active:  1.55,
  very_active:        1.725,
  extremely_active:   1.9,
};

export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: BiologicalSex,
): number {
  const base = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  if (sex === 'male')   return Math.round(base + 5);
  if (sex === 'female') return Math.round(base - 161);
  return Math.round(base - 78); // average offset for prefer_not_to_answer
}

export function calculateTDEE(
  weightKg: number,
  heightCm: number | null,
  age: number | null,
  sex: BiologicalSex | null,
  activityLevel: ActivityLevel,
): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];

  // Fallback to old formula if height/age/sex not provided
  if (!heightCm || !age || !sex) {
    return Math.round(weightKg * multiplier * 24);
  }

  const bmr = calculateBMR(weightKg, heightCm, age, sex);
  return Math.round(bmr * multiplier);
}

// ── CHANGE 3a — BMI ─────────────────────────────────────────────────────────────

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export type BMICategory =
  | 'underweight'
  | 'normal'
  | 'overweight'
  | 'obese_i'
  | 'obese_ii'
  | 'obese_iii';

export function getBMICategory(bmi: number): BMICategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25.0) return 'normal';
  if (bmi < 30.0) return 'overweight';
  if (bmi < 35.0) return 'obese_i';
  if (bmi < 40.0) return 'obese_ii';
  return 'obese_iii';
}

export const BMI_CATEGORY_LABELS: Record<BMICategory, string> = {
  underweight: 'Underweight',
  normal:      'Normal weight',
  overweight:  'Overweight',
  obese_i:     'Obese (Class I)',
  obese_ii:    'Obese (Class II)',
  obese_iii:   'Obese (Class III)',
};

export const BMI_CATEGORY_COLORS: Record<BMICategory, string> = {
  underweight: '#3b82f6',
  normal:      '#22c55e',
  overweight:  '#f59e0b',
  obese_i:     '#f97316',
  obese_ii:    '#ef4444',
  obese_iii:   '#991b1b',
};

export function getBMIContextNote(category: BMICategory, goal: Goal): string {
  const notes: Record<BMICategory, Record<Goal, string>> = {
    underweight: {
      weight_loss: 'Note: Your BMI suggests you may be underweight. Weight loss is not recommended — consider consulting a doctor.',
      muscle_gain: 'Your BMI suggests building muscle mass will improve your health markers.',
      maintain:    'Your BMI is below the healthy range. Consider a muscle-building program.',
    },
    normal: {
      weight_loss: 'Your BMI is in the healthy range. A moderate calorie deficit is appropriate.',
      muscle_gain: 'Excellent baseline for muscle building.',
      maintain:    'Your BMI is in the healthy range. Maintenance calories are well-suited.',
    },
    overweight: {
      weight_loss: 'A calorie deficit and consistent training will improve your BMI significantly.',
      muscle_gain: 'Consider recomping (simultaneous fat loss and muscle gain) at your current BMI.',
      maintain:    'Maintenance is fine short-term. A mild deficit may improve long-term health.',
    },
    obese_i: {
      weight_loss: 'A structured deficit program is recommended. Consider speaking with a doctor.',
      muscle_gain: 'A recomp approach is recommended before a bulk.',
      maintain:    'Maintenance is not recommended at this BMI — a deficit approach is safer.',
    },
    obese_ii: {
      weight_loss: 'Medical guidance recommended alongside your fitness program.',
      muscle_gain: 'Focus on fat loss first before adding significant muscle-building volume.',
      maintain:    'Maintenance is not recommended at this BMI.',
    },
    obese_iii: {
      weight_loss: 'Please consult a healthcare professional before beginning a program.',
      muscle_gain: 'Please consult a healthcare professional before beginning a program.',
      maintain:    'Please consult a healthcare professional before beginning a program.',
    },
  };
  return notes[category]?.[goal] ?? '';
}

// ── CHANGE 5a — Updated macro calculation ───────────────────────────────────────

export type Goal = 'weight_loss' | 'muscle_gain' | 'maintain';

export interface MacroTargets {
  calories:  number;
  protein_g: number;
  carbs_g:   number;
  fat_g:     number;
}

export const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  weight_loss: -500,
  muscle_gain: +250,
  maintain:    0,
};

export const PROTEIN_PER_KG: Record<Goal, number> = {
  weight_loss: 2.2,
  muscle_gain: 2.0,
  maintain:    1.6,
};

// Evidence-based fat targets (g/kg bodyweight)
export const FAT_PER_KG: Record<Goal, number> = {
  weight_loss: 0.8,
  muscle_gain: 1.0,
  maintain:    0.9,
};

export function calculateMacros(
  weightKg: number,
  tdee: number,
  goal: Goal,
): MacroTargets {
  const calories  = Math.max(1200, tdee + GOAL_ADJUSTMENTS[goal]);
  const protein_g = Math.round(weightKg * PROTEIN_PER_KG[goal]);
  const fat_g     = Math.max(40, Math.round(weightKg * FAT_PER_KG[goal]));

  const proteinCals = protein_g * 4;
  const fatCals     = fat_g * 9;
  const carbsCals   = Math.max(0, calories - proteinCals - fatCals);
  const carbs_g     = Math.round(carbsCals / 4);

  return { calories, protein_g, carbs_g, fat_g };
}

// ── Shared profile update type ───────────────────────────────────────────────────

export type BodyMetricsUpdate = {
  target_weight_kg: number;
  height_cm:        number | null;
  age:              number | null;
  biological_sex:   BiologicalSex | null;
  activity_level:   ActivityLevel;
  height_unit:      'cm' | 'ft_in';
  weight_unit:      'kg' | 'lb';
};
