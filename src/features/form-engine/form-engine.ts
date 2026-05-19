import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import type { RepScore } from '@/features/form-engine/scoring-types';

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
  id: string;                               // e.g. "squat_knee_cave"
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedLandmarks?: number[];             // landmark indices to highlight in red on canvas
};

export interface FeedbackCue {
  text: string;       // displayed on screen, e.g. "Push your knees out"
  voiceText: string;  // shorter version for TTS, e.g. "Knees out"
  severity: 'error' | 'warning' | 'positive';
}

export type EngineOutput = {
  // ── Existing fields (used by squat-engine and camera page) ──
  state: EngineState;
  calibration: CalibrationStatus;
  primaryCue: string;
  secondaryCue?: string;
  issues: FormIssue[];
  metrics: Record<string, number>;

  // ── Bilateral angle readout (required) ──
  leftAngle: number;
  rightAngle: number;

  // ── Unilateral rep counting (required) ──
  isUnilateral: boolean;
  leftRepCount: number;
  rightRepCount: number;

  // ── Extended fields for new engines (Phase 1+) ──
  primaryAngle?: number;
  repCount?: number;
  phase?: string;
  formIssues?: FormIssue[];
  topCues?: FeedbackCue[];
  calibrationStatus?: CalibrationStatus;
  confidence?: number;
  repScores?: RepScore[];
};

export interface ExerciseFormEngine {
  readonly id: string;
  reset(): void;
  update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput;
}
