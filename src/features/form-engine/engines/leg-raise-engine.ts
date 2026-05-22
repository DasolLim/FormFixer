import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';

const CUE_DEFS: CueDef[] = [
  { id: 'legraise_lower_back', severity: 'warning', text: 'Keep your lower back flat',             voiceText: 'Back flat',    cooldownReps: 2 },
  { id: 'legraise_full_range', severity: 'warning', text: 'Raise your legs higher',               voiceText: 'Higher',       cooldownReps: 2 },
  { id: 'legraise_momentum',   severity: 'warning', text: 'Raise your legs slowly — no swinging', voiceText: 'Slow it down', cooldownReps: 2 },
];

// LegRaiseEngine adds lower-back and full-range checks on top of GenericExerciseEngine.
// GenericExerciseEngine already handles unilateral rep counting (isUnilateral=true in exercises.json).
export class LegRaiseEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private minAngleThisRep = 180;
  private prevPrimaryAngle = 180;
  private momentumFrames = 0;

  constructor() { super('leg_raise'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
    this.minAngleThisRep = 180;
    this.prevPrimaryAngle = 180;
    this.momentumFrames = 0;
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const primaryAngle = base.primaryAngle ?? 180;

      // Track minimum angle reached this rep (lower angle = legs more raised)
      this.minAngleThisRep = Math.min(this.minAngleThisRep, primaryAngle);

      // 1. Lower back: near the bottom of the lowering phase, hyperextension
      if (primaryAngle > 175) {
        formIssues.push({ id: 'legraise_lower_back', severity: 'warning', message: 'Keep lower back flat' });
      }

      // 2. Momentum: >12° change per frame while rising, for 3+ consecutive frames
      const rising = primaryAngle < this.prevPrimaryAngle;
      if (rising && Math.abs(primaryAngle - this.prevPrimaryAngle) > 12) {
        this.momentumFrames++;
      } else {
        this.momentumFrames = 0;
      }
      if (this.momentumFrames >= 3) {
        formIssues.push({ id: 'legraise_momentum', severity: 'warning', message: 'Raise your legs slowly — no swinging' });
      }
      this.prevPrimaryAngle = primaryAngle;
    }

    if ((base.repCount ?? 0) > repBefore) {
      if (this.minAngleThisRep > 70) {
        formIssues.push({ id: 'legraise_full_range', severity: 'warning', message: 'Raise legs higher' });
      }
      this.minAngleThisRep = 180;
      this.prioritizer.onRepCompleted(formIssues.some(i => i.severity === 'error' || i.severity === 'warning'));
    }

    if (calibration.ready && formIssues.length > 0) {
      this.scorer.patchLastFrameIssues(formIssues);
    }

    const topCues = this.prioritizer.getTopCues(formIssues);
    const primaryCue = calibration.ready ? (topCues[0]?.text ?? base.primaryCue) : calibration.message;
    return { ...base, formIssues, topCues, primaryCue };
  }
}
