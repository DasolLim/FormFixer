import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { midpoint } from '@/features/form-engine/rules/angle';

const CUE_DEFS: CueDef[] = [
  { id: 'press_head_jut',        severity: 'warning', text: "Don't let your head jut forward", voiceText: 'Head back',    cooldownReps: 3 },
  { id: 'press_lockout',         severity: 'warning', text: 'Lock out at the top',              voiceText: 'Full lockout', cooldownReps: 2 },
  { id: 'press_imbalance',       severity: 'warning', text: 'Press both arms evenly',           voiceText: 'Even press',   cooldownReps: 3 },
  { id: 'press_core_stability',  severity: 'warning', text: 'Brace your core',                  voiceText: 'Brace core',   cooldownReps: 3 },
];

export class OverheadPressEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);

  constructor() { super('overhead_press'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const nose     = getWorldLandmark(frame, POSE_LANDMARKS.NOSE);
      const lShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const rShoulder = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER);
      const lHip      = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);
      const rHip      = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_HIP);

      // overhead_press: upAngle=150 means arms up. At top: primaryAngle > 145
      const atTop = (base.primaryAngle ?? 0) > 145;

      // 1. Head jut: nose forward of shoulder (z-axis, world space)
      if (nose && lShoulder && rShoulder) {
        const shoulderMid = midpoint(lShoulder, rShoulder);
        // In MediaPipe world space, z is depth; more negative = toward camera
        if (atTop && (shoulderMid.z ?? 0) - (nose.z ?? 0) > 0.06) {
          formIssues.push({ id: 'press_head_jut', severity: 'warning', message: "Don't let head jut forward" });
        }
      }

      // 2. Lockout: at top, elbow should be fully extended (≥ 165°)
      if (atTop && (base.leftAngle < 165 || base.rightAngle < 165)) {
        formIssues.push({ id: 'press_lockout', severity: 'warning', message: 'Lock out at the top' });
      }

      // 3. Imbalance: left vs right
      if (Math.abs(base.leftAngle - base.rightAngle) > 20) {
        formIssues.push({ id: 'press_imbalance', severity: 'warning', message: 'Press both arms evenly' });
      }

      // 4. Core stability: hip lateral tilt
      if (lHip && rHip && Math.abs(lHip.y - rHip.y) > 0.06) {
        formIssues.push({ id: 'press_core_stability', severity: 'warning', message: 'Brace your core' });
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
