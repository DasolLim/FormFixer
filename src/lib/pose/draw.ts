import type { FormIssue } from '@/features/form-engine/form-engine';
import type { PoseLandmark } from '@/features/pose/pose-types';

// ── Skeleton connection groups ────────────────────────────────────────────────

export const SKELETON_CONNECTIONS: Array<{
  label: string;
  color: string;
  connections: [number, number][];
}> = [
  {
    label: 'head',
    color: '#4A9EFF',
    connections: [[0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10]],
  },
  {
    label: 'torso',
    color: '#FF8C42',
    connections: [[11,12],[11,23],[12,24],[23,24]],
  },
  {
    label: 'left_arm',
    color: '#4CAF50',
    connections: [[11,13],[13,15],[15,17],[15,19],[15,21]],
  },
  {
    label: 'right_arm',
    color: '#4CAF50',
    connections: [[12,14],[14,16],[16,18],[16,20],[16,22]],
  },
  {
    label: 'left_leg',
    color: '#E91E8C',
    connections: [[23,25],[25,27],[27,29],[27,31]],
  },
  {
    label: 'right_leg',
    color: '#E91E8C',
    connections: [[24,26],[26,28],[28,30],[28,32]],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DrawPoseOptions {
  /** The active exercise's anglePoint triplet [A, B, C] — indices into landmarks */
  anglePoint?: [number, number, number];
  /** The smoothed angle value to display near the joint vertex */
  currentAngle?: number;
  /** Form violations — affects landmark colors (populated from Phase 3) */
  formIssues?: FormIssue[];
  canvasWidth: number;
  canvasHeight: number;
  /** Whether to mirror the overlay horizontally (for front-facing camera display) */
  mirrored?: boolean;
}

// ── Visibility guard ──────────────────────────────────────────────────────────

function isVisible(lm: PoseLandmark | null | undefined): boolean {
  if (!lm) return false;
  return (lm.visibility ?? 1) >= 0.5;
}

// ── Active region dimming ─────────────────────────────────────────────────────

// Returns the set of group labels that should be drawn at full opacity for this
// exercise. Other groups are dimmed to 0.6. Always includes torso.
function activeRegionLabels(anglePoint?: [number, number, number]): Set<string> | null {
  if (!anglePoint) return null;
  const vertex = anglePoint[1];
  const active = new Set<string>(['torso']);
  if (vertex >= 23) {
    // Lower body (hips, knees, ankles, heels, toes)
    active.add('left_leg');
    active.add('right_leg');
  } else if (vertex >= 11) {
    // Upper body (shoulders, elbows, wrists, fingers)
    active.add('left_arm');
    active.add('right_arm');
  } else {
    active.add('head');
  }
  return active;
}

// ── Internal drawing helpers ──────────────────────────────────────────────────

function drawSkeletonConnections(
  ctx: CanvasRenderingContext2D,
  landmarks: Array<PoseLandmark | null>,
  toCanvas: (lm: PoseLandmark) => { x: number; y: number },
  formIssues: FormIssue[],
  anglePoint?: [number, number, number]
): void {
  const active = activeRegionLabels(anglePoint);

  for (const group of SKELETON_CONNECTIONS) {
    const isActive = !active || active.has(group.label);
    ctx.strokeStyle = group.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = isActive ? 1.0 : 0.6;

    for (const [a, b] of group.connections) {
      const lmA = landmarks[a];
      const lmB = landmarks[b];
      if (!isVisible(lmA) || !isVisible(lmB)) continue;

      const ptA = toCanvas(lmA!);
      const ptB = toCanvas(lmB!);
      ctx.beginPath();
      ctx.moveTo(ptA.x, ptA.y);
      ctx.lineTo(ptB.x, ptB.y);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1.0;
}

function drawLandmarkDots(
  ctx: CanvasRenderingContext2D,
  landmarks: Array<PoseLandmark | null>,
  toCanvas: (lm: PoseLandmark) => { x: number; y: number },
  formIssues: FormIssue[],
  anglePoint?: [number, number, number]
): void {
  const errorLandmarks = new Set<number>();
  const warningLandmarks = new Set<number>();
  for (const issue of formIssues) {
    if (issue.severity === 'error') issue.affectedLandmarks?.forEach(i => errorLandmarks.add(i));
    if (issue.severity === 'warning') issue.affectedLandmarks?.forEach(i => warningLandmarks.add(i));
  }

  const vertexIdx = anglePoint?.[1];

  for (let idx = 0; idx < landmarks.length; idx++) {
    const lm = landmarks[idx];
    if (!isVisible(lm)) continue;

    const pt = toCanvas(lm!);

    let fillColor = '#FFFFFF';
    let strokeColor = '#888888';
    let radius = 4;

    if (idx === vertexIdx) {
      fillColor = '#FFD700';
      strokeColor = '#FFD700';
      radius = 6;
    } else if (errorLandmarks.has(idx)) {
      fillColor = '#FF4444';
      strokeColor = '#FF4444';
      radius = 6;
    } else if (warningLandmarks.has(idx)) {
      fillColor = '#FF8C00';
      strokeColor = '#FF8C00';
      radius = 5;
    }

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawAngleArc(
  ctx: CanvasRenderingContext2D,
  landmarks: Array<PoseLandmark | null>,
  toCanvas: (lm: PoseLandmark) => { x: number; y: number },
  anglePoint: [number, number, number],
  currentAngle?: number
): void {
  const [idxA, idxB, idxC] = anglePoint;
  const lmA = landmarks[idxA];
  const lmB = landmarks[idxB];
  const lmC = landmarks[idxC];

  if (!isVisible(lmA) || !isVisible(lmB) || !isVisible(lmC)) return;

  const ptA = toCanvas(lmA!);
  const ptB = toCanvas(lmB!); // vertex
  const ptC = toCanvas(lmC!);

  ctx.save();
  ctx.strokeStyle = '#FFD700';
  ctx.fillStyle = '#FFD700';
  ctx.lineWidth = 3;

  // Line from vertex to proximal landmark
  ctx.beginPath();
  ctx.moveTo(ptB.x, ptB.y);
  ctx.lineTo(ptA.x, ptA.y);
  ctx.stroke();

  // Line from vertex to distal landmark
  ctx.beginPath();
  ctx.moveTo(ptB.x, ptB.y);
  ctx.lineTo(ptC.x, ptC.y);
  ctx.stroke();

  // Filled circle at vertex
  ctx.beginPath();
  ctx.arc(ptB.x, ptB.y, 7, 0, 2 * Math.PI);
  ctx.fill();

  // Angle label near vertex: draw outline first for legibility
  if (currentAngle !== undefined) {
    const label = `${Math.round(currentAngle)}°`;
    ctx.font = 'bold 14px monospace';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(label, ptB.x + 10, ptB.y - 10);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, ptB.x + 10, ptB.y - 10);
  }

  ctx.restore();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Main entry point. Draws the full skeleton, angle arc, and form violation
 * highlights in one call. Reads image-space landmarks (normalized 0–1).
 */
export function drawPoseOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Array<PoseLandmark | null>,
  options: DrawPoseOptions
): void {
  if (!landmarks || landmarks.length === 0) return;

  const {
    canvasWidth,
    canvasHeight,
    anglePoint,
    currentAngle,
    formIssues = [],
    mirrored = false,
  } = options;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Convert normalized [0,1] landmark coords to canvas pixel coords.
  // Mirror flips x as (1 - lm.x) for front-facing camera display correction.
  function toCanvas(lm: PoseLandmark): { x: number; y: number } {
    const x = mirrored ? (1 - lm.x) * canvasWidth : lm.x * canvasWidth;
    return { x, y: lm.y * canvasHeight };
  }

  drawSkeletonConnections(ctx, landmarks, toCanvas, formIssues, anglePoint);
  drawLandmarkDots(ctx, landmarks, toCanvas, formIssues, anglePoint);

  if (anglePoint) {
    drawAngleArc(ctx, landmarks, toCanvas, anglePoint, currentAngle);
  }
}

/**
 * Draws red dashed rings around error-severity affected landmarks.
 * No-op when formIssues is empty. Called from Phase 3 form check hooks.
 */
export function drawFormViolationArcs(
  ctx: CanvasRenderingContext2D,
  landmarks: Array<PoseLandmark | null>,
  toCanvas: (lm: PoseLandmark) => { x: number; y: number },
  formIssues: FormIssue[],
  _acceptableRange?: { min: number; max: number }
): void {
  for (const issue of formIssues.filter(i => i.severity === 'error')) {
    if (!issue.affectedLandmarks) continue;
    for (const idx of issue.affectedLandmarks) {
      const lm = landmarks[idx];
      if (!isVisible(lm)) continue;
      const pt = toCanvas(lm!);
      ctx.save();
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 16, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── Canvas utilities ──────────────────────────────────────────────────────────

export function resizeCanvasToVideo(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

export function clearCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
