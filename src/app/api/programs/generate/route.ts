import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { generateLinearProgression } from '@/lib/progression';
import type { MovementBaseline } from '@/lib/onboarding/types';
import type { GeneratedProgram, StoredProgramDay, WorkoutExercise } from '@/lib/programs/types';

type RequestBody = {
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  goal: 'lose' | 'maintain' | 'gain';
  focus: 'lower' | 'upper' | 'fullbody';
  daysPerWeek: number;
  weeks: number;
};

// ── CHANGE 3 — New coach-methodology system prompt ──────────────────────────────

const SYSTEM_PROMPT = `You are an elite strength and conditioning coach with deep knowledge of the training methodologies of Jeff Nippard, Chris Bumstead, and Hany Rambod (Hany is Chris Bumstead's coach and creator of the FST-7 system). You generate evidence-based, hypertrophy-optimised workout programs that real athletes follow.

COACH METHODOLOGY REFERENCE:

Jeff Nippard — Science-based, evidence-driven programming.
  - Emphasis on mechanical tension, metabolic stress, and muscle damage as hypertrophy drivers
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

Respond with ONLY valid JSON — no markdown, no explanation.`;

const GOAL_GUIDANCE: Record<string, string> = {
  lose:     'weight_loss: Moderate volume (12-16 sets/muscle/week), higher rep ranges (12-20), shorter rest (45-75s), compound-dominant, metabolic conditioning circuits, caloric deficit awareness in volume selection',
  maintain: 'maintain: Moderate volume (10-14 sets/muscle/week), balanced rep ranges (8-15), maintain strength on key compound lifts, reduce junk volume',
  gain:     'muscle_gain: High volume (16-22 sets/muscle/week), progressive overload focus (6-12 rep range for compounds, 10-15 for isolation), longer rest (90-180s), compound movements prioritised, apply FST-7 on 1-2 isolation exercises per session',
};

const GOAL_KEY: Record<string, string> = {
  lose:     'weight_loss',
  maintain: 'maintain',
  gain:     'muscle_gain',
};

function buildUserMessage(
  difficulty: string,
  goal: string,
  focus: string,
  daysPerWeek: number,
  weeks: number,
  equipment: string[],
  baseline: MovementBaseline | null,
): string {
  const seniority = difficulty;
  const goalKey = GOAL_KEY[goal] ?? goal;

  const baselineNote = baseline
    ? `Movement baseline: squat depth avg ${baseline.squat.avgBottomAngleDeg.toFixed(0)}° (lower = deeper), torso lean ${baseline.squat.avgTorsoLeanDeg.toFixed(0)}°, symmetry score ${baseline.squat.symmetryScore}/100.`
    : '';

  const focusNote = focus === 'lower'
    ? 'Focus on lower body: prioritise squat patterns, hip hinges, leg press, lunges, calf work. Upper body is secondary/accessory only.'
    : focus === 'upper'
      ? 'Focus on upper body: prioritise push (chest/shoulders/triceps), pull (back/biceps), overhead press. Lower body is secondary/accessory only.'
      : 'Full body balance: each session hits both upper and lower. Alternate push/pull/legs patterns for recovery.';

  return `Generate a complete ${daysPerWeek}-day per week workout program for a ${seniority} level trainee with the goal of ${goalKey}.

Equipment available: ${equipment.join(', ')}
${baselineNote ? `\n${baselineNote}` : ''}

Goal-specific programming: ${GOAL_GUIDANCE[goal]}

${focusNote}

Universal rules:
1. Order: compound movements first, isolation last, FST-7 (if applicable) final
2. Each major muscle group hit 2× per week minimum
3. Antagonist pairing where possible (chest/back, bicep/tricep) for efficiency
4. No two consecutive days training the same primary muscle group
5. Label each day clearly: "Day 1 — Push (Chest / Shoulders / Triceps)"
6. Include warm-up sets recommendation as a coaching_note on compound lifts
7. Rep ranges must be appropriate for the goal (see above)
8. Rest periods must match the goal (see above)
9. Exercise names must be specific: "Incline Dumbbell Press" not "Chest Press"
10. For muscle_gain goal: mark one isolation exercise per session as FST-7 (7 sets × 12-15 reps, 30-45s rest) — indicate with fst7: true in output

Respond only with valid JSON. No markdown, no preamble.

{
  "program_name": "<goal-based name, e.g. 'CBum-Inspired Classic Physique Builder'>",
  "methodology_notes": "<2-3 sentences on which coach principles were applied and why>",
  "split_type": "<e.g. 'Push/Pull/Legs' or 'Upper/Lower' or 'Body Part'>",
  "days": [
    {
      "day_number": <1-${daysPerWeek}>,
      "label": "<e.g. 'Day 1 — Push (Chest / Shoulders / Triceps)'>",
      "primary_muscles": ["<muscle>"],
      "session_notes": "<1 sentence coaching note for the session>",
      "exercises": [
        {
          "exercise_id": "<snake_case, e.g. 'incline_dumbbell_press'>",
          "exercise_name": "<full display name>",
          "sets": <integer>,
          "reps": "<e.g. '6-8' or '12-15'>",
          "rest_seconds": <integer>,
          "tempo": "<e.g. '3-0-1-0' or 'controlled'>",
          "coaching_note": "<one specific technique cue>",
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

Generate exactly ${daysPerWeek} workout days.`;
}

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text.trim();
}

