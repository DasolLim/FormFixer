# Claude Code Prompt — Exercise Program Improvements
# TYPE: IMPROVEMENT — prompt upgrade + schema extension for progression.

---

## CONTEXT

Read ARCHITECTURE.md and CLAUDE.md before touching any file.

Current program generation:
- One API call → full weekly split, all N days simultaneously
- Each day: `label`, list of exercises with `exercise_id`, `sets`, `reps`, `rest_seconds`
- Static schema — same sets/reps every week, `weeks` field repeats the template
- Equipment read from `profile.equipment_profile`, defaults to `['bodyweight']`
- Generation wizard: 4 steps, user picks 2–6 training days, goal, and duration

This prompt does two things:
1. Extends the schema to support week-by-week linear progression
2. Replaces the generation prompt with a research-grounded version referencing
   Jeff Nippard, Chris Bumstead, and Hany Rambod methodologies

The progression logic lives in `lib/progression.ts` as a pure function separate
from the LLM call. The LLM generates static sets/reps as it always has, and
progression is applied deterministically afterward — so a flaky LLM response
never produces broken progression data. The new prompt references each coach's
specific methodology (FST-7 for Hany Rambod, RIR-based for Nippard,
volume-emphasis for CBum) rather than just naming them generically.

---

## CHANGE 1 — SCHEMA EXTENSION FOR LINEAR PROGRESSION

### 1a. New exercise schema

Replace the current per-exercise structure with one that supports progression.
The change is additive — keep all existing fields, add `weekly_progression`.

Current structure (do not remove):
```typescript
{
  exercise_id:  string,
  sets:         number,
  reps:         string,   // e.g. "8-10"
  rest_seconds: number,
}
```

New structure:
```typescript
{
  exercise_id:  string,
  sets:         number,
  reps:         string,          // Week 1 base reps, e.g. "8-10"
  rest_seconds: number,
  weekly_progression: WeeklyProgression[],
}

interface WeeklyProgression {
  week:          number,          // 1-indexed
  sets:          number,
  reps:          string,          // e.g. "10-12"
  phase:         'base' | 'build' | 'peak' | 'deload',
  coaching_note: string,          // e.g. "Focus on controlled eccentric"
}
```

### 1b. Linear progression model

Generate progression phases based on the `weeks` field the user already inputs.

```typescript
// lib/progression.ts — create this file

export type Phase = 'base' | 'build' | 'peak' | 'deload';

export interface ProgressionWeek {
  week:          number;
  sets:          number;
  reps:          string;
  phase:         Phase;
  coaching_note: string;
}

export function generateLinearProgression(
  baseSets: number,
  baseReps: string,       // e.g. "8-10"
  totalWeeks: number,
): ProgressionWeek[] {
  const weeks: ProgressionWeek[] = [];

  // Parse base rep range
  const [minRep, maxRep] = baseReps.split('-').map(Number);

  for (let w = 1; w <= totalWeeks; w++) {
    const isDeload = w === totalWeeks && totalWeeks >= 4;

    if (isDeload) {
      weeks.push({
        week:  w,
        sets:  Math.max(2, Math.floor(baseSets * 0.5)),
        reps:  `${minRep - 2}-${minRep}`,
        phase: 'deload',
        coaching_note: 'Deload week — reduce weight 40–50%, focus on form and recovery.',
      });
      continue;
    }

    // Phase assignment
    const progressRatio = (w - 1) / Math.max(totalWeeks - 2, 1);
    let phase: Phase;
    if (progressRatio < 0.35)      phase = 'base';
    else if (progressRatio < 0.70) phase = 'build';
    else                           phase = 'peak';

    // Rep progression: add 1-2 reps every 2 weeks
    const repIncrement = Math.floor((w - 1) / 2);
    const newMin = minRep + repIncrement;
    const newMax = maxRep + repIncrement;

    // Set progression: add a set at build/peak phase
    const setIncrement = phase === 'base' ? 0 : 1;
    const newSets = baseSets + setIncrement;

    const notes: Record<Phase, string> = {
      base:   'Establish baseline — prioritise full range of motion and muscle connection.',
      build:  'Progressive overload phase — add load when top of rep range is reached.',
      peak:   'Peak intensity — push close to failure on last set, maintain form.',
      deload: 'Deload week — reduce weight 40–50%, focus on form and recovery.',
    };

    weeks.push({
      week:          w,
      sets:          newSets,
      reps:          `${newMin}-${newMax}`,
      phase,
      coaching_note: notes[phase],
    });
  }

  return weeks;
}
```

