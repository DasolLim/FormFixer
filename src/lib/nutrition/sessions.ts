import { getSupabaseClient } from '@/lib/supabaseClient';
import type { MacroInput, MealItemRow, MealType, NutritionGoals } from '@/lib/nutrition/types';

export async function addMealItem(payload: {
  userId: string;
  mealType: MealType;
  foodName: string;
  servingAmount: number;
  servingUnit: string;
  macros: MacroInput;
}) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('meal_items').insert({
    user_id: payload.userId,
    meal_type: payload.mealType,
    food_name: payload.foodName,
    serving_amount: payload.servingAmount,
    serving_unit: payload.servingUnit,
    calories: payload.macros.calories,
    protein_g: payload.macros.protein,
    carbs_g: payload.macros.carbs,
    fats_g: payload.macros.fats,
  });
  return { error };
}

export async function fetchDailyMealItems(userId: string, date: string) {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('meal_items')
    .select('id,meal_type,food_name,serving_amount,serving_unit,calories,protein_g,carbs_g,fats_g,created_at')
    .eq('user_id', userId)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false });
  return { data: (data ?? []) as MealItemRow[], error };
}

export async function saveNutritionGoals(userId: string, goals: NutritionGoals) {
  const supabase = getSupabaseClient();
  console.log('[saveNutritionGoals] userId:', userId, 'goals:', goals);
  const { data, error } = await supabase
    .from('profiles')
    .update({ nutrition_goals: goals as unknown as import('@/lib/database.types').Json })
    .eq('id', userId)
    .select('id,nutrition_goals');
  console.log('[saveNutritionGoals] data:', data, 'error:', error);
  return { error };
}
