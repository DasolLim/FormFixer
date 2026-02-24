import { distance2d } from '@/features/form-engine/rules/angle';
import type { PoseLandmark } from '@/features/pose/pose-types';

export function kneeOutRatio(leftKnee: PoseLandmark, rightKnee: PoseLandmark, leftAnkle: PoseLandmark, rightAnkle: PoseLandmark) {
  const knees = distance2d(leftKnee, rightKnee);
  const ankles = Math.max(distance2d(leftAnkle, rightAnkle), 1e-4);
  return knees / ankles;
}
