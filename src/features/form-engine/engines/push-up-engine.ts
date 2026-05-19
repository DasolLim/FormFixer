import type { ExerciseFormEngine, EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame, PoseLandmark } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { getExerciseConfig } from '@/features/form-engine/exercise-config';
import { RepCounterStateMachine } from '@/features/form-engine/rep-counter-state-machine';
import { RepScorer } from '@/features/form-engine/rep-scorer';
import { AngleSmoother } from '@/lib/pose/math';
import { angleDeg, midpoint, wristAlignmentDeg } from '@/features/form-engine/rules/angle';
import { angleDifference } from '@/features/form-engine/rules/symmetry';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import type { RepScore } from '@/features/form-engine/scoring-types';

function safeAngleDeg(a: PoseLandmark | null, b: PoseLandmark | null, c: PoseLandmark | null): number {
  if (!a || !b || !c) return 180;
  return angleDeg(a, b, c);
}

const PUSH_UP_CUE_DEFS: CueDef[] = [
  { id: 'push_up_depth',    severity: 'error',   text: 'Go lower — chest toward the ground', voiceText: 'Go lower',           cooldownReps: 1 },
  { id: 'body_alignment',   severity: 'warning',  text: 'Keep your body in a straight line',  voiceText: 'Straight body',      cooldownReps: 3 },
  { id: 'arm_symmetry',     severity: 'warning',  text: 'Steady your arms evenly',            voiceText: 'Even arms',          cooldownReps: 3 },
  { id: 'wrist_placement',  severity: 'warning',  text: 'Hands under your shoulders',         voiceText: 'Hands under shoulders', cooldownReps: 4 },
  { id: 'push_up_speed',    severity: 'warning',  text: 'Slow down, stay controlled',         voiceText: 'Slow down',          cooldownReps: 2 },
];

export class PushUpEngine implements ExerciseFormEngine {
  readonly id = 'push_up';
  private config = getExerciseConfig('push_up');
  private stateMachine = new RepCounterStateMachine(this.config);
  private leftSmoother = new AngleSmoother();
  private rightSmoother = new AngleSmoother();
  private prioritizer = new FeedbackPrioritizer(PUSH_UP_CUE_DEFS);
  private repScorer = new RepScorer(getExerciseConfig('push_up'));
  private repScoresAcc: RepScore[] = [];
  private prevRepCount = 0;
  private lastRepMs = 0;
  private repActive = false;

  reset(): void {
    this.stateMachine.reset();
    this.leftSmoother.reset();
    this.rightSmoother.reset();
    this.prioritizer.reset();
    this.repScorer.reset();
    this.repScoresAcc = [];
    this.prevRepCount = 0;
    this.lastRepMs = 0;
    this.repActive = false;
  }

  update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const wl = frame.worldLandmarks;
    const [lA, lB, lC] = this.config.landmarks.left;   // left shoulder, elbow, wrist
    const [rA, rB, rC] = this.config.landmarks.right;  // right shoulder, elbow, wrist

    const rawLeft = safeAngleDeg(wl[lA], wl[lB], wl[lC]);
    const rawRight = safeAngleDeg(wl[rA], wl[rB], wl[rC]);
    const leftAngle = this.leftSmoother.update(rawLeft);
    const rightAngle = this.rightSmoother.update(rawRight);
    const primaryAngle = (leftAngle + rightAngle) / 2;

    const sm = this.stateMachine.update(leftAngle, rightAngle, frame.timestampMs);

    // Rep scoring: keep a rep active at all times, restart after each completion.
    if (!this.repActive) {
      this.repScorer.startRep(frame.timestampMs);
      this.repActive = true;
    }
    const atBottom = primaryAngle <= this.config.repThresholds.downAngle;
    this.repScorer.recordFrame(primaryAngle, leftAngle, rightAngle, [], atBottom ? 'BOTTOM' : 'DESCENDING', frame.timestampMs);

    const issues: FormIssue[] = [];

    if (calibration.ready) {
      // 1. Depth: at bottom position, angle should reach < 100°
      if (primaryAngle < 130 && primaryAngle > 105) {
        issues.push({ id: 'push_up_depth', severity: 'error', message: 'Go lower', affectedLandmarks: [lB, rB] });
      }

      // 2. Body alignment: shoulder–hip–ankle should be ~180° (plank)
      const wLeftShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const wLeftHip = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);
      const wLeftAnkle = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_ANKLE);
      const wRightShoulder = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER);
      const wRightHip = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_HIP);
      const wRightAnkle = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_ANKLE);

      if (wLeftShoulder && wLeftHip && wLeftAnkle && wRightShoulder && wRightHip && wRightAnkle) {
        const shoulderMid = midpoint(wLeftShoulder, wRightShoulder);
        const hipMid = midpoint(wLeftHip, wRightHip);
        const ankleMid = midpoint(wLeftAnkle, wRightAnkle);
        const bodyAngle = angleDeg(shoulderMid, hipMid, ankleMid);
        if (bodyAngle < 160) {
          issues.push({ id: 'body_alignment', severity: 'warning', message: 'Keep body straight', affectedLandmarks: [23, 24] });
        }
      }

      // 3. Arm symmetry: left and right elbow angles should match
      if (angleDifference(leftAngle, rightAngle) > 20) {
        issues.push({ id: 'arm_symmetry', severity: 'warning', message: 'Steady your arms evenly', affectedLandmarks: [lB, rB] });
      }

      // 4. Wrist placement: wrists should be under shoulders (world space)
      const wLeftWrist = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_WRIST);
      if (wLeftShoulder && wLeftWrist) {
        const alignDeg = wristAlignmentDeg(wLeftWrist, wLeftShoulder);
        if (alignDeg > 30) {
          issues.push({ id: 'wrist_placement', severity: 'warning', message: 'Hands under shoulders', affectedLandmarks: [lA, lC] });
        }
      }

      // 5. Speed: rep completed in less than 800ms is too fast
      if (sm.repCount > this.prevRepCount) {
        const repDuration = frame.timestampMs - this.lastRepMs;
        if (this.lastRepMs > 0 && repDuration < 800) {
          issues.push({ id: 'push_up_speed', severity: 'warning', message: 'Slow down, stay controlled' });
        }
        this.lastRepMs = frame.timestampMs;

        const score = this.repScorer.completeRep(frame.timestampMs);
        if (score) this.repScoresAcc.push(score);
        this.repActive = false;

        const hadIssues = issues.some(i => i.severity === 'error' || i.severity === 'warning');
        this.prioritizer.onRepCompleted(hadIssues);
        this.prevRepCount = sm.repCount;
      }
    }

    const topCues = this.prioritizer.getTopCues(issues);
    const primaryCue = calibration.ready
      ? (topCues[0]?.text ?? (sm.repCount > 0 ? `Rep ${sm.repCount} complete` : 'Ready'))
      : calibration.message;

    return {
      state: { phase: 'READY', repCount: sm.repCount, lastRepTimestampMs: 0 },
      calibration,
      primaryCue,
      secondaryCue: topCues[1]?.text,
      issues,
      metrics: { primaryAngle, leftAngle, rightAngle },
      leftAngle,
      rightAngle,
      isUnilateral: false,
      leftRepCount: 0,
      rightRepCount: 0,
      primaryAngle,
      repCount: sm.repCount,
      phase: sm.stage,
      formIssues: issues,
      topCues,
      calibrationStatus: calibration,
      confidence: frame.hasPose ? 1 : 0,
      repScores: this.repScoresAcc,
    };
  }
}
