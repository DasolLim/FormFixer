// ── Existing types (DB storage format) ─────────────────────────────────────────

export type WorkoutExercise = {
  exercise_id:        string
  sets:               number
  reps:               number | string   // number for pre-progression programs, string for new
  rest_seconds:       number
  // optional fields present in newly generated programs
  exercise_name?:     string
  tempo?:             string
  coaching_note?:     string
  fst7?:              boolean
  is_compound?:       boolean
  weekly_progression?: WeeklyProgression[]
}

export type StoredProgramDay = {
  dayIndex:   number
  label:      string
  exercises:  WorkoutExercise[]
}

export type ProgramTemplate = {
  id:                 string
  slug:               string
  title:              string
  description:        string | null
  difficulty:         'beginner' | 'intermediate' | 'advanced'
  weeks:              number
  author_id:          string | null
  is_public:          boolean
  is_ai_generated:    boolean
  required_equipment: string[]
  workout_days:       StoredProgramDay[]
  created_at:         string
}

export type ProgramWithProgress = ProgramTemplate & {
  progress: {
    current_week:        number
    completed_workouts:  number
    completion_percent:  number
  } | null
}

// ── New types (CHANGE 4 — from CLAUDE_CODE_EXERCISE_PROGRAMS.md) ────────────────

export interface WeeklyProgression {
  week:          number;
  sets:          number;
  reps:          string;
  phase:         'base' | 'build' | 'peak' | 'deload';
  coaching_note: string;
}

export interface ProgramExercise {
  exercise_id:        string;
  exercise_name:      string;
  sets:               number;
  reps:               string;
  rest_seconds:       number;
  tempo:              string;
  coaching_note:      string;
  fst7:               boolean;
  is_compound:        boolean;
  weekly_progression: WeeklyProgression[];
}

export interface ProgramDay {
  day_number:      number;
  label:           string;
  primary_muscles: string[];
  session_notes:   string;
  exercises:       ProgramExercise[];
}

export interface GeneratedProgram {
  program_name:          string;
  methodology_notes:     string;
  split_type:            string;
  days:                  ProgramDay[];
  weekly_volume_summary: Record<string, number>;
}
