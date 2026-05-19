import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { distance2d } from '@/features/form-engine/rules/angle';

const CUE_DEFS: CueDef[] = [
  { id: 'situp_neck_strain',  severity: 'warning', text: "Don't pull your neck",      voiceText: 'Relax neck',   cooldownReps: 2 },
  { id: 'situp_full_range',   severity: 'warning', text: 'Crunch up further',          voiceText: 'Higher',       cooldownReps: 2 },
  { id: 'situp_hip_anchor',   severity: 'warning', text: 'Keep your feet planted',     voiceText: 'Feet down',    cooldownReps: 3 },
];

export class SitUpEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private maxEarShoulderDist = 0;
  private anchorAnkleX = 0;
  private anchorAnkleY = 0;
  private anchorSet = false;
  private minAngleThisRep = 180;

  constructor() { super('sit_up'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
    this.maxEarShoulderDist = 0;
    this.anchorSet = false;
    this.minAngleThisRep = 180;
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const lEar      = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_EAR);
      const lShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const lAnkle    = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_ANKLE);

      // Set ankle anchor on first calibrated frame
      if (!this.anchorSet && lAnkle) {
        this.anchorAnkleX = lAnkle.x;
        this.anchorAnkleY = lAnkle.y;
        this.anchorSet = true;
      }

      // 1. Neck strain: ear pulling toward shoulder
      if (lEar && lShoulder) {
        const dist = distance2d(lEar, lShoulder);
        this.maxEarShoulderDist = Math.max(this.maxEarShoulderDist, dist);
        if (this.maxEarShoulderDist > 0 && this.maxEarShoulderDist - dist > 0.12) {
          formIssues.push({ id: 'situp_neck_strain', severity: 'warning', message: "Don't pull your neck" });
        }
      }

      // 2. Full range: track minimum angle reached this rep
      this.minAngleThisRep = Math.min(this.minAngleThisRep, base.primaryAngle ?? 180);

      // 3. Hip anchor: ankle drift from starting position
      if (lAnkle && this.anchorSet) {
        const drift = Math.hypot(lAnkle.x - this.anchorAnkleX, lAnkle.y - this.anchorAnkleY);
        if (drift > 0.05) {
          formIssues.push({ id: 'situp_hip_anchor', severity: 'warning', message: 'Keep feet planted' });
        }
      }
    }

    if ((base.repCount ?? 0) > repBefore) {
      if (this.minAngleThisRep > 130) {
        formIssues.push({ id: 'situp_full_range', severity: 'warning', message: 'Crunch up further' });
      }
      this.minAngleThisRep = 180;
      this.prioritizer.onRepCompleted(formIssues.some(i => i.severity === 'error' || i.severity === 'warning'));
    }

    const topCues = this.prioritizer.getTopCues(formIssues);
    const primaryCue = calibration.ready ? (topCues[0]?.text ?? base.primaryCue) : calibration.message;
    return { ...base, formIssues, topCues, primaryCue };
  }
}
