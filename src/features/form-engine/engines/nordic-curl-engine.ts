import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { angleDeg, verticalLeanDeg } from '@/features/form-engine/rules/angle';

const CUE_DEFS: CueDef[] = [
  { id: 'nc_hip_break', severity: 'error',   text: "Keep hips locked — don't fold at the waist", voiceText: 'Hips locked',   cooldownReps: 1 },
  { id: 'nc_too_fast',  severity: 'error',   text: 'Slow down — control the descent',            voiceText: 'Slow down',     cooldownReps: 1 },
  { id: 'nc_body_line', severity: 'warning', text: 'Keep your body in a straight line',          voiceText: 'Stay straight', cooldownReps: 2 },
];

export class NordicCurlEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private descentStartMs = 0;
  private prevPhase = '';
  private prevLeanDeg = 0;

  constructor() { super('nordic_curl'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
    this.descentStartMs = 0;
    this.prevPhase = '';
    this.prevLeanDeg = 0;
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const side = calibration.orientation === 'right' ? 'right' : 'left';
      const shoulderIdx = side === 'left' ? POSE_LANDMARKS.LEFT_SHOULDER : POSE_LANDMARKS.RIGHT_SHOULDER;
      const hipIdx      = side === 'left' ? POSE_LANDMARKS.LEFT_HIP      : POSE_LANDMARKS.RIGHT_HIP;
      const kneeIdx     = side === 'left' ? POSE_LANDMARKS.LEFT_KNEE     : POSE_LANDMARKS.RIGHT_KNEE;

      const shoulder = getWorldLandmark(frame, shoulderIdx);
      const hip      = getWorldLandmark(frame, hipIdx);
      const knee     = getWorldLandmark(frame, kneeIdx);

      // Hip lock: shoulder-hip-knee angle must stay > 165°; < 160° = break
      if (shoulder && hip && knee) {
        const hipLockAngle = angleDeg(shoulder, hip, knee);
        if (hipLockAngle < 160) {
          formIssues.push({ id: 'nc_hip_break', severity: 'error', message: "Keep hips locked — don't fold at the waist" });
        }

        // Body line: sudden lean change > 8°/frame
        const currentLean = verticalLeanDeg(shoulder, hip);
        if (Math.abs(currentLean - this.prevLeanDeg) > 8) {
          formIssues.push({ id: 'nc_body_line', severity: 'warning', message: 'Keep your body in a straight line' });
        }
        this.prevLeanDeg = currentLean;
      }

      // Track descent start: when entering UP phase (upright kneeling position)
      if (base.phase === 'UP' && this.prevPhase !== 'UP') {
        this.descentStartMs = frame.timestampMs;
      }

      // Check descent speed when reaching DOWN
      if (base.phase === 'DOWN' && this.prevPhase !== 'DOWN' && this.descentStartMs > 0) {
        const descentMs = frame.timestampMs - this.descentStartMs;
        if (descentMs < 1500) {
          formIssues.push({ id: 'nc_too_fast', severity: 'error', message: `Slow down — control the descent (target: 2-4s)` });
        }
        this.descentStartMs = 0;
      }
    }

    this.prevPhase = base.phase ?? '';

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
