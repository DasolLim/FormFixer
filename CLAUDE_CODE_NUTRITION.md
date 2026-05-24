# Claude Code Prompt — Nutrition Feature Improvements
# TYPE: IMPROVEMENT — extend existing nutrition system only.

---

## CONTEXT

Read ARCHITECTURE.md and CLAUDE.md before touching any file.

Current nutrition system facts to read before changing anything:
- TDEE = weight × activity_multiplier (bodyweight-only shortcut — being replaced)
- Fat = fixed 25% of calories
- Protein = fixed g/kg per goal
- Carbs = residual
- Calculation is fully client-side
- Modal defaults weight to 70 kg, does not pre-populate from profile
- Food search: USDA FoodData Central via two proxied Next.js API routes
- Food detail route returns `macrosPer100g` for all items
- No caching — all USDA calls are live
- Portion scaling is client-side math only (no new API call on portion change)

The Mifflin-St Jeor replacement includes a graceful fallback: if height/age/sex
haven't been added to the profile yet, the old weight × multiplier formula is
used silently — existing users won't get broken TDEE calculations on deploy.
Fat targets are now per-goal (0.8–1.0 g/kg) instead of a flat 25%, which gives
carbs a principled basis rather than absorbing all residual calories.

---

## CHANGE 1 — BODY METRICS FIELDS

### 1a. Add to user profile

Add the following fields to the user profile schema and Supabase `profiles` table.
Create a Supabase migration file matching the existing pattern:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm      NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS age            INTEGER CHECK (age > 0 AND age < 120),
  ADD COLUMN IF NOT EXISTS biological_sex TEXT
    CHECK (biological_sex IN ('male', 'female', 'prefer_not_to_answer')),
  ADD COLUMN IF NOT EXISTS weight_unit    TEXT NOT NULL DEFAULT 'kg'
    CHECK (weight_unit IN ('kg', 'lb')),
  ADD COLUMN IF NOT EXISTS height_unit    TEXT NOT NULL DEFAULT 'cm'
    CHECK (height_unit IN ('cm', 'ft_in'));
```

### 1b. Profile form UI additions

In the nutrition profile setup form, add these fields in order below the
existing weight field:

**Weight unit toggle:**
```
● kg  ○ lb
```
Switching units converts the displayed weight value immediately.
Store always in kg internally. Convert on display only:
```typescript
const toKg = (lb: number)  => Math.round(lb * 0.453592 * 10) / 10;
const toLb = (kg: number)  => Math.round(kg * 2.20462 * 10) / 10;
```

**Height field with unit toggle:**
```
Height: [input] cm   ● cm  ○ ft/in
```
When ft/in selected: show two inputs — feet (integer) and inches (0–11).
Store always in cm internally:
```typescript
const toCm       = (ft: number, inches: number) => Math.round((ft * 30.48) + (inches * 2.54));
const toCmFromIn = (totalInches: number) => Math.round(totalInches * 2.54);
```

**Age field:**
```
Age: [number input, min 10, max 100]
```

**Biological sex:**
```
Sex: ● Male  ○ Female  ○ Prefer not to answer
```
`prefer_not_to_answer` is optional — when selected, use the average of male/female
BMR constants in Mifflin-St Jeor (subtract 78 from male formula as average offset).

### 1c. Pre-populate modal from profile

When the nutrition modal opens, pre-populate all fields from `profile` if
the values exist. Currently weight defaults to 70 kg regardless of profile —
fix this:

```typescript
const initialWeight = profile?.weight_kg ?? 70;
const initialHeight = profile?.height_cm ?? null;
const initialAge    = profile?.age ?? null;
const initialSex    = profile?.biological_sex ?? null;
```

---

## CHANGE 2 — REPLACE TDEE FORMULA WITH MIFFLIN-ST JEOR

Replace the current `TDEE = weight × activity_multiplier` formula everywhere
it is used in the codebase with the Mifflin-St Jeor formula.

Search for all uses of the old formula and replace with the function below.
Do not leave any instance of the old formula active.

```typescript
// lib/nutrition.ts — add this function (create file if it doesn't exist)

export type BiologicalSex = 'male' | 'female' | 'prefer_not_to_answer';

