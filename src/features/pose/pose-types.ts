export type PoseLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
};

export type MediaPipePoseResultLike = {
  landmarks?: PoseLandmark[][];
  worldLandmarks?: PoseLandmark[][];
};

/**
 * COORDINATE CONVENTION — READ BEFORE EDITING
 *
 * `landmarks`      — image-space (x, y in [0,1] normalized to video dimensions).
 *                    Use ONLY for canvas drawing and overlay rendering.
 *
 * `worldLandmarks` — world-space (x, y, z in meters, hip-centered).
 *                    Use for ALL angle calculations and form analysis.
 *                    World coordinates normalize for body size and camera distance,
 *                    making angle thresholds consistent across different users.
 */
export type NormalizedPoseFrame = {
  timestampMs: number;
  landmarks: Array<PoseLandmark | null>;       // image-space, for drawing
  worldLandmarks: Array<PoseLandmark | null>;  // world-space, for angle math
  hasPose: boolean;
};

// Full 33-point MediaPipe Pose Landmarker index map.
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export type PoseLandmarkName = keyof typeof POSE_LANDMARKS;

export const CRITICAL_SQUAT_LANDMARKS = [
  POSE_LANDMARKS.LEFT_SHOULDER,
  POSE_LANDMARKS.RIGHT_SHOULDER,
  POSE_LANDMARKS.LEFT_HIP,
  POSE_LANDMARKS.RIGHT_HIP,
  POSE_LANDMARKS.LEFT_KNEE,
  POSE_LANDMARKS.RIGHT_KNEE,
  POSE_LANDMARKS.LEFT_ANKLE,
  POSE_LANDMARKS.RIGHT_ANKLE,
] as const;

export function getLandmark(frame: NormalizedPoseFrame, index: number) {
  return frame.landmarks[index] ?? null;
}

export function getWorldLandmark(
  frame: NormalizedPoseFrame,
  index: number,
  minVisibility = 0.6
): PoseLandmark | null {
  const lm = frame.worldLandmarks[index];
  if (!lm || (lm.visibility ?? 1) < minVisibility) return null;
  return lm;
}

export function landmarkScore(point: PoseLandmark | null) {
  if (!point) return 0;
  const visibility = point.visibility ?? 1;
  const presence = point.presence ?? visibility;
  return Math.min(visibility, presence);
}

export function isLandmarkReliable(point: PoseLandmark | null, minVisibility: number) {
  return landmarkScore(point) >= minVisibility;
}
