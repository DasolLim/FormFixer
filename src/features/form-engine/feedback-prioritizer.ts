import type { FeedbackCue, FormIssue } from '@/features/form-engine/form-engine';

export interface CueDef {
  id: string;
  severity: 'error' | 'warning' | 'positive';
  text: string;
  voiceText: string;
  cooldownReps: number;
}

const ISSUE_SEVERITY_RANK: Record<FormIssue['severity'], number> = {
  error: 1,
  warning: 2,
  info: 3,
};

export class FeedbackPrioritizer {
  private readonly cueDefs: Map<string, CueDef>;
  private currentRep = 0;
  private consecutiveCleanReps = 0;
  private lastShownRep = new Map<string, number>();

  constructor(cueDefs: CueDef[]) {
    this.cueDefs = new Map(cueDefs.map(d => [d.id, d]));
    if (!this.cueDefs.has('symmetry_drift')) {
      this.cueDefs.set('symmetry_drift', {
        id: 'symmetry_drift',
        severity: 'warning',
        text: 'Keep both sides even',
        voiceText: 'Keep both sides even — watch your symmetry',
        cooldownReps: 4,
      });
    }
  }

  // Call once per completed rep. hadIssues = true if any form errors/warnings fired that rep.
  onRepCompleted(hadIssues: boolean): void {
    this.currentRep++;
    if (hadIssues) {
      this.consecutiveCleanReps = 0;
    } else {
      this.consecutiveCleanReps++;
    }
  }

  // Returns up to maxCount prioritized FeedbackCues, applying per-id rep-based cooldowns.
  // Fires positive reinforcement when 3+ consecutive clean reps occur.
  getTopCues(issues: FormIssue[], maxCount = 2): FeedbackCue[] {
    const available = issues.filter(issue => {
      const def = this.cueDefs.get(issue.id);
      const cooldown = def?.cooldownReps ?? 3;
      const lastShown = this.lastShownRep.get(issue.id) ?? -Infinity;
      return this.currentRep - lastShown >= cooldown;
    });

    available.sort((a, b) => ISSUE_SEVERITY_RANK[a.severity] - ISSUE_SEVERITY_RANK[b.severity]);
    const topIssues = available.slice(0, maxCount);

    topIssues.forEach(issue => this.lastShownRep.set(issue.id, this.currentRep));

    const cues: FeedbackCue[] = topIssues.map(issue => {
      const def = this.cueDefs.get(issue.id);
      const severity: FeedbackCue['severity'] = issue.severity === 'error' ? 'error' : 'warning';
      return {
        text: def?.text ?? issue.message,
        voiceText: def?.voiceText ?? issue.message,
        severity,
      };
    });

    if (cues.length === 0 && this.consecutiveCleanReps >= 3) {
      cues.push({ text: 'Great form! Keep it up.', voiceText: 'Great form', severity: 'positive' });
    }

    return cues;
  }

  reset(): void {
    this.currentRep = 0;
    this.consecutiveCleanReps = 0;
    this.lastShownRep.clear();
  }
}
