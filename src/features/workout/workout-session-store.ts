import type { CalibrationStatus, EngineOutput } from '@/features/form-engine/form-engine';

export type WorkoutSessionState = {
  calibration: CalibrationStatus;
  output: EngineOutput | null;
  startedAt: number;
};

export function createWorkoutSessionState(): WorkoutSessionState {
  return {
    calibration: { ready: false, message: 'Step back so full body is visible', stableFrames: 0 },
    output: null,
    startedAt: Date.now()
  };
}

export function resetWorkoutSessionState(state: WorkoutSessionState) {
  state.calibration = { ready: false, message: 'Step back so full body is visible', stableFrames: 0 };
  state.output = null;
  state.startedAt = Date.now();
}
