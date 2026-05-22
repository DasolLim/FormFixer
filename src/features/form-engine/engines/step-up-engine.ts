import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { angleDeg, verticalLeanDeg } from '@/features/form-engine/rules/angle';

const CUE_DEFS: CueDef[] = [
  { id: 'su_knee_forward', severity: 'error',   text: 'Drive through your heel, not your toe', voiceText: 'Heel drive',      cooldownReps: 1 },
  { id: 'su_lockout',      severity: 'error',   text: 'Stand tall at the top — full lockout',  voiceText: 'Stand tall',      cooldownReps: 1 },
  { id: 'su_lean',         severity: 'warning', text: 'Keep your torso upright',               voiceText: 'Chest up',        cooldownReps: 2 },
  { id: 'su_control',      severity: 'warning', text: "Control the step down — don't drop",   voiceText: 'Control descent', cooldownReps: 2 },
];

export class StepUpEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private upEnteredMs = 0;
  private prevPhase = '';

  constructor() { super('step_up'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
    this.upEnteredMs = 0;
    this.prevPhase = '';
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const side = calibration.orientation === 'right' ? 'right' : 'left';
      const kneeIdx    = side === 'left' ? POSE_LANDMARKS.LEFT_KNEE    : POSE_LANDMARKS.RIGHT_KNEE;
      const ankleIdx   = side === 'left' ? POSE_LANDMARKS.LEFT_ANKLE   : POSE_LANDMARKS.RIGHT_ANKLE;
      const hipIdx     = side === 'left' ? POSE_LANDMARKS.LEFT_HIP     : POSE_LANDMARKS.RIGHT_HIP;
      const shoulderIdx = side === 'left' ? POSE_LANDMARKS.LEFT_SHOULDER : POSE_LANDMARKS.RIGHT_SHOULDER;

      const knee    = getWorldLandmark(frame, kneeIdx);
      const ankle   = getWorldLandmark(frame, ankleIdx);
      const hip     = getWorldLandmark(frame, hipIdx);
      const shoulder = getWorldLandmark(frame, shoulderIdx);

      // Knee forward of ankle
      if (knee && ankle && knee.z !== undefined && ankle.z !== undefined && -(knee.z - ankle.z) > 0.08) {
        formIssues.push({ id: 'su_knee_forward', severity: 'error', message: 'Drive through heel, not toe' });
      }

      // Lockout at UP phase: hip extension angle
      if (base.phase === 'UP' && shoulder && hip && knee) {
        const hipExtAngle = angleDeg(shoulder, hip, knee);
        if (hipExtAngle < 160) {
          formIssues.push({ id: 'su_lockout', severity: 'error', message: 'Stand tall at the top — full lockout' });
        }
      }

      // Torso lean
      if (shoulder && hip && verticalLeanDeg(shoulder, hip) > 20) {
        formIssues.push({ id: 'su_lean', severity: 'warning', message: 'Keep your torso upright' });
      }

      // Track when UP phase is entered to detect fast step-down
      if (base.phase === 'UP' && this.prevPhase !== 'UP') {
        this.upEnteredMs = frame.timestampMs;
      }
    }

    this.prevPhase = base.phase ?? '';

    if ((base.repCount ?? 0) > repBefore) {
      if (this.upEnteredMs > 0 && frame.timestampMs - this.upEnteredMs < 400) {
        formIssues.push({ id: 'su_control', severity: 'warning', message: "Control the step down — don't drop" });
      }
      this.upEnteredMs = 0;
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
