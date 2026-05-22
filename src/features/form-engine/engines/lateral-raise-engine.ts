import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';

const CUE_DEFS: CueDef[] = [
  { id: 'raise_elbow_height', severity: 'warning', text: 'Raise your elbows to shoulder height', voiceText: 'Elbows higher', cooldownReps: 2 },
  { id: 'raise_elbow_leads',  severity: 'warning', text: 'Lead with your elbows, not your wrists', voiceText: 'Elbows lead', cooldownReps: 2 },
  { id: 'raise_body_sway',    severity: 'warning', text: 'Keep your body still',                 voiceText: 'Stay still',    cooldownReps: 3 },
  { id: 'raise_imbalance',    severity: 'warning', text: 'Raise both arms evenly',               voiceText: 'Even arms',     cooldownReps: 3 },
];

export class LateralRaiseEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private anchorHipX = 0;
  private anchorSet = false;
  private peakLeftAngle = 180;
  private peakRightAngle = 180;

  constructor() { super('lateral_raise'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
    this.anchorSet = false;
    this.peakLeftAngle = 180;
    this.peakRightAngle = 180;
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const lShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const lElbow    = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_ELBOW);
      const rShoulder = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER);
      const rElbow    = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_ELBOW);
      const lHip      = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);

      // Anchor hip x on first calibrated frame
      if (!this.anchorSet && lHip) {
        this.anchorHipX = lHip.x;
        this.anchorSet = true;
      }

      // Track peak angles this rep (lateral_raise: smaller angle = arms down, larger = arms up)
      this.peakLeftAngle  = Math.min(this.peakLeftAngle,  base.leftAngle);
      this.peakRightAngle = Math.min(this.peakRightAngle, base.rightAngle);

      // 1. Elbow height: at peak (arms raised), elbow should be at shoulder height
      // lateral_raise downAngle=30 means arms raised (angle < 30); check elbow vs shoulder y
      const atPeak = (base.primaryAngle ?? 180) < 40;
      if (atPeak && lElbow && lShoulder) {
        // In world space y-up: elbow below shoulder = elbow.y < shoulder.y
        if (lShoulder.y - lElbow.y > 0.05) {
          formIssues.push({ id: 'raise_elbow_height', severity: 'warning', message: 'Raise elbows to shoulder height' });
        }
      }
      if (atPeak && rElbow && rShoulder) {
        if (rShoulder.y - rElbow.y > 0.05) {
          formIssues.push({ id: 'raise_elbow_height', severity: 'warning', message: 'Raise elbows to shoulder height' });
        }
      }

      // 1b. Elbow leads wrist: at peak, wrist should not be above elbow
      if (atPeak && lElbow) {
        const lWrist = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_WRIST);
        if (lWrist && lWrist.y > lElbow.y + 0.03) {
          formIssues.push({ id: 'raise_elbow_leads', severity: 'warning', message: 'Lead with your elbows, not your wrists' });
        }
      }

      // 2. Body sway: hip x-drift from anchor
      if (lHip && this.anchorSet && Math.abs(lHip.x - this.anchorHipX) > 0.08) {
        formIssues.push({ id: 'raise_body_sway', severity: 'warning', message: 'Keep body still' });
      }

      // 3. Imbalance: left vs right angle difference
      if (Math.abs(base.leftAngle - base.rightAngle) > 15) {
        formIssues.push({ id: 'raise_imbalance', severity: 'warning', message: 'Raise both arms evenly' });
      }
    }

    if ((base.repCount ?? 0) > repBefore) {
      this.peakLeftAngle = 180;
      this.peakRightAngle = 180;
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
