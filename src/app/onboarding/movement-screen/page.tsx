'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clearCanvas, drawPoseOverlay, resizeCanvasToVideo } from '@/lib/pose/draw';
import type { MediaPipePoseResultLike } from '@/features/pose/pose-types';
import { adaptPoseLandmarkerResult } from '@/features/pose/pose-landmarker-adapter';
import { CalibrationGate } from '@/features/form-engine/calibration-gate';
import { DEFAULT_SQUAT_ENGINE_CONFIG } from '@/features/form-engine/engines/squat-engine';
import { getEngine } from '@/features/form-engine/engine-factory';
import { getExerciseConfig } from '@/features/form-engine/exercise-config';
import type { ExerciseFormEngine } from '@/features/form-engine/form-engine';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { saveMovementBaseline } from '@/lib/onboarding/sessions';
import type { MovementBaseline } from '@/lib/onboarding/types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const TARGET_REPS = 5;

type PoseLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => MediaPipePoseResultLike;
};

type VisionModule = {
  FilesetResolver: { forVisionTasks: (wasmRoot: string) => Promise<unknown> };
  PoseLandmarker: {
    createFromOptions: (fileset: unknown, options: Record<string, unknown>) => Promise<PoseLandmarkerLike>;
  };
};

type RepData = { angle: number; torso: number; symmetry: number };

