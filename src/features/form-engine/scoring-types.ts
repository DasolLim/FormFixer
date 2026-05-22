export interface RepScore {
  repNumber: number;       // 1-indexed within the set
  overall: number;         // 0–100, weighted composite
  depth: number;           // 0–100
  symmetry: number;        // 0–100
  form: number;            // 0–100
  tempo: number;           // 0–100
  ascent: number;          // 0–100
  ascentMs: number;        // measured ascent duration in ms (0 = not measured)
  grade: string;           // e.g. 'A+', 'B'
  label: string;           // e.g. 'Perfect', 'Good'
  issueIds: string[];      // FormIssue IDs that fired during this rep
  timestampMs: number;     // when the rep completed
}

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