### 1c. Apply progression in the generation route

In `app/api/programs/generate/route.ts`, after receiving the LLM response and
parsing the exercise list, apply `generateLinearProgression` to each exercise:

```typescript
import { generateLinearProgression } from '@/lib/progression';

// After parsing LLM response:
const programWithProgression = parsedProgram.days.map(day => ({
  ...day,
  exercises: day.exercises.map(ex => ({
    ...ex,
    weekly_progression: generateLinearProgression(
      ex.sets,
      ex.reps,
      programDuration, // the weeks field from user input
    ),
  })),
}));
```

---

## CHANGE 2 — PROGRAM PREVIEW UI

In `app/programs/generate/page.tsx`, update the program preview to show
progression per exercise.

Add a collapsible "Week-by-Week Progression" section under each exercise:

```
Exercise: Barbell Back Squat        3×8-10 · 90s rest
[▼ See progression]
  Week 1  Base    3×8-10   Establish baseline — prioritise full ROM
  Week 2  Base    3×9-11   Establish baseline — prioritise full ROM
  Week 3  Build   4×10-12  Progressive overload — add load when top rep reached
  Week 4  Build   4×11-13  Progressive overload — add load when top rep reached
  Week 5  Peak    4×12-14  Peak intensity — push close to failure on last set
  Week 6  Deload  2×6-8    Deload week — reduce weight 40–50%
```

Phase badges:
- `base`   → grey badge
- `build`  → blue badge
- `peak`   → amber badge
- `deload` → green badge

Default: collapsed. One toggle per exercise.

---

## CHANGE 3 — UPDATED GENERATION PROMPT

This replaces the existing program generation prompt entirely. Update it in
whatever prompt storage system is currently used (DB prompt_templates table or
hardcoded in the route — match existing pattern).

```
You are an elite strength and conditioning coach with deep knowledge of the
training methodologies of Jeff Nippard, Chris Bumstead, and Hany Rambod (Hany
is Chris Bumstead's coach and creator of the FST-7 system). You generate
evidence-based, hypertrophy-optimised workout programs that real athletes follow.

COACH METHODOLOGY REFERENCE:

Jeff Nippard — Science-based, evidence-driven programming.
  - Emphasis on mechanical tension, metabolic stress, and muscle damage as
    hypertrophy drivers
  - Uses RIR (Reps in Reserve) and RPE to autoregulate intensity
  - Advocates for full ROM, controlled eccentrics (2-3s), and compound-first ordering
  - Typical structure: compound movements 3-5 sets × 4-8 reps; isolation 3-4 sets × 8-15 reps
  - Favors frequency: hitting each muscle 2× per week minimum
  - Key principle: "minimum effective volume" — don't add volume without purpose

Chris Bumstead — Classic physique, aesthetic-focused programming.
  - Emphasis on V-taper development: wide shoulders, thick back, small waist, full quads
  - Higher volume isolation work for lagging bodyparts
  - Strong mind-muscle connection priority over absolute load
  - Typical split: Push/Pull/Legs or body-part specialisation
  - Rep ranges: 10-15 for isolation, 6-10 for compounds
  - Trains 5× per week with high weekly volume

Hany Rambod (FST-7 system) — Fascia Stretch Training.
  - 7 sets of 7 reps on the final exercise for each muscle group
  - Short rest periods (30-45s) on FST-7 sets to maximise pump and fascia stretching
  - Heavy compounds first, FST-7 isolation last
  - High training frequency with strategic pump work
  - Emphasises fullness and muscle roundness over pure strength

GENERATION INSTRUCTIONS:

Generate a complete {{training_days}}-day per week workout program for a
{{seniority_level}} level trainee with the goal of {{goal}}.

Goal-specific programming:
- weight_loss:   Moderate volume (12-16 sets/muscle/week), higher rep ranges (12-20),
                 shorter rest (45-75s), compound-dominant, metabolic conditioning circuits
                 on cardio days, caloric deficit awareness in volume selection
- muscle_gain:   High volume (16-22 sets/muscle/week), progressive overload focus (6-12
                 rep range for compounds, 10-15 for isolation), longer rest (90-180s),
                 compound movements prioritised, apply FST-7 on 1-2 isolation exercises
                 per session
- maintain:      Moderate volume (10-14 sets/muscle/week), balanced rep ranges (8-15),
                 maintain strength on key compound lifts, reduce junk volume

Equipment available: {{equipment}}

Apply these universal rules:
1. Order: compound movements first, isolation last, FST-7 (if applicable) final
2. Balanced weekly muscle frequency: each major muscle group hit 2× per week minimum
3. Antagonist pairing where possible (chest/back, bicep/tricep) for efficiency
4. No two consecutive days training the same primary muscle group
5. Label each day clearly: "Day 1 — Push (Chest / Shoulders / Triceps)"
6. Include warm-up sets recommendation as a coaching note on compound lifts
7. Rep ranges must be appropriate for the goal (see above)
8. Rest periods must match the goal (see above)
9. Exercise names must be specific: "Incline Dumbbell Press" not "Chest Press"
10. For muscle_gain goal: mark one isolation exercise per session as FST-7
    (7 sets × 12-15 reps, 30-45s rest) — indicate with fst7: true in output

Respond only with valid JSON. No markdown, no preamble.

{
  "program_name": "<goal-based name, e.g. 'CBum-Inspired Classic Physique Builder'>",
  "methodology_notes": "<2-3 sentences on which coach principles were applied and why>",
  "split_type": "<e.g. 'Push/Pull/Legs' or 'Upper/Lower' or 'Body Part'>",
  "days": [
    {
      "day_number": <1-N>,
      "label": "<e.g. 'Day 1 — Push (Chest / Shoulders / Triceps)'>",
      "primary_muscles": ["<muscle>"],
      "session_notes": "<1 sentence coaching note for the session>",
      "exercises": [
        {
          "exercise_id": "<snake_case name, e.g. 'barbell_bench_press'>",
          "exercise_name": "<full display name>",
          "sets": <integer>,
          "reps": "<e.g. '6-8' or '12-15'>",
          "rest_seconds": <integer>,
          "tempo": "<e.g. '3-0-1-0' eccentric-pause-concentric-pause, or 'controlled'>",
          "coaching_note": "<one specific technique cue from the referenced coaches>",
          "fst7": <true | false>,
          "is_compound": <true | false>
        }
      ]
    }
  ],
  "weekly_volume_summary": {
    "<muscle_group>": <total_sets_per_week>
  }
}
```

