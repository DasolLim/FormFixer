import { evaluateFrameConfidence } from '@/features/pose/confidence-gating';
import { POSE_LANDMARKS, getLandmark, getWorldLandmark, landmarkScore } from '@/features/pose/pose-types';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { angleDeg, midpoint, verticalLeanDeg, heelLiftRatio } from '@/features/form-engine/rules/angle';
import { kneeOutRatio } from '@/features/form-engine/rules/symmetry';
import { TempoTracker } from '@/features/form-engine/rules/tempo';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { SquatRepCounterStateMachine } from '@/features/form-engine/rep-counter-state-machine';
import { RepScorer } from '@/features/form-engine/rep-scorer';
import { getExerciseConfig } from '@/features/form-engine/exercise-config';
import type { CalibrationStatus, EngineOutput, EnginePhase, ExerciseFormEngine, FormIssue } from '@/features/form-engine/form-engine';
import type { RepScore } from '@/features/form-engine/scoring-types';

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
    maxHeelLiftRatio: number;
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
    minKneeOutRatio: 0.62,
    maxHeelLiftRatio: 0.12,
  },
  tempo: {
    minDescentMs: 350,
    minAscentMs: 250
  }
};

const SQUAT_CUE_DEFS: CueDef[] = [
  { id: 'squat_depth',      severity: 'error',   text: 'Go lower — hit parallel',       voiceText: 'Go lower',     cooldownReps: 1 },
  { id: 'squat_torso_lean', severity: 'warning',  text: 'Chest up, stay tall',            voiceText: 'Chest up',     cooldownReps: 3 },
  { id: 'squat_knee_cave',  severity: 'warning',  text: 'Push knees out over toes',       voiceText: 'Knees out',    cooldownReps: 2 },
  { id: 'squat_heel_lift',  severity: 'warning',  text: 'Keep heels flat on the ground',  voiceText: 'Heels down',   cooldownReps: 3 },
  { id: 'squat_tempo',      severity: 'warning',  text: 'Slow down, stay controlled',     voiceText: 'Slow down',    cooldownReps: 2 },
];

function weightedAverage(left: number, right: number, leftWeight: number, rightWeight: number) {
  const total = leftWeight + rightWeight;
  if (total <= 1e-6) return (left + right) / 2;
  return (left * leftWeight + right * rightWeight) / total;
}

export class SquatEngine implements ExerciseFormEngine {
  readonly id = 'squat';
  private counter: SquatRepCounterStateMachine;
  private tempo: TempoTracker;
  private prioritizer: FeedbackPrioritizer;
  private repScorer: RepScorer;
  private repScoresAcc: RepScore[] = [];
  private prevPhase: EnginePhase = 'NOT_READY';

  constructor(private config: SquatEngineConfig = DEFAULT_SQUAT_ENGINE_CONFIG) {
    this.counter = new SquatRepCounterStateMachine(config.rep);
    this.tempo = new TempoTracker(config.tempo);
    this.prioritizer = new FeedbackPrioritizer(SQUAT_CUE_DEFS);
    this.repScorer = new RepScorer(getExerciseConfig('squat'));
  }

  reset() {
    this.counter.reset();
    this.tempo.reset();
    this.prioritizer.reset();
    this.repScorer.reset();
    this.repScoresAcc = [];
    this.prevPhase = 'NOT_READY';
  }

  update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const confidence = evaluateFrameConfidence(frame, this.config.confidence);
    if (!confidence.ok || !calibration.ready) {
      const notReady = this.counter.update(180, false, frame.timestampMs);
      this.prevPhase = notReady.phase;
      return {
        state: { phase: notReady.phase, repCount: notReady.repCount, lastRepTimestampMs: notReady.lastRepTimestampMs },
        calibration,
        primaryCue: calibration.ready ? confidence.reason : calibration.message,
        issues: [{ id: 'calibration', severity: 'info', message: calibration.message }],
        metrics: { kneeAngle: 180, torsoLeanDeg: 0, kneeOutRatio: 1 },
        leftAngle: 180,
        rightAngle: 180,
        isUnilateral: false,
        leftRepCount: 0,
        rightRepCount: 0,
        topCues: [],
        repScores: this.repScoresAcc,
      };
    }