export type ActivityLevel =
  | 'sedentary'           // 1.2
  | 'lightly_active'      // 1.375
  | 'moderately_active'   // 1.55
  | 'very_active'         // 1.725
  | 'extremely_active';   // 1.9

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
```

---

## CHANGE 3 — BMI CALCULATOR

### 3a. BMI calculation utility

```typescript
// Add to lib/nutrition.ts

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
  underweight: '#3b82f6',  // blue
  normal:      '#22c55e',  // green
  overweight:  '#f59e0b',  // amber
  obese_i:     '#f97316',  // orange
  obese_ii:    '#ef4444',  // red
  obese_iii:   '#991b1b',  // dark red
};
```

### 3b. BMI display in nutrition profile

After the user enters weight and height, calculate and display BMI inline:

```
BMI: 23.4 — Normal weight
[■■■■■■■■■■■■■■■■■■■■■■■■■■] (colour-coded bar, marker at current BMI)
      18.5      25.0    30.0   35.0   40.0
```

BMI bar: a horizontal bar from 15 to 45 with category colour zones and a
marker needle showing the user's current BMI. Update live as weight or height changes.

Below the bar, show a contextual note:
```typescript
const getBMIContextNote = (category: BMICategory, goal: string): string => {
  const notes: Record<BMICategory, Record<string, string>> = {
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
    obese_i:  { weight_loss: 'A structured deficit program is recommended. Consider speaking with a doctor.', muscle_gain: 'A recomp approach is recommended before a bulk.', maintain: 'Maintenance is not recommended at this BMI — a deficit approach is safer.' },
    obese_ii: { weight_loss: 'Medical guidance recommended alongside your fitness program.', muscle_gain: 'Focus on fat loss first before adding significant muscle-building volume.', maintain: 'Maintenance is not recommended at this BMI.' },
    obese_iii: { weight_loss: 'Please consult a healthcare professional before beginning a program.', muscle_gain: 'Please consult a healthcare professional before beginning a program.', maintain: 'Please consult a healthcare professional before beginning a program.' },
  };
  return notes[category]?.[goal] ?? '';
};
```

---

## CHANGE 4 — ACTIVITY LEVEL FIELD

Add activity level to the nutrition profile form if not already present.
This feeds into the TDEE multiplier.

```
Activity Level:
● Sedentary         (little or no exercise)
○ Lightly active    (light exercise 1–3 days/week)
○ Moderately active (moderate exercise 3–5 days/week)  ← default
○ Very active       (hard exercise 6–7 days/week)
○ Extremely active  (very hard exercise, physical job)
```

Store as `activity_level` in the profiles table:
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activity_level TEXT NOT NULL DEFAULT 'moderately_active'
    CHECK (activity_level IN (
      'sedentary', 'lightly_active', 'moderately_active',
      'very_active', 'extremely_active'
    ));
```

---

## CHANGE 5 — MACRO TARGETS WITH USER OVERRIDE

### 5a. Updated macro calculation

Replace the existing macro calculation with this updated version.
Fat is no longer a hard-coded 25% — use evidence-based per-goal fat targets:

```typescript
// Add to lib/nutrition.ts

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
  weight_loss: 0.8,   // higher fat on deficit preserves hormones
  muscle_gain: 1.0,   // adequate fat for testosterone production
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
```

### 5b. Override input fields

After displaying calculated macro targets, show editable input fields:

```
Calories:  [2125]  kcal
Protein:   [165]   g
Carbs:     [234]   g
Fat:       [59]    g
```

When user changes any macro gram value:
- Recalculate calories: `(protein_g × 4) + (carbs_g × 4) + (fat_g × 9)`
- Show difference from TDEE: "+125 kcal above TDEE" or "−300 kcal below TDEE"
  in green (deficit) or amber (surplus) or grey (at TDEE ±50)
- Show recommended range below each field:
  - Protein: `Recommended: ${Math.round(weightKg * 1.6)}–${Math.round(weightKg * 2.4)} g`
  - Fat: `Recommended: ${Math.round(weightKg * 0.7)}–${Math.round(weightKg * 1.2)} g`
  - Carbs: `Recommended: no strict minimum — residual after protein and fat`

If user sets a value outside recommended range, show an amber warning inline.
Never block saving — overrides are the user's choice.

