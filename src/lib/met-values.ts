export const TREADMILL_MET_BY_SPEED: Record<number, number> = {
  3:  2.8,
  4:  3.5,
  5:  4.3,
  6:  6.0,
  7:  7.0,
  8:  8.3,
  9:  9.8,
  10: 10.5,
  11: 11.0,
  12: 11.8,
  14: 12.3,
  16: 14.5,
};

export function getTreadmillMET(speedKmh: number, inclinePercent: number): number {
  const speeds = Object.keys(TREADMILL_MET_BY_SPEED).map(Number).sort((a, b) => a - b);
  const lower = speeds.filter(s => s <= speedKmh).pop() ?? speeds[0];
  const upper = speeds.find(s => s > speedKmh) ?? speeds[speeds.length - 1];

  const baseMET = lower === upper
    ? TREADMILL_MET_BY_SPEED[lower]
    : TREADMILL_MET_BY_SPEED[lower] +
      ((speedKmh - lower) / (upper - lower)) *
      (TREADMILL_MET_BY_SPEED[upper] - TREADMILL_MET_BY_SPEED[lower]);

  const inclineAdjustment = 0.07 * inclinePercent * (speedKmh / 10);
  return Math.round((baseMET + inclineAdjustment) * 10) / 10;
}

export const STAIRMASTER_MET_BY_LEVEL: Record<number, number> = {
  1:  4.0,
  2:  4.6,
  3:  5.0,
  4:  5.5,
  5:  6.0,
  6:  6.5,
  7:  7.0,
  8:  7.5,
  9:  8.0,
  10: 8.5,
  11: 9.0,
  12: 9.5,
  13: 10.0,
  14: 10.5,
  15: 11.0,
  16: 11.5,
  17: 12.0,
  18: 12.5,
  19: 13.0,
  20: 14.0,
};

export function getStairmasterMET(level: number): number {
  const clamped = Math.max(1, Math.min(20, Math.round(level)));
  return STAIRMASTER_MET_BY_LEVEL[clamped];
}

export const STRENGTH_MET: Record<string, number> = {
  light:    3.5,
  moderate: 5.0,
  vigorous: 6.0,
};

export function getStrengthCalories(
  metValue: number,
  bodyweightKg: number,
  durationMinutes: number,
): number {
  return Math.round(metValue * bodyweightKg * (durationMinutes / 60));
}

export function calculateCaloriesBurned(
  met: number,
  bodyweightKg: number,
  durationMinutes: number,
): number {
  return Math.round(met * bodyweightKg * (durationMinutes / 60));
}
