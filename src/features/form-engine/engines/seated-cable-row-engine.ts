import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { midpoint, verticalLeanDeg } from '@/features/form-engine/rules/angle';

const CUE_DEFS: CueDef[] = [
  { id: 'scr_kipping',      severity: 'error',   text: "Don't rock — pull with your back", voiceText: 'No rocking',     cooldownReps: 1 },
  { id: 'scr_elbow_drive',  severity: 'error',   text: 'Drive elbows past your body',       voiceText: 'Elbows back',    cooldownReps: 1 },
  { id: 'scr_forward_lean', severity: 'warning', text: 'Sit tall at the start',             voiceText: 'Sit tall',       cooldownReps: 2 },
  { id: 'scr_full_extend',  severity: 'warning', text: 'Fully extend at the front',         voiceText: 'Full extension', cooldownReps: 2 },
];

export class SeatedCableRowEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private repLeanMin = 180;
  private repLeanMax = 0;

  constructor() { super('seated_cable_row'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
    this.repLeanMin = 180;
    this.repLeanMax = 0;
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const primaryAngle = base.primaryAngle ?? 180;
      const side = calibration.orientation === 'right' ? 'right' : 'left';
      const elbowIdx   = side === 'left' ? POSE_LANDMARKS.LEFT_ELBOW    : POSE_LANDMARKS.RIGHT_ELBOW;
      const shoulderIdx = side === 'left' ? POSE_LANDMARKS.LEFT_SHOULDER : POSE_LANDMARKS.RIGHT_SHOULDER;

      const elbow   = getWorldLandmark(frame, elbowIdx);
      const shoulder = getWorldLandmark(frame, shoulderIdx);
      const lShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const rShoulder = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER);
      const lHip      = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);
      const rHip      = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_HIP);

      // Track torso lean for kipping check
      if (lShoulder && rShoulder && lHip && rHip) {
        const shoulderMid = midpoint(lShoulder, rShoulder);
        const hipMid      = midpoint(lHip, rHip);
        const lean = verticalLeanDeg(shoulderMid, hipMid);
        this.repLeanMin = Math.min(this.repLeanMin, lean);
        this.repLeanMax = Math.max(this.repLeanMax, lean);

        // Forward lean at DOWN phase (extended, start position)
        if (base.phase === 'DOWN' && lean > 20) {
          formIssues.push({ id: 'scr_forward_lean', severity: 'warning', message: 'Sit tall at the start' });
        }
      }

      // Elbow drive at UP phase (pulled position)
      if (base.phase === 'UP' && elbow && shoulder &&
          elbow.z !== undefined && shoulder.z !== undefined && elbow.z < shoulder.z - 0.02) {
        formIssues.push({ id: 'scr_elbow_drive', severity: 'error', message: 'Drive elbows past your body' });
      }

      // Full extension at DOWN phase
      if (base.phase === 'DOWN' && primaryAngle < 140) {
        formIssues.push({ id: 'scr_full_extend', severity: 'warning', message: 'Fully extend at the front' });
      }
    }

    if ((base.repCount ?? 0) > repBefore) {
      if (this.repLeanMax - this.repLeanMin > 25) {
        formIssues.push({ id: 'scr_kipping', severity: 'error', message: "Don't rock — pull with your back" });
      }
      this.repLeanMin = 180;
      this.repLeanMax = 0;
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
