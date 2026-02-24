export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export function angleDeg(a: Landmark, b: Landmark, c: Landmark) {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;

  const dot = abx * cbx + aby * cby;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);
  const cosTheta = dot / Math.max(magAB * magCB, 1e-6);
  const clamped = Math.min(1, Math.max(-1, cosTheta));
  return (Math.acos(clamped) * 180) / Math.PI;
}

export function avg(valueA: number, valueB: number) {
  return (valueA + valueB) / 2;
}

export function distance2D(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a: number, b: number, alpha: number) {
  return a + (b - a) * alpha;
}

export function smoothLandmarks(current: Landmark[], previous: Landmark[] | null, alpha: number) {
  if (!previous || previous.length !== current.length) return current;

  return current.map((point, i) => ({
    ...point,
    x: lerp(previous[i].x, point.x, alpha),
    y: lerp(previous[i].y, point.y, alpha),
    z: point.z !== undefined && previous[i].z !== undefined ? lerp(previous[i].z!, point.z!, alpha) : point.z,
    visibility: point.visibility
  }));
}
