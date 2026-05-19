import exercisesData from './exercises.json';

export interface ExerciseLandmarks {
  left: [number, number, number];   // [proximal, joint, distal] — MediaPipe indices
  right: [number, number, number];
}

export interface RepThresholds {
  downAngle: number;
  upAngle: number;
  reversedDirection: boolean;  // true for bicep curl, pull-up (up = bent, not extended)
}

export interface FormCheckConfig {
  id: string;
  phase: string[];              // rep phases to evaluate, e.g. ["DESCENDING", "BOTTOM"]
  severity: 'error' | 'warning' | 'info';
  rule: string;                 // maps to a function name in rules/
  params: Record<string, number>;
  cue: string;
  voiceCue: string;
}

export interface ExerciseConfig {
  name: string;
  isUnilateral: boolean;
  cameraAngle: 'front' | 'side' | 'either';
  landmarks: ExerciseLandmarks;
  anglePoint: [number, number, number];
  repThresholds: RepThresholds;
  formChecks: FormCheckConfig[];
}

export interface ExercisesConfig {
  exercises: Record<string, ExerciseConfig>;
}

export function getExerciseConfig(exerciseId: string): ExerciseConfig {
  const config = (exercisesData as unknown as ExercisesConfig).exercises[exerciseId];
  if (!config) {
    throw new Error(`Unknown exercise: "${exerciseId}". Check exercises.json.`);
  }
  return config;
}

export function getAllExerciseIds(): string[] {
  return Object.keys((exercisesData as unknown as ExercisesConfig).exercises);
}
