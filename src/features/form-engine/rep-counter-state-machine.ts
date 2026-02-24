import type { EnginePhase, EngineState } from '@/features/form-engine/form-engine';

export type HysteresisConfig = {
  enterThreshold: number;
  exitThreshold: number;
  alpha: number;
};

export function createHysteresisSignal(config: HysteresisConfig) {
  let active = false;
  let ema = 0;

  return {
    update(value: number) {
      ema = config.alpha * value + (1 - config.alpha) * ema;
      if (!active && ema >= config.enterThreshold) active = true;
      if (active && ema <= config.exitThreshold) active = false;
      return { active, ema };
    },
    reset() {
      active = false;
      ema = 0;
    }
  };
}

export type RepCounterConfig = {
  descendStartAngle: number;
  bottomAngle: number;
  ascendStartAngle: number;
  lockoutAngle: number;
  minRepCooldownMs: number;
  angleSmoothingAlpha: number;
};

export class RepCounterStateMachine {
  private state: EngineState = { phase: 'NOT_READY', repCount: 0, lastRepTimestampMs: -1e9 };
  private smoothedAngle = 180;

  constructor(private config: RepCounterConfig) {}

  reset() {
    this.state = { phase: 'NOT_READY', repCount: 0, lastRepTimestampMs: -1e9 };
    this.smoothedAngle = 180;
  }

  update(kneeAngle: number, ready: boolean, timestampMs: number) {
    this.smoothedAngle = this.config.angleSmoothingAlpha * kneeAngle + (1 - this.config.angleSmoothingAlpha) * this.smoothedAngle;

    if (!ready) {
      this.state.phase = 'NOT_READY';
      return { ...this.state, repJustCounted: false, smoothedAngle: this.smoothedAngle };
    }

    if (this.state.phase === 'NOT_READY') this.state.phase = 'READY';
    const phase = this.state.phase;

    if ((phase === 'READY' || phase === 'LOCKOUT') && this.smoothedAngle < this.config.descendStartAngle) {
      this.state.phase = 'DESCENDING';
    } else if (phase === 'DESCENDING' && this.smoothedAngle < this.config.bottomAngle) {
      this.state.phase = 'BOTTOM';
    } else if (phase === 'BOTTOM' && this.smoothedAngle > this.config.ascendStartAngle) {
      this.state.phase = 'ASCENDING';
    } else if (phase === 'ASCENDING' && this.smoothedAngle > this.config.lockoutAngle) {
      this.state.phase = 'LOCKOUT';
    }

    let repJustCounted = false;
    if (this.state.phase === 'LOCKOUT') {
      const canCount = timestampMs - this.state.lastRepTimestampMs >= this.config.minRepCooldownMs;
      if (canCount) {
        this.state.repCount += 1;
        this.state.lastRepTimestampMs = timestampMs;
        repJustCounted = true;
      }
      this.state.phase = 'READY';
    }

    return { ...this.state, repJustCounted, smoothedAngle: this.smoothedAngle };
  }

  getState() {
    return { ...this.state };
  }
}

export function toEnginePhase(phase: EnginePhase) {
  return phase;
}