function isGeneratedProgram(v: unknown): v is GeneratedProgram {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.program_name === 'string' &&
    typeof o.methodology_notes === 'string' &&
    typeof o.split_type === 'string' &&
    Array.isArray(o.days) &&
    typeof o.weekly_volume_summary === 'object'
  );
}

const AI_GEN_DAILY_LIMIT = 3;

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('programs')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', user.id)
    .eq('is_ai_generated', true)
    .gte('created_at', todayStart.toISOString());

  if ((count ?? 0) >= AI_GEN_DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Daily limit of ${AI_GEN_DAILY_LIMIT} AI programs reached. Resets at midnight.` },
      { status: 429 },
    );
  }

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { difficulty, goal, focus, daysPerWeek, weeks } = body;
  if (!difficulty || !goal || !focus || !daysPerWeek || !weeks) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('equipment_profile, movement_baseline')
    .eq('id', user.id)
    .single();

  const equipment = (profile?.equipment_profile as string[] | null) ?? ['bodyweight'];
  const baseline  = (profile?.movement_baseline as MovementBaseline | null) ?? null;

  const userMessage = buildUserMessage(difficulty, goal, focus, daysPerWeek, weeks, equipment, baseline);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'google/gemini-flash-1.5',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      max_tokens: 4000,
    }),
  });

  const aiJson = await response.json() as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };

  if (!response.ok || aiJson.error) {
    return NextResponse.json({ error: aiJson.error?.message ?? `OpenRouter error: ${response.status}` }, { status: 500 });
  }

  const rawText: string | undefined = aiJson.choices?.[0]?.message?.content;
  if (!rawText) {
    return NextResponse.json({ error: 'OpenRouter returned no content', detail: JSON.stringify(aiJson).slice(0, 200) }, { status: 500 });
  }

  const rawJson = extractJson(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return NextResponse.json({ error: 'AI returned invalid JSON', details: rawText.slice(0, 300) }, { status: 500 });
  }

  if (!isGeneratedProgram(parsed)) {
    return NextResponse.json({ error: 'AI response missing required fields', details: rawJson.slice(0, 300) }, { status: 500 });
  }

  const program = parsed;

  // ── CHANGE 1c — Apply linear progression to each exercise ──────────────────

  const workoutDays: StoredProgramDay[] = program.days.map(day => ({
    dayIndex: day.day_number - 1,
    label:    day.label,
    exercises: day.exercises.map((ex): WorkoutExercise => ({
      exercise_id:        ex.exercise_id,
      sets:               ex.sets,
      reps:               ex.reps,
      rest_seconds:       ex.rest_seconds,
      exercise_name:      ex.exercise_name,
      tempo:              ex.tempo,
      coaching_note:      ex.coaching_note,
      fst7:               ex.fst7,
      is_compound:        ex.is_compound,
      weekly_progression: generateLinearProgression(ex.sets, ex.reps, weeks),
    })),
  }));

  const slug         = `ai-${user.id.slice(0, 8)}-${Date.now()}`;
  const totalWorkouts = weeks * daysPerWeek;

  const { data: inserted, error: insertError } = await supabase
    .from('programs')
    .insert({
      slug,
      title:              program.program_name,
      description:        program.methodology_notes,
      difficulty,
      weeks,
      author_id:          user.id,
      is_public:          false,
      is_ai_generated:    true,
      required_equipment: equipment as unknown as import('@/lib/database.types').Json,
      workout_days:       workoutDays as unknown as import('@/lib/database.types').Json,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to save program' }, { status: 500 });
  }

  await supabase.from('user_program_progress').insert({
    user_id:             user.id,
    program_id:          inserted.id,
    program_slug:        slug,
    current_week:        1,
    completed_workouts:  0,
    total_workouts:      totalWorkouts,
    completion_percent:  0,
  });

  // Return saved program + metadata for preview display
  return NextResponse.json({
    program:              inserted,
    methodology_notes:    program.methodology_notes,
    split_type:           program.split_type,
    weekly_volume_summary: program.weekly_volume_summary,
  });
}
