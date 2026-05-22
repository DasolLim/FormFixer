import { POSE_LANDMARKS, getLandmark, getWorldLandmark, isLandmarkReliable } from '@/features/pose/pose-types';
import type { CalibrationStatus, CameraOrientation } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame, PoseLandmark } from '@/features/pose/pose-types';
import { angleDeg, midpoint, verticalLeanDeg } from '@/features/form-engine/rules/angle';

export type CalibrationOrientation = 'auto' | 'front' | 'side';

export type CalibrationGateConfig = {
  minVisibility: number;
  requiredStableFrames: number;
  maxMotionPerFrame: number;
  minShoulderHipHeightDelta: number;
  orientation: CalibrationOrientation;
  calibrationMode?: 'standing' | 'prone' | 'hanging' | 'seated' | 'kneeling';
  calibrationLandmarks?: number[];
};

const FALLBACK_LANDMARKS = [
  POSE_LANDMARKS.LEFT_SHOULDER,
  POSE_LANDMARKS.RIGHT_SHOULDER,
  POSE_LANDMARKS.LEFT_HIP,
  POSE_LANDMARKS.RIGHT_HIP,
  POSE_LANDMARKS.LEFT_KNEE,
  POSE_LANDMARKS.RIGHT_KNEE,
  POSE_LANDMARKS.LEFT_ANKLE,
  POSE_LANDMARKS.RIGHT_ANKLE,
];

function averageMotion(prev: PoseLandmark[], next: PoseLandmark[]) {
  let total = 0;
  for (let i = 0; i < prev.length; i += 1) total += Math.hypot(prev[i].x - next[i].x, prev[i].y - next[i].y);
  return total / Math.max(prev.length, 1);
}

function detectOrientation(frame: NormalizedPoseFrame): CameraOrientation {
  const lShoulder = frame.landmarks[11];
  const rShoulder = frame.landmarks[12];
  if (!lShoulder || !rShoulder) return 'front';
  const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
  if (shoulderWidth > 0.10) return 'front';
  return (lShoulder.visibility ?? 0) > (rShoulder.visibility ?? 0) ? 'left' : 'right';
}

export class CalibrationGate {
  private stableFrames = 0;
  private previousCritical: PoseLandmark[] | null = null;

  constructor(private config: CalibrationGateConfig) {}

  reset() {
    this.stableFrames = 0;
    this.previousCritical = null;
  }

  update(frame: NormalizedPoseFrame): CalibrationStatus {
    const orientation = detectOrientation(frame);
    const landmarkIndices = this.config.calibrationLandmarks ?? FALLBACK_LANDMARKS;
    const critical = landmarkIndices.map((idx) => getLandmark(frame, idx));

    if (critical.some((p) => !isLandmarkReliable(p, this.config.minVisibility))) {
      this.reset();
      return { ready: false, message: 'Step back so full body is visible', stableFrames: 0, orientation };
    }

    const criticalPoints = critical as PoseLandmark[];
    const mode = this.config.calibrationMode ?? 'standing';

    if (mode === 'prone') {
      const wLeftShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER, 0);
      const wLeftHip = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP, 0);
      if (wLeftShoulder && wLeftHip && Math.abs(wLeftShoulder.y - wLeftHip.y) > 0.15) {
        this.reset();
        return { ready: false, message: 'Lie flat and hold still', stableFrames: 0, orientation };
      }
    } else if (mode === 'hanging') {
      const wLeftWrist = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_WRIST, 0);
      const wRightWrist = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_WRIST, 0);
      const wLeftShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER, 0);
      const wRightShoulder = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER, 0);
      const wristsAbove =
        (wLeftWrist && wLeftShoulder && wLeftWrist.y > wLeftShoulder.y) ||
        (wRightWrist && wRightShoulder && wRightWrist.y > wRightShoulder.y);
      if (!wristsAbove) {
        this.reset();
        return { ready: false, message: 'Hang from the bar and hold still', stableFrames: 0, orientation };
      }
    } else if (mode === 'seated') {
      const wHip  = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP, 0);
      const wKnee = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_KNEE, 0);
      if (wHip && wKnee && Math.abs(wHip.y - wKnee.y) > 0.20) {
        this.reset();
        return { ready: false, message: 'Sit in position and hold still', stableFrames: 0, orientation };
      }
    } else if (mode === 'kneeling') {
      const wShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER, 0);
      const wHip      = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP, 0);
      const wKnee     = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_KNEE, 0);
      const upright   = wShoulder && wHip && wKnee &&
        Math.abs(wKnee.y - wHip.y) < 0.15 &&
        wShoulder.y > wHip.y + 0.30 &&
        verticalLeanDeg(wShoulder, wHip) < 15;
      if (!upright) {
        this.reset();
        return { ready: false, message: 'Kneel upright with feet anchored and hold still', stableFrames: 0, orientation };
      }
    } else {
      // standing
      const leftHip = getLandmark(frame, POSE_LANDMARKS.LEFT_HIP)!;
      const rightHip = getLandmark(frame, POSE_LANDMARKS.RIGHT_HIP)!;
      const leftShoulder = getLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER)!;
      const rightShoulder = getLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER)!;
      const leftKnee = getLandmark(frame, POSE_LANDMARKS.LEFT_KNEE)!;
      const rightKnee = getLandmark(frame, POSE_LANDMARKS.RIGHT_KNEE)!;
      const leftAnkle = getLandmark(frame, POSE_LANDMARKS.LEFT_ANKLE)!;
      const rightAnkle = getLandmark(frame, POSE_LANDMARKS.RIGHT_ANKLE)!;

      const shoulderMid = midpoint(leftShoulder, rightShoulder);
      const hipMid = midpoint(leftHip, rightHip);
      const kneeAngle = (angleDeg(leftHip, leftKnee, leftAnkle) + angleDeg(rightHip, rightKnee, rightAnkle)) / 2;
      const upright =
        shoulderMid.y + this.config.minShoulderHipHeightDelta < hipMid.y &&
        kneeAngle > 155 &&
        verticalLeanDeg(shoulderMid, hipMid) < 20;

      if (!upright) {
        this.reset();
        return { ready: false, message: 'Stand upright to begin', stableFrames: 0, orientation };
      }
    }

    if (this.config.orientation !== 'auto') {
      const leftShoulder = getLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER)!;
      const rightShoulder = getLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER)!;
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      const isFrontLike = shoulderWidth > 0.08;
      if (this.config.orientation === 'front' && !isFrontLike) {
        this.reset();
        return { ready: false, message: 'Face the camera front-on', stableFrames: 0, orientation };
      }
      if (this.config.orientation === 'side' && isFrontLike) {
        this.reset();
        return { ready: false, message: 'Turn to your side', stableFrames: 0, orientation };
      }
    }

    if (this.previousCritical) {
      const motion = averageMotion(this.previousCritical, criticalPoints);
      if (motion > this.config.maxMotionPerFrame) {
        this.stableFrames = 0;
        this.previousCritical = criticalPoints;
        return { ready: false, message: 'Hold still', stableFrames: 0, orientation };
      }
    }

    this.stableFrames += 1;
    this.previousCritical = criticalPoints;

    if (this.stableFrames >= this.config.requiredStableFrames) {
      return { ready: true, message: 'Ready', stableFrames: this.stableFrames, orientation };
    }

    return {
      ready: false,
      message: `Hold still (${this.stableFrames}/${this.config.requiredStableFrames})`,
      stableFrames: this.stableFrames,
      orientation,
    };
  }
}
