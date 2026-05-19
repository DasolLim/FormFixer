export const POSE_LANDMARK_INDEX = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28
} as const;

// Very simple, easy-to-tune v1 thresholds.
export const SQUAT_THRESHOLDS = {
  minVisibility: 0.45,
  topEnterAngle: 150,
  topLockAngle: 165,
  bottomEnterAngle: 95,
  bottomTargetAngle: 105,
  upEnterAngle: 120,
  torsoLeanMaxDeg: 35,
  kneeInRatioMin: 0.62,
  minFramesBetweenReps: 8,
  smoothingAlpha: 0.35,
  stableCueFrames: 6
} as const;
