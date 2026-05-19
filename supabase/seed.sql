-- Seed the two legacy hardcoded programs into the programs table
-- Run after the Phase 1 migration: npx supabase db seed
-- Or paste into the Supabase SQL editor

INSERT INTO programs (slug, title, description, difficulty, weeks, is_public, required_equipment, workout_days)
VALUES
(
  'form-fundamentals-4-week',
  'Form Fundamentals 4-Week',
  'Build a bulletproof foundation with perfect technique on the core movements.',
  'beginner',
  4,
  true,
  '["bodyweight"]',
  '[
    {"dayIndex":0,"label":"Day 1 – Lower body","exercises":[{"exercise_id":"squat","sets":3,"reps":12,"rest_seconds":60}]},
    {"dayIndex":1,"label":"Day 2 – Upper body","exercises":[{"exercise_id":"push_up","sets":3,"reps":10,"rest_seconds":60}]},
    {"dayIndex":2,"label":"Day 3 – Core","exercises":[{"exercise_id":"crunch","sets":3,"reps":15,"rest_seconds":45}]}
  ]'::jsonb
),
(
  'strength-base-6-week',
  'Strength Base 6-Week',
  'Progress from bodyweight mastery to loaded compound lifts over 6 structured weeks.',
  'intermediate',
  6,
  true,
  '["bodyweight","dumbbells"]',
  '[
    {"dayIndex":0,"label":"Day 1 – Push","exercises":[{"exercise_id":"push_up","sets":4,"reps":12,"rest_seconds":90},{"exercise_id":"overhead_press","sets":3,"reps":10,"rest_seconds":90}]},
    {"dayIndex":1,"label":"Day 2 – Pull","exercises":[{"exercise_id":"pull_up","sets":3,"reps":8,"rest_seconds":120},{"exercise_id":"bicep_curl","sets":3,"reps":12,"rest_seconds":60}]},
    {"dayIndex":2,"label":"Day 3 – Legs","exercises":[{"exercise_id":"squat","sets":4,"reps":10,"rest_seconds":90}]}
  ]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
