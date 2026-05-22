import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getAllExerciseIds } from '@/features/form-engine/exercise-config';
import { GeneratedProgramSchema, validateExerciseIds } from '@/lib/programs/program-schema';
import type { MovementBaseline } from '@/lib/onboarding/types';

type RequestBody = {
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  goal: 'lose' | 'maintain' | 'gain';
  focus: 'lower' | 'upper' | 'fullbody';
  daysPerWeek: number;
  weeks: number;
};

const SYSTEM_PROMPT = 'You are a professional fitness coach. Generate structured workout programs as JSON. Respond with ONLY valid JSON — no markdown, no explanation.';

const GOAL_GUIDANCE: Record<string, string> = {
  lose:     'Fat loss focus: higher rep ranges (12-20), shorter rest periods (45-60s), include supersets and metabolic circuits where possible, moderate weights.',
  maintain: 'Maintenance focus: moderate rep ranges (8-15), balanced rest periods (60-90s), mix of compound and isolation movements.',
  gain:     'Muscle gain focus: lower rep ranges (5-12), longer rest periods (90-120s), emphasize progressive overload with compound lifts and heavy weights.',
};

const FOCUS_GUIDANCE: Record<string, string> = {
  lower:    'Lower body priority: emphasize squat, sumo_squat, step_up, calf_raise, nordic_curl, knee_raise, leg_raise, and wall_sit. Upper body movements are secondary/accessory only.',
  upper:    'Upper body priority: emphasize push_up, incline_db_press, pull_up, overhead_press, arnold_press, seated_cable_row, face_pull, bicep_curl, tricep_pushdown, and lateral_raise. Lower body movements are secondary/accessory only.',
  fullbody: 'Full body balance: each session hits both upper and lower body. Mix compound lower (squat, sumo_squat, step_up) with upper push (push_up, incline_db_press, overhead_press) and upper pull (pull_up, seated_cable_row, face_pull). Alternate push/pull/legs patterns across days for maximum recovery.',
};

function buildUserMessage(
  difficulty: string,
  goal: string,
  focus: string,
  daysPerWeek: number,
  weeks: number,
  equipment: string[],
  validIds: string[],
  baseline: MovementBaseline | null
): string {
  const baselineNote = baseline
    ? `Movement baseline: squat depth avg ${baseline.squat.avgBottomAngleDeg.toFixed(0)}° (lower angle = deeper squat), torso lean ${baseline.squat.avgTorsoLeanDeg.toFixed(0)}°, symmetry score ${baseline.squat.symmetryScore}/100.`
    : '';

  return `Generate a workout program for this user:
- Equipment available: ${equipment.join(', ')}
- Difficulty: ${difficulty}
- Goal: ${goal === 'lose' ? 'Lose Fat' : goal === 'maintain' ? 'Maintain' : 'Build Muscle'}
- Body focus: ${focus === 'lower' ? 'Lower Body' : focus === 'upper' ? 'Upper Body' : 'Full Body'}
- Days per week: ${daysPerWeek}
- Program length: ${weeks} weeks
${baselineNote ? `- ${baselineNote}` : ''}

Goal programming guidance: ${GOAL_GUIDANCE[goal]}
Focus programming guidance: ${FOCUS_GUIDANCE[focus]}

IMPORTANT: Only use exercise IDs EXACTLY from this list:
${validIds.join(', ')}

Do NOT invent exercise IDs. If an exercise is not in the list, pick the closest match.

Use this exact JSON schema:
{
  "title": "<3-80 chars, reflect the goal and focus in the name>",
  "description": "<10-400 chars, describe the program purpose, goal, and what muscles it targets>",
  "difficulty": "${difficulty}",
  "weeks": ${weeks},
  "required_equipment": ["<only equipment from user's list>"],
  "workout_days": [
    {
      "dayIndex": <0-6, 0=Monday>,
      "label": "<e.g. Day 1 - Legs & Glutes>",
      "exercises": [
        {
          "exercise_id": "<from valid list>",
          "sets": <1-5>,
          "reps": <5-20>,
          "rest_seconds": <45-120>
        }
      ]
    }
  ]
}

Generate exactly ${daysPerWeek} workout days. Apply the goal and focus guidance strictly when selecting exercises and programming sets/reps/rest.`;
}

function extractJson(text: string): string {
  // Try to extract JSON from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  // Try to find raw JSON object
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text.trim();
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const baseline = (profile?.movement_baseline as MovementBaseline | null) ?? null;
  const validIds = getAllExerciseIds();

  const userMessage = buildUserMessage(difficulty, goal, focus, daysPerWeek, weeks, equipment, validIds, baseline);

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
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2000,
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

  const validation = GeneratedProgramSchema.safeParse(parsed);
  if (!validation.success) {
    return NextResponse.json({
      error: 'AI response failed schema validation',
      details: JSON.stringify(validation.error.flatten()),
    }, { status: 500 });
  }

  const program = validation.data;

  const invalidIds = validateExerciseIds(program, validIds);
  if (invalidIds.length > 0) {
    return NextResponse.json({
      error: `AI used unknown exercise IDs: ${invalidIds.join(', ')}`,
    }, { status: 500 });
  }

  const slug = `ai-${user.id.slice(0, 8)}-${Date.now()}`;
  const totalWorkouts = weeks * daysPerWeek;

  const { data: inserted, error: insertError } = await supabase
    .from('programs')
    .insert({
      slug,
      title: program.title,
      description: program.description,
      difficulty: program.difficulty,
      weeks: program.weeks,
      author_id: user.id,
      is_public: false,
      is_ai_generated: true,
      required_equipment: program.required_equipment as unknown as import('@/lib/database.types').Json,
      workout_days: program.workout_days as unknown as import('@/lib/database.types').Json,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to save program' }, { status: 500 });
  }

  await supabase.from('user_program_progress').insert({
    user_id: user.id,
    program_id: inserted.id,
    program_slug: slug,
    current_week: 1,
    completed_workouts: 0,
    total_workouts: totalWorkouts,
    completion_percent: 0,
  });

  return NextResponse.json({ program: inserted });
}
