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

export type NormalizedPoseFrame = {
  timestampMs: number;
  landmarks: Array<PoseLandmark | null>;
  worldLandmarks: Array<PoseLandmark | null>;
  hasPose: boolean;
};

// MediaPipe Pose Landmarker indexes (0-32), kept explicit for API correctness.
export const POSE_LANDMARKS = {
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32
} as const;

export const CRITICAL_SQUAT_LANDMARKS = [
  POSE_LANDMARKS.leftShoulder,
  POSE_LANDMARKS.rightShoulder,
  POSE_LANDMARKS.leftHip,
  POSE_LANDMARKS.rightHip,
  POSE_LANDMARKS.leftKnee,
  POSE_LANDMARKS.rightKnee,
  POSE_LANDMARKS.leftAnkle,
  POSE_LANDMARKS.rightAnkle
] as const;

export function getLandmark(frame: NormalizedPoseFrame, index: number) {
  return frame.landmarks[index] ?? null;
}

export function getWorldLandmark(frame: NormalizedPoseFrame, index: number) {
  return frame.worldLandmarks[index] ?? null;
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
