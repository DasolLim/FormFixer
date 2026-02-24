'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';
import { clearCanvas, drawPoseOverlay, resizeCanvasToVideo } from '@/lib/pose/draw';
import type { Landmark } from '@/lib/pose/math';
import type { MediaPipePoseResultLike } from '@/features/pose/pose-types';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { saveWorkoutSession } from '@/lib/workouts/sessions';
import { adaptPoseLandmarkerResult } from '@/features/pose/pose-landmarker-adapter';
import { CalibrationGate } from '@/features/form-engine/calibration-gate';
import { DEFAULT_SQUAT_ENGINE_CONFIG, SquatEngine } from '@/features/form-engine/engines/squat-engine';
import { createWorkoutSessionState, resetWorkoutSessionState } from '@/features/workout/workout-session-store';

type PoseLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => MediaPipePoseResultLike;
};

type VisionModule = {
  FilesetResolver: { forVisionTasks: (wasmRoot: string) => Promise<unknown> };
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
  const sessionRef = useRef(createWorkoutSessionState());

  const [userId, setUserId] = useState<string | null>(null);
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState('NOT_READY');
  const [cue, setCue] = useState('Press Start Camera to begin');
  const [secondaryCue, setSecondaryCue] = useState('');
  const [angle, setAngle] = useState(180);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');

  const calibrationGate = useMemo(
    () =>
      new CalibrationGate({
        minVisibility: DEFAULT_SQUAT_ENGINE_CONFIG.confidence.minVisibility,
        requiredStableFrames: 12,
        maxMotionPerFrame: 0.015,
        minShoulderHipHeightDelta: 0.04,
        orientation: 'auto'
      }),
    []
  );
  const squatEngine = useMemo(() => new SquatEngine(DEFAULT_SQUAT_ENGINE_CONFIG), []);

  useEffect(() => {
    getSupabaseClient().then((supabase) =>
      supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
        if (!data.user) return;
        setUserId(data.user.id);
      })
    );

    return () => stopCamera();
  }, []);

  async function loadPoseLandmarker() {
    if (poseLandmarkerRef.current) return poseLandmarkerRef.current;

    const dynamicImporter = new Function('u', 'return import(/* webpackIgnore: true */ u)') as (url: string) => Promise<VisionModule>;
    const vision = await dynamicImporter('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
    const fileset = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');

    poseLandmarkerRef.current = await vision.PoseLandmarker.createFromOptions(fileset, {
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

    return poseLandmarkerRef.current;
  }

  async function startCamera() {
    setError(null);
    try {
      const pose = await loadPoseLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
        audio: false
      });

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      streamRef.current = stream;
      setIsCameraRunning(true);
      runDetectionLoop(pose);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start camera');
    }
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
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
    resetWorkoutSessionState(sessionRef.current);
    calibrationGate.reset();
    squatEngine.reset();
    setRepCount(0);
    setPhase('NOT_READY');
    setAngle(180);
    setCue('Session reset. Stand upright and hold still to calibrate.');
    setSecondaryCue('');
    setSaveMessage('');
  }

  function runDetectionLoop(pose: PoseLandmarkerLike) {
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      resizeCanvasToVideo(canvas, video);

      const frameTsMs = video.currentTime * 1000;
      const normalized = adaptPoseLandmarkerResult(pose.detectForVideo(video, frameTsMs), frameTsMs);
      const calibration = calibrationGate.update(normalized);
      const output = squatEngine.update(normalized, calibration);

      sessionRef.current.calibration = calibration;
      sessionRef.current.output = output;

      const drawable = normalized.landmarks.map((p) => ({ x: p?.x ?? 0, y: p?.y ?? 0, z: p?.z, visibility: p?.visibility })) as Landmark[];
      drawPoseOverlay(canvas, drawable);

      setRepCount(output.state.repCount);
      setPhase(output.state.phase);
      setCue(output.primaryCue);
      setSecondaryCue(output.secondaryCue ?? '');
      setAngle(Math.round(output.metrics.smoothedKneeAngle ?? output.metrics.kneeAngle ?? 180));

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  async function handleSaveSession() {
    if (!userId || !sessionRef.current.output) {
      setSaveMessage('Login and run at least one rep before saving.');
      return;
    }

    const output = sessionRef.current.output;

    const payload = {
      userId,
      exerciseType: 'squat' as const,
      repCount: output.state.repCount,
      formScore: Math.max(1, Math.min(100, 100 - output.issues.filter((issue) => issue.code !== 'status').length * 10)),
      formSummary: `${output.primaryCue}${output.secondaryCue ? ` | ${output.secondaryCue}` : ''}`
    };

    const { error: saveError } = await saveWorkoutSession(payload);
    if (saveError) {
      setSaveMessage(saveError.message);
      return;
    }

    setSaveMessage('Workout session saved.');
  }

  return (
    <Section title="Camera Trainer" subtitle="Real-time squat form engine" description="Calibrate, track reps, and get live feedback cues.">
      {error ? <p style={{ color: 'var(--danger)', marginTop: 0 }}>{error}</p> : null}
      <Card title="Live Camera">
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 720 }}>
            <video ref={videoRef} style={{ width: '100%', borderRadius: 12, background: '#020817' }} playsInline muted />
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {!isCameraRunning ? <Button onClick={startCamera}>Start Camera</Button> : <Button onClick={stopCamera}>Stop Camera</Button>}
            <Button variant="ghost" onClick={resetSession}>
              Reset Session
            </Button>
            <Button variant="ghost" onClick={handleSaveSession}>
              Save Session
            </Button>
          </div>

          {saveMessage ? <p style={{ color: 'var(--muted)', margin: 0 }}>{saveMessage}</p> : null}
        </div>
      </Card>

      <Card title="Live Metrics" description="RepDetect-inspired pipeline with explicit rule engine.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Card title="Reps" description={`${repCount}`} />
          <Card title="Phase" description={phase} />
          <Card title="Knee Angle" description={`${angle}°`} />
          <Card title="Primary Cue" description={cue} />
          <Card title="Secondary Cue" description={secondaryCue || '—'} />
          <Card title="Camera" description={isCameraRunning ? 'Running' : 'Stopped'} />
        </div>
      </Card>
    </Section>
  );
}
