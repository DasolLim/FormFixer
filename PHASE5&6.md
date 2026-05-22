## PHASE 5 — ADD 5 NEW UPPER BODY EXERCISES

For each: add to exercises.json, create engine file, register in
engine-factory.ts, test thresholds, add to exercise selector UI.

---

### U1: Incline DB Press
**File:** src/features/form-engine/engines/incline-db-press-engine.ts
**Class:** InclineDbPressEngine extends GenericExerciseEngine
**Constructor:** super('incline_db_press')

exercises.json:
```json
"incline_db_press": {
  "name": "Incline DB press",
  "isUnilateral": false,
  "cameraAngle": "front",
  "primary_muscles": ["chest", "anterior_deltoid", "triceps"],
  "calibrationMode": "standing",
  "calibrationLandmarks": [11, 12, 13, 14, 15, 16, 23, 24],
  "smoothingAlpha": 0.35,
  "landmarks": { "left": [11, 13, 15], "right": [12, 14, 16] },
  "anglePoint": [11, 13, 15],
  "repThresholds": { "downAngle": 75, "upAngle": 160, "reversedDirection": false },
  "formChecks": []
}
```

CUE_DEFS:
```ts
{ id: 'idbp_wrist_alignment', severity: 'error',   text: 'Stack your wrists over your elbows',    voiceText: 'Wrists over elbows', cooldownReps: 1 },
{ id: 'idbp_symmetry',        severity: 'error',   text: 'Press both arms evenly',                 voiceText: 'Both arms equal',    cooldownReps: 1 },
{ id: 'idbp_elbow_flare',     severity: 'warning', text: 'Tuck your elbows — about 60 degrees',   voiceText: 'Tuck elbows',        cooldownReps: 2 },
{ id: 'idbp_lockout',         severity: 'warning', text: 'Fully extend at the top',                voiceText: 'Full lockout',       cooldownReps: 2 },
{ id: 'idbp_half_rep',        severity: 'warning', text: 'Go deeper — elbows below chest level',   voiceText: 'Go deeper',          cooldownReps: 1 },
```

Form checks:
- idbp_wrist_alignment: getWorldLandmark(frame, WRIST, 0.72) — if
  Math.abs(wrist.x - elbow.x) > 0.08, fire.
- idbp_elbow_flare: at DOWN phase, if Math.abs(elbow.x - shoulder.x) > 0.18, fire.
- idbp_symmetry: if Math.abs(base.leftAngle - base.rightAngle) > 18, fire.
- idbp_lockout: at UP phase, if primaryAngle < 150, fire.
- idbp_half_rep: at rep completion (repCount > repBefore), if
  minAngleThisRep > 85, fire. Track minAngleThisRep every frame, reset each rep.

---

### U2: Tricep Pushdown
**File:** src/features/form-engine/engines/tricep-pushdown-engine.ts
**Class:** TricepPushdownEngine extends GenericExerciseEngine
**Constructor:** super('tricep_pushdown')

exercises.json:
```json
"tricep_pushdown": {
  "name": "Tricep pushdown",
  "isUnilateral": false,
  "cameraAngle": "side",
  "primary_muscles": ["triceps"],
  "calibrationMode": "standing",
  "calibrationLandmarks": [11, 12, 13, 14, 15, 16, 23, 24],
  "smoothingAlpha": 0.35,
  "landmarks": { "left": [11, 13, 15], "right": [12, 14, 16] },
  "anglePoint": [11, 13, 15],
  "repThresholds": { "downAngle": 25, "upAngle": 90, "reversedDirection": false },
  "formChecks": []
}
```

CUE_DEFS:
```ts
{ id: 'tpd_elbow_drift',    severity: 'error',   text: 'Pin your elbows to your sides',       voiceText: 'Elbows in',       cooldownReps: 1 },
{ id: 'tpd_full_extension', severity: 'error',   text: 'Fully extend at the bottom',           voiceText: 'Full extension',  cooldownReps: 1 },
{ id: 'tpd_tempo',          severity: 'warning', text: "Control the movement — don't rush",    voiceText: 'Slow down',       cooldownReps: 2 },
{ id: 'tpd_wrist_break',    severity: 'warning', text: 'Keep your wrists straight',            voiceText: 'Wrists straight', cooldownReps: 2 },
```

