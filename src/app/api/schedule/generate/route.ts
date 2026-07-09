import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import type { ProgramTemplate } from '@/lib/programs/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type ScheduledEvent = {
  title: string;
  scheduled_date: string;
  notes: string | null;
};

type RequestBody = {
  unavailableDays?: number[];
  weeksAhead?: number;
};

const SYSTEM_PROMPT = 'You are a fitness scheduling assistant. Generate workout calendars as JSON. Respond with ONLY a valid JSON array — no markdown, no explanation.';

function buildUserMessage(
  unavailableDays: number[],
  availableDayNames: string[],
  programs: ProgramTemplate[],
  startDate: string,
  weeksAhead: number
): string {
  const programSummaries = programs.map(p => ({
    title: p.title,
    daysPerWeek: p.workout_days.length,
    weeks: p.weeks,
    days: p.workout_days.map(d => d.label),
  }));

  return `Generate a ${weeksAhead}-week workout schedule.

Start date: ${startDate}
Unavailable days: ${unavailableDays.map(d => DAY_NAMES[d]).join(', ') || 'none'}
Available days: ${availableDayNames.join(', ')}

Active programs:
${JSON.stringify(programSummaries, null, 2)}

Rules:
- Schedule workouts only on available days
- Spread workouts evenly across the weeks
- Rest at least 1 day between workout days when possible
- Use descriptive titles like "Upper Body - Day 1" or "Full Body Workout"

Return a JSON array:
[
  {
    "title": "<workout title>",
    "scheduled_date": "<YYYY-MM-DD>",
    "notes": "<brief note or null>"
  }
]

Generate events for ${weeksAhead} weeks starting from ${startDate}.`;
}

function extractJsonArray(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) return arrMatch[0];
  return text.trim();
}

function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: RequestBody = {};
  try {
    body = await req.json() as RequestBody;
  } catch {
    // empty body is fine, use defaults
  }

  const { unavailableDays = [], weeksAhead = 4 } = body;

  // Fetch user's active programs
  const { data: progressRows } = await supabase
    .from('user_program_progress')
    .select('program_id')
    .eq('user_id', user.id)
    .not('program_id', 'is', null)
    .lt('completion_percent', 100)
    .limit(3);

  const programIds = (progressRows ?? []).map(r => r.program_id as string).filter(Boolean);
  let programs: ProgramTemplate[] = [];

  if (programIds.length > 0) {
    const { data: programRows } = await supabase
      .from('programs')
      .select('id,slug,title,difficulty,weeks,workout_days,required_equipment,description,author_id,is_public,is_ai_generated,created_at')
      .in('id', programIds);
    programs = (programRows ?? []) as unknown as ProgramTemplate[];
  }

  if (programs.length === 0) {
    // Default schedule: 3x/week full body
    programs = [{
      id: 'default',
      slug: 'default',
      title: 'Full Body Training',
      description: 'General fitness',
      difficulty: 'beginner',
      weeks: weeksAhead,
      author_id: null,
      is_public: true,
      is_ai_generated: false,
      required_equipment: ['bodyweight'],
      workout_days: [
        { dayIndex: 0, label: 'Full Body A', exercises: [] },
        { dayIndex: 2, label: 'Full Body B', exercises: [] },
        { dayIndex: 4, label: 'Full Body C', exercises: [] },
      ],
      created_at: new Date().toISOString(),
    }];
  }

  const unavailableSet = new Set(unavailableDays);
  const availableDayNames = DAY_NAMES.filter((_, i) => !unavailableSet.has(i));
  const startDate = new Date().toISOString().slice(0, 10);

  const userMessage = buildUserMessage(unavailableDays, availableDayNames, programs, startDate, weeksAhead);

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

  if (!response.ok) {
    return NextResponse.json({ error: `OpenRouter error: ${response.status}` }, { status: 500 });
  }

  const aiJson = await response.json() as { choices: { message: { content: string } }[] };
  const rawText: string = aiJson.choices[0].message.content;

  const rawJson = extractJsonArray(rawText);
  let events: unknown[];
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) throw new Error('Expected array');
    events = parsed;
  } catch {
    return NextResponse.json({ error: 'AI returned invalid JSON', details: rawText.slice(0, 300) }, { status: 500 });
  }

  // Validate and filter events
  const validEvents: ScheduledEvent[] = [];
  for (const ev of events) {
    if (typeof ev !== 'object' || ev === null) continue;
    const e = ev as Record<string, unknown>;
    if (typeof e.title !== 'string' || typeof e.scheduled_date !== 'string') continue;
    if (!isValidDate(e.scheduled_date)) continue;
    // Skip events on unavailable days
    const dayOfWeek = new Date(e.scheduled_date + 'T12:00:00Z').getDay();
    if (unavailableSet.has(dayOfWeek)) continue;
    validEvents.push({
      title: e.title,
      scheduled_date: e.scheduled_date,
      notes: typeof e.notes === 'string' ? e.notes : null,
    });
  }

  if (validEvents.length === 0) {
    return NextResponse.json({ error: 'AI generated no valid events' }, { status: 500 });
  }

  // Batch insert workout events
  const insertPayload = validEvents.map(ev => ({
    user_id: user.id,
    title: ev.title,
    scheduled_date: ev.scheduled_date,
    notes: ev.notes,
    is_completed: false,
  }));

  const { error: insertError } = await supabase.from('workout_events').insert(insertPayload);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ events: validEvents, count: validEvents.length });
}
