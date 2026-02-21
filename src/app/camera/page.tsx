'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';
import { clearCanvas, drawPoseOverlay, resizeCanvasToVideo } from '@/lib/pose/draw';
import { smoothLandmarks, type Landmark } from '@/lib/pose/math';
import { analyzeSquat, initialSquatState, type SquatPhase, type SquatState } from '@/lib/pose/squat';
import { SQUAT_THRESHOLDS } from '@/lib/pose/constants';

type PoseLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { landmarks?: Landmark[][] };
  close: () => void;
};

type VisionModule = {
  FilesetResolver: {
    forVisionTasks: (wasmRoot: string) => Promise<unknown>;
  };
  PoseLandmarker: {
    createFromOptions: (fileset: unknown, options: Record<string, unknown>) => Promise<PoseLandmarkerLike>;
  };
};

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const previousLandmarksRef = useRef<Landmark[] | null>(null);
  const squatStateRef = useRef<SquatState>({ ...initialSquatState });
  const frameRef = useRef(0);
  const cueFrameCountRef = useRef(0);
  const lastRawCueRef = useRef('Stand where your full body is visible');

  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState<SquatPhase>('top');
  const [cue, setCue] = useState('Press Start Camera to begin squat tracking');
  const [kneeAngle, setKneeAngle] = useState(180);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function loadVisionModule(): Promise<VisionModule> {
    // Use runtime import from CDN so bundling does not require local @mediapipe/tasks-vision install.
    const dynamicImporter = new Function(
      "u",
      "return import(/* webpackIgnore: true */ u)"
    ) as (url: string) => Promise<VisionModule>;

    return dynamicImporter('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
  }

  async function loadPoseLandmarker() {
    if (poseLandmarkerRef.current) return poseLandmarkerRef.current;

    setIsLoadingModel(true);
    try {
      const vision = await loadVisionModule();
      const fileset = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');

      const pose = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      poseLandmarkerRef.current = pose;
      return pose;
    } finally {
      setIsLoadingModel(false);
    }
  }

  async function startCamera() {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera API is not supported in this browser.');
      return;
    }

    try {
      const pose = await loadPoseLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();

      streamRef.current = stream;
      setIsCameraRunning(true);
      runDetectionLoop(pose);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start camera.';
      setError(message.includes('Permission') ? 'Camera permission denied. Please allow camera access.' : message);
      stopCamera();
    }
  }

  function stopCamera() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    clearCanvas(canvasRef.current);
    setIsCameraRunning(false);
  }

  function resetSession() {
    squatStateRef.current = { ...initialSquatState };
    previousLandmarksRef.current = null;
    frameRef.current = 0;
    cueFrameCountRef.current = 0;
    lastRawCueRef.current = 'Stand where your full body is visible';
    setRepCount(0);
    setPhase('top');
    setKneeAngle(180);
    setCue('Session reset. Press Start Camera.');
  }

  function updateCueWithStability(nextCue: string) {
    if (nextCue === lastRawCueRef.current) {
      cueFrameCountRef.current += 1;
    } else {
      lastRawCueRef.current = nextCue;
      cueFrameCountRef.current = 1;
    }

    if (cueFrameCountRef.current >= SQUAT_THRESHOLDS.stableCueFrames) {
      setCue(nextCue);
    }
  }

  function runDetectionLoop(pose: PoseLandmarkerLike) {
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      frameRef.current += 1;
      resizeCanvasToVideo(canvas, video);

      const result = pose.detectForVideo(video, performance.now());
      const raw = result.landmarks?.[0];

      if (raw && raw.length > 0) {
        const smoothed = smoothLandmarks(raw, previousLandmarksRef.current, SQUAT_THRESHOLDS.smoothingAlpha);
        previousLandmarksRef.current = smoothed;

        drawPoseOverlay(canvas, smoothed);

        const analysis = analyzeSquat(smoothed, squatStateRef.current, frameRef.current);
        setRepCount(analysis.reps);
        setPhase(analysis.phase);
        setKneeAngle(Number(analysis.kneeAngle.toFixed(1)));
        updateCueWithStability(analysis.cue);
      } else {
        updateCueWithStability('Body not detected. Step back and stay centered.');
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  return (
    <Section
      title="Camera / Squat Form Fixer"
      subtitle="Live MVP"
      description="Allow camera access, face the camera, and perform slow controlled squats."
    >
      <Card>
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          Tips: keep your full body in frame, place camera around waist/chest height, and use good lighting.
        </p>

        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 920,
            aspectRatio: '16 / 9',
            borderRadius: 14,
            border: '1px solid var(--border)',
            overflow: 'hidden',
            background: '#0b1325'
          }}
        >
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} muted playsInline />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              transform: 'scaleX(-1)'
            }}
          />
          {!isCameraRunning ? (
            <div style={{ position: 'absolute', left: 12, bottom: 12, color: 'var(--muted)' }}>Camera is off</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <Button onClick={startCamera}>{isLoadingModel ? 'Loading model...' : 'Start Camera'}</Button>
          <Button onClick={stopCamera} variant="ghost">
            Stop Camera
          </Button>
          <Button onClick={resetSession} variant="ghost">
            Reset Session
          </Button>
        </div>

        {error ? (
          <p style={{ color: 'var(--danger)', marginTop: 12 }}>
            {error}
          </p>
        ) : null}

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          <Card title="Reps" description={`${repCount}`} />
          <Card title="Phase" description={phase} />
          <Card title="Knee Angle" description={`${kneeAngle}°`} />
          <Card title="Current Cue" description={cue} />
        </div>
      </Card>
    </Section>
  );
}
