import type { EnginePhase, EngineState } from '@/features/form-engine/form-engine';
import type { ExerciseConfig } from '@/features/form-engine/exercise-config';

// ── Hysteresis helpers (used by SquatRepCounterStateMachine) ─────────────────

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

// ── Squat-specific multi-phase counter (used only by SquatEngine) ─────────────

export type RepCounterConfig = {
  descendStartAngle: number;
  bottomAngle: number;
  ascendStartAngle: number;
  lockoutAngle: number;
  minRepCooldownMs: number;
  angleSmoothingAlpha: number;
};

const SQUAT_PHASE_TIMEOUT_MS = 6000;

export class SquatRepCounterStateMachine {
  private state: EngineState = { phase: 'NOT_READY', repCount: 0, lastRepTimestampMs: -1e9 };
  private smoothedAngle = 180;
  private phaseEnteredMs = -1e9;

  constructor(private config: RepCounterConfig) {}

  reset() {
    this.state = { phase: 'NOT_READY', repCount: 0, lastRepTimestampMs: -1e9 };
    this.smoothedAngle = 180;
    this.phaseEnteredMs = -1e9;
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
      this.phaseEnteredMs = -1e9;
    } else if (phase === 'DESCENDING' && this.smoothedAngle < this.config.bottomAngle) {
      if (this.state.phase !== 'BOTTOM') this.phaseEnteredMs = timestampMs;
      this.state.phase = 'BOTTOM';
    } else if (phase === 'BOTTOM' && this.smoothedAngle > this.config.ascendStartAngle) {
      if (this.state.phase !== 'ASCENDING') this.phaseEnteredMs = timestampMs;
      this.state.phase = 'ASCENDING';
    } else if (phase === 'ASCENDING' && this.smoothedAngle > this.config.lockoutAngle) {
      this.state.phase = 'LOCKOUT';
      this.phaseEnteredMs = -1e9;
    }

    // Timeout: if stuck in BOTTOM or ASCENDING for too long, reset to READY
    if ((this.state.phase === 'BOTTOM' || this.state.phase === 'ASCENDING') &&
        this.phaseEnteredMs > 0 &&
        timestampMs - this.phaseEnteredMs > SQUAT_PHASE_TIMEOUT_MS) {
      console.debug('[SquatCounter] Phase timeout — reset to READY');
      this.state.phase = 'READY';
      this.phaseEnteredMs = -1e9;
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

// ── Generic config-driven counter (used by GenericExerciseEngine) ─────────────

const MIN_REP_COOLDOWN_MS = 500;
const UP_STATE_TIMEOUT_MS = 5000;

type SideState = {
  stage: 'READY' | 'UP' | 'DOWN';
  repCount: number;
  lastRepTimestampMs: number;
  lastUpTimestampMs: number;
};

function makeSideState(): SideState {
  return { stage: 'READY', repCount: 0, lastRepTimestampMs: -1e9, lastUpTimestampMs: -1e9 };
}

function tickSide(
  s: SideState,
  angle: number,
  upThreshold: number,
  downThreshold: number,
  reversed: boolean,
  now: number
): SideState {
  // reversed=true: small angle = "up" (bicep curl, pull-up)
  // reversed=false: large angle = "up" (squat, push-up, etc.)
  const isUpPosition = reversed ? angle < upThreshold : angle > upThreshold;
  const isDownPosition = reversed ? angle > downThreshold : angle < downThreshold;

  let { stage, repCount, lastRepTimestampMs, lastUpTimestampMs } = s;

  if (isUpPosition) {
    if (stage !== 'UP') lastUpTimestampMs = now;
    stage = 'UP';
  } else if (stage === 'UP' && now - lastUpTimestampMs > UP_STATE_TIMEOUT_MS) {
    console.debug('[RepCounter] Stale UP state reset after 5s timeout');
    stage = 'READY';
  } else if (isDownPosition && stage === 'UP' && now - lastRepTimestampMs >= MIN_REP_COOLDOWN_MS) {
    repCount += 1;
    lastRepTimestampMs = now;
    stage = 'DOWN';
  }

  return { stage, repCount, lastRepTimestampMs, lastUpTimestampMs };
}

export class RepCounterStateMachine {
  private readonly isUnilateral: boolean;
  private readonly reversed: boolean;
  private readonly upThreshold: number;
  private readonly downThreshold: number;

  private bilateral: SideState = makeSideState();
  private left: SideState = makeSideState();
  private right: SideState = makeSideState();

  constructor(config: ExerciseConfig) {
    this.isUnilateral = config.isUnilateral;
    this.reversed = config.repThresholds.reversedDirection;
    this.upThreshold = config.repThresholds.upAngle;
    this.downThreshold = config.repThresholds.downAngle;
  }

  update(leftAngle: number, rightAngle: number, timestampMs: number) {
    const { upThreshold, downThreshold, reversed } = this;

    if (this.isUnilateral) {
      this.left = tickSide(this.left, leftAngle, upThreshold, downThreshold, reversed, timestampMs);
      this.right = tickSide(this.right, rightAngle, upThreshold, downThreshold, reversed, timestampMs);
      return {
        repCount: this.left.repCount + this.right.repCount,
        leftRepCount: this.left.repCount,
        rightRepCount: this.right.repCount,
        stage: 'READY' as const,
        leftStage: this.left.stage,
        rightStage: this.right.stage,
      };
    }

    const avgAngle = (leftAngle + rightAngle) / 2;
    this.bilateral = tickSide(this.bilateral, avgAngle, upThreshold, downThreshold, reversed, timestampMs);
    return {
      repCount: this.bilateral.repCount,
      leftRepCount: 0,
      rightRepCount: 0,
      stage: this.bilateral.stage,
      leftStage: this.bilateral.stage,
      rightStage: this.bilateral.stage,
    };
  }

  reset() {
    this.bilateral = makeSideState();
    this.left = makeSideState();
    this.right = makeSideState();
  }
}
