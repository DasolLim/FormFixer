import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';

const CUE_DEFS: CueDef[] = [
  { id: 'fp_elbow_height',   severity: 'error',   text: 'Raise elbows to shoulder height',    voiceText: 'Elbows up',      cooldownReps: 1 },
  { id: 'fp_pull_height',    severity: 'error',   text: 'Pull to your face — not your chest', voiceText: 'Pull to face',   cooldownReps: 1 },
  { id: 'fp_torso_sway',     severity: 'warning', text: 'Keep your body still',               voiceText: 'Stay still',     cooldownReps: 2 },
  { id: 'fp_full_extension', severity: 'warning', text: 'Fully extend at the front',          voiceText: 'Full extension', cooldownReps: 2 },
];

export class FacePullEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private hipAnchorX: number | null = null;

  constructor() { super('face_pull'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
    this.hipAnchorX = null;
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const side = calibration.orientation === 'right' ? 'right' : 'left';
      const elbowIdx   = side === 'left' ? POSE_LANDMARKS.LEFT_ELBOW    : POSE_LANDMARKS.RIGHT_ELBOW;
      const shoulderIdx = side === 'left' ? POSE_LANDMARKS.LEFT_SHOULDER : POSE_LANDMARKS.RIGHT_SHOULDER;
      const wristIdx   = side === 'left' ? POSE_LANDMARKS.LEFT_WRIST    : POSE_LANDMARKS.RIGHT_WRIST;

      const elbow   = getWorldLandmark(frame, elbowIdx);
      const shoulder = getWorldLandmark(frame, shoulderIdx);
      const wrist   = getWorldLandmark(frame, wristIdx, 0.72);
      const nose    = getWorldLandmark(frame, POSE_LANDMARKS.NOSE);
      const lHip    = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);
      const rHip    = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_HIP);

      // Set hip anchor on first calibrated frame
      if (this.hipAnchorX === null && lHip && rHip) {
        this.hipAnchorX = (lHip.x + rHip.x) / 2;
      }

      // Torso sway
      if (this.hipAnchorX !== null && lHip && rHip) {
        const hipMidX = (lHip.x + rHip.x) / 2;
        if (Math.abs(hipMidX - this.hipAnchorX) > 0.07) {
          formIssues.push({ id: 'fp_torso_sway', severity: 'warning', message: 'Keep your body still' });
        }
      }

      if (base.phase === 'UP') {
        // Elbow height: elbow should be at or above shoulder height
        if (elbow && shoulder && elbow.y < shoulder.y - 0.04) {
          formIssues.push({ id: 'fp_elbow_height', severity: 'error', message: 'Raise elbows to shoulder height' });
        }
        // Pull height: wrist should be near face (within 8cm of nose)
        if (wrist && nose && wrist.y < nose.y - 0.08) {
          formIssues.push({ id: 'fp_pull_height', severity: 'error', message: 'Pull to your face — not your chest' });
        }
      }

      // Full extension at DOWN phase
      if (base.phase === 'DOWN' && (base.primaryAngle ?? 180) < 140) {
        formIssues.push({ id: 'fp_full_extension', severity: 'warning', message: 'Fully extend at the front' });
      }
    }

    if ((base.repCount ?? 0) > repBefore) {
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
