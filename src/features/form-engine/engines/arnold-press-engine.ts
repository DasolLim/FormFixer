import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { midpoint, verticalLeanDeg } from '@/features/form-engine/rules/angle';

const CUE_DEFS: CueDef[] = [
  { id: 'ap_lockout',  severity: 'error',   text: 'Fully extend your arms at the top',     voiceText: 'Lock out',        cooldownReps: 1 },
  { id: 'ap_symmetry', severity: 'error',   text: 'Press both arms evenly',                 voiceText: 'Both arms equal', cooldownReps: 1 },
  { id: 'ap_arch',     severity: 'warning', text: "Brace your core — don't arch your back", voiceText: 'Core tight',      cooldownReps: 2 },
  { id: 'ap_hip_tilt', severity: 'warning', text: 'Keep your hips level',                   voiceText: 'Level hips',      cooldownReps: 2 },
];

export class ArnoldPressEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);

  constructor() { super('arnold_press'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const primaryAngle = base.primaryAngle ?? 180;
      const lShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const rShoulder = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER);
      const lHip      = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);
      const rHip      = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_HIP);

      // Lockout at UP phase
      if (base.phase === 'UP' && primaryAngle < 150) {
        formIssues.push({ id: 'ap_lockout', severity: 'error', message: 'Fully extend arms at the top' });
      }

      // Symmetry
      if (Math.abs(base.leftAngle - base.rightAngle) > 20) {
        formIssues.push({ id: 'ap_symmetry', severity: 'error', message: 'Press both arms evenly' });
      }

      // Torso arch
      if (lShoulder && rShoulder && lHip && rHip) {
        const shoulderMid = midpoint(lShoulder, rShoulder);
        const hipMid      = midpoint(lHip, rHip);
        if (verticalLeanDeg(shoulderMid, hipMid) > 15) {
          formIssues.push({ id: 'ap_arch', severity: 'warning', message: "Brace your core — don't arch your back" });
        }
        // Hip tilt
        if (Math.abs(lHip.y - rHip.y) > 0.05) {
          formIssues.push({ id: 'ap_hip_tilt', severity: 'warning', message: 'Keep your hips level' });
        }
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
