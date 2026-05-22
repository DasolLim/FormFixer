## PHASE 1 — FIX CRITICAL BUGS IN THE EXISTING SYSTEM

Read every file listed above before writing any code.

### 1.1 Fix RepScorer form score always being 100

**Problem:** All GenericExerciseEngine subclasses call super.update() first,
then compute formIssues after. RepScorer.recordFrame() receives empty
formIssues=[], so the form dimension is always 100 for 8 of 10 exercises.

**Fix in src/features/form-engine/rep-scorer.ts:**

Add a patchLastFrameIssues(issues: FormIssue[]): void method that
retroactively applies the form issues to the frame just recorded:

```ts
private lastFrameErrorCount = 0;
private lastFrameWarningCount = 0;

patchLastFrameIssues(issues: FormIssue[]): void {
  this.errorFrames   -= this.lastFrameErrorCount;
  this.warningFrames -= this.lastFrameWarningCount;
  const hasError   = issues.some(i => i.severity === 'error');
  const hasWarning = issues.some(i => i.severity === 'warning');
  if (hasError)        { this.errorFrames++;   this.lastFrameErrorCount = 1;   this.lastFrameWarningCount = 0; }
  else if (hasWarning) { this.warningFrames++; this.lastFrameWarningCount = 1; this.lastFrameErrorCount = 0;   }
  else                 { this.lastFrameErrorCount = 0; this.lastFrameWarningCount = 0; }
}
```

**Fix in every GenericExerciseEngine subclass** — at the end of each
subclass update() override, after formIssues is fully populated:

```ts
if (calibration.ready && formIssues.length > 0) {
  this.scorer.patchLastFrameIssues(formIssues);
}
```

Note: expose this.scorer as protected in GenericExerciseEngine if private.

Apply to all 8 subclasses: SitUpEngine, CrunchEngine, LateralRaiseEngine,
BicepCurlEngine, OverheadPressEngine, PullUpEngine, LegRaiseEngine,
KneeRaiseEngine.

---

### 1.2 Fix CalibrationGate using squat landmarks for all exercises

**Problem:** CalibrationGate checks CRITICAL_SQUAT_LANDMARKS for all
exercises regardless of relevance.

**Fix in exercises.json** — add calibrationMode and calibrationLandmarks to
every exercise:

```json
"squat":          { "calibrationMode": "standing", "calibrationLandmarks": [23,24,25,26,27,28,11,12] },
"push_up":        { "calibrationMode": "standing", "calibrationLandmarks": [11,12,13,14,15,16,23,24] },
"sit_up":         { "calibrationMode": "prone",    "calibrationLandmarks": [11,12,23,24,27,28] },
"bicep_curl":     { "calibrationMode": "standing", "calibrationLandmarks": [11,12,13,14,15,16] },
"lateral_raise":  { "calibrationMode": "standing", "calibrationLandmarks": [11,12,13,14,23,24] },
"overhead_press": { "calibrationMode": "standing", "calibrationLandmarks": [11,12,13,14,15,16,23,24] },
"leg_raise":      { "calibrationMode": "prone",    "calibrationLandmarks": [11,12,23,24,25,26,27,28] },
"knee_raise":     { "calibrationMode": "standing", "calibrationLandmarks": [23,24,25,26,27,28] },
"crunch":         { "calibrationMode": "prone",    "calibrationLandmarks": [11,12,23,24,27,28] },
"pull_up":        { "calibrationMode": "hanging",  "calibrationLandmarks": [11,12,13,14,15,16,23,24] }
```

**Fix in src/features/form-engine/calibration-gate.ts:**

1. Accept calibrationLandmarks: number[] and calibrationMode:
   'standing' | 'prone' | 'hanging' as constructor parameters.
2. Replace hardcoded CRITICAL_SQUAT_LANDMARKS with the per-exercise array.
3. Add mode-specific upright checks:
   - standing: existing logic (current behavior)
   - prone: shoulder.y and hip.y within 0.15m of each other in world space.
     Message: "Lie flat and hold still"
   - hanging: both wrists (15,16) above both shoulders (11,12) in world y.
     Message: "Hang from the bar and hold still"
