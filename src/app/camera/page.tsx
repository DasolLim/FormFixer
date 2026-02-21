'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/layout/Section';
import { clearCanvas, drawPoseOverlay, resizeCanvasToVideo } from '@/lib/pose/draw';
import { smoothLandmarks, type Landmark } from '@/lib/pose/math';
import { SQUAT_THRESHOLDS } from '@/lib/pose/constants';
import { analyzeExercise, initialExerciseState, type ExerciseState } from '@/lib/workouts/analysis';
import type { ExerciseType, PlanTier } from '@/lib/workouts/types';
import { fetchPlanTier, saveWorkoutSession } from '@/lib/workouts/sessions';
import { getSupabaseClient } from '@/lib/supabaseClient';

type PoseLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { landmarks?: Landmark[][] };
};

type VisionModule = {
  FilesetResolver: { forVisionTasks: (wasmRoot: string) => Promise<unknown> };
  PoseLandmarker: {
    createFromOptions: (fileset: unknown, options: Record<string, unknown>) => Promise<PoseLandmarkerLike>;
  };
};

const EXERCISE_TIPS: Record<ExerciseType, string> = {
  squat: 'Face camera. Keep full body visible. Camera at waist/chest height.',
  pushup: 'Place camera side/front at floor level. Keep whole body in frame.',
  lunge: 'Show full body. Step back enough so both legs stay visible.'
};

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const previousLandmarksRef = useRef<Landmark[] | null>(null);
  const stateRef = useRef<ExerciseState>({ ...initialExerciseState });
  const frameRef = useRef(0);
  const cueFramesRef = useRef(0);
  const rawCueRef = useRef('Stand where your full body is visible');

  const [exercise, setExercise] = useState<ExerciseType>('squat');
  const [planTier, setPlanTier] = useState<PlanTier>('free');
  const [userId, setUserId] = useState<string | null>(null);
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState('top');
  const [cue, setCue] = useState('Press Start Camera to begin');
  const [angle, setAngle] = useState(180);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');

  const isExerciseLocked = useMemo(() => planTier === 'free' && exercise === 'lunge', [planTier, exercise]);

  useEffect(() => {
    getSupabaseClient().then((supabase) =>
      supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
        if (!data.user) return;
        setUserId(data.user.id);
        setPlanTier(await fetchPlanTier(data.user.id));
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
    if (isExerciseLocked) {
      setError('Lunge is Pro-only. Choose squat/push-up or upgrade later.');
      return;
    }

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
    stateRef.current = { ...initialExerciseState };
    frameRef.current = 0;
    setRepCount(0);
    setPhase('top');
    setAngle(180);
    setCue('Session reset');
    setSaveMessage('');
  }

  function updateStableCue(next: string) {
    if (next === rawCueRef.current) cueFramesRef.current += 1;
    else {
      rawCueRef.current = next;
      cueFramesRef.current = 1;
    }
    if (cueFramesRef.current >= SQUAT_THRESHOLDS.stableCueFrames) setCue(next);
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
      const landmarks = result.landmarks?.[0];
      if (landmarks) {
        const smoothed = smoothLandmarks(landmarks, previousLandmarksRef.current, SQUAT_THRESHOLDS.smoothingAlpha);
        previousLandmarksRef.current = smoothed;
        drawPoseOverlay(canvas, smoothed);

        const analysis = analyzeExercise(exercise, smoothed, stateRef.current, frameRef.current);
        setRepCount(analysis.reps);
        setPhase(analysis.phase);
        setAngle(Number(analysis.primaryAngle.toFixed(1)));
        updateStableCue(analysis.cue);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  async function handleSaveSession() {
    setSaveMessage('');
    if (!userId) {
      setSaveMessage('Login to save workout sessions.');
      return;
    }

    const formScore = Math.min(100, Math.max(45, Math.round(100 - Math.abs(angle - 100) * 0.4)));
    const formSummary = `${exercise} session completed. Final cue: ${cue}`;

    const { error: saveError } = await saveWorkoutSession({
      userId,
      exerciseType: exercise,
      repCount,
      formScore,
      formSummary
    });

    setSaveMessage(saveError ? `Save failed: ${saveError.message}` : 'Session saved to history.');
  }

  return (
    <Section title="Camera / Form Fixer" subtitle="Live workout tracking" description="Pick an exercise, start camera, complete reps, then save session.">
      <Card>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>Plan: {planTier.toUpperCase()} · {EXERCISE_TIPS[exercise]}</p>

        <div style={{ marginBottom: 12 }}>
          <label>
            Exercise:
            <select
              value={exercise}
              onChange={(e) => setExercise(e.target.value as ExerciseType)}
              style={{ marginLeft: 10, padding: 8, borderRadius: 8, background: '#0d1629', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              <option value="squat">Squat (Free)</option>
              <option value="pushup">Push-up (Free)</option>
              <option value="lunge">Lunge (Pro)</option>
            </select>
          </label>
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: 920, aspectRatio: '16 / 9', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', background: '#0b1325' }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} muted playsInline />
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'scaleX(-1)' }} />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <Button onClick={startCamera}>Start Camera</Button>
          <Button onClick={stopCamera} variant="ghost">Stop Camera</Button>
          <Button onClick={resetSession} variant="ghost">Reset</Button>
          <Button onClick={handleSaveSession} variant="ghost">Save Session</Button>
        </div>

        {error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}
        {saveMessage ? <p style={{ color: 'var(--muted)' }}>{saveMessage}</p> : null}

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          <Card title="Reps" description={`${repCount}`} />
          <Card title="Phase" description={phase} />
          <Card title="Primary Angle" description={`${angle}°`} />
          <Card title="Cue" description={cue} />
          <Card title="Camera" description={isCameraRunning ? 'Running' : 'Stopped'} />
        </div>
      </Card>
    </Section>
  );
}
