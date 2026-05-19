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

export type NutritionGoals = {
  goalType: GoalType;
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
};

export function calculateMacroGoals(weightKg: number, goalType: GoalType): NutritionGoals {
  const base = Math.round(weightKg * 30);
  const adjust: Record<GoalType, number> = {
    lose_weight: -400,
    maintain: 0,
    build_muscle: 300,
  };
  const calorieGoal = base + adjust[goalType];
  const proteinGoal = goalType === 'build_muscle'
    ? Math.round(weightKg * 2)
    : Math.round(weightKg * 1.6);
  const fatGoal = Math.round((calorieGoal * 0.25) / 9);
  const carbGoal = Math.max(0, Math.round((calorieGoal - proteinGoal * 4 - fatGoal * 9) / 4));
  return { goalType, calorieGoal, proteinGoal, carbGoal, fatGoal };
}
