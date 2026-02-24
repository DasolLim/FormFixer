export type ExerciseType = 'squat' | 'pushup' | 'lunge';

export type PlanTier = 'free' | 'pro';

export type WorkoutSessionRow = {
  id: string;
  created_at: string;
  exercise_type: ExerciseType;
  rep_count: number;
  form_score: number;
  form_summary: string;
};
