import type { MediaPipePoseResultLike, NormalizedPoseFrame, PoseLandmark } from '@/features/pose/pose-types';

const LANDMARK_COUNT = 33;

function safeLandmark(point: PoseLandmark | undefined, clampToUnit = true): PoseLandmark | null {
  if (!point) return null;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

  const normalizedX = clampToUnit ? Math.min(1, Math.max(0, point.x)) : point.x;
  const normalizedY = clampToUnit ? Math.min(1, Math.max(0, point.y)) : point.y;

  return {
    x: normalizedX,
    y: normalizedY,
    z: Number.isFinite(point.z as number) ? point.z : 0,
    visibility: Number.isFinite(point.visibility as number) ? point.visibility : 1,
    presence: Number.isFinite(point.presence as number) ? point.presence : 1
  };
}

function normalizeLandmarkSet(source: PoseLandmark[] | undefined, clampToUnit: boolean) {
  const set = source ?? [];
  return Array.from({ length: LANDMARK_COUNT }, (_, index) => safeLandmark(set[index], clampToUnit));
}

export function normalizePoseResult(result: MediaPipePoseResultLike | null | undefined, timestampMs: number): NormalizedPoseFrame {
  const imagePose = result?.landmarks?.[0];
  const worldPose = result?.worldLandmarks?.[0];

  return {
    timestampMs,
    landmarks: normalizeLandmarkSet(imagePose, true),
    worldLandmarks: normalizeLandmarkSet(worldPose, false),
    hasPose: Boolean(imagePose && imagePose.length >= LANDMARK_COUNT)
  };
}
