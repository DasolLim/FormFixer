import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';

const CUE_DEFS: CueDef[] = [
  { id: 'idbp_wrist_alignment', severity: 'error',   text: 'Stack your wrists over your elbows',   voiceText: 'Wrists over elbows', cooldownReps: 1 },
  { id: 'idbp_symmetry',        severity: 'error',   text: 'Press both arms evenly',                voiceText: 'Both arms equal',    cooldownReps: 1 },
  { id: 'idbp_elbow_flare',     severity: 'warning', text: 'Tuck your elbows — about 60 degrees',  voiceText: 'Tuck elbows',        cooldownReps: 2 },
  { id: 'idbp_lockout',         severity: 'warning', text: 'Fully extend at the top',               voiceText: 'Full lockout',       cooldownReps: 2 },
  { id: 'idbp_half_rep',        severity: 'warning', text: 'Go deeper — elbows below chest level',  voiceText: 'Go deeper',          cooldownReps: 1 },
];

export class InclineDbPressEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private minAngleThisRep = 180;

  constructor() { super('incline_db_press'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
    this.minAngleThisRep = 180;
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const primaryAngle = base.primaryAngle ?? 180;
      this.minAngleThisRep = Math.min(this.minAngleThisRep, primaryAngle);

      const lShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const lElbow    = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_ELBOW);
      const lWrist    = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_WRIST, 0.72);
      const rShoulder = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER);
      const rElbow    = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_ELBOW);
      const rWrist    = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_WRIST, 0.72);

      // Wrist alignment: wrist should be above elbow (x-axis alignment)
      if (lWrist && lElbow && Math.abs(lWrist.x - lElbow.x) > 0.08) {
        formIssues.push({ id: 'idbp_wrist_alignment', severity: 'error', message: 'Stack wrists over elbows' });
      } else if (rWrist && rElbow && Math.abs(rWrist.x - rElbow.x) > 0.08) {
        formIssues.push({ id: 'idbp_wrist_alignment', severity: 'error', message: 'Stack wrists over elbows' });
      }

      // Elbow flare at DOWN phase
      if (base.phase === 'DOWN') {
        if (lElbow && lShoulder && Math.abs(lElbow.x - lShoulder.x) > 0.18) {
          formIssues.push({ id: 'idbp_elbow_flare', severity: 'warning', message: 'Tuck elbows — about 60 degrees' });
        } else if (rElbow && rShoulder && Math.abs(rElbow.x - rShoulder.x) > 0.18) {
          formIssues.push({ id: 'idbp_elbow_flare', severity: 'warning', message: 'Tuck elbows — about 60 degrees' });
        }
      }

      // Symmetry: both arms moving evenly
      if (Math.abs(base.leftAngle - base.rightAngle) > 18) {
        formIssues.push({ id: 'idbp_symmetry', severity: 'error', message: 'Press both arms evenly' });
      }

      // Lockout at UP phase
      if (base.phase === 'UP' && primaryAngle < 150) {
        formIssues.push({ id: 'idbp_lockout', severity: 'warning', message: 'Fully extend at the top' });
      }
    }

    if ((base.repCount ?? 0) > repBefore) {
      if (this.minAngleThisRep > 85) {
        formIssues.push({ id: 'idbp_half_rep', severity: 'warning', message: 'Go deeper — elbows below chest level' });
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