Form checks:
- tpd_elbow_drift (side-facing): elbow drifts forward in Z.
  Compute drift = shoulder.z - elbow.z. If drift > 0.12, fire.
- tpd_full_extension: at DOWN phase, if primaryAngle > 35, fire.
- tpd_tempo: if rep completes in < 600ms, fire.
  Track repStartTimestampMs, reset on each rep completion.
- tpd_wrist_break: angleDeg(elbow, wrist, index_finger) < 155, fire.
  Use minVisibility 0.72 for wrist and index.

---

### U3: Face Pull
**File:** src/features/form-engine/engines/face-pull-engine.ts
**Class:** FacePullEngine extends GenericExerciseEngine
**Constructor:** super('face_pull')

exercises.json:
```json
"face_pull": {
  "name": "Face pull",
  "isUnilateral": false,
  "cameraAngle": "side",
  "primary_muscles": ["rear_deltoid", "rotator_cuff", "upper_traps"],
  "calibrationMode": "standing",
  "calibrationLandmarks": [11, 12, 13, 14, 15, 16, 23, 24],
  "smoothingAlpha": 0.35,
  "landmarks": { "left": [11, 13, 15], "right": [12, 14, 16] },
  "anglePoint": [11, 13, 15],
  "repThresholds": { "downAngle": 160, "upAngle": 55, "reversedDirection": true },
  "formChecks": []
}
```

CUE_DEFS:
```ts
{ id: 'fp_elbow_height',   severity: 'error',   text: 'Raise elbows to shoulder height',    voiceText: 'Elbows up',      cooldownReps: 1 },
{ id: 'fp_pull_height',    severity: 'error',   text: 'Pull to your face — not your chest', voiceText: 'Pull to face',   cooldownReps: 1 },
{ id: 'fp_torso_sway',     severity: 'warning', text: 'Keep your body still',               voiceText: 'Stay still',     cooldownReps: 2 },
{ id: 'fp_full_extension', severity: 'warning', text: 'Fully extend at the front',          voiceText: 'Full extension', cooldownReps: 2 },
```

Form checks:
- fp_elbow_height: at UP phase (peak pull), if elbow.y < shoulder.y - 0.04
  in world y-up space, fire. (Elbow below shoulder = wrong.)
- fp_pull_height: at UP phase, if wrist.y < nose.y (landmark 0) - 0.08,
  fire. Use minVisibility 0.72 for wrist.
- fp_torso_sway: record hipAnchorX at calibration. If current hipMid.x
  drifts > 0.07m from anchor, fire.
- fp_full_extension: at DOWN phase, if primaryAngle < 140, fire.

---

### U4: Arnold Press
**File:** src/features/form-engine/engines/arnold-press-engine.ts
**Class:** ArnoldPressEngine extends GenericExerciseEngine
**Constructor:** super('arnold_press')

exercises.json:
```json
"arnold_press": {
  "name": "Arnold press",
  "isUnilateral": false,
  "cameraAngle": "front",
  "primary_muscles": ["anterior_deltoid", "medial_deltoid", "rear_deltoid"],
  "calibrationMode": "standing",
  "calibrationLandmarks": [11, 12, 13, 14, 15, 16, 23, 24],
  "smoothingAlpha": 0.35,
  "landmarks": { "left": [11, 13, 15], "right": [12, 14, 16] },
  "anglePoint": [11, 13, 15],
  "repThresholds": { "downAngle": 80, "upAngle": 160, "reversedDirection": false },
  "formChecks": []
}
```

