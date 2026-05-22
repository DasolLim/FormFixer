import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { midpoint, verticalLeanDeg } from '@/features/form-engine/rules/angle';

const CUE_DEFS: CueDef[] = [
  { id: 'ss_knee_cave', severity: 'error',   text: 'Push knees out over your toes',   voiceText: 'Knees out',  cooldownReps: 1 },
  { id: 'ss_depth',     severity: 'error',   text: 'Squat deeper — hips below knees', voiceText: 'Go deeper',  cooldownReps: 1 },
  { id: 'ss_lean',      severity: 'warning', text: 'Keep your chest upright',         voiceText: 'Chest up',   cooldownReps: 2 },
  { id: 'ss_heel_lift', severity: 'warning', text: 'Keep your heels flat',            voiceText: 'Heels down', cooldownReps: 2 },
];

export class SumoSquatEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private minAngleThisRep = 180;

  constructor() { super('sumo_squat'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
    this.minAngleThisRep = 180;
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const primaryAngle = base.primaryAngle ?? 180;
      this.minAngleThisRep = Math.min(this.minAngleThisRep, primaryAngle);

      const lKnee    = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_KNEE);
      const rKnee    = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_KNEE);
      const lAnkle   = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_ANKLE);
      const rAnkle   = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_ANKLE);
      const lHeel    = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HEEL, 0.72);
      const lShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const rShoulder = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER);
      const lHip     = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);
      const rHip     = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_HIP);

      // Knee cave: kneeWidth / ankleWidth should be >= 0.75 for sumo
      if (lKnee && rKnee && lAnkle && rAnkle) {
        const kneeWidth  = Math.abs(lKnee.x - rKnee.x);
        const ankleWidth = Math.abs(lAnkle.x - rAnkle.x);
        if (ankleWidth > 0 && kneeWidth / ankleWidth < 0.75) {
          formIssues.push({ id: 'ss_knee_cave', severity: 'error', message: 'Push knees out over your toes' });
        }
      }

      // Torso lean
      if (lShoulder && rShoulder && lHip && rHip) {
        const shoulderMid = midpoint(lShoulder, rShoulder);
        const hipMid      = midpoint(lHip, rHip);
        if (verticalLeanDeg(shoulderMid, hipMid) > 30) {
          formIssues.push({ id: 'ss_lean', severity: 'warning', message: 'Keep your chest upright' });
        }
      }

      // Heel lift
      if (lHeel && lAnkle && lHeel.y - lAnkle.y > 0.04) {
        formIssues.push({ id: 'ss_heel_lift', severity: 'warning', message: 'Keep your heels flat' });
      }
    }

    if ((base.repCount ?? 0) > repBefore) {
      if (this.minAngleThisRep > 105) {
        formIssues.push({ id: 'ss_depth', severity: 'error', message: 'Squat deeper — hips below knees' });
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
