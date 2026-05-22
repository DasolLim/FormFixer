import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { angleDeg } from '@/features/form-engine/rules/angle';

const CUE_DEFS: CueDef[] = [
  { id: 'tpd_elbow_drift',    severity: 'error',   text: 'Pin your elbows to your sides',    voiceText: 'Elbows in',       cooldownReps: 1 },
  { id: 'tpd_full_extension', severity: 'error',   text: 'Fully extend at the bottom',        voiceText: 'Full extension',  cooldownReps: 1 },
  { id: 'tpd_tempo',          severity: 'warning', text: "Control the movement — don't rush", voiceText: 'Slow down',       cooldownReps: 2 },
  { id: 'tpd_wrist_break',    severity: 'warning', text: 'Keep your wrists straight',         voiceText: 'Wrists straight', cooldownReps: 2 },
];

export class TricepPushdownEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private repStartMs = 0;

  constructor() { super('tricep_pushdown'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
    this.repStartMs = 0;
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const primaryAngle = base.primaryAngle ?? 180;
      const side = calibration.orientation === 'right' ? 'right' : 'left';
      const elbowIdx  = side === 'left' ? POSE_LANDMARKS.LEFT_ELBOW    : POSE_LANDMARKS.RIGHT_ELBOW;
      const shoulderIdx = side === 'left' ? POSE_LANDMARKS.LEFT_SHOULDER : POSE_LANDMARKS.RIGHT_SHOULDER;
      const wristIdx  = side === 'left' ? POSE_LANDMARKS.LEFT_WRIST    : POSE_LANDMARKS.RIGHT_WRIST;
      const indexIdx  = side === 'left' ? POSE_LANDMARKS.LEFT_INDEX    : POSE_LANDMARKS.RIGHT_INDEX;

      const elbow   = getWorldLandmark(frame, elbowIdx);
      const shoulder = getWorldLandmark(frame, shoulderIdx);
      const wrist   = getWorldLandmark(frame, wristIdx, 0.72);
      const index   = getWorldLandmark(frame, indexIdx, 0.72);

      // Elbow drift: elbow should stay under shoulder (z-axis, side view)
      if (elbow && shoulder && shoulder.z !== undefined && elbow.z !== undefined) {
        const drift = shoulder.z - elbow.z;
        if (drift > 0.12) {
          formIssues.push({ id: 'tpd_elbow_drift', severity: 'error', message: 'Pin elbows to sides' });
        }
      }

      // Full extension at DOWN phase
      if (base.phase === 'DOWN' && primaryAngle > 35) {
        formIssues.push({ id: 'tpd_full_extension', severity: 'error', message: 'Fully extend at the bottom' });
      }

      // Wrist break
      if (elbow && wrist && index) {
        const wristAngle = angleDeg(elbow, wrist, index);
        if (wristAngle < 155) {
          formIssues.push({ id: 'tpd_wrist_break', severity: 'warning', message: 'Keep wrists straight' });
        }
      }

      // Track rep start
      if (this.repStartMs === 0) this.repStartMs = frame.timestampMs;
    }

    if ((base.repCount ?? 0) > repBefore) {
      if (this.repStartMs > 0 && frame.timestampMs - this.repStartMs < 600) {
        formIssues.push({ id: 'tpd_tempo', severity: 'warning', message: "Control the movement — don't rush" });
      }
      this.repStartMs = frame.timestampMs;
      this.prioritizer.onRepCompleted(formIssues.some(i => i.severity === 'error' || i.severity === 'warning'));
    }

    if (calibration.ready && formIssues.length > 0) {
      this.scorer.patchLastFrameIssues(formIssues);
    }

    const topCues = this.prioritizer.getTopCues(formIssues);
    const primaryCue = calibration.ready ? (topCues[0]?.text ?? base.primaryCue) : calibration.message;
    return { ...base, formIssues, topCues, primaryCue };
  }
}
