import { getSupabaseServer } from '@/lib/supabaseServer';
import { fetchNutritionGoalsServer } from '@/lib/nutrition/server';
import { NutritionClient } from './NutritionClient';

export default async function NutritionPage() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const initialGoals = user ? await fetchNutritionGoalsServer(user.id) : null;

  return <NutritionClient initialGoals={initialGoals} />;
}
