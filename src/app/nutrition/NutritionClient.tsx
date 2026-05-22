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
import { rlLimited, rlIncrement, rlRemaining, rlResetLabel } from '@/lib/rate-limit';

const FOOD_SEARCH_KEY = 'food_search';
const FOOD_SEARCH_MAX = 25;

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type LogTab = 'breakfast' | 'lunch' | 'dinner';
const LOG_TABS: { key: LogTab; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch',     label: 'Lunch' },
  { key: 'dinner',    label: 'Dinner' },
];

interface NutritionClientProps {
  initialGoals: NutritionGoals | null;
}

export function NutritionClient({ initialGoals }: NutritionClientProps) {
  const [userId, setUserId]                     = useState<string | null>(null);
  const [goals, setGoals]                       = useState<NutritionGoals | null>(initialGoals);
  const [showGoalsModal, setShowGoalsModal]     = useState(false);
  const [mealType, setMealType]                 = useState<MealType>('breakfast');
  const [logTab, setLogTab]                     = useState<LogTab>('breakfast');
  const [foodName, setFoodName]                 = useState('');
  const [servingAmount, setServingAmount]       = useState(100);
  const [servingUnit, setServingUnit]           = useState('g');
  const [macros, setMacros]                     = useState<MacroInput>({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [message, setMessage]                   = useState('');
  const [searchQuery, setSearchQuery]           = useState('');
  const [searchResults, setSearchResults]       = useState<UsdaSearchItem[]>([]);
  const [isSearching, setIsSearching]           = useState(false);
  const [isFetchingFood, setIsFetchingFood]     = useState(false);
  const [foodFetchError, setFoodFetchError]     = useState<string | null>(null);
  const [dailyItems, setDailyItems]             = useState<MealItemRow[]>([]);
  const [recentSearches, setRecentSearches]     = useState<string[]>([]);
  const [goalsSaveError, setGoalsSaveError]     = useState<string | null>(null);
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
          acc.protein  += item.protein_g;
          acc.carbs    += item.carbs_g;
          acc.fats     += item.fats_g;
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      ),
    [dailyItems]
  );

  const tabItems = useMemo(
    () => dailyItems.filter(item => item.meal_type === logTab),
    [dailyItems, logTab]
  );

  const caloriesPct = goals
    ? Math.min(100, Math.round((totals.calories / goals.calorieGoal) * 100))
    : 0;

  async function handleSaveMealItem() {
    setMessage('');
    if (!userId) { setMessage('Login required to save meal logs.'); return; }
    const result = await addMealItem({ userId, mealType, foodName, servingAmount, servingUnit, macros });
    if (result.error) { setMessage(`Save failed: ${result.error.message}`); return; }
    setMessage('Meal item saved.');
    setFoodName('');
    await loadDailyItems(userId);
  }

  async function handleSearchFood(query = searchQuery) {
    if (!query.trim()) return;
    if (rlLimited(FOOD_SEARCH_KEY, FOOD_SEARCH_MAX, 'day')) {
      setMessage(`Search limit reached (${FOOD_SEARCH_MAX}/day). Resets at ${rlResetLabel('day')}.`);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(`/api/usda/search?q=${encodeURIComponent(query)}`);
      const json = await response.json();
      setSearchResults(json.foods ?? []);
      setRecentSearches(prev => [query, ...prev.filter(r => r !== query)].slice(0, 5));
      rlIncrement(FOOD_SEARCH_KEY, 'day');
    } finally {
      setIsSearching(false);
    }
  }

  async function selectUsdaFood(fdcId: number) {
    setIsFetchingFood(true);
    setFoodFetchError(null);
    try {
      const response = await fetch(`/api/usda/food/${fdcId}`);
      const json = await response.json();

      if (!response.ok || json.error) {
        setFoodFetchError(json.error ?? 'Failed to load food details.');
        return;
      }

      const per100  = json.macrosPer100g ?? { calories: 0, protein: 0, carbs: 0, fats: 0 };
      const serving = Number(json.servingSize ?? 100);
      const ratio   = serving / 100;

      setFoodName(json.description ?? '');
      setServingAmount(serving);
      setServingUnit(json.servingUnit ?? 'g');
      setMacros({
        calories: Number((per100.calories * ratio).toFixed(1)),
        protein:  Number((per100.protein  * ratio).toFixed(1)),
        carbs:    Number((per100.carbs    * ratio).toFixed(1)),
        fats:     Number((per100.fats     * ratio).toFixed(1)),
      });
      setSearchResults([]);
      setSearchQuery('');
    } catch (err) {
      setFoodFetchError('Network error loading food details.');
      console.error('[selectUsdaFood]', err);
    } finally {
      setIsFetchingFood(false);
    }
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

      {showGoalsModal && (
        <NutritionGoalsModal
          goals={goals}
          onSave={handleSaveGoals}
          onClose={() => setShowGoalsModal(false)}
        />
      )}

      <div className="nutrition-desktop-grid">

        {/* ── FIRST COLUMN (left/top): Calories + Macros + Meal Log ── */}
        <div className="nutrition-col-left">

          {/* Today's calories hero */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
                  Today&apos;s calories
                </p>
                <p style={{ fontSize: 40, fontWeight: 800, margin: 0, lineHeight: 1 }}>
                  <span className="text-lime font-tabular">{Math.round(totals.calories)}</span>
                  {goals && (
                    <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 6 }}>
                      / {goals.calorieGoal}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ height: 36, padding: '0 12px', fontSize: 12 }}
                onClick={() => setShowGoalsModal(true)}
              >
                <Settings size={13} strokeWidth={1.5} />
                Goals
              </button>
            </div>
            {goals && (
              <div className="form-gauge-track" style={{ marginTop: 14 }}>
                <div
                  className="form-gauge-fill"
                  style={{ width: `${caloriesPct}%`, background: 'var(--accent)' }}
                />
              </div>
            )}
          </div>

          {/* Macros */}
          {goals ? (
            <div style={{ marginBottom: 12 }}>
              <MacroSummary
                calories={totals.calories}
                protein={totals.protein}
                carbs={totals.carbs}
                fats={totals.fats}
                goals={goals}
              />
            </div>
          ) : (
            <div className="nutrition-macro-bar" style={{ marginBottom: 12 }}>
              <div className="nutrition-macro-item accent">
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
              <div className="nutrition-macro-item">
                <span className="nutrition-macro-val">{Math.round(totals.calories)}</span>
                <span className="nutrition-macro-lbl">kcal</span>
              </div>
            </div>
          )}

          {/* Meal log with tabs */}
          <div className="card">
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>
              Meal log
            </p>

            {/* Tab row */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {LOG_TABS.map(tab => {
                const isActive = tab.key === logTab;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setLogTab(tab.key)}
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 999,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      background: isActive ? 'var(--accent)' : 'var(--bg-input)',
                      color: isActive ? 'var(--text-on-lime)' : 'var(--text-secondary)',
                      transition: 'background 0.15s ease, color 0.15s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Items or empty state */}
            {tabItems.length > 0 ? (
              tabItems.map(item => (
                <div key={item.id} className="nutrition-log-item">
                  <div className="nutrition-log-info">
                    <span className="nutrition-log-name">{item.food_name}</span>
                    <span className="nutrition-log-meta">{item.meal_type}</span>
                  </div>
                  <span className="nutrition-log-kcal">{item.calories} kcal</span>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
                  {LOG_TABS.find(t => t.key === logTab)?.label} — not logged yet
                </p>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ height: 32, padding: '0 14px', fontSize: 13 }}
                  onClick={() => setMealType(logTab)}
                >
                  + Add
                </button>
              </div>
            )}
          </div>

        </div>

        {/* ── SECOND COLUMN (right/bottom): Search + Log a Meal ── */}
        <div className="nutrition-col-right">

          {/* Search Foods */}
          <Card title="Search Foods">
            {recentSearches.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {recentSearches.map(q => (
                  <button
                    key={q}
                    type="button"
                    className="tag tag-dark"
                    style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
                    onClick={() => { setSearchQuery(q); handleSearchFood(q); }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div className="nutrition-search-bar">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search USDA database…"
                className="nutrition-search-input"
                onKeyDown={e => e.key === 'Enter' && handleSearchFood()}
                disabled={rlLimited(FOOD_SEARCH_KEY, FOOD_SEARCH_MAX, 'day')}
              />
              <button type="button" className="nutrition-search-btn" onClick={() => handleSearchFood()} disabled={rlLimited(FOOD_SEARCH_KEY, FOOD_SEARCH_MAX, 'day')}>
                <Search size={18} strokeWidth={1.5} />
              </button>
            </div>
            <p style={{ fontSize: 11, color: rlLimited(FOOD_SEARCH_KEY, FOOD_SEARCH_MAX, 'day') ? 'var(--color-warn)' : 'var(--text-muted)', marginTop: 4 }}>
              {rlRemaining(FOOD_SEARCH_KEY, FOOD_SEARCH_MAX, 'day')} of {FOOD_SEARCH_MAX} searches remaining today
            </p>
            {isSearching && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12 }}>Searching…</p>
            )}
            {searchResults.length > 0 && (
              <div className="nutrition-results-scroll" style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {searchResults.map(item => (
                    <button
                      key={item.fdcId}
                      type="button"
                      className="nutrition-food-result"
                      onClick={() => selectUsdaFood(item.fdcId)}
                      disabled={isFetchingFood}
                    >
                      <span className="nutrition-food-result-name">{item.description}</span>
                      {item.brandOwner && (
                        <span className="nutrition-food-result-brand">{item.brandOwner}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Log a Meal form */}
          <Card title="Log a Meal" id="log-a-meal-form">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {isFetchingFood && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Loading food details…</p>
            )}
            {foodFetchError && (
              <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{foodFetchError}</p>
            )}
              <label className="form-label">
                Meal type
                <select
                  value={mealType}
                  onChange={e => setMealType(e.target.value as MealType)}
                  className="exercise-select"
                >
                  {mealTypes.map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                Food name
                <input
                  value={foodName}
                  onChange={e => setFoodName(e.target.value)}
                  placeholder="e.g. Chicken breast"
                  className="form-input"
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="form-label">
                  Amount
                  <input
                    type="number"
                    value={servingAmount}
                    onChange={e => setServingAmount(Number(e.target.value || 0))}
                    className="form-input"
                  />
                </label>
                <label className="form-label">
                  Unit
                  <input
                    value={servingUnit}
                    onChange={e => setServingUnit(e.target.value)}
                    className="form-input"
                  />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="form-label">
                  Calories
                  <input
                    type="number"
                    value={macros.calories}
                    onChange={e => setMacros(prev => ({ ...prev, calories: Number(e.target.value || 0) }))}
                    className="form-input"
                  />
                </label>
                <label className="form-label">
                  Protein (g)
                  <input
                    type="number"
                    value={macros.protein}
                    onChange={e => setMacros(prev => ({ ...prev, protein: Number(e.target.value || 0) }))}
                    className="form-input"
                  />
                </label>
                <label className="form-label">
                  Carbs (g)
                  <input
                    type="number"
                    value={macros.carbs}
                    onChange={e => setMacros(prev => ({ ...prev, carbs: Number(e.target.value || 0) }))}
                    className="form-input"
                  />
                </label>
                <label className="form-label">
                  Fats (g)
                  <input
                    type="number"
                    value={macros.fats}
                    onChange={e => setMacros(prev => ({ ...prev, fats: Number(e.target.value || 0) }))}
                    className="form-input"
                  />
                </label>
              </div>
              <Button onClick={handleSaveMealItem} full>Save Meal</Button>
              {message && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{message}</p>
              )}
            </div>
          </Card>

        </div>
      </div>

    </div>
  );
}