CUE_DEFS:
```ts
{ id: 'ap_lockout',   severity: 'error',   text: 'Fully extend your arms at the top',      voiceText: 'Lock out',        cooldownReps: 1 },
{ id: 'ap_symmetry', severity: 'error',   text: 'Press both arms evenly',                  voiceText: 'Both arms equal', cooldownReps: 1 },
{ id: 'ap_arch',     severity: 'warning', text: "Brace your core — don't arch your back",  voiceText: 'Core tight',      cooldownReps: 2 },
{ id: 'ap_hip_tilt', severity: 'warning', text: 'Keep your hips level',                    voiceText: 'Level hips',      cooldownReps: 2 },
```

Form checks:
- ap_lockout: at UP phase, if primaryAngle < 150, fire.
- ap_symmetry: if Math.abs(leftAngle - rightAngle) > 20, fire.
- ap_arch: compute verticalLeanDeg(shoulderMid, hipMid). If > 15, fire.
- ap_hip_tilt: if Math.abs(lHip.y - rHip.y) > 0.05 in world space, fire.

---

### U5: Seated Cable Row
**File:** src/features/form-engine/engines/seated-cable-row-engine.ts
**Class:** SeatedCableRowEngine extends GenericExerciseEngine
**Constructor:** super('seated_cable_row')

exercises.json:
```json
"seated_cable_row": {
  "name": "Seated cable row",
  "isUnilateral": false,
  "cameraAngle": "side",
  "primary_muscles": ["lats", "rhomboids", "biceps", "rear_deltoid"],
  "calibrationMode": "seated",
  "calibrationLandmarks": [11, 12, 13, 14, 15, 16, 23, 24],
  "smoothingAlpha": 0.35,
  "landmarks": { "left": [11, 13, 15], "right": [12, 14, 16] },
  "anglePoint": [11, 13, 15],
  "repThresholds": { "downAngle": 155, "upAngle": 45, "reversedDirection": true },
  "formChecks": []
}
```

Add "seated" to CalibrationGate modes: check that hip.y is approximately
equal to knee.y in world space (user is seated, not standing). Message:
"Sit in position and hold still".

CUE_DEFS:
```ts
{ id: 'scr_kipping',      severity: 'error',   text: "Don't rock — pull with your back",  voiceText: 'No rocking',     cooldownReps: 1 },
{ id: 'scr_elbow_drive',  severity: 'error',   text: 'Drive elbows past your body',        voiceText: 'Elbows back',    cooldownReps: 1 },
{ id: 'scr_forward_lean', severity: 'warning', text: 'Sit tall at the start',              voiceText: 'Sit tall',       cooldownReps: 2 },
{ id: 'scr_full_extend',  severity: 'warning', text: 'Fully extend at the front',          voiceText: 'Full extension', cooldownReps: 2 },
```

Form checks:
- scr_kipping: track repLeanMin and repLeanMax using verticalLeanDeg per
  frame. At rep completion, if (repLeanMax - repLeanMin) > 25, fire.
  Reset min/max each rep.
- scr_elbow_drive: at UP phase, if elbow.z < shoulder.z - 0.02 (elbow did
  NOT pass behind shoulder plane in world Z), fire.
- scr_forward_lean: at DOWN phase, if verticalLeanDeg(shoulder, hip) > 20, fire.
- scr_full_extend: at DOWN phase, if primaryAngle < 140, fire.

---

## PHASE 6 — ADD 5 NEW LOWER BODY EXERCISES

---

### L1: Sumo Squat
**File:** src/features/form-engine/engines/sumo-squat-engine.ts
**Class:** SumoSquatEngine extends GenericExerciseEngine
**Constructor:** super('sumo_squat')

exercises.json:
```json
"sumo_squat": {
  "name": "Sumo squat",
  "isUnilateral": false,
  "cameraAngle": "front",
  "primary_muscles": ["inner_quads", "glutes", "adductors"],
  "calibrationMode": "standing",
  "calibrationLandmarks": [11, 12, 23, 24, 25, 26, 27, 28],
  "smoothingAlpha": 0.40,
  "landmarks": { "left": [23, 25, 27], "right": [24, 26, 28] },
  "anglePoint": [23, 25, 27],
  "repThresholds": { "downAngle": 95, "upAngle": 165, "reversedDirection": false },
  "formChecks": []
}
```

