import type { SessionScore } from '@/lib/workouts/types';
import type { RepScore } from '@/features/form-engine/scoring-types';

export type WorkoutPlanConfig = {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
};

export type SetResult = {
  setNumber: number;
  repCount: number;
  formScore: number;
};

export type WorkoutPlanPhase = 'idle' | 'active' | 'resting' | 'complete';

export type WorkoutPlanState = {
  config: WorkoutPlanConfig;
  phase: WorkoutPlanPhase;
  currentSet: number;
  setResults: SetResult[];
  restSecondsRemaining: number;
};

export type WorkoutPlanAction =
  | { type: 'START' }
  | { type: 'COMPLETE_SET'; repCount: number; formScore: number }
  | { type: 'SKIP_REST' }
  | { type: 'TICK_REST' }
  | { type: 'UPDATE_CONFIG'; config: Partial<WorkoutPlanConfig> }
  | { type: 'RESET' };

export function makeInitialPlanState(config: WorkoutPlanConfig): WorkoutPlanState {
  return {
    config,
    phase: 'idle',
    currentSet: 1,
    setResults: [],
    restSecondsRemaining: config.restSeconds,
  };
}

export function workoutPlanReducer(
  state: WorkoutPlanState,
  action: WorkoutPlanAction
): WorkoutPlanState {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        phase: 'active',
        currentSet: 1,
        setResults: [],
        restSecondsRemaining: state.config.restSeconds,
      };

    case 'COMPLETE_SET': {
      const result: SetResult = {
        setNumber: state.currentSet,
        repCount: action.repCount,
        formScore: action.formScore,
      };
      const setResults = [...state.setResults, result];
      if (state.currentSet >= state.config.targetSets) {
        return { ...state, setResults, phase: 'complete' };
      }
      return {
        ...state,
        setResults,
        phase: 'resting',
        restSecondsRemaining: state.config.restSeconds,
      };
    }

    case 'TICK_REST': {
      const next = state.restSecondsRemaining - 1;
      if (next <= 0) {
        return { ...state, phase: 'active', currentSet: state.currentSet + 1, restSecondsRemaining: 0 };
      }
      return { ...state, restSecondsRemaining: next };
    }

    case 'SKIP_REST':
      return { ...state, phase: 'active', currentSet: state.currentSet + 1, restSecondsRemaining: 0 };

    case 'UPDATE_CONFIG':
      return { ...state, config: { ...state.config, ...action.config } };

    case 'RESET':
      return makeInitialPlanState(state.config);

    default:
      return state;
  }
}

export function aggregateSetResults(
  exerciseId: string,
  setResults: SetResult[],
  durationMs: number
): SessionScore {
  if (setResults.length === 0) {
    return {
      exerciseId,
      repCount: 0,
      repScores: [],
      averageOverall: 0,
      averageDepth: 0,
      averageSymmetry: 0,
      averageForm: 0,
      formTrend: 'stable',
      topIssues: [],
      durationMs,
    };
  }

  const totalReps = setResults.reduce((sum, s) => sum + s.repCount, 0);
  const avgScore = Math.round(
    setResults.reduce((sum, s) => sum + s.formScore, 0) / setResults.length
  );

  const repScores: RepScore[] = setResults.map((s, i) => ({
    repNumber: i + 1,
    overall: s.formScore,
    depth: s.formScore,
    symmetry: s.formScore,
    form: s.formScore,
    tempo: s.formScore,
    ascent: 100,
    ascentMs: 0,
    issueIds: [],
    timestampMs: Date.now(),
  }));

  const mid = Math.ceil(setResults.length / 2);
  const firstHalf = setResults.slice(0, mid);
  const secondHalf = setResults.slice(mid);
  let formTrend: 'improving' | 'declining' | 'stable' = 'stable';
  if (secondHalf.length > 0) {
    const firstAvg = firstHalf.reduce((sum, s) => sum + s.formScore, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.formScore, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    if (diff > 5) formTrend = 'improving';
    else if (diff < -5) formTrend = 'declining';
  }

  return {
    exerciseId,
    repCount: totalReps,
    repScores,
    averageOverall: avgScore,
    averageDepth: avgScore,
    averageSymmetry: avgScore,
    averageForm: avgScore,
    formTrend,
    topIssues: [],
    durationMs,
  };
}
