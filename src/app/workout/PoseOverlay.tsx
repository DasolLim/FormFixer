'use client';

import { useEffect, useRef } from 'react';
import { drawPoseOverlay } from '@/lib/pose/draw';
import type { Landmark } from '@/lib/pose/math';

export function PoseOverlay({ width, height, landmarks }: { width: number; height: number; landmarks: Landmark[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    drawPoseOverlay(canvas, landmarks);
  }, [width, height, landmarks]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}
