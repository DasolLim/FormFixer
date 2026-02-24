import { POSE_LANDMARK_INDEX, SQUAT_THRESHOLDS } from '@/lib/pose/constants';
import { angleDeg, avg, distance2D, type Landmark } from '@/lib/pose/math';

export type SquatPhase = 'top' | 'down' | 'bottom' | 'up';

export type SquatState = {
  phase: SquatPhase;
  reps: number;
  lastRepFrame: number;
};

export type SquatAnalysis = {
  isStable: boolean;
  kneeAngle: number;
  phase: SquatPhase;
  reps: number;
  cue: string;
};

export const initialSquatState: SquatState = {
  phase: 'top',
  reps: 0,
  lastRepFrame: -100
};

function visibilityOk(landmarks: Landmark[]) {
  const i = POSE_LANDMARK_INDEX;
  const important = [
    landmarks[i.leftShoulder],
    landmarks[i.rightShoulder],
    landmarks[i.leftHip],
    landmarks[i.rightHip],
    landmarks[i.leftKnee],
    landmarks[i.rightKnee],
    landmarks[i.leftAnkle],
    landmarks[i.rightAnkle]
  ];

  return important.every((p) => (p?.visibility ?? 0) >= SQUAT_THRESHOLDS.minVisibility);
}

export function analyzeSquat(landmarks: Landmark[], prev: SquatState, frameCount: number): SquatAnalysis {
  if (!visibilityOk(landmarks)) {
    return {
      isStable: false,
      kneeAngle: 180,
      phase: prev.phase,
      reps: prev.reps,
      cue: 'Step back so full body is visible'
    };
  }

  const i = POSE_LANDMARK_INDEX;

  const leftKneeAngle = angleDeg(landmarks[i.leftHip], landmarks[i.leftKnee], landmarks[i.leftAnkle]);
  const rightKneeAngle = angleDeg(landmarks[i.rightHip], landmarks[i.rightKnee], landmarks[i.rightAnkle]);
  const kneeAngle = avg(leftKneeAngle, rightKneeAngle);

  let phase = prev.phase;
  let reps = prev.reps;
  let lastRepFrame = prev.lastRepFrame;

  if (phase === 'top' && kneeAngle < SQUAT_THRESHOLDS.topEnterAngle) phase = 'down';
  if (phase === 'down' && kneeAngle < SQUAT_THRESHOLDS.bottomEnterAngle) phase = 'bottom';
  if (phase === 'bottom' && kneeAngle > SQUAT_THRESHOLDS.upEnterAngle) phase = 'up';

  const canCount = frameCount - prev.lastRepFrame > SQUAT_THRESHOLDS.minFramesBetweenReps;
  if (phase === 'up' && kneeAngle > SQUAT_THRESHOLDS.topLockAngle && canCount) {
    reps += 1;
    phase = 'top';
    lastRepFrame = frameCount;
  }

  const leftShoulder = landmarks[i.leftShoulder];
  const rightShoulder = landmarks[i.rightShoulder];
  const leftHip = landmarks[i.leftHip];
  const rightHip = landmarks[i.rightHip];
  const leftKnee = landmarks[i.leftKnee];
  const rightKnee = landmarks[i.rightKnee];
  const leftAnkle = landmarks[i.leftAnkle];
  const rightAnkle = landmarks[i.rightAnkle];

  const shoulderMid = { x: avg(leftShoulder.x, rightShoulder.x), y: avg(leftShoulder.y, rightShoulder.y) };
  const hipMid = { x: avg(leftHip.x, rightHip.x), y: avg(leftHip.y, rightHip.y) };
  const torsoLeanDeg = Math.abs((Math.atan2(hipMid.x - shoulderMid.x, hipMid.y - shoulderMid.y) * 180) / Math.PI);

  const kneeWidth = distance2D(leftKnee, rightKnee);
  const ankleWidth = Math.max(distance2D(leftAnkle, rightAnkle), 1e-4);
  const kneeOutRatio = kneeWidth / ankleWidth;

  let cue = 'Good rep. Keep breathing and stay controlled';
  if (phase === 'down' && kneeAngle > SQUAT_THRESHOLDS.bottomTargetAngle) {
    cue = 'Go lower';
  } else if (torsoLeanDeg > SQUAT_THRESHOLDS.torsoLeanMaxDeg) {
    cue = 'Chest up';
  } else if (kneeOutRatio < SQUAT_THRESHOLDS.kneeInRatioMin) {
    cue = 'Push knees out';
  }

  prev.phase = phase;
  prev.reps = reps;
  prev.lastRepFrame = lastRepFrame;

  return { isStable: true, kneeAngle, phase, reps, cue };
}
