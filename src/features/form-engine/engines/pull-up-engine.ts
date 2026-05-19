import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';

const CUE_DEFS: CueDef[] = [
  { id: 'pullup_chin_over_bar', severity: 'warning', text: 'Pull until your chin clears the bar', voiceText: 'Chin over bar',  cooldownReps: 1 },
  { id: 'pullup_full_hang',     severity: 'warning', text: 'Fully extend at the bottom',          voiceText: 'Full hang',       cooldownReps: 2 },
  { id: 'pullup_kipping',       severity: 'warning', text: 'Avoid kipping — control the movement', voiceText: 'No kipping',     cooldownReps: 2 },
  { id: 'pullup_imbalance',     severity: 'warning', text: 'Pull evenly with both arms',           voiceText: 'Even pull',      cooldownReps: 3 },
];

export class PullUpEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private prevHipX = 0;
  private hipXSet = false;

  constructor() { super('pull_up'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
    this.hipXSet = false;
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const lEar   = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_EAR);
      const lWrist = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_WRIST);
      const lHip   = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);
      const rHip   = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_HIP);

      const primaryAngle = base.primaryAngle ?? 180;

      // 1. Chin over bar: at top (angle < 80 for reversed pull-up), ear should be above wrist level
      // pull_up reversedDirection=true, upAngle=70. At top: primaryAngle < 80
      if (primaryAngle < 80 && lEar && lWrist) {
        // world space y-up: ear above wrist = ear.y > wrist.y
        if (lEar.y < lWrist.y) {
          formIssues.push({ id: 'pullup_chin_over_bar', severity: 'warning', message: 'Chin over bar' });
        }
      }

      // 2. Full hang: at bottom (angle > 135), elbows should fully extend (≥ 155°)
      if (primaryAngle > 135 && (base.leftAngle < 155 || base.rightAngle < 155)) {
        formIssues.push({ id: 'pullup_full_hang', severity: 'warning', message: 'Fully extend at the bottom' });
      }

      // 3. Kipping: excessive hip horizontal movement per frame
      const hipX = lHip ? lHip.x : (rHip?.x ?? 0);
      if (this.hipXSet && Math.abs(hipX - this.prevHipX) > 0.03) {
        formIssues.push({ id: 'pullup_kipping', severity: 'warning', message: 'Avoid kipping' });
      }
      this.prevHipX = hipX;
      this.hipXSet = true;

      // 4. Imbalance
      if (Math.abs(base.leftAngle - base.rightAngle) > 25) {
        formIssues.push({ id: 'pullup_imbalance', severity: 'warning', message: 'Pull evenly with both arms' });
      }
    }

    if ((base.repCount ?? 0) > repBefore) {
      this.prioritizer.onRepCompleted(formIssues.some(i => i.severity === 'error' || i.severity === 'warning'));
    }

    const topCues = this.prioritizer.getTopCues(formIssues);
    const primaryCue = calibration.ready ? (topCues[0]?.text ?? base.primaryCue) : calibration.message;
    return { ...base, formIssues, topCues, primaryCue };
  }
}
