'use client';

import { useEffect, useRef } from 'react';
import { drawPoseOverlay } from '@/lib/pose/draw';
import type { PoseLandmark } from '@/features/pose/pose-types';

export function PoseOverlay({ width, height, landmarks }: { width: number; height: number; landmarks: Array<PoseLandmark | null> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPoseOverlay(ctx, landmarks, { canvasWidth: width, canvasHeight: height });
  }, [width, height, landmarks]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}