---

## CHANGE 6 — MEAL LOG SNACK SLOT

Add a `snack` meal slot to the existing meal log, matching the pattern of
breakfast, lunch, and dinner.

The snack slot:
- Appears between lunch and dinner in the meal log UI
- Label: "Snack"
- Supports multiple food items (same as other meal slots)
- Contributes to daily macro totals the same as other slots
- Stored in the same structure as other meal slots

Do not change the data structure for existing meal slots — extend only.

---

## CHANGE 7 — MEAL LOG PORTION SCALING

When a user selects a food item and it is displayed in the log, add a
portion size input that scales all macros client-side.

### How it works

The food detail API already returns `macrosPer100g`:
```typescript
interface MacrosPer100g {
  calories:  number;
  protein_g: number;
  carbs_g:   number;
  fat_g:     number;
  fiber_g:   number;  // if available
}
```

Store the base `macrosPer100g` on the logged food item. The displayed
values are always computed:

```typescript
interface LoggedFoodItem {
  fdcId:         string;
  description:   string;
  macrosPer100g: MacrosPer100g;
  portionGrams:  number;   // user-adjustable, default 100
  unit:          string;   // from USDA servingUnit, default 'g'
}

// Computed on render — no API call
function scaleMacros(
  macrosPer100g: MacrosPer100g,
  portionGrams: number,
): MacrosPer100g {
  const ratio = portionGrams / 100;
  return {
    calories:  Math.round(macrosPer100g.calories  * ratio),
    protein_g: Math.round(macrosPer100g.protein_g * ratio * 10) / 10,
    carbs_g:   Math.round(macrosPer100g.carbs_g   * ratio * 10) / 10,
    fat_g:     Math.round(macrosPer100g.fat_g      * ratio * 10) / 10,
    fiber_g:   Math.round((macrosPer100g.fiber_g ?? 0) * ratio * 10) / 10,
  };
}
```

### Portion input UI

Below the food item name, show:
```
Portion: [100] g   (updates on blur or Enter — not on every keystroke)
```

When the user changes the value and confirms (blur or Enter):
1. Update `portionGrams` in state
2. Re-run `scaleMacros` with new portion
3. Update the displayed macros for that item
4. Update the meal slot total
5. Update the daily total

No API call is made. All updates are local state.

Minimum portion: 1 g. Maximum: 9999 g. Validate on blur — reset to previous
valid value if out of range.

---

## VERIFICATION CHECKLIST

**Profile:**
- [ ] Migration adds `height_cm`, `age`, `biological_sex`, `weight_unit`,
      `height_unit`, `activity_level` to profiles table
- [ ] Profile form shows all new fields
- [ ] Weight unit toggle converts displayed value without losing precision
- [ ] Height toggle (cm / ft in) converts and stores in cm
- [ ] Modal pre-populates from profile on open

**TDEE:**
- [ ] Mifflin-St Jeor formula used everywhere old formula was
- [ ] Old `weight × multiplier × 24` formula has zero remaining usages
- [ ] Falls back gracefully to old formula when height/age/sex missing

**BMI:**
- [ ] BMI calculated and displayed live as weight or height changes
- [ ] BMI bar renders with correct colour zones and marker
- [ ] BMI category label correct for all ranges
- [ ] Contextual note matches goal and BMI category

**Macros:**
- [ ] Fat no longer hard-coded at 25%
- [ ] Override input fields update calorie total live
- [ ] TDEE difference shown with correct sign and colour
- [ ] Recommended range shown for protein and fat
- [ ] Amber warning shown when outside recommended range

**Meal log:**
- [ ] Snack slot present between lunch and dinner
- [ ] Snack contributes to daily totals
- [ ] Portion input field on each food item
- [ ] Scaling updates on blur/Enter — not on keystroke
- [ ] Meal and daily totals update after portion change
- [ ] Portion out of range resets to last valid value
- [ ] No API call made on portion change

## CONSTRAINTS

- Follow CLAUDE.md conventions exactly
- Inline styles only — no Tailwind, no new CSS files
- No new npm packages
- Full TypeScript type annotations
- All calculations remain client-side — no new server routes
- Do not modify USDA proxy routes
