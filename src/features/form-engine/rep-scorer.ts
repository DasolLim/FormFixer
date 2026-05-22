import type { FormIssue } from '@/features/form-engine/form-engine';
import type { ExerciseConfig } from '@/features/form-engine/exercise-config';
import type { RepScore, SessionSummary } from '@/features/form-engine/scoring-types';

export type { RepScore, SessionSummary };

interface RepData {
  repNumber: number;
  minAngle: number;
  maxSymmetryDiff: number;
  errorFrames: number;
  warningFrames: number;
  totalFrames: number;
  issueIds: Set<string>;
  descentMs: number;
  ascentStartMs: number;
  completedAt: number;
}

function scoreDepth(shortfall: number): number {
  if (shortfall === 0)  return 100;
  if (shortfall <= 5)   return 97;
  if (shortfall <= 10)  return 90;
  if (shortfall <= 20)  return 75;
  if (shortfall <= 35)  return 55;
  return Math.max(0, 55 - (shortfall - 35) * 1.5);
}

function scoreForm(errorFrames: number, warningFrames: number, totalFrames: number): number {
  if (totalFrames === 0) return 100;
  const errorRatio   = errorFrames   / totalFrames;
  const warningRatio = warningFrames / totalFrames;
  const deduction = (errorRatio * 60) + (warningRatio * 25);
  return Math.max(0, Math.round(100 - deduction));
}

function getGrade(score: number): { grade: string; label: string } {
  if (score >= 95) return { grade: 'A+', label: 'Perfect' };
  if (score >= 88) return { grade: 'A',  label: 'Excellent' };
  if (score >= 80) return { grade: 'B+', label: 'Great' };
  if (score >= 72) return { grade: 'B',  label: 'Good' };
  if (score >= 62) return { grade: 'C+', label: 'Fair' };
  if (score >= 50) return { grade: 'C',  label: 'Needs work' };
  return             { grade: 'D',  label: 'Significant issues' };
}

const IMPROVEMENT_TIPS: Record<string, string> = {
  depth:    'Focus on hitting full range of motion — go a little deeper each rep.',
  symmetry: 'Your left and right sides are uneven. Slow down and feel both sides working equally.',
  form:     'Prioritize quality over speed — reduce weight if needed to maintain good technique.',
  tempo:    'Control the eccentric (lowering) phase — aim for 2-3 seconds on the way down.',
};

export class RepScorer {
  private currentRepData: RepData | null = null;
  private repNumber = 0;
  private _descentStart = 0;
  private lastFrameErrorCount = 0;
  private lastFrameWarningCount = 0;
  private prevPhase = '';
  private completedScores: RepScore[] = [];

  constructor(private config: ExerciseConfig) {}

  startRep(timestampMs: number): void {
    this.repNumber++;
    this.currentRepData = {
      repNumber: this.repNumber,
      minAngle: Infinity,
      maxSymmetryDiff: 0,
      errorFrames: 0,
      warningFrames: 0,
      totalFrames: 0,
      issueIds: new Set(),
      descentMs: 0,
      ascentStartMs: 0,
      completedAt: 0,
    };
    this._descentStart = timestampMs;
    this.lastFrameErrorCount = 0;
    this.lastFrameWarningCount = 0;
    this.prevPhase = '';
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
    this.currentRepData.totalFrames++;
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

    if (this.prevPhase === 'BOTTOM' && phase !== 'BOTTOM' && this.currentRepData.ascentStartMs === 0) {
      this.currentRepData.ascentStartMs = timestampMs;
    }
    this.prevPhase = phase;
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
    this.prevPhase = '';
    const score = this._scoreRep(data);
    this.completedScores.push(score);
    return score;
  }