### Prompt variables to inject:
| Placeholder | Source |
|---|---|
| `{{training_days}}` | User's day selection from wizard (2–6) |
| `{{goal}}` | `weight_loss` / `muscle_gain` / `maintain` |
| `{{equipment}}` | `profile.equipment_profile` array |
| `{{seniority_level}}` | Infer from profile if available, default `intermediate` |

---

## CHANGE 4 — SCHEMA TYPE UPDATES

Update the TypeScript types for the program to include new fields:

```typescript
// types/program.ts (or wherever program types are defined)

export interface ProgramExercise {
  exercise_id:         string;
  exercise_name:       string;
  sets:                number;
  reps:                string;
  rest_seconds:        number;
  tempo:               string;
  coaching_note:       string;
  fst7:                boolean;
  is_compound:         boolean;
  weekly_progression:  WeeklyProgression[];
}

export interface WeeklyProgression {
  week:          number;
  sets:          number;
  reps:          string;
  phase:         'base' | 'build' | 'peak' | 'deload';
  coaching_note: string;
}

export interface ProgramDay {
  day_number:      number;
  label:           string;
  primary_muscles: string[];
  session_notes:   string;
  exercises:       ProgramExercise[];
}

export interface GeneratedProgram {
  program_name:           string;
  methodology_notes:      string;
  split_type:             string;
  days:                   ProgramDay[];
  weekly_volume_summary:  Record<string, number>;
}
```

---

## VERIFICATION CHECKLIST

- [ ] `lib/progression.ts` created with `generateLinearProgression`
- [ ] Generation route applies progression after LLM response parsing
- [ ] Program preview shows collapsible week-by-week progression per exercise
- [ ] Phase badges render correctly (grey/blue/amber/green)
- [ ] New prompt injected with all four variables
- [ ] FST-7 exercises visually marked in the preview (badge or indicator)
- [ ] `methodology_notes` and `split_type` displayed in program header
- [ ] `weekly_volume_summary` displayed as a summary card
- [ ] TypeScript types updated — `npm run type-check` passes
- [ ] Existing programs (already saved in DB) render without errors
  (`weekly_progression` defaults to `[]` if not present)

## CONSTRAINTS

- Follow CLAUDE.md conventions exactly
- Inline styles only — no Tailwind, no new CSS files
- No new npm packages
- Full TypeScript type annotations
- Existing program display for already-saved programs must not break
