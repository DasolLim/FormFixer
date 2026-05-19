'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { Play, Square, RotateCcw, Save, Pause, Flag } from 'lucide-react';
import PRBadge from '@/components/ui/PRBadge';
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

function cueColor(severity: string): string {
  if (severity === 'error')    return 'var(--color-warn)';
  if (severity === 'positive') return 'var(--color-good)';
  return 'var(--color-neutral)';
}

function cueDotColor(severity: string): string {
  return severity === 'positive' ? '#D5FF5F' : '#FF6B6B';
}

const DEFAULT_CONFIG: WorkoutPlanConfig = {
  exerciseId: 'squat',
  targetSets: 3,
  targetReps: 10,
  restSeconds: 60,
};

export default function CameraPage() {
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

  const [planState, dispatch] = useReducer(workoutPlanReducer, makeInitialPlanState(initialConfig));
  // Mirror setResults into a ref so the auto-save effect always reads the
  // latest value without depending on React's closure timing.
  const setResultsRef = useRef(planState.setResults);
  setResultsRef.current = planState.setResults;

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
  const [showInfoCard, setShowInfoCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartWallMsRef = useRef<number>(0);
  const planStartWallMsRef = useRef<number>(0);
  const { speakCue, cancelCue } = useSpeechCue(5000);

  const calibrationGateRef = useRef(
    new CalibrationGate({
      minVisibility: DEFAULT_SQUAT_ENGINE_CONFIG.confidence.minVisibility,
      requiredStableFrames: 12,
      maxMotionPerFrame: 0.015,
      minShoulderHipHeightDelta: 0.04,
      orientation: 'auto',
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
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (programContext?.exerciseId) {
      setSelectedExercise(programContext.exerciseId);
    }
  }, [programContext]);

  // Auto-save when plan reaches 'complete'. Read setResults from the ref so
  // we always get the value written in the same synchronous batch as the dispatch.
  useEffect(() => {
    if (planState.phase === 'complete' && setResultsRef.current.length > 0) {
      doSaveMultiSetSession(setResultsRef.current);
    }
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
    calibrationGateRef.current.reset();
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

  async function doSaveMultiSetSession(setResults: typeof planState.setResults) {
    if (!userId) { setSaveMessage('Login required to save.'); return; }
    if (setResults.length === 0) { setSaveMessage('Complete at least one set before saving.'); return; }
    const durationMs = planStartWallMsRef.current > 0 ? Date.now() - planStartWallMsRef.current : 0;
    const score = aggregateSetResults(selectedExercise, setResults, durationMs);
    console.log('[doSaveMultiSetSession] setResults:', JSON.stringify(setResults));
    console.log('[doSaveMultiSetSession] score:', JSON.stringify(score));
    const { error: saveError, prResult: pr } = await saveWorkoutSession(userId, selectedExercise, score.repCount, score, {
      programId: programContext?.programId,
      dayIndex: programContext?.dayIndex,
      setResults,
    });
    if (saveError) { setSaveMessage(saveError.message); return; }
    setSessionScore(score);
    if (pr) setPrResult(pr);
    setSaveMessage('');
    stopCamera();
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

  function handleSummaryDone() {
    setSessionScore(null);
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
        cues.forEach(c => speakCue(c.voiceText, voiceEnabled, { rate: voiceRate }));
        rafRef.current = requestAnimationFrame(tick);
      } catch (detectError) {
        setError(detectError instanceof Error ? detectError.message : 'Pose detection failed.');
        stopCamera();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const exerciseName = getExerciseConfig(selectedExercise).name;

  return (
    <div className="camera-page-root">
      {programContext && (
        <div className="program-context-banner">
          <span>Day {programContext.dayIndex + 1}</span>
          <span>{programContext.targetSets} sets × {programContext.targetReps} reps</span>
          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{programContext.exerciseId}</span>
        </div>
      )}

      <div className="camera-page-layout">
        {/* ── Camera column ── */}
        <div className="camera-col-left">
          <div className="camera-preview-wrap">
            <div className="camera-preview">
              <video ref={videoRef} playsInline muted />
              <canvas ref={canvasRef} />
              {prResult && <PRBadge result={prResult} />}

              {/* Start Camera overlay — visible only when camera is off */}
              {!isCameraRunning && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  zIndex: 10, background: 'rgba(0,0,0,0.45)',
                }}>
                  <button type="button" className="cam-main-btn cam-main-btn-start" onClick={startCamera}
                    style={{ width: 'auto', padding: '12px 28px' }}>
                    <Play size={18} strokeWidth={2} /> Start Camera
                  </button>
                </div>
              )}

              {/* Exercise picker + LIVE badge */}
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
                {isCameraRunning && (
                  <div className="cam-live-badge">
                    <span className="cam-live-dot" />
                    LIVE
                  </div>
                )}
              </div>

              {/* Set badge */}
              {isMultiSet && isPlanActive && (
                <div className="set-badge">
                  Set {planState.currentSet} / {planState.config.targetSets}
                </div>
              )}

              {/* Bottom HUD — stats + timer */}
              {isCameraRunning && (
                <div className="cam-hud cam-hud-bottom">
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

        {/* ── Right column: 4 always-visible cards ── */}
        <div className="camera-col-right">
          <div className="cam-control-panel">

            {/* Rest timer overlay */}
            {planState.phase === 'resting' && (
              <RestTimer
                durationSeconds={planState.config.restSeconds}
                onComplete={handleRestComplete}
                onSkip={handleSkipRest}
              />
            )}

            {planState.phase !== 'resting' && (
              <>
                {/* Card 1: Exercise & Config */}
                <div className="cam-feedback-panel">
                  <p className="cam-panel-label">Exercise</p>
                  {!isCameraRunning && planState.phase === 'idle' && (
                    <WorkoutConfigPanel
                      config={{
                        targetSets: planState.config.targetSets,
                        targetReps: planState.config.targetReps,
                        restSeconds: planState.config.restSeconds,
                      }}
                      onChange={cfg => dispatch({ type: 'UPDATE_CONFIG', config: cfg })}
                    />
                  )}
                  {isMultiSet && isCameraRunning && planState.phase === 'active' && (
                    <button type="button" className="cam-main-btn"
                      style={{ background: 'var(--accent)', color: 'var(--text-on-lime)', marginTop: 8 }}
                      onClick={handleCompleteSet}>
                      <Flag size={16} strokeWidth={2} />
                      Complete Set {planState.currentSet}
                    </button>
                  )}
                </div>

                {/* Card 2: Form Feedback (always visible) */}
                <div className="cam-feedback-panel">
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                    Form feedback
                  </p>
                  {error ? (
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#FF6B6B', margin: 0 }}>{error}</p>
                  ) : topCues.length === 0 ? (
                    <div className="feedback-cue-wrap">
                      <p className="feedback-cue-text">{cue}</p>
                      {secondaryCue && <p className="feedback-cue-secondary">{secondaryCue}</p>}
                    </div>
                  ) : (
                    <div className="feedback-cue-list">
                      {topCues.map((c, i) => (
                        <div key={i} className="feedback-cue-item">
                          <span className="feedback-cue-dot" style={{ background: cueDotColor(c.severity) }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                              {c.text}
                            </span>
                            {c.voiceText && c.voiceText !== c.text && (
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                                {c.voiceText}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card 3: Timer */}
                <div className="cam-feedback-panel">
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>Timer</p>
                  <p style={{
                    fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                    margin: '0 0 10px', lineHeight: 1,
                    color: timerRunning ? 'var(--accent)' : 'var(--text-secondary)',
                  }}>
                    {formatTime(timerElapsed)}
                  </p>
                  {/* Stopped — never started */}
                  {!timerRunning && timerElapsed === 0 && (
                    <button type="button" className="cam-main-btn cam-main-btn-start" onClick={startTimer}>
                      <Play size={16} strokeWidth={2} /> Start
                    </button>
                  )}
                  {/* Running */}
                  {timerRunning && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="cam-ctrl-btn" onClick={pauseTimer}>
                        <Pause size={14} strokeWidth={1.5} /> Pause
                      </button>
                      <button type="button" className="cam-ctrl-btn"
                        style={{ borderColor: 'rgba(255,107,107,0.4)', color: '#FF6B6B' }}
                        onClick={pauseTimer}>
                        <Square size={14} strokeWidth={1.5} /> End
                      </button>
                    </div>
                  )}
                  {/* Paused */}
                  {!timerRunning && timerElapsed > 0 && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="cam-main-btn cam-main-btn-start"
                        style={{ height: 40, fontSize: 13 }}
                        onClick={startTimer}>
                        <Play size={14} strokeWidth={2} /> Resume
                      </button>
                      <button type="button" className="cam-ctrl-btn"
                        style={{ borderColor: 'rgba(255,107,107,0.4)', color: '#FF6B6B' }}
                        onClick={resetTimer}>
                        <Square size={14} strokeWidth={1.5} /> End
                      </button>
                    </div>
                  )}
                </div>

                {/* Card 4: Voice Cues toggle */}
                <div className="cam-feedback-panel" style={{ paddingTop: 14, paddingBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Voice cues</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Spoken feedback on reps</p>
                    </div>
                    {/* Pill toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={voiceEnabled}
                      onClick={() => setVoiceEnabled(v => !v)}
                      style={{
                        position: 'relative', flexShrink: 0,
                        width: 44, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer',
                        background: voiceEnabled ? 'var(--accent)' : 'var(--bg-input)',
                        transition: 'background 0.2s ease',
                        padding: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3,
                        left: voiceEnabled ? 21 : 3,
                        width: 20, height: 20, borderRadius: '50%',
                        background: voiceEnabled ? 'var(--text-on-lime)' : 'var(--text-muted)',
                        transition: 'left 0.2s ease',
                        display: 'block',
                      }} />
                    </button>
                  </div>
                </div>

                {/* Save / Reset row */}
                <div className="cam-ctrl-row">
                  <button type="button" className="cam-ctrl-btn" onClick={resetSession}>
                    <RotateCcw size={15} strokeWidth={1.5} /> Reset
                  </button>
                  <button type="button" className="cam-ctrl-btn" onClick={handleSaveSession}>
                    <Save size={15} strokeWidth={1.5} /> Save
                  </button>
                </div>

                {saveMessage && <p className="cam-save-msg">{saveMessage}</p>}

                {/* End button */}
                {isCameraRunning && (
                  <button type="button" className="cam-main-btn cam-main-btn-stop" onClick={stopCamera} style={{ marginTop: 8 }}>
                    <Square size={18} strokeWidth={2} /> End Session
                  </button>
                )}

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
