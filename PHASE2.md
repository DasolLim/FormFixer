## PHASE 2 — IMPROVE EXISTING FORM CORRECTION

### 2.1 Squat — add butt wink and forward knee travel

**File:** src/features/form-engine/engines/squat-engine.ts

New CueDefs:
```ts
{ id: 'squat_butt_wink',    severity: 'error',   text: "Don't tuck your pelvis at the bottom", voiceText: 'Keep pelvis neutral', cooldownReps: 1 },
{ id: 'squat_knee_forward', severity: 'warning', text: 'Sit back — drive your hips back',       voiceText: 'Hips back',          cooldownReps: 2 },
```

Butt wink: track verticalLeanDeg(shoulder_mid, hip_mid) frame by frame
during descent. Store prevLeanDeg. If (currentLeanDeg - prevLeanDeg) > 8
for 3 consecutive frames while phase is DESCENDING or BOTTOM, fire
squat_butt_wink.

Forward knee travel: at BOTTOM phase, if (worldLandmarks[25].z -
worldLandmarks[27].z) > 0.05 (knee more than 5cm in front of ankle),
fire squat_knee_forward. Average left and right sides.

Lockout hysteresis: require the lockout angle (165 degrees) to be held
for 3 consecutive frames before counting the rep. Add a lockoutFrameCount
counter in SquatRepCounterStateMachine.

---

### 2.2 Push-up — differentiate hip sag vs pike, add elbow flare

**File:** src/features/form-engine/engines/push-up-engine.ts

Replace pushup_body_alignment with:
```ts
{ id: 'pushup_hips_sag',    severity: 'error',   text: 'Raise your hips — keep a straight line', voiceText: 'Hips up',      cooldownReps: 1 },
{ id: 'pushup_hips_pike',   severity: 'warning', text: 'Lower your hips — straight line only',    voiceText: 'Hips down',    cooldownReps: 2 },
{ id: 'pushup_elbow_flare', severity: 'warning', text: 'Tuck elbows closer to your body',         voiceText: 'Tuck elbows',  cooldownReps: 2 },
```

Compute bodyAngle = angleDeg(shoulder_mid, hip_mid, ankle_mid).
- bodyAngle < 155 AND hip_mid.y < shoulder_mid.y - 0.04 (hip below shoulder): fire pushup_hips_sag
- bodyAngle < 155 AND hip_mid.y > shoulder_mid.y + 0.04 (hip above shoulder): fire pushup_hips_pike
- Math.abs(worldLandmarks[13].x - worldLandmarks[11].x) > 0.14: fire pushup_elbow_flare

---

### 2.3 Sit-up and Crunch — scale-invariant neck check

**Files:** sit-up-engine.ts, crunch-engine.ts

Replace absolute earShoulderDist threshold with normalized ratio:
```ts
const earShoulderDist = distance2d(ear, shoulder);
const shoulderWidth   = distance2d(lShoulder, rShoulder);
const neckRatio       = earShoulderDist / Math.max(shoulderWidth, 0.2);
// Record baselineNeckRatio at calibration frame
// Fire neck_strain if (baselineNeckRatio - neckRatio) > 0.30
```

---

### 2.4 Bicep curl — add full extension and supination cues

**File:** src/features/form-engine/engines/bicep-curl-engine.ts

- Tighten curl_full_extension threshold from <150 to <155 degrees at DOWN phase.
- Add curl_supination (info severity): at UP phase, check if wrist.z < elbow.z - 0.02.
  Cue: "Rotate your palm toward the ceiling at the top". cooldownReps: 3.

---

### 2.5 Overhead press — add rib flare detection

**File:** src/features/form-engine/engines/overhead-press-engine.ts

Add press_rib_flare (warning): during UP approach phase, if
verticalLeanDeg(shoulder_mid, hip_mid) > 15 degrees, fire it.
Cue: "Keep your ribs down — brace your core".
At 18+ degrees, upgrade press_core_stability to error severity.

---

### 2.6 Lateral raise — add elbow-leads-wrist check

**File:** src/features/form-engine/engines/lateral-raise-engine.ts

Add raise_elbow_leads (warning): at UP phase, if worldLandmarks[15].y
(wrist) > worldLandmarks[13].y (elbow) + 0.03 in world space y-up
(wrist above elbow), fire it.
Cue: "Lead with your elbows, not your wrists".

---

### 2.7 Pull-up — fix kipping detection with rolling window

**File:** src/features/form-engine/engines/pull-up-engine.ts

Replace per-frame hip movement check with a rolling window approach:
- Maintain hipXRepMin and hipXRepMax (worst hip x values seen this rep).
- Fire pullup_kipping if (hipXRepMax - hipXRepMin) > 0.08m at any point.
- Reset hipXRepMin and hipXRepMax at the start of each new rep.

---

### 2.8 Leg raise — add momentum detection

**File:** src/features/form-engine/engines/leg-raise-engine.ts

Add legraise_momentum (warning): track prevPrimaryAngle each frame.
During concentric phase (legs rising), if
Math.abs(primaryAngle - prevPrimaryAngle) > 12 (more than 12 degrees per
frame), fire it after 3 consecutive such frames.
Cue: "Raise your legs slowly — no swinging".

---