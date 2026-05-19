import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { angleDeg } from '@/features/form-engine/rules/angle';

const CUE_DEFS: CueDef[] = [
  { id: 'curl_elbow_drift',     severity: 'error',   text: 'Pin your elbows to your sides',  voiceText: 'Elbows in',        cooldownReps: 1 },
  { id: 'curl_wrist_break',     severity: 'warning',  text: 'Keep your wrists straight',      voiceText: 'Wrists straight',  cooldownReps: 3 },
  { id: 'curl_full_extension',  severity: 'warning',  text: 'Fully extend at the bottom',     voiceText: 'Full extension',   cooldownReps: 2 },
  { id: 'curl_imbalance',       severity: 'warning',  text: 'Even out both arms',             voiceText: 'Even arms',        cooldownReps: 3 },
];

export class BicepCurlEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);

  constructor() { super('bicep_curl'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const wl = frame.worldLandmarks;
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const lShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const lElbow    = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_ELBOW);
      const lWrist    = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_WRIST);
      const lIndex    = wl[POSE_LANDMARKS.LEFT_INDEX];
      const rShoulder = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER);
      const rElbow    = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_ELBOW);

      // 1. Elbow drift: elbows should stay under shoulders (x-axis)
      if (lElbow && lShoulder && Math.abs(lElbow.x - lShoulder.x) > 0.15) {
        formIssues.push({ id: 'curl_elbow_drift', severity: 'error', message: 'Pin elbows to sides' });
      } else if (rElbow && rShoulder && Math.abs(rElbow.x - rShoulder.x) > 0.15) {
        formIssues.push({ id: 'curl_elbow_drift', severity: 'error', message: 'Pin elbows to sides' });
      }

      // 2. Wrist break: wrist angle should be ~180° (straight); < 155° = broken
      if (lElbow && lWrist && lIndex) {
        const wristAngle = angleDeg(lElbow, lWrist, lIndex);
        if (wristAngle < 155) {
          formIssues.push({ id: 'curl_wrist_break', severity: 'warning', message: 'Keep wrists straight' });
        }
      }

      // 3. Full extension: at bottom (arms extended), angle should reach ≥ 150°
      if (base.leftAngle < 150 || base.rightAngle < 150) {
        if (base.phase === 'UP' || base.phase === 'READY') {
          formIssues.push({ id: 'curl_full_extension', severity: 'warning', message: 'Fully extend at the bottom' });
        }
      }

      // 4. Imbalance: left vs right angle difference
      if (Math.abs(base.leftAngle - base.rightAngle) > 20) {
        formIssues.push({ id: 'curl_imbalance', severity: 'warning', message: 'Even out both arms' });
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
