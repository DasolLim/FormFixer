import type { EngineOutput, CalibrationStatus, FormIssue, ExerciseFormEngine } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { AngleSmoother } from '@/lib/pose/math';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';
import { angleDeg, midpoint, verticalLeanDeg } from '@/features/form-engine/rules/angle';

const CUE_DEFS: CueDef[] = [
  { id: 'ws_too_high', severity: 'error',   text: 'Lower your hips to 90 degrees',        voiceText: 'Go lower',    cooldownReps: 0 },
  { id: 'ws_too_low',  severity: 'warning', text: "Rise slightly — you're below 90",       voiceText: 'Rise a bit',  cooldownReps: 0 },
  { id: 'ws_back',     severity: 'error',   text: 'Press your back flat against the wall', voiceText: 'Back flat',   cooldownReps: 0 },
  { id: 'ws_shin',     severity: 'warning', text: 'Adjust foot position',                  voiceText: 'Feet adjust', cooldownReps: 0 },
];

export class WallSitEngine implements ExerciseFormEngine {
  readonly id = 'wall_sit';
  private smoother = new AngleSmoother(4);
  private prioritizer = new FeedbackPrioritizer(CUE_DEFS);
  private totalHoldMs = 0;
  private cleanHoldMs = 0;
  private prevFrameMs = 0;

  reset(): void {
    this.smoother.reset();
    this.prioritizer.reset();
    this.totalHoldMs = 0;
    this.cleanHoldMs = 0;
    this.prevFrameMs = 0;
  }

  update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const formIssues: FormIssue[] = [];
    let kneeAngle = 90;
    let primaryCue = calibration.ready ? 'Hold position' : calibration.message;

    if (calibration.ready) {
      const side = calibration.orientation === 'right' ? 'right' : 'left';
      const hipIdx    = side === 'left' ? POSE_LANDMARKS.LEFT_HIP    : POSE_LANDMARKS.RIGHT_HIP;
      const kneeIdx   = side === 'left' ? POSE_LANDMARKS.LEFT_KNEE   : POSE_LANDMARKS.RIGHT_KNEE;
      const ankleIdx  = side === 'left' ? POSE_LANDMARKS.LEFT_ANKLE  : POSE_LANDMARKS.RIGHT_ANKLE;
      const shoulderIdx = side === 'left' ? POSE_LANDMARKS.LEFT_SHOULDER : POSE_LANDMARKS.RIGHT_SHOULDER;

      const hip    = getWorldLandmark(frame, hipIdx);
      const knee   = getWorldLandmark(frame, kneeIdx);
      const ankle  = getWorldLandmark(frame, ankleIdx);
      const shoulder = getWorldLandmark(frame, shoulderIdx);
      const lShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const rShoulder = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_SHOULDER);
      const lHip      = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);
      const rHip      = getWorldLandmark(frame, POSE_LANDMARKS.RIGHT_HIP);

      if (hip && knee && ankle) {
        const rawAngle = angleDeg(hip, knee, ankle);
        kneeAngle = this.smoother.update(rawAngle);

        if (kneeAngle > 100) {
          formIssues.push({ id: 'ws_too_high', severity: 'error', message: 'Lower your hips to 90 degrees' });
        } else if (kneeAngle < 80) {
          formIssues.push({ id: 'ws_too_low', severity: 'warning', message: "Rise slightly — you're below 90" });
        }

        // Shin angle: ankle vs knee depth
        if (ankle.z !== undefined && knee.z !== undefined && Math.abs(ankle.z - knee.z) > 0.06) {
          formIssues.push({ id: 'ws_shin', severity: 'warning', message: 'Adjust foot position' });
        }
      }

      // Back against wall: torso should be upright (low lean)
      if (lShoulder && rShoulder && lHip && rHip) {
        const shoulderMid = midpoint(lShoulder, rShoulder);
        const hipMid      = midpoint(lHip, rHip);
        if (verticalLeanDeg(shoulderMid, hipMid) > 12) {
          formIssues.push({ id: 'ws_back', severity: 'error', message: 'Press your back flat against the wall' });
        }
      }

      const hasErrors = formIssues.some(i => i.severity === 'error');
      const isHolding = kneeAngle >= 80 && kneeAngle <= 105 && !hasErrors;
      const elapsed   = this.prevFrameMs > 0 ? Math.min(frame.timestampMs - this.prevFrameMs, 100) : 0;

      if (isHolding) {
        this.totalHoldMs += elapsed;
        if (formIssues.length === 0) this.cleanHoldMs += elapsed;
      }

      const topCues = this.prioritizer.getTopCues(formIssues);
      if (topCues.length > 0) {
        primaryCue = topCues[0].text;
      } else if (isHolding) {
        primaryCue = `${Math.round(kneeAngle)}° — perfect depth`;
      } else if (kneeAngle > 100) {
        primaryCue = `${Math.round(kneeAngle)}° — go lower`;
      } else {
        primaryCue = `${Math.round(kneeAngle)}°`;
      }
    }

    this.prevFrameMs = frame.timestampMs;

    const topCues = this.prioritizer.getTopCues(formIssues);

    return {
      state: { phase: 'READY', repCount: 0, lastRepTimestampMs: 0 },
      calibration,
      primaryCue,
      issues: [],
      metrics: {
        holdDurationMs: this.totalHoldMs,
        cleanHoldMs: this.cleanHoldMs,
        kneeAngle,
      },
      leftAngle: kneeAngle,
      rightAngle: kneeAngle,
      isUnilateral: false,
      leftRepCount: 0,
      rightRepCount: 0,
      primaryAngle: kneeAngle,
      repCount: 0,
      phase: 'READY',
      formIssues,
      topCues,
      calibrationStatus: calibration,
      confidence: frame.hasPose ? 1 : 0,
      repScores: [],
    };
  }
}
