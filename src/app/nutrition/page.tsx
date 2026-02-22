'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Section } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { addMealItem, fetchDailyMealItems } from '@/lib/nutrition/sessions';
import type { MacroInput, MealItemRow, MealType, UsdaSearchItem } from '@/lib/nutrition/types';

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function NutritionPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [foodName, setFoodName] = useState('');
  const [servingAmount, setServingAmount] = useState(100);
  const [servingUnit, setServingUnit] = useState('g');
  const [macros, setMacros] = useState<MacroInput>({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [message, setMessage] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UsdaSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [dailyItems, setDailyItems] = useState<MealItemRow[]>([]);

  const today = new Date().toISOString().slice(0, 10);

  const loadDailyItems = useCallback(async (currentUserId: string) => {
    const result = await fetchDailyMealItems(currentUserId, today);
    if (!result.error) setDailyItems(result.data);
  }, [today]);

  useEffect(() => {
    getSupabaseClient().then((supabase) =>
      supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
        if (!data.user) return;
        setUserId(data.user.id);
        await loadDailyItems(data.user.id);
      })
    );
  }, [loadDailyItems]);

  const totals = useMemo(
    () =>
      dailyItems.reduce(
        (acc, item) => {
          acc.calories += item.calories;
          acc.protein += item.protein_g;
          acc.carbs += item.carbs_g;
          acc.fats += item.fats_g;
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      ),
    [dailyItems]
  );

  async function handleSaveMealItem() {
    setMessage('');
    if (!userId) {
      setMessage('Login required to save meal logs.');
      return;
    }

    const result = await addMealItem({ userId, mealType, foodName, servingAmount, servingUnit, macros });
    if (result.error) {
      setMessage(`Save failed: ${result.error.message}`);
      return;
    }

    setMessage('Meal item saved.');
    setFoodName('');
    await loadDailyItems(userId);
  }

  async function handleSearchFood() {
    setIsSearching(true);
    try {
      const response = await fetch(`/api/usda/search?q=${encodeURIComponent(searchQuery)}`);
      const json = await response.json();
      setSearchResults(json.foods ?? []);
    } finally {
      setIsSearching(false);
    }
  }

  async function selectUsdaFood(fdcId: number) {
    const response = await fetch(`/api/usda/food/${fdcId}`);
    const json = await response.json();

    setFoodName(json.description ?? 'USDA Food');
    setServingAmount(Number(json.servingSize ?? 100));
    setServingUnit(json.servingUnit ?? 'g');

    const per100 = json.macrosPer100g ?? { calories: 0, protein: 0, carbs: 0, fats: 0 };
    const ratio = Number(json.servingSize ?? 100) / 100;
    setMacros({
      calories: Number((per100.calories * ratio).toFixed(1)),
      protein: Number((per100.protein * ratio).toFixed(1)),
      carbs: Number((per100.carbs * ratio).toFixed(1)),
      fats: Number((per100.fats * ratio).toFixed(1))
    });
  }

  return (
    <Section title="Nutrition" subtitle="Meal Logging + Macros" description="Track meals manually and use USDA food search for nutrition lookup.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Card title="Calories" description={`${Math.round(totals.calories)}`} />
        <Card title="Protein" description={`${totals.protein.toFixed(1)} g`} />
        <Card title="Carbs" description={`${totals.carbs.toFixed(1)} g`} />
        <Card title="Fats" description={`${totals.fats.toFixed(1)} g`} />
      </div>

      <Card title="USDA Food Search" description="Search food, pick an item, then edit servings/macros before saving.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search foods..." style={{ flex: 1, minWidth: 220, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
          <Button onClick={handleSearchFood}>{isSearching ? 'Searching...' : 'Search USDA'}</Button>
        </div>

        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {searchResults.map((item) => (
            <button
              key={item.fdcId}
              type="button"
              onClick={() => selectUsdaFood(item.fdcId)}
              style={{ textAlign: 'left', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0f182d', color: 'var(--text)', cursor: 'pointer' }}
            >
              {item.description} {item.brandOwner ? `· ${item.brandOwner}` : ''}
            </button>
          ))}
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card title="Manual Meal Entry" description="You can always edit food values manually.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            <label>
              Meal
              <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }}>
                {mealTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Food
              <input value={foodName} onChange={(e) => setFoodName(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
            </label>
            <label>
              Serving Amount
              <input type="number" value={servingAmount} onChange={(e) => setServingAmount(Number(e.target.value || 0))} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
            </label>
            <label>
              Unit
              <input value={servingUnit} onChange={(e) => setServingUnit(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
            </label>
            <label>
              Calories
              <input type="number" value={macros.calories} onChange={(e) => setMacros((prev) => ({ ...prev, calories: Number(e.target.value || 0) }))} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
            </label>
            <label>
              Protein (g)
              <input type="number" value={macros.protein} onChange={(e) => setMacros((prev) => ({ ...prev, protein: Number(e.target.value || 0) }))} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
            </label>
            <label>
              Carbs (g)
              <input type="number" value={macros.carbs} onChange={(e) => setMacros((prev) => ({ ...prev, carbs: Number(e.target.value || 0) }))} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
            </label>
            <label>
              Fats (g)
              <input type="number" value={macros.fats} onChange={(e) => setMacros((prev) => ({ ...prev, fats: Number(e.target.value || 0) }))} style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: '#0d1629', color: 'var(--text)' }} />
            </label>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button onClick={handleSaveMealItem}>Save Meal Item</Button>
          </div>
          {message ? <p style={{ color: 'var(--muted)' }}>{message}</p> : null}
        </Card>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        {dailyItems.map((item) => (
          <Card
            key={item.id}
            title={`${item.meal_type.toUpperCase()} · ${item.food_name}`}
            description={`${item.calories} kcal · P ${item.protein_g}g · C ${item.carbs_g}g · F ${item.fats_g}g`}
          />
        ))}
        {dailyItems.length === 0 ? <Card title="No meal logs today" description="Add your first meal item above." /> : null}
      </div>

      <div style={{ marginTop: 16 }}>
        <Card title="Food photo integration" description="Deferred: food image capture/recognition will be added in a later phase." />
      </div>
    </Section>
  );
}