  private _scoreRep(data: RepData): RepScore {
    const { reversedDirection, downAngle, upAngle } = this.config.repThresholds;

    const depthTarget = reversedDirection ? upAngle : downAngle;
    const shortfall = Math.max(0, data.minAngle - depthTarget);
    const depth = scoreDepth(shortfall);

    // Side-facing exercises: one side is occluded → angle defaults to 180° → diff is
    // meaningless. Unilateral: sides are intentionally different. Skip symmetry for both.
    let symmetry: number;
    if (this.config.isUnilateral || this.config.cameraAngle === 'side') {
      symmetry = 100;
    } else {
      symmetry = Math.max(0, Math.min(100, 100 - data.maxSymmetryDiff * 2));
    }

    const form = scoreForm(data.errorFrames, data.warningFrames, data.totalFrames);

    // Tempo: perfect at 800ms–3500ms. Below 400ms = flash reps (penalise to 50-60).
    // 400–800ms ramps from 60→100 so natural controlled reps (~700ms) score ~90.
    const d = data.descentMs;
    let tempo: number;
    if (d === 0) {
      tempo = 100;
    } else if (d >= 800 && d <= 3500) {
      tempo = 100;
    } else if (d < 400) {
      tempo = Math.max(0, (d / 400) * 60);
    } else if (d < 800) {
      tempo = 60 + ((d - 400) / 400) * 40;
    } else {
      tempo = Math.max(0, 100 - (d - 3500) / 50);
    }

    const ascentMs = data.ascentStartMs > 0 ? data.completedAt - data.ascentStartMs : 0;
    let ascent: number;
    if (ascentMs === 0) {
      ascent = 100;
    } else if (ascentMs <= 500) {
      ascent = 85;
    } else if (ascentMs <= 2000) {
      ascent = 100;
    } else {
      ascent = Math.max(0, 100 - (ascentMs - 2000) / 30);
    }

    const overall = depth * 0.28 + symmetry * 0.22 + form * 0.32 + tempo * 0.10 + ascent * 0.08;
    const overallRounded = Math.round(overall);
    const { grade, label } = getGrade(overallRounded);

    return {
      repNumber: data.repNumber,
      overall: overallRounded,
      depth: Math.round(depth),
      symmetry: Math.round(symmetry),
      form: Math.round(form),
      tempo: Math.round(tempo),
      ascent: Math.round(ascent),
      ascentMs,
      grade,
      label,
      issueIds: [...data.issueIds],
      timestampMs: data.completedAt,
    };
  }

  getSessionSummary(): SessionSummary {
    const scores = this.completedScores;
    const n = scores.length;
    if (n === 0) {
      return {
        totalReps: 0,
        averageOverall: 0,
        averageDepth: 0,
        averageForm: 0,
        averageSymmetry: 0,
        averageTempo: 0,
        fatigueDetected: false,
        trendDirection: 'stable',
        topIssueIds: [],
        improvementTip: IMPROVEMENT_TIPS.form,
      };
    }

    const avg = (key: keyof RepScore) =>
      Math.round(scores.reduce((s, r) => s + (r[key] as number), 0) / n);

    const averageOverall   = avg('overall');
    const averageDepth     = avg('depth');
    const averageForm      = avg('form');
    const averageSymmetry  = avg('symmetry');
    const averageTempo     = avg('tempo');

    let fatigueDetected = false;
    if (n >= 6) {
      const first3 = scores.slice(0, 3).reduce((s, r) => s + r.overall, 0) / 3;
      const last3  = scores.slice(-3).reduce((s, r) => s + r.overall, 0) / 3;
      fatigueDetected = last3 < first3 - 12;
    }

    let trendDirection: SessionSummary['trendDirection'] = 'stable';
    if (n >= 2) {
      const half = Math.floor(n / 2);
      const firstHalf = scores.slice(0, half).reduce((s, r) => s + r.overall, 0) / half;
      const secondHalf = scores.slice(half).reduce((s, r) => s + r.overall, 0) / (n - half);
      const diff = secondHalf - firstHalf;
      if (diff > 3) trendDirection = 'improving';
      else if (diff < -3) trendDirection = 'declining';
    }

    const issueCounts = new Map<string, number>();
    scores.forEach(r => r.issueIds.forEach(id => issueCounts.set(id, (issueCounts.get(id) ?? 0) + 1)));
    const topIssueIds = [...issueCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    const dims = { depth: averageDepth, symmetry: averageSymmetry, form: averageForm, tempo: averageTempo };
    const worstDim = (Object.entries(dims) as [string, number][])
      .reduce((a, b) => b[1] < a[1] ? b : a)[0];
    const improvementTip = IMPROVEMENT_TIPS[worstDim] ?? IMPROVEMENT_TIPS.form;

    return {
      totalReps: n,
      averageOverall,
      averageDepth,
      averageForm,
      averageSymmetry,
      averageTempo,
      fatigueDetected,
      trendDirection,
      topIssueIds,
      improvementTip,
    };
  }

  reset(): void {
    this.currentRepData = null;
    this.repNumber = 0;
    this._descentStart = 0;
    this.lastFrameErrorCount = 0;
    this.lastFrameWarningCount = 0;
    this.prevPhase = '';
    this.completedScores = [];
  }
}
