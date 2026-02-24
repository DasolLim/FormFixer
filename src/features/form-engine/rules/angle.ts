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
