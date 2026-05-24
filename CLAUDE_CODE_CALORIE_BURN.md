# Claude Code Prompt — Calorie Burn Tracker Improvements
# TYPE: IMPROVEMENT — modify existing implementation only.

---

## CONTEXT

Read ARCHITECTURE.md and CLAUDE.md before touching any file. This prompt
improves the existing calorie burn tracker. Do not rewrite anything not
explicitly listed below.

---

## CHANGE 1 — MET VALUE TABLES

### 1a. Treadmill — speed-variable MET values

Replace any flat MET value for treadmill/running with a speed-based lookup table.
Use published ACSM MET values:

```typescript
// lib/met-values.ts — create this file

export const TREADMILL_MET_BY_SPEED: Record<number, number> = {
  // speed in km/h — MET value
  3:  2.8,   // slow walk
  4:  3.5,   // brisk walk
  5:  4.3,   // fast walk
  6:  6.0,   // light jog
  7:  7.0,   // jog
  8:  8.3,   // run
  9:  9.8,   // moderate run
  10: 10.5,  // fast run
  11: 11.0,  // hard run
  12: 11.8,  // sprint pace
  14: 12.3,  // fast sprint
  16: 14.5,  // very fast sprint
};

// Incline MET adjustment — add to base speed MET
// Based on ACSM running equation: each 1% incline adds ~0.07 METs per km/h
export function getTreadmillMET(speedKmh: number, inclinePercent: number): number {
  const speeds = Object.keys(TREADMILL_MET_BY_SPEED).map(Number).sort((a, b) => a - b);
  const lower = speeds.filter(s => s <= speedKmh).pop() ?? speeds[0];
  const upper = speeds.find(s => s > speedKmh) ?? speeds[speeds.length - 1];

  // Linear interpolation between nearest known speeds
  const baseMET = lower === upper
    ? TREADMILL_MET_BY_SPEED[lower]
    : TREADMILL_MET_BY_SPEED[lower] +
      ((speedKmh - lower) / (upper - lower)) *
      (TREADMILL_MET_BY_SPEED[upper] - TREADMILL_MET_BY_SPEED[lower]);

  // Incline adjustment: +0.07 × incline% × (speed / 10)
  const inclineAdjustment = 0.07 * inclinePercent * (speedKmh / 10);
  return Math.round((baseMET + inclineAdjustment) * 10) / 10;
}
```

### 1b. StairMaster — level-based MET values

```typescript
// Add to lib/met-values.ts

export const STAIRMASTER_MET_BY_LEVEL: Record<number, number> = {
  1:  4.0,
  2:  4.6,
  3:  5.0,
  4:  5.5,
  5:  6.0,
  6:  6.5,
  7:  7.0,
  8:  7.5,
  9:  8.0,
  10: 8.5,
  11: 9.0,
  12: 9.5,
  13: 10.0,
  14: 10.5,
  15: 11.0,
  16: 11.5,
  17: 12.0,
  18: 12.5,
  19: 13.0,
  20: 14.0,
};

export function getStairmasterMET(level: number): number {
  const clamped = Math.max(1, Math.min(20, Math.round(level)));
  return STAIRMASTER_MET_BY_LEVEL[clamped];
}
```

### 1c. Strength training — MET × bodyweight × duration

```typescript
// Add to lib/met-values.ts

// Standard MET values for strength training intensity
export const STRENGTH_MET: Record<string, number> = {
  light:    3.5,   // general light lifting, machines
  moderate: 5.0,   // general moderate lifting, free weights
  vigorous: 6.0,   // heavy compound lifts, powerlifting
};

export function getStrengthCalories(
  metValue: number,
  bodyweightKg: number,
  durationMinutes: number,
): number {
  // Calories = MET × weight(kg) × duration(hours)
  return Math.round(metValue * bodyweightKg * (durationMinutes / 60));
}
```

### 1d. General calorie formula (used across all exercise types)

```typescript
export function calculateCaloriesBurned(
  met: number,
  bodyweightKg: number,
  durationMinutes: number,
): number {
  return Math.round(met * bodyweightKg * (durationMinutes / 60));
}
```

---

## CHANGE 2 — TREADMILL INPUT FIELDS

In the calorie burn UI, when the user selects treadmill as the exercise type,
show two additional input fields:

**Speed input:**
```
Label:       Speed
Type:        Number input
Unit toggle: km/h | mph (follows user unit preference)
Range:       1–20 km/h (or 0.6–12.4 mph)
Step:        0.5
Default:     8 km/h
```

**Incline input:**
```
Label:   Incline
Type:    Number input or slider
Unit:    % (always, no toggle needed)
Range:   0–15%
Step:    0.5
Default: 0
```

If the user changes speed or incline, recalculate MET live using `getTreadmillMET`
and update the calorie preview in real time.

Convert mph to km/h before passing to `getTreadmillMET`:
```typescript
const toKmh = (mph: number) => Math.round(mph * 1.60934 * 10) / 10;
```

---

## CHANGE 3 — STAIRMASTER INPUT FIELDS

When the user selects StairMaster as the exercise type, show one additional
input field:

**Level input:**
```
Label:   Level
Type:    Slider or number input
Range:   1–20
Step:    1
Default: 10
```

Show the intensity label next to the level:
```typescript
const getStairmasterLabel = (level: number): string => {
  if (level <= 6)  return 'Low intensity';
  if (level <= 13) return 'Moderate intensity';
  return 'High intensity';
};
```

Recalculate MET live using `getStairmasterMET(level)` when level changes.

---

## CHANGE 4 — CALORIE PREVIEW

For all exercise types, show a live calorie preview below the inputs:

```
Estimated burn: 312 kcal
Based on: MET 8.3 · 75 kg · 45 min
```

This requires the user's bodyweight. Read it from the nutrition profile if
available (`profile.weight_kg`). If not set, show an inline prompt:
"Add your weight in your nutrition profile for accurate calorie estimates."
Use 70 kg as a silent fallback for the calculation.

---

## VERIFICATION CHECKLIST

- [ ] `lib/met-values.ts` created with all four exports
- [ ] Treadmill speed input appears when treadmill is selected
- [ ] Treadmill incline input appears when treadmill is selected
- [ ] StairMaster level input (1–20) appears when StairMaster is selected
- [ ] StairMaster intensity label updates with level
- [ ] Calorie preview updates live on any input change
- [ ] Unit toggle (km/h vs mph) converts correctly before MET lookup
- [ ] Strength training uses MET × bodyweight × duration formula
- [ ] All existing exercise types unaffected

## CONSTRAINTS

- Follow CLAUDE.md conventions exactly
- Inline styles only — no Tailwind, no new CSS files
- No new npm packages
- Full TypeScript type annotations
- Do not modify any unrelated calorie tracker logic
