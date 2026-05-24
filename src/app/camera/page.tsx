'use client';

import { Suspense, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { clearCanvas, drawPoseOverlay, resizeCanvasToVideo } from '@/lib/pose/draw';
import type { MediaPipePoseResultLike } from '@/features/pose/pose-types';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { saveWorkoutSession } from '@/lib/workouts/sessions';
import { computeSessionScore } from '@/lib/workouts/analysis';
import type { SessionScore } from '@/lib/workouts/types';
import { adaptPoseLandmarkerResult } from '@/features/pose/pose-landmarker-adapter';
import { CalibrationGate } from '@/features/form-engine/calibration-gate';
import { DEFAULT_SQUAT_ENGINE_CONFIG } from '@/features/form-engine/engines/squat-engine';
import { createWorkoutSessionState, resetWorkoutSessionState } from '@/features/workout/workout-session-store';
import {
  workoutPlanReducer,
  makeInitialPlanState,
  aggregateSetResults,
  type WorkoutPlanConfig,
} from '@/features/workout/workout-plan-store';
import { getEngine, EXERCISE_IDS } from '@/features/form-engine/engine-factory';
import { getExerciseConfig } from '@/features/form-engine/exercise-config';
import type { ExerciseFormEngine, FeedbackCue } from '@/features/form-engine/form-engine';
import { SessionSummaryPanel } from '@/components/ui/SessionSummaryPanel';
import { ExerciseInfoCard } from '@/components/ui/ExerciseInfoCard';
import { WorkoutConfigPanel } from '@/components/ui/WorkoutConfigPanel';
import { RestTimer } from '@/components/ui/RestTimer';
import { Play, Flag, Camera, CameraOff, CheckCircle2, Circle, ChevronRight, Minus, Plus } from 'lucide-react';
import PRBadge from '@/components/ui/PRBadge';
import { SessionSidePanel } from '@/components/ui/SessionSidePanel';
import type { PRCheckResult } from '@/lib/workouts/records';
import { useSpeechCue } from '@/features/pose/use-speech-cue';

type PoseLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => MediaPipePoseResultLike;
};

type VisionModule = {
  FilesetResolver: { forVisionTasks: (wasmRoot: string) => Promise<unknown> };
  PoseLandmarker: {
    createFromOptions: (fileset: unknown, options: Record<string, unknown>) => Promise<PoseLandmarkerLike>;
  };
};

type DayExercise = { exercise_id: string; sets: number; reps: number; rest_seconds: number };
type DaySession = {
  programId: string; programSlug: string; dayIndex: number; dayLabel: string;
  exercises: DayExercise[];
};


const DEFAULT_CONFIG: WorkoutPlanConfig = {
  exerciseId: 'squat',
  targetSets: 3,
  targetReps: 10,
  restSeconds: 60,
};

