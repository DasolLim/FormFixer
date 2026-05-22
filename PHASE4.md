## PHASE 4 — OVERHAUL SCORING

### 4.1 Rewrite depth scoring with tiered forgiveness

**File:** src/features/form-engine/rep-scorer.ts

Replace linear penalty (2 pts per degree short) with tiered system:
```ts
function scoreDepth(shortfall: number): number {
  if (shortfall === 0)      return 100;
  if (shortfall <= 5)       return 97;
  if (shortfall <= 10)      return 90;
  if (shortfall <= 20)      return 75;
  if (shortfall <= 35)      return 55;
  return Math.max(0, 55 - (shortfall - 35) * 1.5);
}
```

### 4.2 Rewrite form scoring proportionally

Replace raw frame counts with proportion of rep:
```ts
function scoreForm(errorFrames: number, warningFrames: number, totalFrames: number): number {
  if (totalFrames === 0) return 100;
  const errorRatio   = errorFrames   / totalFrames;
  const warningRatio = warningFrames / totalFrames;
  const deduction = (errorRatio * 60) + (warningRatio * 25);
  return Math.max(0, Math.round(100 - deduction));
}
```

### 4.3 Add grade and label to RepScore

```ts
function getGrade(score: number): { grade: string; label: string } {
  if (score >= 95) return { grade: 'A+', label: 'Perfect' };
  if (score >= 88) return { grade: 'A',  label: 'Excellent' };
  if (score >= 80) return { grade: 'B+', label: 'Great' };
  if (score >= 72) return { grade: 'B',  label: 'Good' };
  if (score >= 62) return { grade: 'C+', label: 'Fair' };
  if (score >= 50) return { grade: 'C',  label: 'Needs work' };
  return             { grade: 'D',  label: 'Significant issues' };
}
```

Add grade: string and label: string to RepScore type. Compute in
completeRep() and include in the returned RepScore.

### 4.4 Add SessionSummary with fatigue detection and improvement tips

Add getSessionSummary(): SessionSummary method to RepScorer:

```ts
export type SessionSummary = {
  totalReps: number;
  averageOverall: number;
  averageDepth: number;
  averageForm: number;
  averageSymmetry: number;
  averageTempo: number;
  fatigueDetected: boolean;
  trendDirection: 'improving' | 'stable' | 'declining';
  topIssueIds: string[];
  improvementTip: string;
};
```

Fatigue: true if scores.length >= 6 AND last-3-rep avg < first-3-rep avg
by more than 12 points.

Trend: compare avg of first half vs second half of all reps. Improving if
difference > +3, declining if < -3, else stable.

Top issues: count issueIds across all reps, return top 3 by frequency.

Improvement tip based on worst average dimension:
```ts
const tips = {
  depth:    'Focus on hitting full range of motion — go a little deeper each rep.',
  symmetry: 'Your left and right sides are uneven. Slow down and feel both sides working equally.',
  form:     'Prioritize quality over speed — reduce weight if needed to maintain good technique.',
  tempo:    'Control the eccentric (lowering) phase — aim for 2-3 seconds on the way down.',
};
```

Expose sessionSummary?: SessionSummary in EngineOutput type.

### 4.5 Add positive reinforcement cue variety

**File:** src/features/form-engine/feedback-prioritizer.ts

Replace single "Great form!" with rotating array:
```ts
const POSITIVE_CUES = [
  { text: 'Perfect rep!',          voiceText: 'Perfect rep'         },
  { text: 'Great form — keep it up!', voiceText: 'Great form'      },
  { text: 'Looking strong!',       voiceText: 'Looking strong'      },
  { text: 'Excellent technique!',  voiceText: 'Excellent technique' },
  { text: "That's the one!",       voiceText: "That's the one"      },
];
// Use: POSITIVE_CUES[consecutiveCleanReps % POSITIVE_CUES.length]
// Trigger after consecutiveCleanReps >= 2 (was >= 3 — more encouraging)
```

---