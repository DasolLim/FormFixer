## IMPORTANT NOTES FOR CLAUDE CODE

- Read ALL existing engine files before editing any. Do not assume field
  names or method signatures — verify from actual source.
- All file imports use the @/ alias — match the existing pattern.
- All angles are in degrees. All world-space distances are in meters.
  Normalized landmarks use [0,1] relative to image size.
- Do NOT change the ExerciseFormEngine interface signature.
- GenericExerciseEngine exposes this.prevRepCount — use it in subclasses
  to detect rep completion.
- After Phase 1, run all 10 existing exercises and confirm no regressions
  before proceeding to Phase 2.
- Commit each phase separately with a clear commit message.
- The calf_raise uses landmark triple [25,27,31] not [23,25,27]. Confirm
  GenericExerciseEngine reads the landmark indices from config.landmarks
  rather than hardcoding them. If it hardcodes, fix that first.
- The wall_sit must implement ExerciseFormEngine directly, not via
  GenericExerciseEngine, because it has no rep counter.