export default function MovementScreenPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectTimestampRef = useRef(0);
  const engineRef = useRef<ExerciseFormEngine>(getEngine('squat'));
  const calibrationGateRef = useRef(
    new CalibrationGate({
      minVisibility: DEFAULT_SQUAT_ENGINE_CONFIG.confidence.minVisibility,
      requiredStableFrames: 12,
      maxMotionPerFrame: 0.015,
      minShoulderHipHeightDelta: 0.04,
      orientation: 'auto',
    })
  );

  // Per-rep tracking
  const prevRepCountRef = useRef(0);
  const minAngleThisRepRef = useRef(Infinity);
  const torsoAtMinRef = useRef(0);
  const symmetryAtMinRef = useRef(1);
  const repDataRef = useRef<RepData[]>([]);

  const [userId, setUserId] = useState<string | null>(null);
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [phase, setPhase] = useState('NOT_READY');
  const [cue, setCue] = useState('Press Start to begin the movement screen');
  const [repCount, setRepCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedReps, setSavedReps] = useState(0);

  const isCalibrated = phase !== 'NOT_READY' && phase !== 'CALIBRATING';

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    })();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPoseLandmarker() {
    if (poseLandmarkerRef.current) return poseLandmarkerRef.current;
    const dynamicImporter = new Function('u', 'return import(/* webpackIgnore: true */ u)') as (url: string) => Promise<VisionModule>;
    const vision = await dynamicImporter('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
    const fileset = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    poseLandmarkerRef.current = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    return poseLandmarkerRef.current;
  }

  async function startCamera() {
    setError(null);
    try {
      const pose = await loadPoseLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
        audio: false,
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      streamRef.current = stream;
      lastDetectTimestampRef.current = 0;
      setIsCameraRunning(true);
      runDetectionLoop(pose);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start camera');
    }
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    clearCanvas(canvasRef.current);
    lastDetectTimestampRef.current = 0;
    setIsCameraRunning(false);
  }

  const saveBaseline = useCallback(async (reps: RepData[]) => {
    if (!userId) { setError('Login required to save baseline.'); return; }
    setIsSaving(true);
    const avgAngle = reps.reduce((s, r) => s + r.angle, 0) / reps.length;
    const avgTorso = reps.reduce((s, r) => s + r.torso, 0) / reps.length;
    const avgSymmetry = reps.reduce((s, r) => s + r.symmetry, 0) / reps.length;

    const baseline: MovementBaseline = {
      squat: {
        avgBottomAngleDeg: Math.round(avgAngle * 10) / 10,
        avgTorsoLeanDeg: Math.round(avgTorso * 10) / 10,
        symmetryScore: Math.round(avgSymmetry * 100),
        repsRecorded: reps.length,
      },
      overheadReach: {
        leftShoulderFlexion: 170,
        rightShoulderFlexion: 170,
        mobilityScore: 100,
      },
      recordedAt: new Date().toISOString(),
    };

    try {
      await saveMovementBaseline(userId, baseline);
      router.push('/onboarding/equipment');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save baseline');
      setIsSaving(false);
    }
  }, [userId, router]);

  function runDetectionLoop(pose: PoseLandmarkerLike) {
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      resizeCanvasToVideo(canvas, video);
      try {
        const candidateTs = performance.now();
        const frameTsMs = Math.max(candidateTs, lastDetectTimestampRef.current + 0.001);
        lastDetectTimestampRef.current = frameTsMs;

        const normalized = adaptPoseLandmarkerResult(pose.detectForVideo(video, frameTsMs), frameTsMs);
        const calibration = calibrationGateRef.current.update(normalized);
        const output = engineRef.current.update(normalized, calibration);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const exerciseConfig = getExerciseConfig('squat');
          const displayAngle = output.metrics.smoothedKneeAngle ?? output.metrics.kneeAngle ?? 180;
          drawPoseOverlay(ctx, normalized.landmarks, {
            anglePoint: exerciseConfig.anglePoint,
            currentAngle: displayAngle,
            formIssues: output.issues ?? [],
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            mirrored: false,
          });
        }

        const currentPhase = output.state.phase;
        const currentRepCount = output.state.repCount;
        const smoothedAngle = output.metrics.smoothedKneeAngle ?? output.metrics.kneeAngle ?? 180;
        const torsoLean = output.metrics.torsoLeanDeg ?? 0;
        const kneeRatio = output.metrics.kneeOutRatio ?? 1;

        // Track minimum angle for this rep
        if (smoothedAngle < minAngleThisRepRef.current) {
          minAngleThisRepRef.current = smoothedAngle;
          torsoAtMinRef.current = torsoLean;
          symmetryAtMinRef.current = kneeRatio;
        }

        // Detect new rep completion
        if (currentRepCount > prevRepCountRef.current) {
          const repAngle = minAngleThisRepRef.current === Infinity ? smoothedAngle : minAngleThisRepRef.current;
          repDataRef.current.push({
            angle: repAngle,
            torso: torsoAtMinRef.current,
            symmetry: symmetryAtMinRef.current,
          });
          minAngleThisRepRef.current = Infinity;
          prevRepCountRef.current = currentRepCount;

          if (currentRepCount >= TARGET_REPS) {
            stopCamera();
            const collected = [...repDataRef.current];
            setSavedReps(collected.length);
            void saveBaseline(collected);
            return;
          }
        }

        setRepCount(currentRepCount);
        setPhase(currentPhase);
        setCue(output.primaryCue);
        rafRef.current = requestAnimationFrame(tick);
      } catch (detectError) {
        setError(detectError instanceof Error ? detectError.message : 'Pose detection failed.');
        stopCamera();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const progressPct = Math.min(100, (repCount / TARGET_REPS) * 100);

  if (isSaving) {
    return (
      <div className="onboarding-page">
        <div className="onboarding-card">
          <h2 className="onboarding-title">Analyzing your movement...</h2>
          <p className="onboarding-subtitle">{savedReps} squat{savedReps !== 1 ? 's' : ''} recorded. Saving baseline.</p>
          <div className="onboarding-progress-bar-wrap">
            <div className="onboarding-progress-bar" style={{ width: '100%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <h1 className="onboarding-title">Movement Screen</h1>
        <p className="onboarding-subtitle">
          Perform {TARGET_REPS} bodyweight squats so we can calibrate your program to your mobility.
          Stand sideways to the camera for best results.
        </p>

        <div className="camera-preview-wrap" style={{ marginBottom: 16 }}>
          <div className="camera-preview" style={{ maxWidth: 480, margin: '0 auto' }}>
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />

            {isCameraRunning && (
              <div className={`cam-hud cam-hud-status${isCalibrated ? ' cam-hud-ready' : ' cam-hud-warn'}`}>
                {isCalibrated
                  ? <><CheckCircle2 size={14} strokeWidth={1.5} /> Calibrated — ready</>
                  : <><AlertCircle size={14} strokeWidth={1.5} /> Stand in frame · hold still</>
                }
              </div>
            )}

            {isCameraRunning && (
              <div className="cam-hud cam-hud-bottom">
                <div className="cam-stats-row">
                  <div className="cam-stat cam-stat-lime">
                    <span className="cam-stat-val font-tabular">{repCount}</span>
                    <span className="cam-stat-lbl">Reps</span>
                  </div>
                  <div className="cam-stat">
                    <span className="cam-stat-val">{phase.replace('_', ' ')}</span>
                    <span className="cam-stat-lbl">Phase</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 4 }}>
            <span>Squats recorded</span>
            <span>{repCount} / {TARGET_REPS}</span>
          </div>
          <div className="onboarding-progress-bar-wrap">
            <div className="onboarding-progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {isCameraRunning && (
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: 12, textAlign: 'center' }}>{cue}</p>
        )}

        {error && (
          <p style={{ color: 'var(--color-warn)', fontSize: '0.85rem', marginBottom: 8 }}>{error}</p>
        )}

        {!isCameraRunning ? (
          <button type="button" className="btn btn-primary btn-full" onClick={startCamera}>
            Start Camera
          </button>
        ) : (
          <button type="button" className="cam-main-btn cam-main-btn-stop" style={{ width: '100%' }} onClick={stopCamera}>
            Stop
          </button>
        )}

        <button
          type="button"
          style={{ marginTop: 10, width: '100%', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', padding: '6px 0' }}
          onClick={() => router.push('/onboarding/equipment')}
        >
          Skip movement screen
        </button>
      </div>
    </div>
  );
}
