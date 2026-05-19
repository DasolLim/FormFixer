import type { PoseLandmark } from '@/features/pose/pose-types';

export function midpoint(a: PoseLandmark, b: PoseLandmark): PoseLandmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2, visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1) };
}

export function distance2d(a: PoseLandmark, b: PoseLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function angleDeg(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark) {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const denom = Math.max(Math.hypot(abx, aby) * Math.hypot(cbx, cby), 1e-6);
  const cos = Math.max(-1, Math.min(1, dot / denom));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function verticalLeanDeg(shoulderMid: PoseLandmark, hipMid: PoseLandmark) {
  return Math.abs((Math.atan2(hipMid.x - shoulderMid.x, hipMid.y - shoulderMid.y) * 180) / Math.PI);
}

// Semantic alias for verticalLeanDeg — preferred name for torso-specific form checks.
export function torsoLeanDeg(shoulderMid: PoseLandmark, hipMid: PoseLandmark): number {
  return verticalLeanDeg(shoulderMid, hipMid);
}

// Returns normalized heel-lift amount using world landmarks (y-axis points up in world space).
// Positive = heel lifted above ankle; near-zero = heel planted.
// Normalize by lower-leg length so thresholds are body-size-independent.
export function heelLiftRatio(heel: PoseLandmark, ankle: PoseLandmark, knee: PoseLandmark): number {
  const lowerLegLen = Math.max(distance2d(knee, ankle), 1e-4);
  return (heel.y - ankle.y) / lowerLegLen;
}

// Returns absolute horizontal deviation of knee from vertical ankle alignment,
// normalized by upper-leg length. 0 = knee tracks directly over ankle.
export function kneeTrackingRatio(knee: PoseLandmark, ankle: PoseLandmark, hip: PoseLandmark): number {
  const refLen = Math.max(distance2d(hip, ankle), 1e-4);
  return Math.abs(knee.x - ankle.x) / refLen;
}

// Returns how far the wrist deviates horizontally from directly under the shoulder (degrees).
// Near 0° = wrist directly below shoulder; large values = wrist too wide or too narrow.
export function wristAlignmentDeg(wrist: PoseLandmark, shoulder: PoseLandmark): number {
  const dy = Math.abs(shoulder.y - wrist.y) + 1e-6;
  return Math.abs((Math.atan2(wrist.x - shoulder.x, dy) * 180) / Math.PI);
}
