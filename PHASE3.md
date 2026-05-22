## PHASE 3 — IMPROVE REP COUNTER SYSTEM

### 3.1 Add rep timeout (Phase 1.6 covers this — ensure it is also
applied to SquatRepCounterStateMachine ASCENDING and BOTTOM states)

### 3.2 Add ascent timing to RepScorer

**File:** src/features/form-engine/rep-scorer.ts

Add ascentStartTimestampMs field. Record it when phase transitions DOWN→UP.
Compute ascentMs = timestampMs - ascentStartTimestampMs at rep completion.
Add ascentMs to RepScore type.

Add ascent dimension (8% weight):
```ts
if (ascentMs === 0)          ascentScore = 100;
else if (ascentMs <= 500)    ascentScore = 85;   // explosive — good
else if (ascentMs <= 2000)   ascentScore = 100;  // ideal
else                         ascentScore = Math.max(0, 100 - (ascentMs - 2000) / 30);
```

Update overall formula:
```
overall = depth*0.28 + symmetry*0.22 + form*0.32 + tempo*0.10 + ascent*0.08
```

### 3.3 Make smoothing alpha configurable per exercise

Add smoothingAlpha field to exercises.json for each exercise.
Default: 0.35. Fast exercises (calf raise): 0.20. Slow: 0.25.
Update GenericExerciseEngine to read config.smoothingAlpha and pass it
to both AngleSmoother instances.

---