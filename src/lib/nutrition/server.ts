import { getSupabaseServer } from '@/lib/supabaseServer';
import type { NutritionGoals } from '@/lib/nutrition/types';

export async function fetchNutritionGoalsServer(userId: string): Promise<NutritionGoals | null> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select('nutrition_goals')
    .eq('id', userId)
    .single();

  if (!data?.nutrition_goals) return null;
  return data.nutrition_goals as unknown as NutritionGoals;
}

export async function fetchWeeklyMealSummary(
  userId: string
): Promise<{ day: string; calories: number }[]> {
  const supabase = getSupabaseServer();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('meal_items')
    .select('created_at,calories')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (!data) return [];

  const dayMap = new Map<string, number>();
  for (const item of data) {
    const day = item.created_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + item.calories);
  }

  return [...dayMap.entries()].map(([day, calories]) => ({ day, calories }));
}
