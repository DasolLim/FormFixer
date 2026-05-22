## PHASE 7 — REGISTER ALL NEW EXERCISES

**File:** src/features/form-engine/engine-factory.ts

Add all 10 imports:
```ts
import { InclineDbPressEngine }  from './engines/incline-db-press-engine';
import { TricepPushdownEngine }  from './engines/tricep-pushdown-engine';
import { FacePullEngine }        from './engines/face-pull-engine';
import { ArnoldPressEngine }     from './engines/arnold-press-engine';
import { SeatedCableRowEngine }  from './engines/seated-cable-row-engine';
import { SumoSquatEngine }       from './engines/sumo-squat-engine';
import { WallSitEngine }         from './engines/wall-sit-engine';
import { StepUpEngine }          from './engines/step-up-engine';
import { CalfRaiseEngine }       from './engines/calf-raise-engine';
import { NordicCurlEngine }      from './engines/nordic-curl-engine';
```

Add to getEngine() switch:
```ts
case 'incline_db_press': return new InclineDbPressEngine();
case 'tricep_pushdown':  return new TricepPushdownEngine();
case 'face_pull':        return new FacePullEngine();
case 'arnold_press':     return new ArnoldPressEngine();
case 'seated_cable_row': return new SeatedCableRowEngine();
case 'sumo_squat':       return new SumoSquatEngine();
case 'wall_sit':         return new WallSitEngine();
case 'step_up':          return new StepUpEngine();
case 'calf_raise':       return new CalfRaiseEngine();
case 'nordic_curl':      return new NordicCurlEngine();
```

Update EXERCISE_IDS:
```ts
export const EXERCISE_IDS = [
  'squat', 'push_up', 'sit_up', 'bicep_curl', 'lateral_raise',
  'overhead_press', 'leg_raise', 'knee_raise', 'crunch', 'pull_up',
  'incline_db_press', 'tricep_pushdown', 'face_pull', 'arnold_press', 'seated_cable_row',
  'sumo_squat', 'wall_sit', 'step_up', 'calf_raise', 'nordic_curl',
] as const;
```

---