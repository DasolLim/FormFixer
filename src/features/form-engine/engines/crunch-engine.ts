import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { distance2d } from '@/features/form-engine/rules/angle';

const CUE_DEFS: CueDef[] = [
  { id: 'crunch_neck_pull', severity: 'warning', text: "Don't pull your neck", voiceText: 'Relax neck', cooldownReps: 2 },
  { id: 'crunch_range',     severity: 'warning', text: 'Curl higher',          voiceText: 'Higher',     cooldownReps: 2 },
  { id: 'crunch_hip_flex',  severity: 'warning',  text: 'Keep hips flat',       voiceText: 'Hips flat',  cooldownReps: 4 },
];

export class CrunchEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private maxEarShoulderDist = 0;
  private minAngleThisRep = 180;

  constructor() { super('crunch'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
    this.maxEarShoulderDist = 0;
    this.minAngleThisRep = 180;
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const lEar      = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_EAR);
      const lShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const lHip      = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);
      const rHip      = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_HIP);

      // 1. Neck pull: ear approaching shoulder
      if (lEar && lShoulder) {
        const dist = distance2d(lEar, lShoulder);
        this.maxEarShoulderDist = Math.max(this.maxEarShoulderDist, dist);
        if (this.maxEarShoulderDist > 0 && this.maxEarShoulderDist - dist > 0.10) {
          formIssues.push({ id: 'crunch_neck_pull', severity: 'warning', message: "Don't pull your neck" });
        }
      }

      // 2. Range: track min angle reached this rep
      this.minAngleThisRep = Math.min(this.minAngleThisRep, base.primaryAngle ?? 180);

      // 3. Hip flex: if hips rise during crunch (hip y changes significantly)
      if (lHip && rHip) {
        const hipAngle = Math.abs(lHip.y - rHip.y);
        if (hipAngle > 0.08) {
          formIssues.push({ id: 'crunch_hip_flex', severity: 'info', message: 'Keep hips flat' });
        }
      }
    }

    if ((base.repCount ?? 0) > repBefore) {
      if (this.minAngleThisRep > 130) {
        formIssues.push({ id: 'crunch_range', severity: 'warning', message: 'Curl higher' });
      }
      this.minAngleThisRep = 180;
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
