import type { NormalizedPoseFrame } from '@/features/pose/pose-types';

export type CalibrationStatus = {
  ready: boolean;
  message: string;
  stableFrames: number;
};

export type EnginePhase = 'NOT_READY' | 'READY' | 'DESCENDING' | 'BOTTOM' | 'ASCENDING' | 'LOCKOUT';

export type EngineState = {
  phase: EnginePhase;
  repCount: number;
  lastRepTimestampMs: number;
};

export type FormIssue = {
  code: string;
  message: string;
  priority: number;
};

export type EngineOutput = {
  state: EngineState;
  calibration: CalibrationStatus;
  primaryCue: string;
  secondaryCue?: string;
  issues: FormIssue[];
  metrics: Record<string, number>;
};

export interface ExerciseFormEngine {
  readonly id: string;
  reset(): void;
  update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput;
}
