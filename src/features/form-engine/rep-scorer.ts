import type { FormIssue } from '@/features/form-engine/form-engine';
import type { ExerciseConfig } from '@/features/form-engine/exercise-config';
import type { RepScore } from '@/features/form-engine/scoring-types';

export type { RepScore };

interface RepData {
  repNumber: number;
  minAngle: number;
  maxSymmetryDiff: number;
  formIssuesPerFrame: FormIssue[][];
  descentMs: number;
  completedAt: number;
}

export class RepScorer {
  private currentRepData: RepData | null = null;
  private repNumber = 0;
  private _descentStart = 0;

  constructor(private config: ExerciseConfig) {}

  startRep(timestampMs: number): void {
    this.repNumber++;
    this.currentRepData = {
      repNumber: this.repNumber,
      minAngle: Infinity,
      maxSymmetryDiff: 0,
      formIssuesPerFrame: [],
      descentMs: 0,
      completedAt: 0,
    };
    this._descentStart = timestampMs;
  }

  recordFrame(
    primaryAngle: number,
    leftAngle: number,
    rightAngle: number,
    formIssues: FormIssue[],
    phase: string,
    timestampMs: number
  ): void {
    if (!this.currentRepData) return;
    this.currentRepData.minAngle = Math.min(this.currentRepData.minAngle, primaryAngle);
    const diff = Math.abs(leftAngle - rightAngle);
    this.currentRepData.maxSymmetryDiff = Math.max(this.currentRepData.maxSymmetryDiff, diff);
    this.currentRepData.formIssuesPerFrame.push(formIssues);
    // Record descent duration on the first BOTTOM frame (time from startRep to reaching bottom).
    if (phase === 'BOTTOM' && this.currentRepData.descentMs === 0) {
      this.currentRepData.descentMs = timestampMs - this._descentStart;
    }
  }

  completeRep(timestampMs: number): RepScore | null {
    if (!this.currentRepData) return null;
    const data = { ...this.currentRepData, completedAt: timestampMs };
    this.currentRepData = null;
    return this._scoreRep(data);
  }

  private _scoreRep(data: RepData): RepScore {
    const { reversedDirection, downAngle, upAngle } = this.config.repThresholds;

    // Depth: measures how close to the required extreme the rep reached.
    // For normal exercises (squat, push-up): need minAngle ≤ downAngle.
    // For reversed exercises (bicep curl, pull-up): need minAngle ≤ upAngle.
    const depthTarget = reversedDirection ? upAngle : downAngle;
    const shortfall = Math.max(0, data.minAngle - depthTarget);
    const depth = Math.max(0, Math.min(100, 100 - shortfall * 2));

    // Symmetry: penalize left/right angle imbalance.
    const symmetry = Math.max(0, Math.min(100, 100 - data.maxSymmetryDiff * 3));

    // Form: penalize error and warning frames.
    const allIssues = data.formIssuesPerFrame.flat();
    const errorCount = allIssues.filter(i => i.severity === 'error').length;
    const warningCount = allIssues.filter(i => i.severity === 'warning').length;
    const form = Math.max(0, Math.min(100, 100 - errorCount * 15 - warningCount * 5));

    // Tempo: descentMs === 0 means no timing measurement available → neutral score.
    const d = data.descentMs;
    let tempo: number;
    if (d === 0) {
      tempo = 100;
    } else if (d >= 1000 && d <= 3500) {
      tempo = 100;
    } else if (d < 1000) {
      tempo = Math.min(100, d / 10);
    } else {
      tempo = Math.max(0, 100 - (d - 3500) / 50);
    }

    const overall = depth * 0.30 + symmetry * 0.25 + form * 0.35 + tempo * 0.10;
    const issueIds = [...new Set(allIssues.map(i => i.id))];

    return {
      repNumber: data.repNumber,
      overall: Math.round(overall),
      depth: Math.round(depth),
      symmetry: Math.round(symmetry),
      form: Math.round(form),
      tempo: Math.round(tempo),
      issueIds,
      timestampMs: data.completedAt,
    };
  }

  reset(): void {
    this.currentRepData = null;
    this.repNumber = 0;
    this._descentStart = 0;
  }
}
