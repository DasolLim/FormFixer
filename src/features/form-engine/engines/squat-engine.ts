import { evaluateFrameConfidence } from '@/features/pose/confidence-gating';
import { POSE_LANDMARKS, getLandmark, getWorldLandmark, landmarkScore } from '@/features/pose/pose-types';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { angleDeg, midpoint, verticalLeanDeg } from '@/features/form-engine/rules/angle';
import { kneeOutRatio } from '@/features/form-engine/rules/symmetry';
import { TempoTracker } from '@/features/form-engine/rules/tempo';
import { prioritizeFeedback } from '@/features/form-engine/feedback-prioritizer';
import { RepCounterStateMachine } from '@/features/form-engine/rep-counter-state-machine';
import type { CalibrationStatus, EngineOutput, ExerciseFormEngine, FormIssue } from '@/features/form-engine/form-engine';

export type SquatEngineConfig = {
  confidence: { minVisibility: number; requiredCriticalCount: number };
  rep: {
    descendStartAngle: number;
    bottomAngle: number;
    ascendStartAngle: number;
    lockoutAngle: number;
    minRepCooldownMs: number;
    angleSmoothingAlpha: number;
  };
  form: {
    targetDepthAngle: number;
    maxTorsoLeanDeg: number;
    minKneeOutRatio: number;
  };
  tempo: {
    minDescentMs: number;
    minAscentMs: number;
  };
};

export const DEFAULT_SQUAT_ENGINE_CONFIG: SquatEngineConfig = {
  confidence: { minVisibility: 0.45, requiredCriticalCount: 8 },
  rep: {
    descendStartAngle: 152,
    bottomAngle: 95,
    ascendStartAngle: 120,
    lockoutAngle: 167,
    minRepCooldownMs: 450,
    angleSmoothingAlpha: 0.35
  },
  form: {
    targetDepthAngle: 105,
    maxTorsoLeanDeg: 35,
    minKneeOutRatio: 0.62
  },
  tempo: {
    minDescentMs: 350,
    minAscentMs: 250
  }
};


function weightedAverage(left: number, right: number, leftWeight: number, rightWeight: number) {
  const total = leftWeight + rightWeight;
  if (total <= 1e-6) return (left + right) / 2;
  return (left * leftWeight + right * rightWeight) / total;
}

export class SquatEngine implements ExerciseFormEngine {
  readonly id = 'squat';
  private counter: RepCounterStateMachine;
  private tempo: TempoTracker;

  constructor(private config: SquatEngineConfig = DEFAULT_SQUAT_ENGINE_CONFIG) {
    this.counter = new RepCounterStateMachine(config.rep);
    this.tempo = new TempoTracker(config.tempo);
  }

  reset() {
    this.counter.reset();
    this.tempo.reset();
  }

  update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const confidence = evaluateFrameConfidence(frame, this.config.confidence);
    if (!confidence.ok || !calibration.ready) {
      const notReady = this.counter.update(180, false, frame.timestampMs);
      return {
        state: { phase: notReady.phase, repCount: notReady.repCount, lastRepTimestampMs: notReady.lastRepTimestampMs },
        calibration,
        primaryCue: calibration.ready ? confidence.reason : calibration.message,
        issues: [{ code: 'calibration', message: calibration.message, priority: 1 }],
        metrics: { kneeAngle: 180, torsoLeanDeg: 0, kneeOutRatio: 1 }
      };
    }

    const leftHip = getLandmark(frame, POSE_LANDMARKS.leftHip)!;
    const rightHip = getLandmark(frame, POSE_LANDMARKS.rightHip)!;
    const leftKnee = getLandmark(frame, POSE_LANDMARKS.leftKnee)!;
    const rightKnee = getLandmark(frame, POSE_LANDMARKS.rightKnee)!;
    const leftAnkle = getLandmark(frame, POSE_LANDMARKS.leftAnkle)!;
    const rightAnkle = getLandmark(frame, POSE_LANDMARKS.rightAnkle)!;
    const leftShoulder = getLandmark(frame, POSE_LANDMARKS.leftShoulder)!;
    const rightShoulder = getLandmark(frame, POSE_LANDMARKS.rightShoulder)!;

    const leftKneeAngle = angleDeg(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = angleDeg(rightHip, rightKnee, rightAnkle);
    const leftWeight = landmarkScore(leftHip) + landmarkScore(leftKnee) + landmarkScore(leftAnkle);
    const rightWeight = landmarkScore(rightHip) + landmarkScore(rightKnee) + landmarkScore(rightAnkle);
    const kneeAngle = weightedAverage(leftKneeAngle, rightKneeAngle, leftWeight, rightWeight);

    const worldLeftHip = getWorldLandmark(frame, POSE_LANDMARKS.leftHip);
    const worldRightHip = getWorldLandmark(frame, POSE_LANDMARKS.rightHip);
    const worldLeftShoulder = getWorldLandmark(frame, POSE_LANDMARKS.leftShoulder);
    const worldRightShoulder = getWorldLandmark(frame, POSE_LANDMARKS.rightShoulder);

    const hipMid = worldLeftHip && worldRightHip ? midpoint(worldLeftHip, worldRightHip) : midpoint(leftHip, rightHip);
    const shoulderMid =
      worldLeftShoulder && worldRightShoulder ? midpoint(worldLeftShoulder, worldRightShoulder) : midpoint(leftShoulder, rightShoulder);
    const torsoLean = verticalLeanDeg(shoulderMid, hipMid);
    const kneeRatio = kneeOutRatio(leftKnee, rightKnee, leftAnkle, rightAnkle);

    const next = this.counter.update(kneeAngle, true, frame.timestampMs);
    const tempoResult = this.tempo.update(next.phase, frame.timestampMs);

    const issues: FormIssue[] = [];
    if (next.phase === 'BOTTOM' && kneeAngle > this.config.form.targetDepthAngle) {
      issues.push({ code: 'depth', message: 'Go lower', priority: 3 });
    }
    if (torsoLean > this.config.form.maxTorsoLeanDeg) {
      issues.push({ code: 'torso', message: 'Chest up', priority: 2 });
    }
    if (kneeRatio < this.config.form.minKneeOutRatio) {
      issues.push({ code: 'knees', message: 'Push knees out', priority: 2 });
    }
    if (tempoResult?.tooFast) {
      issues.push({ code: 'tempo', message: 'Slow down and stay controlled', priority: 4 });
    }
    if (!issues.length) {
      issues.push({ code: 'status', message: next.repJustCounted ? 'Rep counted. Keep going.' : 'Good form. Stay controlled.', priority: 5 });
    }

    const top = prioritizeFeedback(issues, 2);

    return {
      state: { phase: next.phase, repCount: next.repCount, lastRepTimestampMs: next.lastRepTimestampMs },
      calibration,
      primaryCue: top[0]?.message ?? 'Ready',
      secondaryCue: top[1]?.message,
      issues: top,
      metrics: {
        kneeAngle,
        smoothedKneeAngle: next.smoothedAngle,
        torsoLeanDeg: torsoLean,
        kneeOutRatio: kneeRatio,
        descentMs: tempoResult?.descentMs ?? 0,
        ascentMs: tempoResult?.ascentMs ?? 0
      }
    };
  }
}