CUE_DEFS:
```ts
{ id: 'ss_knee_cave', severity: 'error',   text: 'Push knees out over your toes',   voiceText: 'Knees out',  cooldownReps: 1 },
{ id: 'ss_depth',     severity: 'error',   text: 'Squat deeper — hips below knees', voiceText: 'Go deeper',  cooldownReps: 1 },
{ id: 'ss_lean',      severity: 'warning', text: 'Keep your chest upright',         voiceText: 'Chest up',   cooldownReps: 2 },
{ id: 'ss_heel_lift', severity: 'warning', text: 'Keep your heels flat',            voiceText: 'Heels down', cooldownReps: 2 },
```

Form checks:
- ss_knee_cave: kneeWidth = Math.abs(lKnee.x - rKnee.x), ankleWidth =
  Math.abs(lAnkle.x - rAnkle.x). If (kneeWidth / ankleWidth) < 0.75, fire.
  (Sumo threshold is 0.75, vs standard squat's 0.62, because wide stance
  requires knees to track further out.)
- ss_depth: track minAngleThisRep. At rep completion, if minAngleThisRep
  > 105, fire.
- ss_lean: verticalLeanDeg(shoulderMid, hipMid) > 30, fire.
- ss_heel_lift: lHeel.y - lAnkle.y > 0.04 (heel rising off floor), fire.
  Use minVisibility 0.72 for heel landmarks.

---

### L2: Wall Sit (Isometric — special engine)
**File:** src/features/form-engine/engines/wall-sit-engine.ts
**Class:** WallSitEngine implements ExerciseFormEngine DIRECTLY
(do NOT extend GenericExerciseEngine — this is isometric, no rep counter)

exercises.json:
```json
"wall_sit": {
  "name": "Wall sit",
  "isUnilateral": false,
  "cameraAngle": "side",
  "primary_muscles": ["quadriceps", "glutes"],
  "calibrationMode": "standing",
  "calibrationLandmarks": [23, 24, 25, 26, 27, 28, 11, 12],
  "smoothingAlpha": 0.25,
  "isIsometric": true,
  "landmarks": { "left": [23, 25, 27], "right": [24, 26, 28] },
  "anglePoint": [23, 25, 27],
  "repThresholds": { "downAngle": 88, "upAngle": 95, "reversedDirection": false },
  "formChecks": []
}
```

Engine must implement ExerciseFormEngine interface with these fields:
- holdStartMs: number | null
- totalHoldMs: number (accumulated time in correct position)
- cleanHoldMs: number (time with no form errors)
- smoother: AngleSmoother(0.25)
- prioritizer: FeedbackPrioritizer(CUE_DEFS)

CUE_DEFS:
```ts
{ id: 'ws_too_high', severity: 'error',   text: 'Lower your hips to 90 degrees',        voiceText: 'Go lower',   cooldownReps: 0 },
{ id: 'ws_too_low',  severity: 'warning', text: "Rise slightly — you're below 90",       voiceText: 'Rise a bit', cooldownReps: 0 },
{ id: 'ws_back',     severity: 'error',   text: 'Press your back flat against the wall', voiceText: 'Back flat',  cooldownReps: 0 },
{ id: 'ws_shin',     severity: 'warning', text: 'Adjust foot position',                  voiceText: 'Feet adjust',cooldownReps: 0 },
```

update() logic:
1. Compute kneeAngle = angleDeg(hip, knee, ankle) with smoother.
2. Fire ws_too_high if kneeAngle > 100. Fire ws_too_low if kneeAngle < 80.
3. Fire ws_back if verticalLeanDeg(shoulder, hip) > 12.
4. Fire ws_shin if Math.abs(ankle.z - knee.z) > 0.06m. Determine direction
   from sign: if ankle.z > knee.z + 0.06, feet too far. If ankle.z <
   knee.z - 0.06, feet too close.
