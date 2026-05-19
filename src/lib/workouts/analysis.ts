import type { Landmark } from '@/lib/pose/math';
import { analyzeSquat, initialSquatState, type SquatPhase } from '@/lib/pose/squat';
import { angleDeg, avg } from '@/lib/pose/math';
import { POSE_LANDMARK_INDEX } from '@/lib/pose/constants';
import type { ExerciseType, RepScore, SessionScore } from '@/lib/workouts/types';

export function computeSessionScore(
  exerciseId: string,
  repScores: RepScore[],
  durationMs: number
): SessionScore {
  if (repScores.length === 0) {
    return { exerciseId, repCount: 0, repScores: [], averageOverall: 0, averageDepth: 0, averageSymmetry: 0, averageForm: 0, formTrend: 'stable', topIssues: [], durationMs };
  }

  const avgField = (field: 'overall' | 'depth' | 'symmetry' | 'form') =>
    Math.round(repScores.reduce((sum, r) => sum + r[field], 0) / repScores.length);

  // Form trend: compare first half vs second half — require at least 4 reps for a meaningful read.
  let formTrend: SessionScore['formTrend'] = 'stable';
  if (repScores.length >= 4) {
    const mid = Math.floor(repScores.length / 2);
    const firstHalf = repScores.slice(0, mid);
    const secondHalf = repScores.slice(mid);
    const avgFirst = firstHalf.length ? firstHalf.reduce((s, r) => s + r.overall, 0) / firstHalf.length : 0;
    const avgSecond = secondHalf.length ? secondHalf.reduce((s, r) => s + r.overall, 0) / secondHalf.length : 0;
    formTrend = avgSecond > avgFirst + 5 ? 'improving' : avgSecond < avgFirst - 5 ? 'declining' : 'stable';
  }

  // Top 3 most frequent issue IDs across all reps.
  const issueFreq = new Map<string, number>();
  repScores.forEach(r => r.issueIds.forEach(id => issueFreq.set(id, (issueFreq.get(id) ?? 0) + 1)));
  const topIssues = [...issueFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);

  return {
    exerciseId,
    repCount: repScores.length,
    repScores,
    averageOverall: avgField('overall'),
    averageDepth: avgField('depth'),
    averageSymmetry: avgField('symmetry'),
    averageForm: avgField('form'),
    formTrend,
    topIssues,
    durationMs,
  };
}

type Phase = SquatPhase | 'start' | 'down' | 'up';

export type ExerciseState = {
  phase: Phase;
  reps: number;
  lastRepFrame: number;
};

export type ExerciseAnalysis = {
  reps: number;
  phase: string;
  cue: string;
  primaryAngle: number;
};

export const initialExerciseState: ExerciseState = { ...initialSquatState };

export function analyzeExercise(exercise: ExerciseType, landmarks: Landmark[], state: ExerciseState, frameCount: number): ExerciseAnalysis {
  if (exercise === 'squat') {
    const squatState = state as { phase: 'top' | 'down' | 'bottom' | 'up'; reps: number; lastRepFrame: number };
    const result = analyzeSquat(landmarks, squatState, frameCount);
    return { reps: result.reps, phase: result.phase, cue: result.cue, primaryAngle: result.kneeAngle };
  }

  if (exercise === 'pushup') {
    const i = POSE_LANDMARK_INDEX;
    const elbowLeft = angleDeg(landmarks[11], landmarks[13], landmarks[15]);
    const elbowRight = angleDeg(landmarks[12], landmarks[14], landmarks[16]);
    const elbowAngle = avg(elbowLeft, elbowRight);

    if (state.phase === 'top' && elbowAngle < 120) state.phase = 'down';
    if (state.phase === 'down' && elbowAngle < 90) state.phase = 'bottom';
    if (state.phase === 'bottom' && elbowAngle > 120) state.phase = 'up';
    if (state.phase === 'up' && elbowAngle > 155 && frameCount - state.lastRepFrame > 8) {
      state.reps += 1;
      state.phase = 'top';
      state.lastRepFrame = frameCount;
    }

    const hipShoulderDelta = avg(landmarks[i.leftHip].y, landmarks[i.rightHip].y) - avg(landmarks[i.leftShoulder].y, landmarks[i.rightShoulder].y);
    const cue = hipShoulderDelta > 0.2 ? 'Keep body in one straight line' : state.phase === 'down' && elbowAngle > 100 ? 'Go lower' : 'Good push-up';

    return { reps: state.reps, phase: state.phase, cue, primaryAngle: elbowAngle };
  }

  const i = POSE_LANDMARK_INDEX;
  const leftKnee = angleDeg(landmarks[i.leftHip], landmarks[i.leftKnee], landmarks[i.leftAnkle]);
  const rightKnee = angleDeg(landmarks[i.rightHip], landmarks[i.rightKnee], landmarks[i.rightAnkle]);
  const lowest = Math.min(leftKnee, rightKnee);

  if (state.phase === 'top' && lowest < 140) state.phase = 'down';
  if (state.phase === 'down' && lowest < 100) state.phase = 'bottom';
  if (state.phase === 'bottom' && lowest > 130) state.phase = 'up';
  if (state.phase === 'up' && lowest > 160 && frameCount - state.lastRepFrame > 8) {
    state.reps += 1;
    state.phase = 'top';
    state.lastRepFrame = frameCount;
  }

  const cue = state.phase === 'down' && lowest > 110 ? 'Drop back knee lower' : 'Keep front knee tracking over toes';
  return { reps: state.reps, phase: state.phase, cue, primaryAngle: lowest };
}