4. Update engine-factory.ts to pass exercise config into CalibrationGate.

---

### 1.3 Fix orientation detection for side-facing exercises

**Problem:** Side-facing exercises assume user always faces left; filming
from the right swaps left/right landmark assignments.

**Fix in src/features/form-engine/calibration-gate.ts:**

```ts
export type CameraOrientation = 'front' | 'left' | 'right';

// Add orientation: CameraOrientation to CalibrationStatus type

function detectOrientation(frame: NormalizedPoseFrame): CameraOrientation {
  const lShoulder = frame.landmarks[11];
  const rShoulder = frame.landmarks[12];
  const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
  if (shoulderWidth > 0.10) return 'front';
  return (lShoulder.visibility ?? 0) > (rShoulder.visibility ?? 0) ? 'left' : 'right';
}
```

In all side-facing engines, read calibration.orientation and swap landmark
indices when orientation === 'right'. Example for PushUpEngine: use
landmarks 12,14,16 (right side) as primary when orientation is 'right'.

---

### 1.4 Fix crunch threshold fragility

**Problem:** Crunch uses downAngle:170, upAngle:150, reversedDirection:false.
The 20 degree working range is too narrow and fragile.

**Fix in exercises.json:**
```json
"crunch": {
  "repThresholds": {
    "downAngle": 165,
    "upAngle": 120,
    "reversedDirection": true
  }
}
```

This gives a 45 degree working range. Update CrunchEngine's crunch_range
check: fire when minAngleThisRep > 130 degrees (wasn't crunched enough).

---

### 1.5 Fix wrist and foot landmark visibility gating

**Problem:** Wrist-break and heel-lift checks fire on unreliable landmarks.

**Fix in exercises.json** — add minVisibilityOverrides:
```json
"bicep_curl":  { "minVisibilityOverrides": { "15": 0.72, "16": 0.72, "19": 0.72, "20": 0.72 } },
"squat":       { "minVisibilityOverrides": { "29": 0.72, "30": 0.72 } },
"push_up":     { "minVisibilityOverrides": { "15": 0.72, "16": 0.72 } }
```

**Fix in src/features/pose/pose-types.ts:**

Modify getWorldLandmark() to accept optional minVisibility override:

```ts
export function getWorldLandmark(
  frame: NormalizedPoseFrame,
  index: number,
  minVisibility = 0.6
): PoseLandmark | null {
  const lm = frame.worldLandmarks[index];
  if (!lm || (lm.visibility ?? 1) < minVisibility) return null;
  return lm;
}
```

---

### 1.6 Add rep timeout to prevent stale UP state

**Fix in src/features/form-engine/rep-counter-state-machine.ts:**

Add lastUpTimestampMs per side. In tickSide(), if stage === 'UP' and
(frame.timestampMs - lastUpTimestampMs) > 5000, reset stage to 'READY'
without counting a rep. Log a console.debug message for testing.

For SquatRepCounterStateMachine: add the same timeout (6 seconds) for
the ASCENDING and BOTTOM states.

---

### 1.7 Wire voice cues to Web Speech API

**Fix in the camera page component** (the file that calls engine.update()
each frame):

```ts
let lastSpokenCueId = '';

function speakCue(cue: FeedbackCue | undefined): void {
  if (!cue || cue.id === lastSpokenCueId) return;
  if (!window.speechSynthesis) return;
  lastSpokenCueId = cue.id;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(cue.voiceText);
  utt.rate = 1.15;
  utt.pitch = 1.0;
  utt.volume = 0.9;
  window.speechSynthesis.speak(utt);
}

// After receiving engineOutput each frame:
speakCue(engineOutput.topCues?.[0]);
```

Reset lastSpokenCueId = '' on exercise switch or reset.

---