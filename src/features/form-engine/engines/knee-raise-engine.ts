import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';

const CUE_DEFS: CueDef[] = [
  { id: 'kneeraise_symmetry', severity: 'warning', text: 'Raise both knees evenly', voiceText: 'Even knees', cooldownReps: 3 },
];

// KneeRaiseEngine adds symmetry check on top of GenericExerciseEngine.
// GenericExerciseEngine handles unilateral rep counting (isUnilateral=true in exercises.json).
export class KneeRaiseEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);

  constructor() { super('knee_raise'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      // Symmetry: left vs right knee angle difference at peak
      if (Math.abs(base.leftAngle - base.rightAngle) > 20) {
        formIssues.push({ id: 'kneeraise_symmetry', severity: 'warning', message: 'Raise both knees evenly' });
      }
    }

    if ((base.repCount ?? 0) > repBefore) {
      this.prioritizer.onRepCompleted(formIssues.some(i => i.severity === 'error' || i.severity === 'warning'));
    }

    const topCues = this.prioritizer.getTopCues(formIssues);
    const primaryCue = calibration.ready ? (topCues[0]?.text ?? base.primaryCue) : calibration.message;
    return { ...base, formIssues, topCues, primaryCue };
  }
}
