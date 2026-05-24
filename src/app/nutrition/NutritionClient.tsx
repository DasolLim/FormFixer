'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MacroSummary } from '@/components/ui/MacroProgressBar';
import { NutritionGoalsModal, type ProfileForModal } from '@/components/ui/NutritionGoalsModal';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { addMealItem, fetchDailyMealItems, saveNutritionGoals } from '@/lib/nutrition/sessions';
import type { MacroInput, MealItemRow, MealType, NutritionGoals, UsdaSearchItem } from '@/lib/nutrition/types';
import type { BodyMetricsUpdate } from '@/lib/nutrition';
import { Search, Settings } from 'lucide-react';
import { CalorieBurnCard } from './CalorieBurnCard';
import { rlLimited, rlIncrement, rlRemaining, rlResetLabel } from '@/lib/rate-limit';

const FOOD_SEARCH_KEY = 'food_search';
const FOOD_SEARCH_MAX = 25;

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type LogTab = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const LOG_TABS: { key: LogTab; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch',     label: 'Lunch' },
  { key: 'snack',     label: 'Snack' },
  { key: 'dinner',    label: 'Dinner' },
];

// Portion scaling helper (CHANGE 7)
function scaleMacros(per100g: MacroInput, portionGrams: number): MacroInput {
  const ratio = portionGrams / 100;
  return {
    calories: Math.round(per100g.calories  * ratio),
    protein:  Math.round(per100g.protein   * ratio * 10) / 10,
    carbs:    Math.round(per100g.carbs     * ratio * 10) / 10,
    fats:     Math.round(per100g.fats      * ratio * 10) / 10,
  };
}

interface NutritionClientProps {
  initialGoals: NutritionGoals | null;
}

export function NutritionClient({ initialGoals }: NutritionClientProps) {
  const [userId, setUserId]                 = useState<string | null>(null);
  const [profile, setProfile]               = useState<ProfileForModal | null>(null);
  const [goals, setGoals]                   = useState<NutritionGoals | null>(initialGoals);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [mealType, setMealType]             = useState<MealType>('breakfast');
  const [logTab, setLogTab]                 = useState<LogTab>('breakfast');
  const [foodName, setFoodName]             = useState('');
  const [servingAmount, setServingAmount]   = useState(100);
  const [servingUnit, setServingUnit]       = useState('g');
  const [macros, setMacros]                 = useState<MacroInput>({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [message, setMessage]               = useState('');
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<UsdaSearchItem[]>([]);
  const [isSearching, setIsSearching]       = useState(false);
  const [isFetchingFood, setIsFetchingFood] = useState(false);
  const [foodFetchError, setFoodFetchError] = useState<string | null>(null);
  const [dailyItems, setDailyItems]         = useState<MealItemRow[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [goalsSaveError, setGoalsSaveError] = useState<string | null>(null);

  // CHANGE 7 — portion scaling state
  const [macrosPer100g, setMacrosPer100g]   = useState<MacroInput | null>(null);
  const [portionGrams, setPortionGrams]     = useState(100);
  const portionInputRef                      = useRef<HTMLInputElement>(null);
  const [portionDraft, setPortionDraft]     = useState('100');

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

      const { data: profileData } = await supabase
        .from('profiles')
        .select('target_weight_kg, weight_unit, height_cm, height_unit, age, biological_sex, activity_level')
        .eq('id', data.user.id)
        .single();
      if (profileData) setProfile(profileData as ProfileForModal);
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
    setMacrosPer100g(null);
    setPortionGrams(100);
    setPortionDraft('100');
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

      setFoodName(json.description ?? '');
      setServingUnit(json.servingUnit ?? 'g');
      setMacrosPer100g(per100);

      // Set initial portion = serving size, scale macros accordingly
      const initialPortion = Math.max(1, serving);
      setPortionGrams(initialPortion);
      setPortionDraft(String(initialPortion));
      setServingAmount(initialPortion);
      setMacros(scaleMacros(per100, initialPortion));

      setSearchResults([]);
      setSearchQuery('');
    } catch (err) {
      setFoodFetchError('Network error loading food details.');
      console.error('[selectUsdaFood]', err);
    } finally {
      setIsFetchingFood(false);
    }
  }

  // CHANGE 7 — apply portion scaling on blur/Enter
  function applyPortion() {
    const val = Number(portionDraft);
    if (!val || val < 1 || val > 9999) {
      // Reset to last valid
      setPortionDraft(String(portionGrams));
      return;
    }
    setPortionGrams(val);
    setServingAmount(val);
    if (macrosPer100g) {
      setMacros(scaleMacros(macrosPer100g, val));
    }
  }

  async function handleSaveGoals(newGoals: NutritionGoals, metrics: BodyMetricsUpdate) {
    setGoalsSaveError(null);
    if (!userId) {
      setGoalsSaveError('Not logged in — please reload the page and try again.');
      return;
    }
    const supabase = getSupabaseClient();
    const [goalsResult, profileResult] = await Promise.all([
      saveNutritionGoals(userId, newGoals),
      supabase.from('profiles').update({
        target_weight_kg: metrics.target_weight_kg,
        height_cm:        metrics.height_cm,
        age:              metrics.age,
        biological_sex:   metrics.biological_sex,
        activity_level:   metrics.activity_level,
        height_unit:      metrics.height_unit,
        weight_unit:      metrics.weight_unit,
      }).eq('id', userId),
    ]);
    if (goalsResult.error || profileResult.error) {
      setGoalsSaveError(`Failed to save: ${goalsResult.error?.message ?? profileResult.error?.message}`);
      return;
    }
    setGoals(newGoals);
    setProfile(prev => prev ? {
      ...prev,
      target_weight_kg: metrics.target_weight_kg,
      height_cm:        metrics.height_cm,
      age:              metrics.age,
      biological_sex:   metrics.biological_sex,
      activity_level:   metrics.activity_level,
      height_unit:      metrics.height_unit,
      weight_unit:      metrics.weight_unit,
    } : null);
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
          profile={profile}
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

          {/* Meal log with tabs — CHANGE 6: includes snack */}
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
                      fontSize: 12,
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

              {/* CHANGE 7 — Portion scaling input */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="form-label">
                  Portion (g)
                  <input
                    ref={portionInputRef}
                    type="number"
                    min={1}
                    max={9999}
                    value={portionDraft}
                    onChange={e => setPortionDraft(e.target.value)}
                    onBlur={applyPortion}
                    onKeyDown={e => { if (e.key === 'Enter') { applyPortion(); portionInputRef.current?.blur(); } }}
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

              {macrosPer100g && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '-4px 0' }}>
                  Per 100 g: {macrosPer100g.calories} kcal · {macrosPer100g.protein}g protein
                </p>
              )}

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

          <CalorieBurnCard userId={userId} />

        </div>
      </div>

    </div>
  );
}
