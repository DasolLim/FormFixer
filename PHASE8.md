## PHASE 8 — TESTING PROTOCOL

### Phase 1 bug fix verification
1. Run any GenericExerciseEngine exercise (bicep curl) with intentionally
   bad form for 5 reps. Check repScores in console — form dimension must
   be less than 100.
2. Switch to pull-up — calibration should show "Hang from the bar" not
   "Stand upright".
3. Film a push-up from the right side — orientation should be detected
   and landmark assignments swapped.
4. Do a crunch set — reps should count reliably across the full 45-degree
   range (120-165 degrees).

### Phase 2 form correction verification
For each improved exercise: perform with correct form (no cues should
fire), then introduce the specific fault (cue must fire within 1-2 frames).

### Phase 3 rep counter verification
1. Curl to top, stop 6 seconds. No rep counted, state resets to READY.
2. Fast 10 reps — no double counting.
3. repScores[n].ascentMs populated for all reps.

### Phase 4 scoring verification
1. Five perfect reps: all scores >= 90, grade A or better.
2. Five consistently shallow reps: depth dimension penalized but overall
   stays in 50-75 range (not catastrophically low).
3. Ten reps total: sessionSummary.trendDirection and improvementTip
   are populated and accurate.

### New exercise verification (for each of the 10)
1. Add console.log('angle:', base.primaryAngle, 'phase:', base.phase)
2. Perform exercise slowly — confirm phase transitions are correct:
   READY -> DOWN -> UP for normal exercises
   READY -> UP -> DOWN for reversed (face_pull, seated_cable_row)
3. Confirm repCount increments exactly once per full rep.
4. Confirm at least one form cue fires with incorrect form.
5. Remove console.log before committing.

### Wall sit specific verification
1. Check that metrics.holdDurationMs increments in real time.
2. Check that primaryCue shows live knee angle when form is correct.
3. Check that ws_too_high fires above 100 degrees and clears below 100.

---

## COMPLETE ANGLE REFERENCE — ALL 20 EXERCISES

```
Exercise              | Camera | Landmark triple (L)  | Down  | Up   | Reversed
----------------------|--------|----------------------|-------|------|----------
squat                 | front  | 23->25->27           | 110   | 160  | false
push_up               | side   | 11->13->15           | 130   | 160  | false
sit_up                | side   | 11->23->27           | 145   | 160  | false
bicep_curl            | front  | 11->13->15           | 160   | 60   | true
lateral_raise         | front  | 23->11->13           | 30    | 80   | false
overhead_press        | front  | 23->11->13           | 100   | 150  | false
leg_raise             | side   | 11->23->27           | 130   | 160  | false
knee_raise            | front  | 23->25->27           | 110   | 160  | false
crunch (FIXED)        | side   | 11->23->27           | 165   | 120  | true
pull_up               | front  | 11->13->15           | 140   | 70   | true
incline_db_press      | front  | 11->13->15           | 75    | 160  | false
tricep_pushdown       | side   | 11->13->15           | 25    | 90   | false
face_pull             | side   | 11->13->15           | 160   | 55   | true
arnold_press          | front  | 11->13->15           | 80    | 160  | false
seated_cable_row      | side   | 11->13->15           | 155   | 45   | true
sumo_squat            | front  | 23->25->27           | 95    | 165  | false
wall_sit              | side   | 23->25->27           | 88    | 95   | false (isometric)
step_up               | side   | 23->25->27           | 90    | 165  | false
calf_raise            | side   | 25->27->31 (NEW)     | 75    | 110  | false
nordic_curl           | side   | 23->25->27           | 15    | 155  | false
```

---
