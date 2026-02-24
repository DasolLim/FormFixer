import { CRITICAL_SQUAT_LANDMARKS, POSE_LANDMARKS, getLandmark, isLandmarkReliable } from '@/features/pose/pose-types';
import type { CalibrationStatus } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame, PoseLandmark } from '@/features/pose/pose-types';
import { angleDeg, midpoint, verticalLeanDeg } from '@/features/form-engine/rules/angle';

export type CalibrationOrientation = 'auto' | 'front' | 'side';

export type CalibrationGateConfig = {
  minVisibility: number;
  requiredStableFrames: number;
  maxMotionPerFrame: number;
  minShoulderHipHeightDelta: number;
  orientation: CalibrationOrientation;
};

const defaultStatus: CalibrationStatus = { ready: false, message: 'Step back so full body is visible', stableFrames: 0 };

function averageMotion(prev: PoseLandmark[], next: PoseLandmark[]) {
  let total = 0;
  for (let i = 0; i < prev.length; i += 1) total += Math.hypot(prev[i].x - next[i].x, prev[i].y - next[i].y);
  return total / Math.max(prev.length, 1);
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
    const critical = CRITICAL_SQUAT_LANDMARKS.map((idx) => getLandmark(frame, idx));
    if (critical.some((p) => !isLandmarkReliable(p, this.config.minVisibility))) {
      this.reset();
      return { ...defaultStatus, message: 'Step back so full body is visible' };
    }

    const criticalPoints = critical as PoseLandmark[];

    const leftHip = getLandmark(frame, POSE_LANDMARKS.leftHip)!;
    const rightHip = getLandmark(frame, POSE_LANDMARKS.rightHip)!;
    const leftShoulder = getLandmark(frame, POSE_LANDMARKS.leftShoulder)!;
    const rightShoulder = getLandmark(frame, POSE_LANDMARKS.rightShoulder)!;
    const leftKnee = getLandmark(frame, POSE_LANDMARKS.leftKnee)!;
    const rightKnee = getLandmark(frame, POSE_LANDMARKS.rightKnee)!;
    const leftAnkle = getLandmark(frame, POSE_LANDMARKS.leftAnkle)!;
    const rightAnkle = getLandmark(frame, POSE_LANDMARKS.rightAnkle)!;

    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const hipMid = midpoint(leftHip, rightHip);
    const kneeAngle = (angleDeg(leftHip, leftKnee, leftAnkle) + angleDeg(rightHip, rightKnee, rightAnkle)) / 2;
    const upright = shoulderMid.y + this.config.minShoulderHipHeightDelta < hipMid.y && kneeAngle > 155 && verticalLeanDeg(shoulderMid, hipMid) < 20;

    if (!upright) {
      this.reset();
      return { ready: false, message: 'Stand upright to begin', stableFrames: 0 };
    }

    if (this.config.orientation !== 'auto') {
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      const isFrontLike = shoulderWidth > 0.08;
      if (this.config.orientation === 'front' && !isFrontLike) {
        this.reset();
        return { ready: false, message: 'Face the camera front-on', stableFrames: 0 };
      }
      if (this.config.orientation === 'side' && isFrontLike) {
        this.reset();
        return { ready: false, message: 'Turn to your side', stableFrames: 0 };
      }
    }

    if (this.previousCritical) {
      const motion = averageMotion(this.previousCritical, criticalPoints);
      if (motion > this.config.maxMotionPerFrame) {
        this.stableFrames = 0;
        this.previousCritical = criticalPoints;
        return { ready: false, message: 'Hold still', stableFrames: 0 };
      }
    }

    this.stableFrames += 1;
    this.previousCritical = criticalPoints;

    if (this.stableFrames >= this.config.requiredStableFrames) {
      return { ready: true, message: 'Ready', stableFrames: this.stableFrames };
    }

    return { ready: false, message: `Hold still (${this.stableFrames}/${this.config.requiredStableFrames})`, stableFrames: this.stableFrames };
  }
}
