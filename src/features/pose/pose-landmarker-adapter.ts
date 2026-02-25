import { normalizePoseResult } from '@/features/pose/landmark-normalization';
import type { MediaPipePoseResultLike, NormalizedPoseFrame } from '@/features/pose/pose-types';

export function adaptPoseLandmarkerResult(result: MediaPipePoseResultLike | null | undefined, timestampMs: number): NormalizedPoseFrame {
  return normalizePoseResult(result, timestampMs);
}
