import type { FormIssue } from '@/features/form-engine/form-engine';
import type { ExerciseConfig } from '@/features/form-engine/exercise-config';
import type { RepScore } from '@/features/form-engine/scoring-types';

export type { RepScore };

interface RepData {
  repNumber: number;
  minAngle: number;
  maxSymmetryDiff: number;
  errorFrames: number;
  warningFrames: number;
  issueIds: Set<string>;
  descentMs: number;
  completedAt: number;
}

export class RepScorer {
  private currentRepData: RepData | null = null;
  private repNumber = 0;
  private _descentStart = 0;
  private lastFrameErrorCount = 0;
  private lastFrameWarningCount = 0;

  constructor(private config: ExerciseConfig) {}

  startRep(timestampMs: number): void {
    this.repNumber++;
    this.currentRepData = {
      repNumber: this.repNumber,
      minAngle: Infinity,
      maxSymmetryDiff: 0,
      errorFrames: 0,
      warningFrames: 0,
      issueIds: new Set(),
      descentMs: 0,
      completedAt: 0,
    };
    this._descentStart = timestampMs;
    this.lastFrameErrorCount = 0;
    this.lastFrameWarningCount = 0;
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

    formIssues.forEach(i => this.currentRepData!.issueIds.add(i.id));
    const hasError = formIssues.some(i => i.severity === 'error');
    const hasWarning = !hasError && formIssues.some(i => i.severity === 'warning');
    if (hasError) {
      this.currentRepData.errorFrames++;
      this.lastFrameErrorCount = 1;
      this.lastFrameWarningCount = 0;
    } else if (hasWarning) {
      this.currentRepData.warningFrames++;
      this.lastFrameWarningCount = 1;
      this.lastFrameErrorCount = 0;
    } else {
      this.lastFrameErrorCount = 0;
      this.lastFrameWarningCount = 0;
    }

    if (phase === 'BOTTOM' && this.currentRepData.descentMs === 0) {
      this.currentRepData.descentMs = timestampMs - this._descentStart;
    }
  }

  patchLastFrameIssues(issues: FormIssue[]): void {
    if (!this.currentRepData) return;
    this.currentRepData.errorFrames -= this.lastFrameErrorCount;
    this.currentRepData.warningFrames -= this.lastFrameWarningCount;
    issues.forEach(i => this.currentRepData!.issueIds.add(i.id));
    const hasError = issues.some(i => i.severity === 'error');
    const hasWarning = issues.some(i => i.severity === 'warning');
    if (hasError) {
      this.currentRepData.errorFrames++;
      this.lastFrameErrorCount = 1;
      this.lastFrameWarningCount = 0;
    } else if (hasWarning) {
      this.currentRepData.warningFrames++;
      this.lastFrameWarningCount = 1;
      this.lastFrameErrorCount = 0;
    } else {
      this.lastFrameErrorCount = 0;
      this.lastFrameWarningCount = 0;
    }
  }

  completeRep(timestampMs: number): RepScore | null {
    if (!this.currentRepData) return null;
    const data = { ...this.currentRepData, completedAt: timestampMs };
    this.currentRepData = null;
    this.lastFrameErrorCount = 0;
    this.lastFrameWarningCount = 0;
    return this._scoreRep(data);
  }

  private _scoreRep(data: RepData): RepScore {
    const { reversedDirection, downAngle, upAngle } = this.config.repThresholds;

    const depthTarget = reversedDirection ? upAngle : downAngle;
    const shortfall = Math.max(0, data.minAngle - depthTarget);
    const depth = Math.max(0, Math.min(100, 100 - shortfall * 2));

    const symmetry = Math.max(0, Math.min(100, 100 - data.maxSymmetryDiff * 3));

    const form = Math.max(0, Math.min(100, 100 - data.errorFrames * 15 - data.warningFrames * 5));

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

    return {
      repNumber: data.repNumber,
      overall: Math.round(overall),
      depth: Math.round(depth),
      symmetry: Math.round(symmetry),
      form: Math.round(form),
      tempo: Math.round(tempo),
      issueIds: [...data.issueIds],
      timestampMs: data.completedAt,
    };
  }

  reset(): void {
    this.currentRepData = null;
    this.repNumber = 0;
    this._descentStart = 0;
    this.lastFrameErrorCount = 0;
    this.lastFrameWarningCount = 0;
  }
}
