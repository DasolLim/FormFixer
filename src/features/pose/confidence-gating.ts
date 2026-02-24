import { CRITICAL_SQUAT_LANDMARKS, isLandmarkReliable } from '@/features/pose/pose-types';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';

export type FrameConfidenceConfig = {
  minVisibility: number;
  requiredCriticalCount: number;
};

export function evaluateFrameConfidence(frame: NormalizedPoseFrame, config: FrameConfidenceConfig) {
  const visibleCritical = CRITICAL_SQUAT_LANDMARKS.filter((index) => isLandmarkReliable(frame.landmarks[index], config.minVisibility));

  if (!frame.hasPose) {
    return { ok: false, reason: 'No pose detected' };
  }

  if (visibleCritical.length < config.requiredCriticalCount) {
    return { ok: false, reason: 'Step back so full body is visible' };
  }

  return { ok: true, reason: 'ok' };
}
