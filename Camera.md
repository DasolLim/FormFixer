# FormFixer — Real-Time Form Correction System

Complete architecture reference for the camera-based exercise form detection engine. Covers pose detection, rep counting, form scoring, and feedback delivery for all 10 current exercises. Use this document to debug, improve, and extend the system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [MediaPipe Pose Landmark Map](#2-mediapipe-pose-landmark-map)
3. [Data Pipeline: Frame to Feedback](#3-data-pipeline-frame-to-feedback)
4. [Core Interface: ExerciseFormEngine](#4-core-interface-exerciseformengine)
5. [EngineOutput Schema](#5-engineoutput-schema)
6. [CalibrationGate](#6-calibrationgate)
7. [Rep Counting](#7-rep-counting)
8. [RepScorer: Per-Rep Scoring Formula](#8-repscorer-per-rep-scoring-formula)
9. [FeedbackPrioritizer: Cue Deduplication](#9-feedbackprioritizer-cue-deduplication)
10. [exercises.json: Data-Driven Config](#10-exercisesjson-data-driven-config)
11. [GenericExerciseEngine: The Base Class](#11-genericexerciseengine-the-base-class)
12. [All 10 Exercises: Deep Dive](#12-all-10-exercises-deep-dive)
13. [Angle Calculation Primitives](#13-angle-calculation-primitives)
14. [Known Weaknesses and Improvement Opportunities](#14-known-weaknesses-and-improvement-opportunities)
15. [How to Add a New Exercise](#15-how-to-add-a-new-exercise)

---

## 1. System Overview

The form correction system runs entirely in the browser. No video is uploaded to a server. Each frame is processed locally using MediaPipe Pose, and the detected skeleton is fed into a per-exercise engine that counts reps, checks form, and generates human-readable feedback cues.

```
Webcam frame
    ↓
MediaPipe Pose  (WASM, runs at ~30fps)
    ↓
NormalizedPoseFrame  { landmarks[], worldLandmarks[], timestampMs, hasPose }
    ↓
CalibrationGate  (is the user standing still, fully in frame, upright?)
    ↓
ExerciseFormEngine.update(frame, calibrationStatus)
    ↓
EngineOutput  { repCount, primaryCue, formIssues, topCues, repScores, ... }
    ↓
Camera UI  (rep counter, form cue overlay, per-rep score history)
```

The key design principle: **every engine is stateful and processes frames one at a time**. There is no look-back buffer; all measurements accumulate incrementally within the current rep lifecycle.

---

## 2. MediaPipe Pose Landmark Map

MediaPipe Pose returns 33 landmarks, 0-indexed. Two coordinate spaces are available:

| Space | Property | Coordinates | Use |
|---|---|---|---|
| Normalized | `frame.landmarks[i]` | x,y in [0,1] relative to image, z relative to hips | Distance in screen space |
| World | `frame.worldLandmarks[i]` | x,y,z in meters, origin at hip midpoint, y-up | Real-world angles and distances |

**Always use world landmarks for angle calculations.** Normalized landmarks distort angles when the camera is not perpendicular to the movement plane.

### Full landmark index table

| Index | Name | Index | Name |
|---|---|---|---|
| 0 | NOSE | 17 | LEFT_PINKY |
| 1 | LEFT_EYE_INNER | 18 | RIGHT_PINKY |
| 2 | LEFT_EYE | 19 | LEFT_INDEX |
| 3 | LEFT_EYE_OUTER | 20 | RIGHT_INDEX |
| 4 | RIGHT_EYE_INNER | 21 | LEFT_THUMB |
| 5 | RIGHT_EYE | 22 | RIGHT_THUMB |
| 6 | RIGHT_EYE_OUTER | 23 | LEFT_HIP |
| 7 | LEFT_EAR | 24 | RIGHT_HIP |
| 8 | RIGHT_EAR | 25 | LEFT_KNEE |
| 9 | LEFT_MOUTH | 26 | RIGHT_KNEE |
| 10 | RIGHT_MOUTH | 27 | LEFT_ANKLE |
| 11 | LEFT_SHOULDER | 28 | RIGHT_ANKLE |
| 12 | RIGHT_SHOULDER | 29 | LEFT_HEEL |
| 13 | LEFT_ELBOW | 30 | RIGHT_HEEL |
| 14 | RIGHT_ELBOW | 31 | LEFT_FOOT_INDEX |
| 15 | LEFT_WRIST | 32 | RIGHT_FOOT_INDEX |
| 16 | RIGHT_WRIST | | |

### Most-used landmark triples (proximal → joint → distal)

| Exercise | Angle measures | Indices |
|---|---|---|
| Squat | Knee flexion (L) | 23 → 25 → 27 (hip → knee → ankle) |
| Squat | Knee flexion (R) | 24 → 26 → 28 |
| Push-up | Elbow flexion (L) | 11 → 13 → 15 (shoulder → elbow → wrist) |
| Push-up | Elbow flexion (R) | 12 → 14 → 16 |
| Sit-up / Crunch | Trunk flexion (L) | 11 → 23 → 27 (shoulder → hip → ankle) |
| Lateral Raise | Arm raise angle (L) | 23 → 11 → 13 (hip → shoulder → elbow) |
| Overhead Press | Arm raise angle (L) | 23 → 11 → 13 |

Each MediaPipe landmark has a `visibility` score (0–1). The system checks `visibility >= minVisibility` (typically 0.6) before trusting a landmark.

---

## 3. Data Pipeline: Frame to Feedback

### 3.1 `NormalizedPoseFrame`

The normalized input type passed to every engine:

```ts
type NormalizedPoseFrame = {
  landmarks: PoseLandmark[];        // 33 normalized (screen-space) landmarks
  worldLandmarks: PoseLandmark[];   // 33 world-space landmarks (meters, y-up)
  timestampMs: number;              // monotonic timestamp from MediaPipe
  hasPose: boolean;                 // false if no person detected
};

type PoseLandmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;              // confidence 0–1
};
```

### 3.2 `getWorldLandmark` vs direct indexing

Use the typed helper `getWorldLandmark(frame, POSE_LANDMARKS.LEFT_KNEE)` rather than direct `frame.worldLandmarks[25]`. It returns `null` if the landmark is below the visibility threshold, enabling clean null-checks in engine code.

### 3.3 Frame rate

MediaPipe typically runs at 25–30fps on modern hardware. The engines are designed for ~30fps but the state machines use `timestampMs` (not frame count) for all timing decisions, so the system degrades gracefully at lower frame rates.

---

## 4. Core Interface: ExerciseFormEngine

**File:** `src/features/form-engine/form-engine.ts`

```ts
export interface ExerciseFormEngine {
  readonly id: string;
  reset(): void;
  update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput;
}
```

Every engine must implement these three members. The camera page calls `update()` once per frame and `reset()` when the user switches exercises or restarts.

### Engine hierarchy

```
ExerciseFormEngine (interface)
    └── GenericExerciseEngine (base class)
            ├── SitUpEngine
            ├── CrunchEngine
            ├── LateralRaiseEngine
            ├── BicepCurlEngine
            ├── OverheadPressEngine
            ├── PullUpEngine
            ├── LegRaiseEngine
            └── KneeRaiseEngine
    └── SquatEngine (standalone — uses SquatRepCounterStateMachine)
    └── PushUpEngine (standalone — uses RepCounterStateMachine directly)
```

The squat and push-up engines were written before the `GenericExerciseEngine` base class existed. They contain more detailed, hand-crafted form check logic. All other engines inherit from `GenericExerciseEngine` and add exercise-specific checks on top.

### Getting an engine instance

**File:** `src/features/form-engine/engine-factory.ts`

```ts
import { getEngine } from '@/features/form-engine/engine-factory';
const engine = getEngine('squat'); // throws on unknown ID
```

Valid IDs (in display order): `squat`, `push_up`, `sit_up`, `bicep_curl`, `lateral_raise`, `overhead_press`, `leg_raise`, `knee_raise`, `crunch`, `pull_up`.

---

## 5. EngineOutput Schema

**File:** `src/features/form-engine/form-engine.ts`

Every `update()` call returns an `EngineOutput`. The camera page reads these fields each frame:

```ts
type EngineOutput = {
  // Calibration state
  calibration: CalibrationStatus;
  calibrationStatus?: CalibrationStatus;

  // Rep counting
  repCount?: number;              // total completed reps (bilateral)
  leftRepCount: number;           // left-side reps (unilateral exercises)
  rightRepCount: number;          // right-side reps (unilateral exercises)
  isUnilateral: boolean;          // true for leg_raise, knee_raise

  // Angles
  primaryAngle?: number;          // average of left and right smoothed angles
  leftAngle: number;              // smoothed left-side joint angle (degrees)
  rightAngle: number;             // smoothed right-side joint angle (degrees)

  // Phase
  phase?: string;                 // current stage: 'READY' | 'UP' | 'DOWN' (generic)
  state: EngineState;             // { phase, repCount, lastRepTimestampMs }

  // Feedback
  primaryCue: string;             // single most important cue to display
  secondaryCue?: string;          // optional second cue
  formIssues?: FormIssue[];       // all raw issues detected this frame
  topCues?: FeedbackCue[];        // prioritized, cooldown-filtered cues (max 2)
  issues: FormIssue[];            // legacy field (same as formIssues)

  // Scoring
  repScores?: RepScore[];         // accumulated per-rep scores for the session
  metrics: Record<string, number>; // exercise-specific metrics for debugging

  // Pose quality
  confidence?: number;            // 1 if hasPose, 0 otherwise
};
```

### Key field relationships

- `primaryCue` = `topCues[0]?.text ?? 'Ready'` (or calibration message if not calibrated)
- `formIssues` contains every issue detected this frame; `topCues` is the cooldown-filtered subset
- `repScores` grows by one entry each time a rep completes; it accumulates across the whole session until `reset()` is called

---

## 6. CalibrationGate

**File:** `src/features/form-engine/calibration-gate.ts`

The calibration gate runs before the exercise engine. It checks that the user is:

1. **Fully in frame** — all critical squat landmarks (hips, knees, ankles, shoulders) have `visibility >= minVisibility` (default 0.6)
2. **Standing upright** — shoulder midpoint is above hip midpoint by at least `minShoulderHipHeightDelta`, knee angle > 155°, torso lean < 20°
3. **Oriented correctly** — for exercises with `cameraAngle: 'front'`, shoulder width > 0.08 image units; for `side`, shoulder width ≤ 0.08
4. **Still** — average motion of critical landmarks between frames < `maxMotionPerFrame` (default ~0.01)
5. **Stable for N frames** — must maintain all the above for `requiredStableFrames` (default ~15) consecutive frames

Until `calibration.ready === true`, the engines suppress form checks and rep counting. `calibration.message` is shown as the primary cue: `'Step back so full body is visible'`, `'Stand upright to begin'`, `'Hold still (8/15)'`, etc.

### CalibrationStatus type

```ts
type CalibrationStatus = {
  ready: boolean;
  message: string;
  stableFrames: number;
};
```

---

## 7. Rep Counting

There are two separate state machine implementations.

### 7.1 SquatRepCounterStateMachine (squat engine only)

**File:** `src/features/form-engine/rep-counter-state-machine.ts`

A 5-phase machine designed specifically for the squat's distinct movement phases:

```
NOT_READY ──(calibration ready)──► READY
READY     ──(angle < descendStart=155°)──► DESCENDING
DESCENDING──(angle < bottom=110°)──────► BOTTOM
BOTTOM    ──(angle > ascendStart=130°)──► ASCENDING
ASCENDING ──(angle > lockout=165°)──────► LOCKOUT
LOCKOUT   ──(increment rep + cooldown)──► READY
```

A rep is counted when the machine reaches LOCKOUT (standing fully upright after a complete descent). The 500ms cooldown (`minRepCooldownMs`) prevents double-counting during brief angle oscillations at the top.

**Angle smoothing:** EMA applied to raw knee angle before entering state transitions:
```
smoothedAngle = alpha * rawAngle + (1 - alpha) * smoothedAngle
```
Default alpha is 0.4 (moderate smoothing — responsive but not jittery).

### 7.2 RepCounterStateMachine (all other exercises)

A simpler 3-stage machine used by `GenericExerciseEngine` (and by `PushUpEngine` directly):

```
States: READY → UP → DOWN
```

`tickSide` logic per side:
```ts
isUpPosition  = reversed ? angle < upAngle    : angle > upAngle
isDownPosition = reversed ? angle > downAngle : angle < downAngle

if (isUpPosition)         stage = 'UP'
if (isDownPosition && stage === 'UP' && cooldown OK)  repCount++, stage = 'DOWN'
```

The rep is counted on the **DOWN transition**, not at the top. This means:
- Normal exercises (squat, push-up): rep counts when returning to start position (angle crosses `downAngle` after being above `upAngle`)
- Reversed exercises (bicep curl, pull-up): same logic, but angle meanings are flipped — small angle is "up" (curled/pulled), large angle is "down" (extended/hanging)

**Bilateral vs. unilateral:**
- Bilateral (`isUnilateral: false`): left and right angles are averaged; one shared count
- Unilateral (`isUnilateral: true`): left and right are tracked independently; total = left + right

### 7.3 reversedDirection flag

| `reversedDirection` | Exercise | "Up" position | "Down" position |
|---|---|---|---|
| `false` | squat, push-up, sit-up, lateral raise, overhead press, leg raise, knee raise, crunch | Large angle (extended/high) | Small angle (flexed/low) |
| `true` | bicep curl, pull-up | Small angle (elbow flexed / chin over bar) | Large angle (arm extended / hanging) |

For reversed exercises, the scoring's `depthTarget` also flips to `upAngle` instead of `downAngle`.

---

## 8. RepScorer: Per-Rep Scoring Formula

**File:** `src/features/form-engine/rep-scorer.ts`

The `RepScorer` runs inside `GenericExerciseEngine`. It accumulates per-frame measurements during a rep and produces a `RepScore` when the rep completes.

### Lifecycle

```
startRep(timestampMs)        ← called at the start of each rep
recordFrame(...)             ← called every frame during the rep
completeRep(timestampMs)     ← called when repCount increments; returns RepScore
```

### RepScore type

```ts
type RepScore = {
  repNumber: number;
  overall: number;    // 0–100, weighted composite
  depth: number;      // 0–100
  symmetry: number;   // 0–100
  form: number;       // 0–100
  tempo: number;      // 0–100
  issueIds: string[]; // deduplicated list of form issue IDs that fired
  timestampMs: number;
};
```

### Scoring formulas

**Depth (30% weight)**
Measures how close the rep came to the required extreme angle.
```
depthTarget = reversedDirection ? upAngle : downAngle
shortfall   = max(0, minAngle - depthTarget)
depth       = clamp(0, 100, 100 - shortfall * 2)
```
Each degree short of the target costs 2 points. At 50° short = 0.

**Symmetry (25% weight)**
Penalizes imbalance between left and right sides across the rep.
```
symmetry = clamp(0, 100, 100 - maxSymmetryDiff * 3)
```
`maxSymmetryDiff` is the worst single-frame angle difference between left and right. At 33° difference = 0.

**Form (35% weight)**
Penalizes frames where form issues were detected.
```
form = clamp(0, 100, 100 - errorFrames * 15 - warningFrames * 5)
```
Each error frame costs 15 points, each warning frame costs 5 points. 7 error frames = 0.

**Tempo (10% weight)**
Measures descent duration. Optimal range is 1–3.5 seconds.
```
if descentMs == 0:           tempo = 100   (no timing data — neutral)
if 1000 ≤ descentMs ≤ 3500: tempo = 100   (perfect)
if descentMs < 1000:         tempo = descentMs / 10   (too fast)
if descentMs > 3500:         tempo = max(0, 100 - (descentMs - 3500) / 50)  (too slow)
```

**Overall:**
```
overall = depth*0.30 + symmetry*0.25 + form*0.35 + tempo*0.10
```

### Limitation

The `GenericExerciseEngine` passes an empty `formIssues=[]` to `recordFrame`. This means the `form` dimension is always 100 for all non-squat, non-push-up exercises because form issues are computed in the subclass `update()` override after `super.update()` returns. The subclass would need to pass its issues back into the scorer to fix this.

---

## 9. FeedbackPrioritizer: Cue Deduplication

**File:** `src/features/form-engine/feedback-prioritizer.ts`

The `FeedbackPrioritizer` prevents the UI from spamming the same correction cue every frame. Each engine creates one prioritizer instance with a set of `CueDef` definitions.

```ts
type CueDef = {
  id: string;
  severity: 'error' | 'warning' | 'positive';
  text: string;       // displayed in the camera overlay
  voiceText: string;  // shorter version for text-to-speech
  cooldownReps: number; // minimum reps between showing this cue again
};
```

### How it works

`getTopCues(issues, maxCount = 2)`:
1. Filter `issues` — discard any issue whose `id` was shown fewer than `cooldownReps` reps ago
2. Sort survivors by severity (error = 1, warning = 2, info = 3)
3. Take the top `maxCount` (default 2)
4. Record the current rep number for each shown issue
5. If zero issues survive and `consecutiveCleanReps >= 3`, emit a positive "Great form!" cue

`onRepCompleted(hadIssues)`: call once per completed rep to advance the rep counter and update the clean-rep streak.

### Built-in symmetry cue

The prioritizer auto-adds a `symmetry_drift` cue if it's not provided by the engine's `CUE_DEFS`. This is the fallback for the symmetry detection built into `GenericExerciseEngine`.

---

## 10. exercises.json: Data-Driven Config

**File:** `src/features/form-engine/exercises.json`

Each exercise entry defines the landmarks and angle thresholds used by `GenericExerciseEngine` (and the `RepScorer`). The `formChecks` array is currently empty for all exercises — form checks are implemented in engine code, not in JSON.

### Config schema

```ts
type ExerciseConfig = {
  name: string;
  isUnilateral: boolean;          // track sides independently?
  cameraAngle: 'front' | 'side'; // required camera orientation
  primary_muscles: string[];
  landmarks: {
    left:  [number, number, number];  // [proximal, joint, distal] landmark indices
    right: [number, number, number];
  };
  anglePoint: [number, number, number]; // canonical angle triple (usually same as left)
  repThresholds: {
    downAngle: number;       // angle at the lowest/most-flexed position
    upAngle: number;         // angle at the top/most-extended position
    reversedDirection: boolean;
  };
  formChecks: [];             // reserved for future declarative form checks
};
```

### All 10 exercises at a glance

| ID | Name | Camera | Bilateral | Landmarks (L) | downAngle | upAngle | Reversed |
|---|---|---|---|---|---|---|---|
| `squat` | Squat | front | yes | 23→25→27 | 110° | 160° | no |
| `push_up` | Push-Up | side | yes | 11→13→15 | 130° | 160° | no |
| `sit_up` | Sit-Up | side | yes | 11→23→27 | 145° | 160° | no |
| `bicep_curl` | Bicep Curl | front | yes | 11→13→15 | 160° | 60° | yes |
| `lateral_raise` | Lateral Raise | front | yes | 23→11→13 | 30° | 80° | no |
| `overhead_press` | Overhead Press | front | yes | 23→11→13 | 100° | 150° | no |
| `leg_raise` | Leg Raise | side | no (unilateral) | 11→23→27 | 130° | 160° | no |
| `knee_raise` | Knee Raise | front | no (unilateral) | 23→25→27 | 110° | 160° | no |
| `crunch` | Crunch | side | yes | 11→23→27 | 170° | 150° | no |
| `pull_up` | Pull-Up | front | yes | 11→13→15 | 140° | 70° | yes |

**Note on crunch thresholds:** The crunch uses an unusual configuration — `downAngle: 170°, upAngle: 150°`. At rest the trunk is nearly flat (~170°); the crunch "up" position is a slight trunk flexion (~150°). The `reversedDirection: false` means a rep registers when returning from ~150° back to ~170°, which correctly fires after the concentric crunch.

---

## 11. GenericExerciseEngine: The Base Class

**File:** `src/features/form-engine/engines/generic-exercise-engine.ts`

`GenericExerciseEngine` provides the common skeleton that 8 of 10 engines inherit. Understanding it is key to understanding all subclasses.

### What the base `update()` does per frame

```
1. Read world landmarks for left/right landmark triples from config
2. Compute raw left angle = angleDeg(wl[lA], wl[lB], wl[lC])
3. Compute raw right angle = angleDeg(wl[rA], wl[rB], wl[rC])
4. Smooth both angles through AngleSmoother (EMA-based)
5. primaryAngle = (leftAngle + rightAngle) / 2
6. Feed to RepCounterStateMachine → get repCount, stage, leftRepCount, rightRepCount
7. Feed to RepScorer (every frame; startRep auto-called if needed)
8. Detect symmetry drift: if |leftAngle - rightAngle| > 12° for 3+ consecutive frames
   → push 'Keep both sides even' cue (skipped for isUnilateral exercises)
9. Return EngineOutput
```

### Subclass override pattern

All subclasses follow this pattern:

```ts
override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
  const repBefore = this.prevRepCount;
  const base = super.update(frame, calibration); // run the base engine
  const formIssues: FormIssue[] = [];

  if (calibration.ready) {
    // ... read specific landmarks, run form checks, push to formIssues
  }

  if ((base.repCount ?? 0) > repBefore) {
    // ... handle end-of-rep checks (e.g. full range check)
    this.prioritizer.onRepCompleted(formIssues.some(i => i.severity === 'error' || i.severity === 'warning'));
  }

  const topCues = this.prioritizer.getTopCues(formIssues);
  const primaryCue = calibration.ready ? (topCues[0]?.text ?? base.primaryCue) : calibration.message;
  return { ...base, formIssues, topCues, primaryCue };
}
```

Note: `base.primaryCue` defaults to `'Reps: N'` (or `'Ready'` for rep 0) from `GenericExerciseEngine`. The subclass overrides this with the form cue when one is active.

---

## 12. All 10 Exercises: Deep Dive

### 12.1 Squat

**File:** `src/features/form-engine/engines/squat-engine.ts`
**Camera:** front-facing | **Type:** bilateral | **Engine:** standalone (not GenericExerciseEngine)

**Angle measured:** knee flexion — hip(23) → knee(25) → ankle(27)

**Rep counting:** `SquatRepCounterStateMachine` (5-phase, angle thresholds in config: descend at 155°, bottom at 110°, ascend at 130°, lockout at 165°)

**Form checks (5):**

| Check ID | Condition | Severity | Cue |
|---|---|---|---|
| `squat_depth` | At BOTTOM: knee angle > 105° (not deep enough) | error | "Squat deeper" |
| `squat_torso_lean` | Torso lean > 35° from vertical | warning | "Keep chest up" |
| `squat_knee_cave` | `kneeOutRatio < 0.62` (knees collapsing inward relative to ankles) | error | "Push your knees out" |
| `squat_heel_lift` | `heelLiftRatio > 0.12` (heel rising off ground) | warning | "Keep heels down" |
| `squat_tempo` | Rep completed in < 800ms | warning | "Slow down" |

`kneeOutRatio` = lateral knee distance / lateral ankle distance. Values below 0.62 mean the knees are caving inward relative to ankle-width.

`heelLiftRatio` = `(heelAvgY - ankleAvgY) / (hipAvgY - ankleAvgY)`. Measures heel height as a fraction of leg length.

**Weighted confidence:** The squat engine computes an average landmark visibility for critical lower-body points (hips, knees, ankles) and suppresses checks when confidence is low.

---

### 12.2 Push-Up

**File:** `src/features/form-engine/engines/push-up-engine.ts`
**Camera:** side-facing | **Type:** bilateral | **Engine:** standalone

**Angle measured:** elbow flexion — shoulder(11) → elbow(13) → wrist(15)

**Rep counting:** `RepCounterStateMachine` directly (not via GenericExerciseEngine). Down at < 130°, up at > 160°.

**Form checks (5):**

| Check ID | Condition | Severity | Cue |
|---|---|---|---|
| `pushup_depth` | At bottom: elbow angle 105–130° | error | "Go lower" |
| `pushup_body_alignment` | Shoulder-hip-ankle angle < 160° (hips sagging or piked) | error | "Keep body straight" |
| `pushup_arm_symmetry` | `|leftAngle - rightAngle| > 20°` | warning | "Even out your arms" |
| `pushup_wrist_placement` | Wrist alignment angle > 30° from optimal | warning | "Check hand position" |
| `pushup_speed` | Rep completed in < 800ms | warning | "Slow down" |

`AngleSmoother`: PushUpEngine uses `AngleSmoother` (EMA, alpha=0.3) to reduce jitter on elbow angles. This is the same utility used in GenericExerciseEngine.

---

### 12.3 Sit-Up

**File:** `src/features/form-engine/engines/sit-up-engine.ts`
**Camera:** side-facing | **Type:** bilateral

**Angle measured:** trunk flexion — shoulder(11) → hip(23) → ankle(27)

**Rep thresholds:** down at < 145°, up at > 160°

**Form checks (3):**

| Check ID | Condition | Severity | Cue |
|---|---|---|---|
| `situp_neck_strain` | Ear-to-shoulder distance drops > 0.12m from baseline (head pulling forward) | warning | "Don't pull your neck" |
| `situp_full_range` | At rep completion: `minAngleThisRep > 130°` (didn't crunch enough) | warning | "Crunch up further" |
| `situp_hip_anchor` | Ankle drift > 0.05 units from starting position | warning | "Keep your feet planted" |

Baseline anchor for ankle and ear-to-shoulder distance is captured on the first calibrated frame and held for the session.

---

### 12.4 Bicep Curl

**File:** `src/features/form-engine/engines/bicep-curl-engine.ts`
**Camera:** front-facing | **Type:** bilateral | **reversedDirection:** true

**Angle measured:** elbow flexion — shoulder(11) → elbow(13) → wrist(15)

**Rep thresholds:** "up" at < 60° (arm curled), "down" at > 160° (arm extended)

**Form checks (4):**

| Check ID | Condition | Severity | Cue |
|---|---|---|---|
| `curl_elbow_drift` | `|elbow.x - shoulder.x| > 0.15m` | error | "Pin your elbows to your sides" |
| `curl_wrist_break` | Elbow→wrist→index angle < 155° | warning | "Keep your wrists straight" |
| `curl_full_extension` | At bottom phase: left or right angle < 150° | warning | "Fully extend at the bottom" |
| `curl_imbalance` | `|leftAngle - rightAngle| > 20°` | warning | "Even out both arms" |

---

### 12.5 Lateral Raise

**File:** `src/features/form-engine/engines/lateral-raise-engine.ts`
**Camera:** front-facing | **Type:** bilateral

**Angle measured:** arm raise — hip(23) → shoulder(11) → elbow(13)

**Rep thresholds:** down at < 30° (arms at sides), up at > 80° (arms raised)

**Form checks (3):**

| Check ID | Condition | Severity | Cue |
|---|---|---|---|
| `raise_elbow_height` | At peak (primaryAngle < 40°): elbow.y < shoulder.y by > 0.05m | warning | "Raise your elbows to shoulder height" |
| `raise_body_sway` | Hip x-drift from anchor > 0.08m | warning | "Keep your body still" |
| `raise_imbalance` | `|leftAngle - rightAngle| > 15°` | warning | "Raise both arms evenly" |

---

### 12.6 Overhead Press

**File:** `src/features/form-engine/engines/overhead-press-engine.ts`
**Camera:** front-facing | **Type:** bilateral

**Angle measured:** arm raise — hip(23) → shoulder(11) → elbow(13)

**Rep thresholds:** down at < 100°, up at > 150°

**Form checks (4):**

| Check ID | Condition | Severity | Cue |
|---|---|---|---|
| `press_head_jut` | At top: `shoulderMid.z - nose.z > 0.06m` (head forward) | warning | "Don't let your head jut forward" |
| `press_lockout` | At top: left or right angle < 165° | warning | "Lock out at the top" |
| `press_imbalance` | `|leftAngle - rightAngle| > 20°` | warning | "Press both arms evenly" |
| `press_core_stability` | `|lHip.y - rHip.y| > 0.06m` (hip tilt) | warning | "Brace your core" |

Uses world-space z (depth) for head jut detection — requires a mostly front-facing camera.

---

### 12.7 Leg Raise

**File:** `src/features/form-engine/engines/leg-raise-engine.ts`
**Camera:** side-facing | **Type:** unilateral (left and right tracked separately)

**Angle measured:** hip flexion — shoulder(11) → hip(23) → ankle(27)

**Rep thresholds:** down at < 130°, up at > 160°

**Form checks (2):**

| Check ID | Condition | Severity | Cue |
|---|---|---|---|
| `legraise_lower_back` | During lowering phase: angle > 175° (hyperextension) | warning | "Keep your lower back flat" |
| `legraise_full_range` | At rep completion: `minAngleThisRep > 70°` (legs not raised high enough) | warning | "Raise your legs higher" |

---

### 12.8 Knee Raise

**File:** `src/features/form-engine/engines/knee-raise-engine.ts`
**Camera:** front-facing | **Type:** unilateral

**Angle measured:** knee flexion — hip(23) → knee(25) → ankle(27)

**Rep thresholds:** down at < 110°, up at > 160°

**Form checks (1):**

| Check ID | Condition | Severity | Cue |
|---|---|---|---|
| `kneeraise_symmetry` | `|leftAngle - rightAngle| > 20°` | warning | "Raise both knees evenly" |

---

### 12.9 Crunch

**File:** `src/features/form-engine/engines/crunch-engine.ts`
**Camera:** side-facing | **Type:** bilateral

**Angle measured:** trunk flexion — shoulder(11) → hip(23) → ankle(27)

**Rep thresholds:** up at < 150° (flexed), down at > 170° (flat) — the range is narrow (20°); a rep fires when trunk angle crosses 170° after having been below 150°.

**Form checks (3):**

| Check ID | Condition | Severity | Cue |
|---|---|---|---|
| `crunch_neck_pull` | Ear-to-shoulder distance drops > 0.10m from baseline | warning | "Don't pull your neck" |
| `crunch_range` | At rep completion: `minAngleThisRep > 155°` | warning | "Curl higher" |
| `crunch_hip_flex` | `|lHip.y - rHip.y| > 0.08m` | info | "Keep hips flat" |

---

### 12.10 Pull-Up

**File:** `src/features/form-engine/engines/pull-up-engine.ts`
**Camera:** front-facing | **Type:** bilateral | **reversedDirection:** true

**Angle measured:** elbow flexion — shoulder(11) → elbow(13) → wrist(15)

**Rep thresholds:** "up" at < 70° (elbows bent, chin at bar), "down" at > 140° (hanging)

**Form checks (4):**

| Check ID | Condition | Severity | Cue |
|---|---|---|---|
| `pullup_chin_over_bar` | At top (angle < 80°): `ear.y < wrist.y` (chin below bar) | warning | "Pull until your chin clears the bar" |
| `pullup_full_hang` | At bottom (angle > 135°): left or right angle < 155° | warning | "Fully extend at the bottom" |
| `pullup_kipping` | Hip horizontal movement > 0.03m per frame | warning | "Avoid kipping — control the movement" |
| `pullup_imbalance` | `|leftAngle - rightAngle| > 25°` | warning | "Pull evenly with both arms" |

---

## 13. Angle Calculation Primitives

**File:** `src/features/form-engine/rules/angle.ts`

```ts
// Three-joint angle (degrees). Standard formula: arccos of dot product of two vectors.
function angleDeg(proximal, joint, distal): number

// 2D Euclidean distance between two landmarks (ignores z)
function distance2d(a, b): number

// Midpoint of two landmarks
function midpoint(a, b): { x, y, z }

// Lean of a segment from vertical (degrees): 0° = perfectly upright
function verticalLeanDeg(top, bottom): number
```

`AngleSmoother` (EMA) is in `src/lib/pose/math.ts`:

```ts
class AngleSmoother {
  private ema = 180;
  update(raw: number): number {
    this.ema = ALPHA * raw + (1 - ALPHA) * this.ema; // ALPHA ≈ 0.3
    return this.ema;
  }
  reset(): void { this.ema = 180; }
}
```

---

## 14. Known Weaknesses and Improvement Opportunities

### 14.1 Form scoring is disconnected from RepScorer

All subclasses of `GenericExerciseEngine` call `super.update()` first, then compute form issues after. The `RepScorer.recordFrame()` inside `super.update()` receives an empty `formIssues=[]`, so the `form` score is always 100 for these engines. **Fix:** pass the computed form issues into `recordFrame()`, or move scoring into the subclass after computing issues.

### 14.2 CalibrationGate uses squat landmarks for all exercises

`CalibrationGate` checks `CRITICAL_SQUAT_LANDMARKS` (hips, knees, ankles) regardless of exercise. An overhead press only needs upper-body landmarks. **Fix:** make the critical landmark set configurable per exercise in `exercises.json`.

### 14.3 No temporal context between reps

The system measures form within a single rep. It cannot detect fatigue (degrading scores over successive reps) or compensations that develop over time. **Fix:** expose the `repScores[]` array to a fatigue analyzer that compares early vs. late reps.

### 14.4 Crunch threshold logic is fragile

The crunch uses `downAngle: 170, upAngle: 150` with `reversedDirection: false`. This means the GenericExerciseEngine's `atBottom` check (`angle <= downAngle = 170°`) fires almost immediately since a flat torso is ~170°. The 20° working range is easily missed when the user isn't directly side-on to the camera. **Fix:** consider `reversedDirection: true` with a smaller upAngle (trunk very flexed = small angle), which more naturally models the exercise.

### 14.5 Wrist and foot landmarks are unreliable

MediaPipe Pose landmark accuracy degrades significantly for hands and feet when not well-lit or partially occluded. The wrist-break check in BicepCurl and heel-lift in Squat should be gated behind a higher `minVisibility` threshold. Consider raising per-landmark visibility requirements for these specific checks.

### 14.6 Side-facing exercises assume consistent orientation

The push-up, sit-up, crunch, and leg-raise engines assume a constant left-side-facing camera. If the user films from the right, left/right assignments will be swapped. **Fix:** add an orientation detection step in the calibration gate that determines which side is facing the camera.

### 14.7 No exercise-specific calibration

The `CalibrationGate` only has one mode: "standing upright." Exercises done lying down (sit-up, crunch, leg-raise) currently skip calibration or produce incorrect messages. **Fix:** add a `CalibrationMode` to the config per exercise (standing / prone / hanging) with mode-specific readiness checks.

### 14.8 Voice cues not wired to TTS

`FeedbackCue.voiceText` is a shorter TTS-friendly string but the camera page does not currently call the Web Speech API. **Fix:** implement `speechSynthesis.speak()` triggered on `topCues[0].voiceText` change with a debounce.

---

## 15. How to Add a New Exercise

Follow these steps to add a new exercise, e.g. `romanian_deadlift`.

### Step 1: Add entry to exercises.json

```json
"romanian_deadlift": {
  "name": "Romanian Deadlift",
  "isUnilateral": false,
  "cameraAngle": "side",
  "primary_muscles": ["hamstrings", "glutes", "lower_back"],
  "landmarks": {
    "left":  [23, 25, 27],
    "right": [24, 26, 28]
  },
  "anglePoint": [23, 25, 27],
  "repThresholds": {
    "downAngle": 70,
    "upAngle": 165,
    "reversedDirection": false
  },
  "formChecks": []
}
```

Choose `downAngle` and `upAngle` by:
1. Running the camera with a placeholder engine
2. Printing `primaryAngle` to console at the bottom and top of the movement
3. Setting `downAngle` = typical bottom value, `upAngle` = typical top value
4. Leave 10–20° headroom on each threshold to avoid false fires near the boundaries

### Step 2: Create the engine file

`src/features/form-engine/engines/romanian-deadlift-engine.ts`

```ts
import type { EngineOutput, CalibrationStatus, FormIssue } from '@/features/form-engine/form-engine';
import type { NormalizedPoseFrame } from '@/features/pose/pose-types';
import { POSE_LANDMARKS, getWorldLandmark } from '@/features/pose/pose-types';
import { GenericExerciseEngine } from './generic-exercise-engine';
import { FeedbackPrioritizer } from '@/features/form-engine/feedback-prioritizer';
import type { CueDef } from '@/features/form-engine/feedback-prioritizer';

const CUE_DEFS: CueDef[] = [
  { id: 'rdl_back_rounding', severity: 'error',   text: 'Keep your back flat',      voiceText: 'Back flat',   cooldownReps: 1 },
  { id: 'rdl_hip_hinge',     severity: 'warning', text: 'Hinge at the hips',        voiceText: 'Hip hinge',   cooldownReps: 2 },
  { id: 'rdl_full_lockout',  severity: 'warning', text: 'Stand all the way up',     voiceText: 'Full lockout', cooldownReps: 2 },
];

export class RomanianDeadliftEngine extends GenericExerciseEngine {
  private readonly prioritizer = new FeedbackPrioritizer(CUE_DEFS);

  constructor() { super('romanian_deadlift'); }

  override reset(): void {
    super.reset();
    this.prioritizer.reset();
  }

  override update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput {
    const repBefore = this.prevRepCount;
    const base = super.update(frame, calibration);
    const formIssues: FormIssue[] = [];

    if (calibration.ready) {
      const lShoulder = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_SHOULDER);
      const lHip      = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_HIP);
      const lKnee     = getWorldLandmark(frame, POSE_LANDMARKS.LEFT_KNEE);

      // Back rounding: torso angle from vertical > 20° while in bottom half
      // (implement using verticalLeanDeg(shoulder, hip) from rules/angle.ts)

      // Full lockout: at top, hip angle should be > 160°
      if ((base.primaryAngle ?? 0) < 160 && base.phase === 'UP') {
        formIssues.push({ id: 'rdl_full_lockout', severity: 'warning', message: 'Stand all the way up' });
      }
    }

    if ((base.repCount ?? 0) > repBefore) {
      this.prioritizer.onRepCompleted(formIssues.some(i => i.severity === 'error' || i.severity === 'warning'));
    }

    const topCues = this.prioritizer.getTopCues(formIssues);
    const primaryCue = calibration.ready ? (topCues[0]?.text ?? base.primaryCue) : calibration.message;
    return { ...base, formIssues, topCues, primaryCue };
  }
}
```

### Step 3: Register in engine-factory.ts

```ts
import { RomanianDeadliftEngine } from './engines/romanian-deadlift-engine';

// In getEngine():
case 'romanian_deadlift': return new RomanianDeadliftEngine();

// In EXERCISE_IDS:
export const EXERCISE_IDS = [
  // ... existing,
  'romanian_deadlift',
] as const;
```

### Step 4: Test thresholds

Run the dev server and open the camera page. Select the exercise and watch the console or add a temporary `console.log(base.primaryAngle, base.phase)` in the engine. Verify that:
- `phase` transitions from `'READY'` → `'DOWN'` → `'UP'` at the right points in the movement
- `repCount` increments correctly
- Form checks fire at the right angles

### Step 5: Add to the program/camera exercise selector

Add an entry to the exercise selection UI in the camera page so users can choose the new exercise.

---

## Quick Reference: File Locations

| Purpose | File |
|---|---|
| Engine interface + types | `src/features/form-engine/form-engine.ts` |
| Exercise config + JSON loader | `src/features/form-engine/exercise-config.ts` |
| Exercise definitions | `src/features/form-engine/exercises.json` |
| Engine factory | `src/features/form-engine/engine-factory.ts` |
| Base class | `src/features/form-engine/engines/generic-exercise-engine.ts` |
| Squat engine | `src/features/form-engine/engines/squat-engine.ts` |
| Push-up engine | `src/features/form-engine/engines/push-up-engine.ts` |
| Rep state machines | `src/features/form-engine/rep-counter-state-machine.ts` |
| Per-rep scorer | `src/features/form-engine/rep-scorer.ts` |
| Feedback prioritizer | `src/features/form-engine/feedback-prioritizer.ts` |
| Calibration gate | `src/features/form-engine/calibration-gate.ts` |
| Angle math primitives | `src/features/form-engine/rules/angle.ts` |
| AngleSmoother (EMA) | `src/lib/pose/math.ts` |
| MediaPipe landmark constants | `src/features/pose/pose-types.ts` |
