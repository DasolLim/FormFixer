import type { ExerciseFormEngine, EngineOutput, CalibrationStatus, FeedbackCue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame, PoseLandmark } from '@/features/pose/pose-types';
import { getExerciseConfig, type ExerciseConfig } from '@/features/form-engine/exercise-config';
import { RepCounterStateMachine } from '@/features/form-engine/rep-counter-state-machine';
import { RepScorer } from '@/features/form-engine/rep-scorer';
import { AngleSmoother } from '@/lib/pose/math';
import { angleDeg } from '@/features/form-engine/rules/angle';
import type { RepScore } from '@/features/form-engine/scoring-types';

function safeAngleDeg(a: PoseLandmark | null, b: PoseLandmark | null, c: PoseLandmark | null): number {
  if (!a || !b || !c) return 180;
  return angleDeg(a, b, c);
}

export class GenericExerciseEngine implements ExerciseFormEngine {
  readonly id: string;
  private config: ExerciseConfig;
  private stateMachine: RepCounterStateMachine;
  private leftSmoother: AngleSmoother;
  private rightSmoother: AngleSmoother;
  private repScorer: RepScorer;
  private repScoresAcc: RepScore[] = [];
  protected prevRepCount = 0;
  private repActive = false;
  private symmetryDriftFrames = 0;

  constructor(exerciseId: string) {
    this.id = exerciseId;
    this.config = getExerciseConfig(exerciseId);
    this.stateMachine = new RepCounterStateMachine(this.config);
    this.leftSmoother = new AngleSmoother();
    this.rightSmoother = new AngleSmoother();
    this.repScorer = new RepScorer(this.config);
  }

  reset(): void {
    this.stateMachine.reset();
    this.leftSmoother.reset();
    this.rightSmoother.reset();
    this.repScorer.reset();
    this.repScoresAcc = [];
    this.prevRepCount = 0;
    this.repActive = false;
    this.symmetryDriftFrames = 0;
  }

  update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const wl = frame.worldLandmarks;
    const [lA, lB, lC] = this.config.landmarks.left;
    const [rA, rB, rC] = this.config.landmarks.right;

    const rawLeftAngle = safeAngleDeg(wl[lA], wl[lB], wl[lC]);
    const rawRightAngle = safeAngleDeg(wl[rA], wl[rB], wl[rC]);

    const leftAngle = this.leftSmoother.update(rawLeftAngle);
    const rightAngle = this.rightSmoother.update(rawRightAngle);
    const primaryAngle = (leftAngle + rightAngle) / 2;

    const sm = this.stateMachine.update(leftAngle, rightAngle, frame.timestampMs);

    // Rep scoring: always keep a rep active so every frame is recorded.
    if (!this.repActive) {
      this.repScorer.startRep(frame.timestampMs);
      this.repActive = true;
    }

    // Derive a rough phase for descent timing: 'BOTTOM' when angle reaches the target zone.
    const { reversedDirection, downAngle } = this.config.repThresholds;
    const atBottom = reversedDirection ? primaryAngle >= downAngle : primaryAngle <= downAngle;
    this.repScorer.recordFrame(primaryAngle, leftAngle, rightAngle, [], atBottom ? 'BOTTOM' : 'DESCENDING', frame.timestampMs);

    if (sm.repCount > this.prevRepCount) {
      const score = this.repScorer.completeRep(frame.timestampMs);
      if (score) this.repScoresAcc.push(score);
      this.prevRepCount = sm.repCount;
      this.repActive = false; // will be restarted next frame
    }

    // Symmetry drift detection
    const symmetryDrift = Math.abs(leftAngle - rightAngle)
    if (symmetryDrift > 12) {
      this.symmetryDriftFrames++
    } else {
      this.symmetryDriftFrames = 0
    }

    const topCues: FeedbackCue[] = []
    if (this.symmetryDriftFrames >= 3 && !this.config.isUnilateral) {
      topCues.push({
        text: 'Keep both sides even',
        voiceText: 'Keep both sides even — watch your symmetry',
        severity: 'warning',
      })
    }

    const primaryCue = calibration.ready
      ? (sm.repCount > 0 ? `Reps: ${sm.repCount}` : 'Ready')
      : calibration.message;

    return {
      state: { phase: 'READY', repCount: sm.repCount, lastRepTimestampMs: 0 },
      calibration,
      primaryCue,
      issues: [],
      metrics: { primaryAngle, leftAngle, rightAngle },
      leftAngle,
      rightAngle,
      isUnilateral: this.config.isUnilateral,
      leftRepCount: sm.leftRepCount,
      rightRepCount: sm.rightRepCount,
      primaryAngle,
      repCount: sm.repCount,
      phase: sm.stage,
      formIssues: [],
      topCues,
      calibrationStatus: calibration,
      confidence: frame.hasPose ? 1 : 0,
      repScores: this.repScoresAcc,
    };
  }
}