    const leftHip = getLandmark(frame, POSE_LANDMARKS.LEFT_HIP)!;
    const rightHip = getLandmark(frame, POSE_LANDMARKS.RIGHT_HIP)!;
    const leftKnee = getLandmark(frame, POSE_LANDMARKS.LEFT_KNEE)!;
    const rightKnee = getLandmark(frame, POSE_LANDMARKS.RIGHT_KNEE)!;
    const leftAnkle = getLandmark(frame, POSE_LANDMARKS.LEFT_ANKLE)!;
    const rightAnkle = getLandmark(frame, POSE_LANDMARKS.RIGHT_ANKLE)!;
    const leftShoulder = getLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER)!;
    const rightShoulder = getLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER)!;

    const leftKneeAngle = angleDeg(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = angleDeg(rightHip, rightKnee, rightAnkle);
    const leftWeight = landmarkScore(leftHip) + landmarkScore(leftKnee) + landmarkScore(leftAnkle);
    const rightWeight = landmarkScore(rightHip) + landmarkScore(rightKnee) + landmarkScore(rightAnkle);
    const kneeAngle = weightedAverage(leftKneeAngle, rightKneeAngle, leftWeight, rightWeight);

    const worldLeftHip = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);
    const worldRightHip = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_HIP);
    const worldLeftShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
    const worldRightShoulder = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER);
    const worldLeftHeel = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HEEL);
    const worldRightHeel = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_HEEL);
    const worldLeftAnkle = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_ANKLE);
    const worldRightAnkle = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_ANKLE);
    const worldLeftKnee = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_KNEE);
    const worldRightKnee = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_KNEE);

    const hipMid = worldLeftHip && worldRightHip ? midpoint(worldLeftHip, worldRightHip) : midpoint(leftHip, rightHip);
    const shoulderMid =
      worldLeftShoulder && worldRightShoulder ? midpoint(worldLeftShoulder, worldRightShoulder) : midpoint(leftShoulder, rightShoulder);
    const torsoLean = verticalLeanDeg(shoulderMid, hipMid);
    const kneeRatio = kneeOutRatio(leftKnee, rightKnee, leftAnkle, rightAnkle);

    const leftHeelLift = worldLeftHeel && worldLeftAnkle && worldLeftKnee
      ? heelLiftRatio(worldLeftHeel, worldLeftAnkle, worldLeftKnee)
      : 0;
    const rightHeelLift = worldRightHeel && worldRightAnkle && worldRightKnee
      ? heelLiftRatio(worldRightHeel, worldRightAnkle, worldRightKnee)
      : 0;
    const maxHeelLift = Math.max(leftHeelLift, rightHeelLift);

    const next = this.counter.update(kneeAngle, true, frame.timestampMs);
    const tempoResult = this.tempo.update(next.phase, frame.timestampMs);

    // RepScorer: start a new rep when phase transitions into DESCENDING.
    const enteringDescending = this.prevPhase !== 'DESCENDING' && next.phase === 'DESCENDING';
    if (enteringDescending) {
      this.repScorer.startRep(frame.timestampMs);
    }

    const issues: FormIssue[] = [];
    if (next.phase === 'BOTTOM' && kneeAngle > this.config.form.targetDepthAngle) {
      issues.push({ id: 'squat_depth', severity: 'error', message: 'Go lower' });
    }
    if (torsoLean > this.config.form.maxTorsoLeanDeg) {
      issues.push({ id: 'squat_torso_lean', severity: 'warning', message: 'Chest up' });
    }
    if (kneeRatio < this.config.form.minKneeOutRatio) {
      issues.push({ id: 'squat_knee_cave', severity: 'warning', message: 'Push knees out' });
    }
    if (maxHeelLift > this.config.form.maxHeelLiftRatio) {
      issues.push({ id: 'squat_heel_lift', severity: 'warning', message: 'Heels down' });
    }
    if (tempoResult?.tooFast) {
      issues.push({ id: 'squat_tempo', severity: 'warning', message: 'Slow down and stay controlled' });
    }

    // Record every frame once a rep is in progress (startRep was called).
    this.repScorer.recordFrame(kneeAngle, leftKneeAngle, rightKneeAngle, issues, next.phase, frame.timestampMs);

    const hadIssues = issues.some(i => i.severity === 'error' || i.severity === 'warning');

    if (next.repJustCounted) {
      const score = this.repScorer.completeRep(frame.timestampMs);
      if (score) this.repScoresAcc.push(score);
      this.prioritizer.onRepCompleted(hadIssues);
    }

    const topCues = this.prioritizer.getTopCues(issues);

    if (!issues.length) {
      issues.push({ id: 'squat_status', severity: 'info', message: next.repJustCounted ? 'Rep counted. Keep going.' : 'Good form. Stay controlled.' });
    }

    const primaryCue = topCues[0]?.text ?? (next.repJustCounted ? 'Rep counted. Keep going.' : 'Good form. Stay controlled.');
    const secondaryCue = topCues[1]?.text;

    this.prevPhase = next.phase;

    return {
      state: { phase: next.phase, repCount: next.repCount, lastRepTimestampMs: next.lastRepTimestampMs },
      calibration,
      primaryCue,
      secondaryCue,
      issues,
      metrics: {
        kneeAngle,
        smoothedKneeAngle: next.smoothedAngle,
        torsoLeanDeg: torsoLean,
        kneeOutRatio: kneeRatio,
        heelLift: maxHeelLift,
        descentMs: tempoResult?.descentMs ?? 0,
        ascentMs: tempoResult?.ascentMs ?? 0
      },
      leftAngle: leftKneeAngle,
      rightAngle: rightKneeAngle,
      isUnilateral: false,
      leftRepCount: 0,
      rightRepCount: 0,
      topCues,
      repScores: this.repScoresAcc,
    };
  }
}