function CameraPageInner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const sessionRef = useRef(createWorkoutSessionState());
  const lastDetectTimestampRef = useRef(0);
  const engineRef = useRef<ExerciseFormEngine>(getEngine('squat'));

  const searchParams = useSearchParams();

  const programContext = useMemo(() => {
    const programId = searchParams.get('programId');
    if (!programId) return null;
    return {
      programId,
      programSlug: searchParams.get('programSlug') ?? '',
      dayIndex: Number(searchParams.get('dayIndex') ?? 0),
      exerciseId: searchParams.get('exerciseId') ?? '',
      targetSets: Number(searchParams.get('targetSets') ?? 3),
      targetReps: Number(searchParams.get('targetReps') ?? 10),
      restSeconds: Number(searchParams.get('restSeconds') ?? 60),
    };
  }, [searchParams]);

  const initialConfig: WorkoutPlanConfig = useMemo(() => ({
    exerciseId: programContext?.exerciseId || 'squat',
    targetSets: programContext?.targetSets ?? DEFAULT_CONFIG.targetSets,
    targetReps: programContext?.targetReps ?? DEFAULT_CONFIG.targetReps,
    restSeconds: programContext?.restSeconds ?? DEFAULT_CONFIG.restSeconds,
  }), [programContext]);

  const exercises = useMemo(
    () => EXERCISE_IDS.slice(0, 6).map(id => ({ id, name: getExerciseConfig(id).name })),
    []
  );
  const allExercises = useMemo(
    () => EXERCISE_IDS.map(id => ({ id, name: getExerciseConfig(id).name })),
    []
  );

  const [planState, dispatch] = useReducer(workoutPlanReducer, makeInitialPlanState(initialConfig));
  // Mirror setResults into a ref so the auto-save effect always reads the
  // latest value without depending on React's closure timing.
  const setResultsRef = useRef(planState.setResults);
  setResultsRef.current = planState.setResults;

  const [daySession, setDaySession] = useState<DaySession | null>(null);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [completedExSets, setCompletedExSets] = useState<number[]>([]);
  const [useCameraMode, setUseCameraMode] = useState(true);
  const [manualReps, setManualReps] = useState(0);
  const currentExIdxRef = useRef(currentExIdx);
  currentExIdxRef.current = currentExIdx;
  const daySessionRef = useRef<DaySession | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState('squat');
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState('NOT_READY');
  const [cue, setCue] = useState('Press Start to begin');
  const [secondaryCue, setSecondaryCue] = useState('');
  const [primaryAngle, setPrimaryAngle] = useState(180);
  const [leftAngle, setLeftAngle] = useState(180);
  const [rightAngle, setRightAngle] = useState(180);
  const [isUnilateral, setIsUnilateral] = useState(false);
  const [leftRepCount, setLeftRepCount] = useState(0);
  const [rightRepCount, setRightRepCount] = useState(0);
  const [topCues, setTopCues] = useState<FeedbackCue[]>([]);
  const [sessionScore, setSessionScore] = useState<SessionScore | null>(null);
  const [prResult, setPrResult] = useState<PRCheckResult | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceRate] = useState(1.0);
  const voiceEnabledRef = useRef(true);
  voiceEnabledRef.current = voiceEnabled;
  const [showInfoCard, setShowInfoCard] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartWallMsRef = useRef<number>(0);
  const planStartWallMsRef = useRef<number>(0);
  const { speakCue, cancelCue, resetCues } = useSpeechCue(5000);

  const calibrationGateRef = useRef(
    new CalibrationGate({
      minVisibility: DEFAULT_SQUAT_ENGINE_CONFIG.confidence.minVisibility,
      requiredStableFrames: 12,
      maxMotionPerFrame: 0.015,
      minShoulderHipHeightDelta: 0.04,
      orientation: 'front',
      calibrationMode: 'standing',
      calibrationLandmarks: [23, 24, 25, 26, 27, 28, 11, 12],
    })
  );

  const isCalibrated = phase !== 'NOT_READY' && phase !== 'CALIBRATING';
  const isMultiSet = planState.config.targetSets > 1;
  const isPlanActive = planState.phase === 'active' || planState.phase === 'resting';

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
    })();
    // Read day session from sessionStorage
    try {
      const raw = sessionStorage.getItem('workout_day_session');
      if (raw) {
        const ds = JSON.parse(raw) as DaySession;
        setDaySession(ds);
        daySessionRef.current = ds;
        setCompletedExSets(new Array(ds.exercises.length).fill(0));
      }
    } catch { /* ignore */ }
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (programContext?.exerciseId) {
      setSelectedExercise(programContext.exerciseId);
    }
  }, [programContext]);

  // Auto-save when plan reaches 'complete'.
  useEffect(() => {
    if (planState.phase !== 'complete' || setResultsRef.current.length === 0) return;
    const ds = daySessionRef.current;
    const exIdx = currentExIdxRef.current;
    const isLast = !ds || exIdx >= ds.exercises.length - 1;
    doSaveAndAdvance(setResultsRef.current, isLast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planState.phase]);

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

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function startTimer() {
    if (timerIntervalRef.current) return;
    setTimerRunning(true);
    timerIntervalRef.current = setInterval(() => setTimerElapsed(e => e + 1), 1000);
  }

  function pauseTimer() {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerRunning(false);
  }

  function resetTimer() {
    pauseTimer();
    setTimerElapsed(0);
  }

  async function startCamera() {
    setError(null);
    setIsCameraLoading(true);
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
      sessionStartWallMsRef.current = Date.now();
      if (!isPlanActive) {
        planStartWallMsRef.current = Date.now();
        dispatch({ type: 'START' });
      }
      setIsCameraRunning(true);
      startTimer();
      runDetectionLoop(pose);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start camera');
    } finally {
      setIsCameraLoading(false);
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
    cancelCue();
    clearCanvas(canvasRef.current);
    lastDetectTimestampRef.current = 0;
    pauseTimer();
    setIsCameraRunning(false);
  }

  function handleExerciseChange(exerciseId: string) {
    engineRef.current.reset();
    engineRef.current = getEngine(exerciseId);
    const exConfig = getExerciseConfig(exerciseId);
    calibrationGateRef.current = new CalibrationGate({
      minVisibility: DEFAULT_SQUAT_ENGINE_CONFIG.confidence.minVisibility,
      requiredStableFrames: 12,
      maxMotionPerFrame: 0.015,
      minShoulderHipHeightDelta: 0.04,
      orientation: exConfig.cameraAngle === 'front' ? 'front' : exConfig.cameraAngle === 'side' ? 'side' : 'auto',
      calibrationMode: exConfig.calibrationMode ?? 'standing',
      calibrationLandmarks: exConfig.calibrationLandmarks ?? [11, 12, 23, 24, 25, 26, 27, 28],
    });
    resetCues();
    setSelectedExercise(exerciseId);
    dispatch({ type: 'UPDATE_CONFIG', config: { exerciseId } });
    setRepCount(0);
    setLeftRepCount(0);
    setRightRepCount(0);
    setPhase('READY');
    setPrimaryAngle(180);
    setLeftAngle(180);
    setRightAngle(180);
    setIsUnilateral(getExerciseConfig(exerciseId).isUnilateral);
    setCue('Exercise changed. Stand upright and hold still to calibrate.');
    setShowInfoCard(true);
    setSecondaryCue('');
    setTopCues([]);
    setSessionScore(null);
    setSaveMessage('');
    resetWorkoutSessionState(sessionRef.current);
  }

  function resetSession() {
    engineRef.current.reset();
    calibrationGateRef.current.reset();
    resetCues();
    resetWorkoutSessionState(sessionRef.current);
    dispatch({ type: 'RESET' });
    setRepCount(0);
    setLeftRepCount(0);
    setRightRepCount(0);
    setPhase('NOT_READY');
    setPrimaryAngle(180);
    setLeftAngle(180);
    setRightAngle(180);
    setCue('Session reset. Stand upright and hold still to calibrate.');
    setSecondaryCue('');
    setTopCues([]);
    setSessionScore(null);
    setSaveMessage('');
    resetTimer();
    sessionStartWallMsRef.current = Date.now();
    planStartWallMsRef.current = Date.now();
  }

  function getCurrentFormScore(): number {
    const output = sessionRef.current.output;
    if (!output) return 0;
    const scores = output.repScores ?? [];
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((sum, r) => sum + r.overall, 0) / scores.length);
  }

  function handleCompleteSet() {
    const output = sessionRef.current.output;
    const totalReps = output ? (output.repCount ?? output.state.repCount) : 0;
    const formScore = getCurrentFormScore();
    dispatch({ type: 'COMPLETE_SET', repCount: totalReps, formScore });
    resetWorkoutSessionState(sessionRef.current);
    sessionStartWallMsRef.current = Date.now();
    setRepCount(0);
    setLeftRepCount(0);
    setRightRepCount(0);
    setSaveMessage('');
  }

  async function doSaveAndAdvance(setResults: typeof planState.setResults, isLast: boolean) {
    if (!userId) { setSaveMessage('Login required to save.'); return; }
    if (setResults.length === 0) return;
    const durationMs = planStartWallMsRef.current > 0 ? Date.now() - planStartWallMsRef.current : 0;
    const score = aggregateSetResults(selectedExercise, setResults, durationMs);
    const ds = daySessionRef.current;
    const exIdx = currentExIdxRef.current;
    const { error: saveError, prResult: pr } = await saveWorkoutSession(userId, selectedExercise, score.repCount, score, {
      programId: ds?.programId ?? programContext?.programId,
      // Only pass dayIndex on last exercise so progress counter increments once per day
      dayIndex: isLast ? (ds?.dayIndex ?? programContext?.dayIndex) : undefined,
      setResults,
    });
    if (saveError) { setSaveMessage(saveError.message); return; }
    if (pr) setPrResult(pr);
    setSaveMessage('');

    if (isLast) {
      setSessionScore(score);
      stopCamera();
    } else if (ds) {
      const nextIdx = exIdx + 1;
      const nextEx = ds.exercises[nextIdx];
      // Record completed sets for this exercise
      setCompletedExSets(prev => {
        const copy = [...prev];
        copy[exIdx] = planState.config.targetSets;
        return copy;
      });
      setCurrentExIdx(nextIdx);
      currentExIdxRef.current = nextIdx;
      setManualReps(0);
      // Reset plan and advance exercise
      dispatch({ type: 'RESET' });
      handleExerciseChange(nextEx.exercise_id);
      dispatch({ type: 'UPDATE_CONFIG', config: { targetSets: nextEx.sets, targetReps: nextEx.reps, restSeconds: nextEx.rest_seconds } });
      if (isCameraRunning) dispatch({ type: 'START' });
      planStartWallMsRef.current = Date.now();
    }
  }

  async function doSaveMultiSetSession(setResults: typeof planState.setResults) {
    const ds = daySessionRef.current;
    const isLast = !ds || currentExIdxRef.current >= ds.exercises.length - 1;
    await doSaveAndAdvance(setResults, isLast);
  }

  async function handleSaveSession() {
    if (isMultiSet && setResultsRef.current.length > 0) {
      await doSaveMultiSetSession(setResultsRef.current);
      return;
    }
    if (!userId || !sessionRef.current.output) {
      setSaveMessage('Login and run at least one rep before saving.');
      return;
    }
    const output = sessionRef.current.output;
    const totalReps = output.repCount ?? output.state.repCount;
    if (totalReps === 0) { setSaveMessage('Complete at least one rep before saving.'); return; }
    const repScores = output.repScores ?? [];
    const durationMs = sessionStartWallMsRef.current > 0 ? Date.now() - sessionStartWallMsRef.current : 0;
    const score = computeSessionScore(selectedExercise, repScores, durationMs);
    const { error: saveError, prResult: pr } = await saveWorkoutSession(userId, selectedExercise, totalReps, score, {
      programId: programContext?.programId,
      dayIndex: programContext?.dayIndex,
    });
    if (saveError) { setSaveMessage(saveError.message); return; }
    setSessionScore(score);
    if (pr) setPrResult(pr);
    setSaveMessage('');
  }

  function handleRestComplete() {
    dispatch({ type: 'SKIP_REST' });
  }

  function handleSkipRest() {
    dispatch({ type: 'SKIP_REST' });
  }

  function handleTurnOffCamera() {
    stopCamera();
    resetSession();
  }

  function handleManualCompleteSet() {
    dispatch({ type: 'COMPLETE_SET', repCount: manualReps, formScore: 0 });
    setManualReps(0);
  }

  function handleSummaryDone() {
    const ds = daySessionRef.current;
    if (ds?.programSlug) {
      sessionStorage.removeItem('workout_day_session');
      router.push(`/programs/${ds.programSlug}`);
    } else {
      setSessionScore(null);
    }
  }

  function handleAnotherSet() {
    setSessionScore(null);
    resetSession();
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
      try {
        const candidateTs = performance.now();
        const frameTsMs = Math.max(candidateTs, lastDetectTimestampRef.current + 0.001);
        lastDetectTimestampRef.current = frameTsMs;
        const normalized = adaptPoseLandmarkerResult(pose.detectForVideo(video, frameTsMs), frameTsMs);
        const calibration = calibrationGateRef.current.update(normalized);
        const output = engineRef.current.update(normalized, calibration);
        sessionRef.current.calibration = calibration;
        sessionRef.current.output = output;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const exerciseConfig = getExerciseConfig(engineRef.current.id);
          const displayAngle = output.primaryAngle ?? output.metrics.smoothedKneeAngle ?? output.metrics.kneeAngle ?? 180;
          drawPoseOverlay(ctx, normalized.landmarks, {
            anglePoint: exerciseConfig.anglePoint,
            currentAngle: displayAngle,
            formIssues: output.formIssues ?? [],
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            mirrored: false,
          });
        }
        setRepCount(output.repCount ?? output.state.repCount);
        setPhase(output.phase ?? output.state.phase);
        setCue(output.primaryCue);
        setSecondaryCue(output.secondaryCue ?? '');
        setPrimaryAngle(Math.round(output.primaryAngle ?? output.metrics.smoothedKneeAngle ?? output.metrics.kneeAngle ?? 180));
        setLeftAngle(Math.round(output.leftAngle));
        setRightAngle(Math.round(output.rightAngle));
        setIsUnilateral(output.isUnilateral);
        setLeftRepCount(output.leftRepCount);
        setRightRepCount(output.rightRepCount);
        const cues = output.topCues ?? [];
        setTopCues(cues);
        cues.forEach(c => speakCue(c.voiceText, voiceEnabledRef.current, { rate: voiceRate }));
        rafRef.current = requestAnimationFrame(tick);
      } catch (detectError) {
        setError(detectError instanceof Error ? detectError.message : 'Pose detection failed.');
        stopCamera();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const exerciseName = getExerciseConfig(selectedExercise).name;

  const activeDay = daySession ?? (programContext ? {
    programId: programContext.programId, programSlug: programContext.programSlug,
    dayIndex: programContext.dayIndex, dayLabel: `Day ${programContext.dayIndex + 1}`,
    exercises: [{ exercise_id: programContext.exerciseId, sets: programContext.targetSets, reps: programContext.targetReps, rest_seconds: programContext.restSeconds }],
  } : null);

  return (
    <div className="camera-page-root">

      <div className="camera-page-layout">
        {/* ── Camera column ── */}
        <div className="camera-col-left">
          <div className="camera-preview-wrap">
            <div className="camera-preview">
              <video ref={videoRef} playsInline muted style={{ display: useCameraMode && isCameraRunning ? undefined : 'none' }} />
              <canvas ref={canvasRef} style={{ display: useCameraMode && isCameraRunning ? undefined : 'none' }} />
              {useCameraMode && !isCameraRunning && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 16,
                  background: 'var(--bg-page)',
                }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'var(--bg-card-raised)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CameraOff size={28} color="var(--text-muted)" strokeWidth={1.5} />
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Camera is off</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={startCamera}
                    disabled={isCameraLoading}
                    style={{ gap: 8, paddingLeft: 20, paddingRight: 20 }}
                  >
                    <Camera size={16} strokeWidth={2} />
                    {isCameraLoading ? 'Starting…' : 'Turn on camera'}
                  </button>
                </div>
              )}
              {!useCameraMode && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 20,
                  background: 'var(--bg-card)',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                      {(activeDay?.exercises[currentExIdx]?.exercise_id ?? selectedExercise).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </p>
                    <div style={{ fontSize: 72, fontWeight: 800, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                      {manualReps}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                      reps / {activeDay?.exercises[currentExIdx]?.reps ?? planState.config.targetReps}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" onClick={() => setManualReps(r => Math.max(0, r - 1))}
                      style={{ width: 52, height: 52, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Minus size={22} />
                    </button>
                    <button type="button" onClick={() => setManualReps(r => r + 1)}
                      style={{ width: 52, height: 52, borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--text-on-lime)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={22} />
                    </button>
                  </div>
                  <button type="button" onClick={handleManualCompleteSet}
                    disabled={planState.phase === 'resting' || planState.phase === 'complete'}
                    className="btn btn-primary"
                    style={{ minWidth: 160 }}>
                    <Flag size={15} /> Complete Set {planState.currentSet} / {planState.config.targetSets}
                  </button>
                </div>
              )}
              {prResult && <PRBadge result={prResult} />}

              {/* Exercise picker + Turn Off Camera */}
              <div className="cam-hud cam-hud-exercise">
                <select
                  value={selectedExercise}
                  onChange={e => handleExerciseChange(e.target.value)}
                  className="cam-exercise-pill"
                  style={{ maxWidth: 160, width: 'fit-content' }}
                >
                  {EXERCISE_IDS.map(id => (
                    <option key={id} value={id}>{getExerciseConfig(id).name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={isCameraRunning ? handleTurnOffCamera : startCamera}
                  aria-label={isCameraRunning ? 'Turn off camera' : 'Turn on camera'}
                  style={{ height: 42, padding: '0 14px', flexShrink: 0, borderRadius: 11, background: 'rgba(16,16,16,0.84)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: `1px solid ${isCameraRunning ? 'rgba(255,255,255,0.1)' : 'rgba(213,255,95,0.35)'}`, color: isCameraRunning ? undefined : 'var(--accent)' }}
                >
                  {isCameraRunning ? <CameraOff size={16} strokeWidth={1.5} /> : <Camera size={16} strokeWidth={1.5} />}
                </button>
              </div>

              {/* Set badge */}
              {isMultiSet && isPlanActive && (
                <div className="set-badge">
                  Set {planState.currentSet} / {planState.config.targetSets}
                </div>
              )}

              {/* Bottom HUD — calibration status + stats + timer */}
              {isCameraRunning && (
                <div className="cam-hud cam-hud-bottom">
                  <div className={`cam-hud-cue-row${isCalibrated ? ' cam-hud-ready' : ' cam-hud-warn'}`}>
                    {cue}
                  </div>
                  <div className="cam-stats-row">
                    {isUnilateral ? (
                      <>
                        <div className="cam-stat"><span className="cam-stat-val font-tabular">{leftRepCount}</span><span className="cam-stat-lbl">Left</span></div>
                        <div className="cam-stat cam-stat-lime"><span className="cam-stat-val font-tabular">{repCount}</span><span className="cam-stat-lbl">Total</span></div>
                        <div className="cam-stat"><span className="cam-stat-val font-tabular">{rightRepCount}</span><span className="cam-stat-lbl">Right</span></div>
                        <div className="cam-stat"><span className="cam-stat-val font-tabular">{formatTime(timerElapsed)}</span><span className="cam-stat-lbl">Time</span></div>
                      </>
                    ) : (
                      <>
                        <div className="cam-stat cam-stat-lime"><span className="cam-stat-val font-tabular">{repCount}</span><span className="cam-stat-lbl">Reps</span></div>
                        <div className="cam-stat"><span className="cam-stat-val font-tabular">{primaryAngle}°</span><span className="cam-stat-lbl">Angle</span></div>
                        <div className="cam-stat"><span className="cam-stat-val">{phase.replace('_', ' ')}</span><span className="cam-stat-lbl">Phase</span></div>
                        <div className="cam-stat"><span className="cam-stat-val font-tabular">{formatTime(timerElapsed)}</span><span className="cam-stat-lbl">Time</span></div>
                      </>
                    )}
                  </div>
                  {isUnilateral && (
                    <div className="cam-stats-row">
                      <div className="cam-stat"><span className="cam-stat-val font-tabular">{leftAngle}°</span><span className="cam-stat-lbl">L Angle</span></div>
                      <div className="cam-stat"><span className="cam-stat-val font-tabular">{rightAngle}°</span><span className="cam-stat-lbl">R Angle</span></div>
                      <div className="cam-stat"><span className="cam-stat-val">{phase.replace('_', ' ')}</span><span className="cam-stat-lbl">Phase</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column: data panel ── */}
        <div className="camera-col-right">

          {/* Workout day panel */}
          {activeDay && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '14px 16px', marginBottom: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 2px' }}>
                    Program Workout
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {activeDay.dayLabel}
                  </p>
                </div>
                {/* Camera / Manual toggle */}
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', borderRadius: 8, padding: 3 }}>
                  {(['camera', 'manual'] as const).map(mode => (
                    <button key={mode} type="button"
                      onClick={() => { setUseCameraMode(mode === 'camera'); if (mode === 'camera' && !isCameraRunning) {} else if (mode === 'manual') stopCamera(); }}
                      style={{
                        padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: (mode === 'camera') === useCameraMode ? 'var(--bg-card-raised)' : 'transparent',
                        color: (mode === 'camera') === useCameraMode ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                        textTransform: 'capitalize', transition: 'all 0.15s',
                      }}>
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exercise list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeDay.exercises.map((ex, i) => {
                  const isCurrent = i === currentExIdx;
                  const isDone = completedExSets[i] >= ex.sets || i < currentExIdx;
                  const setsCompleted = i < currentExIdx ? ex.sets : i === currentExIdx ? planState.setResults.length : 0;
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 10,
                      background: isCurrent ? 'var(--accent-muted)' : 'transparent',
                      border: isCurrent ? '1px solid var(--border-active)' : '1px solid transparent',
                      transition: 'all 0.2s',
                    }}>
                      <div style={{ flexShrink: 0 }}>
                        {isDone
                          ? <CheckCircle2 size={16} color="var(--accent)" />
                          : isCurrent
                            ? <ChevronRight size={16} color="var(--accent)" />
                            : <Circle size={16} color="var(--text-muted)" />
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ex.exercise_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </p>
                        {/* Set progress dots */}
                        <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                          {Array.from({ length: ex.sets }, (_, si) => (
                            <div key={si} style={{
                              width: si < setsCompleted ? 14 : 8, height: 4, borderRadius: 2,
                              background: si < setsCompleted ? 'var(--accent)' : 'var(--border)',
                              transition: 'all 0.2s',
                            }} />
                          ))}
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4, lineHeight: '4px', alignSelf: 'center' }}>
                            {setsCompleted}/{ex.sets} · {ex.reps} reps
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="cam-control-panel">

            {planState.phase === 'resting' && (
              <RestTimer
                durationSeconds={planState.config.restSeconds}
                onComplete={handleRestComplete}
                onSkip={handleSkipRest}
              />
            )}

            {planState.phase !== 'resting' && (
              <>
                {planState.phase === 'idle' && (
                  <>
                    {useCameraMode ? (
                      <button type="button" className="btn btn-primary btn-full" onClick={startCamera} disabled={isCameraLoading} style={{ marginBottom: 4 }}>
                        <Play size={18} strokeWidth={2} /> {isCameraLoading ? 'Starting…' : 'Start Camera'}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary btn-full" onClick={() => { dispatch({ type: 'START' }); }} style={{ marginBottom: 4 }}>
                        <Play size={18} strokeWidth={2} /> Start Workout
                      </button>
                    )}
                    {!activeDay && (
                      <WorkoutConfigPanel
                        config={{ targetSets: planState.config.targetSets, targetReps: planState.config.targetReps, restSeconds: planState.config.restSeconds }}
                        onChange={cfg => dispatch({ type: 'UPDATE_CONFIG', config: cfg })}
                      />
                    )}
                  </>
                )}

                {isMultiSet && useCameraMode && isCameraRunning && planState.phase === 'active' && (
                  <button type="button" className="btn btn-primary btn-full" onClick={handleCompleteSet} style={{ marginBottom: 4 }}>
                    <Flag size={16} strokeWidth={2} />
                    Complete Set {planState.currentSet}
                  </button>
                )}

                {error && (
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-warn)', margin: '0 0 8px' }}>
                    {error}
                  </p>
                )}

                <SessionSidePanel
                  exercises={exercises}
                  allExercises={allExercises}
                  selectedExercise={selectedExercise}
                  onExerciseChange={handleExerciseChange}
                  formScore={getCurrentFormScore()}
                  topCues={topCues}
                  primaryCue={cue}
                  voiceEnabled={voiceEnabled}
                  onVoiceToggle={() => setVoiceEnabled(v => !v)}
                  onSave={handleSaveSession}
                  isCameraRunning={isCameraRunning}
                />

                {saveMessage && <p className="cam-save-msg">{saveMessage}</p>}

                {showInfoCard && (
                  <ExerciseInfoCard exerciseId={selectedExercise} onStart={() => setShowInfoCard(false)} />
                )}

                {sessionScore && (
                  <SessionSummaryPanel
                    sessionScore={sessionScore}
                    exerciseName={exerciseName}
                    onDone={handleSummaryDone}
                    onAnotherSet={handleAnotherSet}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense>
      <CameraPageInner />
    </Suspense>
  );
}