5. isHolding = kneeAngle in [80,105] AND no error-level issues.
6. Track totalHoldMs and cleanHoldMs.
7. Show live angle as primaryCue when form is correct:
   e.g. "92 degrees — perfect depth" or "98 degrees — go lower".
8. Return EngineOutput with repCount: 0 and metrics: { holdDurationMs,
   cleanHoldMs, kneeAngle }. Camera UI reads metrics.holdDurationMs to
   display hold timer.

---

### L3: Step-Up
**File:** src/features/form-engine/engines/step-up-engine.ts
**Class:** StepUpEngine extends GenericExerciseEngine
**Constructor:** super('step_up')

exercises.json:
```json
"step_up": {
  "name": "Step-up",
  "isUnilateral": true,
  "cameraAngle": "side",
  "primary_muscles": ["quadriceps", "glutes", "hip_flexors"],
  "calibrationMode": "standing",
  "calibrationLandmarks": [11, 12, 23, 24, 25, 26, 27, 28],
  "smoothingAlpha": 0.40,
  "landmarks": { "left": [23, 25, 27], "right": [24, 26, 28] },
  "anglePoint": [23, 25, 27],
  "repThresholds": { "downAngle": 90, "upAngle": 165, "reversedDirection": false },
  "formChecks": []
}
```

CUE_DEFS:
```ts
{ id: 'su_knee_forward', severity: 'error',   text: 'Drive through your heel, not your toe', voiceText: 'Heel drive',      cooldownReps: 1 },
{ id: 'su_lockout',      severity: 'error',   text: 'Stand tall at the top — full lockout',  voiceText: 'Stand tall',      cooldownReps: 1 },
{ id: 'su_lean',         severity: 'warning', text: 'Keep your torso upright',               voiceText: 'Chest up',        cooldownReps: 2 },
{ id: 'su_control',      severity: 'warning', text: "Control the step down — don't drop",   voiceText: 'Control descent', cooldownReps: 2 },
```

Form checks:
- Determine working leg: leftIsLeading = lKneeAngle < rKneeAngle - 15.
  Use the corresponding hip/knee/ankle landmarks for checks.
- su_knee_forward: compute -(knee.z - ankle.z). If > 0.08 (knee more than
  8cm in front of ankle), fire.
- su_lockout: at UP phase, compute hipExtAngle = angleDeg(shoulder, hip,
  knee). If < 160, fire.
- su_lean: verticalLeanDeg(shoulder, hip) > 20, fire.
- su_control: record descentStartMs when phase enters UP. At rep
  completion, if (timestampMs - descentStartMs) < 400, fire.

---

### L4: Calf Raise
**File:** src/features/form-engine/engines/calf-raise-engine.ts
**Class:** CalfRaiseEngine extends GenericExerciseEngine
**Constructor:** super('calf_raise')

IMPORTANT: This exercise uses a DIFFERENT landmark triple for the primary
angle: knee(25) -> ankle(27) -> foot_index(31). This is NOT the standard
hip-knee-ankle triple. Verify GenericExerciseEngine uses the landmarks
array from config for angle calculation.

exercises.json:
```json
"calf_raise": {
  "name": "Calf raise",
  "isUnilateral": false,
  "cameraAngle": "side",
  "primary_muscles": ["gastrocnemius", "soleus"],
  "calibrationMode": "standing",
  "calibrationLandmarks": [23, 24, 25, 26, 27, 28],
  "smoothingAlpha": 0.20,
  "minVisibilityOverrides": { "27": 0.72, "28": 0.72, "31": 0.72, "32": 0.72 },
  "landmarks": { "left": [25, 27, 31], "right": [26, 28, 32] },
  "anglePoint": [25, 27, 31],
  "repThresholds": { "downAngle": 75, "upAngle": 110, "reversedDirection": false },
  "formChecks": []
}
```

