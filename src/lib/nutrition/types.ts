export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MacroInput = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type MealItemRow = {
  id: string;
  meal_type: MealType;
  food_name: string;
  serving_amount: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  created_at: string;
};

export type UsdaSearchItem = {
  fdcId: number;
  description: string;
  brandOwner?: string;
};

export type GoalType = 'lose_weight' | 'maintain' | 'build_muscle';

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';

export type NutritionGoals = {
  goalType: GoalType;
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
};

// TDEE multipliers based on activity level (applied to bodyweight in kg)
// Derived from Mifflin-St Jeor BMR (avg male/female, 175cm, 30y) × PAL factor
const TDEE_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary:          27, // desk job, no exercise
  lightly_active:     31, // 1-3 workouts/week
  moderately_active:  35, // 3-5 workouts/week
  very_active:        40, // 6-7 intense sessions/week
};

// Protein g/kg targets — higher in deficit to protect lean mass
const PROTEIN_PER_KG: Record<GoalType, number> = {
  lose_weight:  2.2, // max preservation of muscle in caloric deficit
  maintain:     1.6, // general active population standard
  build_muscle: 2.0, // hypertrophy research consensus
};

// Calorie adjustment on top of TDEE
const CALORIE_ADJUST: Record<GoalType, number> = {
  lose_weight:  -500, // ~0.5 kg/week loss
  maintain:        0,
  build_muscle:  250, // conservative lean bulk
};

export function calculateMacroGoals(
  weightKg: number,
  goalType: GoalType,
  activityLevel: ActivityLevel = 'moderately_active',
): NutritionGoals {
  const tdee = Math.round(weightKg * TDEE_MULTIPLIER[activityLevel]);
  const calorieGoal = Math.max(1200, tdee + CALORIE_ADJUST[goalType]);

  const proteinGoal = Math.round(weightKg * PROTEIN_PER_KG[goalType]);

  // Fat: 25% of calories, floored at 40 g for hormonal health
  const fatGoal = Math.max(40, Math.round((calorieGoal * 0.25) / 9));

  // Carbs: remaining calories after protein and fat are accounted for
  const carbGoal = Math.max(0, Math.round(
    (calorieGoal - proteinGoal * 4 - fatGoal * 9) / 4
  ));

  return { goalType, calorieGoal, proteinGoal, carbGoal, fatGoal };
}
