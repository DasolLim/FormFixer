import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { angleDeg, midpoint, verticalLeanDeg } from '@/features/form-engine/rules/angle';

const CUE_DEFS: CueDef[] = [
  { id: 'cr_peak',      severity: 'error',   text: 'Rise up fully on your toes',           voiceText: 'Full rise',      cooldownReps: 1 },
  { id: 'cr_heel_down', severity: 'warning', text: 'Lower your heels all the way down',     voiceText: 'Heels down',     cooldownReps: 2 },
  { id: 'cr_knee_bend', severity: 'warning', text: 'Keep your knees straight',              voiceText: 'Knees straight', cooldownReps: 2 },
  { id: 'cr_lean',      severity: 'warning', text: "Don't lean forward",                    voiceText: 'Stay upright',   cooldownReps: 2 },
  { id: 'cr_low_vis',   severity: 'warning', text: 'Move to better lighting for tracking',  voiceText: 'Better lighting',cooldownReps: 5 },
];

export class CalfRaiseEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);

  constructor() { super('calf_raise'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const primaryAngle = base.primaryAngle ?? 90;
      const side = calibration.orientation === 'right' ? 'right' : 'left';

      // Check foot index visibility first
      const footIdx  = side === 'left' ? POSE_LANDMARKS.LEFT_FOOT_INDEX : POSE_LANDMARKS.RIGHT_FOOT_INDEX;
      const footLm   = getWorldLandmark(frame, footIdx, 0.72);
      const footVisible = !!footLm;

      if (!footVisible) {
        formIssues.push({ id: 'cr_low_vis', severity: 'info', message: 'Move to better lighting for tracking' });
      } else {
        // Peak: at UP phase, should be well plantar-flexed
        if (base.phase === 'UP' && primaryAngle < 100) {
          formIssues.push({ id: 'cr_peak', severity: 'error', message: 'Rise up fully on your toes' });
        }

        // Heel down: at DOWN phase, heel should be fully lowered
        if (base.phase === 'DOWN' && primaryAngle > 82) {
          formIssues.push({ id: 'cr_heel_down', severity: 'warning', message: 'Lower your heels all the way down' });
        }
      }

      // Knee bend: check hip-knee-ankle angle using landmarks 23,25,27 (or right side)
      const hipIdx    = side === 'left' ? POSE_LANDMARKS.LEFT_HIP   : POSE_LANDMARKS.RIGHT_HIP;
      const kneeIdx   = side === 'left' ? POSE_LANDMARKS.LEFT_KNEE  : POSE_LANDMARKS.RIGHT_KNEE;
      const ankleIdx  = side === 'left' ? POSE_LANDMARKS.LEFT_ANKLE : POSE_LANDMARKS.RIGHT_ANKLE;
      const hip   = getWorldLandmark(frame, hipIdx);
      const knee  = getWorldLandmark(frame, kneeIdx);
      const ankle = getWorldLandmark(frame, ankleIdx);
      if (hip && knee && ankle && angleDeg(hip, knee, ankle) < 165) {
        formIssues.push({ id: 'cr_knee_bend', severity: 'warning', message: 'Keep your knees straight' });
      }

      // Torso lean
      const lShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const rShoulder = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER);
      const lHip      = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);
      const rHip      = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_HIP);
      if (lShoulder && rShoulder && lHip && rHip) {
        const shoulderMid = midpoint(lShoulder, rShoulder);
        const hipMid      = midpoint(lHip, rHip);
        if (verticalLeanDeg(shoulderMid, hipMid) > 8) {
          formIssues.push({ id: 'cr_lean', severity: 'warning', message: "Don't lean forward" });
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
