import type { EnginePhase } from '@/features/form-engine/form-engine';

export type TempoConfig = {
  minDescentMs: number;
  minAscentMs: number;
};

export class TempoTracker {
  private descendStartMs: number | null = null;
  private ascentStartMs: number | null = null;

  constructor(private config: TempoConfig) {}

  reset() {
    this.descendStartMs = null;
    this.ascentStartMs = null;
  }

  update(phase: EnginePhase, timestampMs: number) {
    if (phase === 'DESCENDING' && this.descendStartMs === null) {
      this.descendStartMs = timestampMs;
      this.ascentStartMs = null;
      return null;
    }

    if (phase === 'ASCENDING' && this.ascentStartMs === null) {
      this.ascentStartMs = timestampMs;
      return null;
    }

    if (phase === 'LOCKOUT') {
      const descentMs = this.descendStartMs ? timestampMs - this.descendStartMs : null;
      const ascentMs = this.ascentStartMs ? timestampMs - this.ascentStartMs : null;
      const tooFast = Boolean((descentMs !== null && descentMs < this.config.minDescentMs) || (ascentMs !== null && ascentMs < this.config.minAscentMs));
      this.reset();
      return { tooFast, descentMs: descentMs ?? 0, ascentMs: ascentMs ?? 0 };
    }

    return null;
  }
}