CUE_DEFS:
```ts
{ id: 'cr_peak',      severity: 'error',   text: 'Rise up fully on your toes',          voiceText: 'Full rise',      cooldownReps: 1 },
{ id: 'cr_heel_down', severity: 'warning', text: 'Lower your heels all the way down',    voiceText: 'Heels down',     cooldownReps: 2 },
{ id: 'cr_knee_bend', severity: 'warning', text: 'Keep your knees straight',             voiceText: 'Knees straight', cooldownReps: 2 },
{ id: 'cr_lean',      severity: 'warning', text: "Don't lean forward",                   voiceText: 'Stay upright',   cooldownReps: 2 },
{ id: 'cr_low_vis',   severity: 'info',    text: 'Move to better lighting for tracking', voiceText: 'Better lighting',cooldownReps: 5 },
```

Form checks:
- Check landmark visibility first. If foot_index landmarks not visible at
  0.72 threshold, fire cr_low_vis and skip foot-based checks.
- cr_peak: at UP phase, if primaryAngle < 100, fire.
- cr_heel_down: at DOWN phase, if primaryAngle > 82, fire.
- cr_knee_bend: compute knee angle = angleDeg(hip, knee, ankle) using
  landmarks 23,25,27. If < 165, fire.
- cr_lean: verticalLeanDeg(shoulder, hip) > 8, fire.

---

### L5: Nordic Hamstring Curl
**File:** src/features/form-engine/engines/nordic-curl-engine.ts
**Class:** NordicCurlEngine extends GenericExerciseEngine
**Constructor:** super('nordic_curl')

exercises.json:
```json
"nordic_curl": {
  "name": "Nordic hamstring curl",
  "isUnilateral": false,
  "cameraAngle": "side",
  "primary_muscles": ["hamstrings"],
  "calibrationMode": "kneeling",
  "calibrationLandmarks": [11, 12, 23, 24, 25, 26],
  "smoothingAlpha": 0.30,
  "landmarks": { "left": [23, 25, 27], "right": [24, 26, 28] },
  "anglePoint": [23, 25, 27],
  "repThresholds": { "downAngle": 15, "upAngle": 155, "reversedDirection": false },
  "formChecks": []
}
```

Add "kneeling" calibration mode to CalibrationGate:
- Check knee.y is within 0.15m of hip.y (both near floor = kneeling).
- Check shoulder.y is significantly above hip.y (not curled over).
- verticalLeanDeg(shoulder, hip) < 15 (kneeling upright).
- Message: "Kneel upright with feet anchored and hold still".

CUE_DEFS:
```ts
{ id: 'nc_hip_break', severity: 'error',   text: "Keep hips locked — don't fold at the waist", voiceText: 'Hips locked',    cooldownReps: 1 },
{ id: 'nc_too_fast',  severity: 'error',   text: 'Slow down — control the descent',            voiceText: 'Slow down',      cooldownReps: 1 },
{ id: 'nc_body_line', severity: 'warning', text: 'Keep your body in a straight line',          voiceText: 'Stay straight',  cooldownReps: 2 },
```

Form checks:
- nc_hip_break: compute hipLockAngle = angleDeg(shoulder, hip, knee) using
  landmarks 11,23,25. This MUST stay > 165 at all times. If < 160, fire.
  This is the most critical check — a break here means the exercise is
  not a Nordic curl at all.
- nc_too_fast: track descentStartMs when phase enters UP state (user
  kneeling upright). When phase reaches DOWN, compute descentMs =
  timestampMs - descentStartMs. If < 1500, fire the cue with the actual
  duration in the message: e.g. "Control the descent — 0.9s is too fast
  (target: 2-4s)".
- nc_body_line: track prevLeanDeg each frame. If
  Math.abs(currentLean - prevLean) > 8 within a single frame, fire
  (sudden body line break).