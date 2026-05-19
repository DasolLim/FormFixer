import type { RepScore } from '@/features/form-engine/scoring-types';

export type { RepScore };

export type ExerciseType = 'squat' | 'pushup' | 'lunge';

export type PlanTier = 'free' | 'pro';

export type WorkoutSessionRow = {
  id: string;
  created_at: string;
  exercise_type: ExerciseType;
  exercise_id?: string | null;
  rep_count: number;
  form_score: number;
  form_summary: string;
  average_form_score?: number | null;
  form_trend?: string | null;
  rep_scores?: RepScore[] | null;
};

export interface SessionScore {
  exerciseId: string;
  repCount: number;
  repScores: RepScore[];
  averageOverall: number;
  averageDepth: number;
  averageSymmetry: number;
  averageForm: number;
  formTrend: 'improving' | 'declining' | 'stable';
  topIssues: string[];      // top 3 most-frequent issueIds across all reps
  durationMs: number;
}
