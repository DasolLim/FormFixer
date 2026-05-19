'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MacroSummary } from '@/components/ui/MacroProgressBar';
import { NutritionGoalsModal } from '@/components/ui/NutritionGoalsModal';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { addMealItem, fetchDailyMealItems, saveNutritionGoals } from '@/lib/nutrition/sessions';
import type { MacroInput, MealItemRow, MealType, NutritionGoals, UsdaSearchItem } from '@/lib/nutrition/types';
import { Search, Settings } from 'lucide-react';

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

interface NutritionClientProps {
  initialGoals: NutritionGoals | null;
}

export function NutritionClient({ initialGoals }: NutritionClientProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [goals, setGoals] = useState<NutritionGoals | null>(initialGoals);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
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
  const [goalsSaveError, setGoalsSaveError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const loadDailyItems = useCallback(async (uid: string) => {
    const result = await fetchDailyMealItems(uid, today);
    if (!result.error) setDailyItems(result.data);
  }, [today]);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      await loadDailyItems(data.user.id);
    })();
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
    if (!userId) { setMessage('Login required to save meal logs.'); return; }
    const result = await addMealItem({ userId, mealType, foodName, servingAmount, servingUnit, macros });
    if (result.error) { setMessage(`Save failed: ${result.error.message}`); return; }
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
      fats: Number((per100.fats * ratio).toFixed(1)),
    });
  }

  async function handleSaveGoals(newGoals: NutritionGoals) {
    setGoalsSaveError(null);
    if (!userId) {
      setGoalsSaveError('Not logged in — please reload the page and try again.');
      return;
    }
    const { error } = await saveNutritionGoals(userId, newGoals);
    if (error) {
      setGoalsSaveError(`Failed to save goals: ${error.message}`);
      return;
    }
    setGoals(newGoals);
    setShowGoalsModal(false);
  }

  return (
    <div className="ui-section">
      {goalsSaveError && (
        <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{goalsSaveError}</p>
      )}
      {/* Macro progress bars (when goals set) or summary bar (fallback) */}
      {goals ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Today&apos;s progress</span>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setShowGoalsModal(true)}>
              <Settings size={13} strokeWidth={1.5} style={{ marginRight: 4 }} />
              Goals
            </button>
          </div>
          <MacroSummary
            calories={totals.calories}
            protein={totals.protein}
            carbs={totals.carbs}
            fats={totals.fats}
            goals={goals}
          />
        </div>
      ) : (
        <div className="nutrition-macro-bar">
          <div className="nutrition-macro-item accent">
            <span className="nutrition-macro-val">{Math.round(totals.calories)}</span>
            <span className="nutrition-macro-lbl">Calories</span>
          </div>
          <div className="nutrition-macro-item">
            <span className="nutrition-macro-val">{totals.protein.toFixed(1)}g</span>
            <span className="nutrition-macro-lbl">Protein</span>
          </div>
          <div className="nutrition-macro-item">
            <span className="nutrition-macro-val">{totals.carbs.toFixed(1)}g</span>
            <span className="nutrition-macro-lbl">Carbs</span>
          </div>
          <div className="nutrition-macro-item">
            <span className="nutrition-macro-val">{totals.fats.toFixed(1)}g</span>
            <span className="nutrition-macro-lbl">Fats</span>
          </div>
          <button type="button" className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => setShowGoalsModal(true)}>
            Set goals
          </button>
        </div>
      )}

      {showGoalsModal && (
        <NutritionGoalsModal
          goals={goals}
          onSave={handleSaveGoals}
          onClose={() => setShowGoalsModal(false)}
        />
      )}

      <div className="nutrition-desktop-grid">
        <div className="nutrition-col-left">
          <Card title="Search Foods">
            <div className="nutrition-search-bar">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search USDA database…"
                className="nutrition-search-input"
                onKeyDown={e => e.key === 'Enter' && handleSearchFood()}
              />
              <button type="button" className="nutrition-search-btn" onClick={handleSearchFood}>
                <Search size={18} strokeWidth={1.5} />
              </button>
            </div>
            {isSearching && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12 }}>Searching…</p>}
            {searchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                {searchResults.map(item => (
                  <button key={item.fdcId} type="button" onClick={() => selectUsdaFood(item.fdcId)} className="nutrition-food-result">
                    <span className="nutrition-food-result-name">{item.description}</span>
                    {item.brandOwner && <span className="nutrition-food-result-brand">{item.brandOwner}</span>}
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title="Log a Meal">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <label className="form-label">
                Meal type
                <select value={mealType} onChange={e => setMealType(e.target.value as MealType)} className="exercise-select">
                  {mealTypes.map(type => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Food name
                <input value={foodName} onChange={e => setFoodName(e.target.value)} placeholder="e.g. Chicken breast" className="form-input" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="form-label">
                  Amount
                  <input type="number" value={servingAmount} onChange={e => setServingAmount(Number(e.target.value || 0))} className="form-input" />
                </label>
                <label className="form-label">
                  Unit
                  <input value={servingUnit} onChange={e => setServingUnit(e.target.value)} className="form-input" />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="form-label">
                  Calories
                  <input type="number" value={macros.calories} onChange={e => setMacros(prev => ({ ...prev, calories: Number(e.target.value || 0) }))} className="form-input" />
                </label>
                <label className="form-label">
                  Protein (g)
                  <input type="number" value={macros.protein} onChange={e => setMacros(prev => ({ ...prev, protein: Number(e.target.value || 0) }))} className="form-input" />
                </label>
                <label className="form-label">
                  Carbs (g)
                  <input type="number" value={macros.carbs} onChange={e => setMacros(prev => ({ ...prev, carbs: Number(e.target.value || 0) }))} className="form-input" />
                </label>
                <label className="form-label">
                  Fats (g)
                  <input type="number" value={macros.fats} onChange={e => setMacros(prev => ({ ...prev, fats: Number(e.target.value || 0) }))} className="form-input" />
                </label>
              </div>
              <Button onClick={handleSaveMealItem} full>Save Meal</Button>
              {message && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{message}</p>}
            </div>
          </Card>
        </div>

        <div className="nutrition-col-right">
          {dailyItems.length > 0 ? (
            <Card title={`Today's Log · ${dailyItems.length} item${dailyItems.length === 1 ? '' : 's'}`}>
              <div style={{ marginTop: 8 }}>
                {dailyItems.map(item => (
                  <div key={item.id} className="nutrition-log-item">
                    <div className="nutrition-log-info">
                      <span className="nutrition-log-name">{item.food_name}</span>
                      <span className="nutrition-log-meta">{item.meal_type}</span>
                    </div>
                    <span className="nutrition-log-kcal">{item.calories} kcal</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            !isSearching && (
              <div className="nutrition-empty-state">
                <p className="nutrition-empty-text">No meals logged yet</p>
                <p className="nutrition-empty-sub">Search for a food or use the log form to get started</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
