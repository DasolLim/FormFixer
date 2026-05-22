import type { ExerciseFormEngine } from './form-engine';
import { SquatEngine } from './engines/squat-engine';
import { PushUpEngine } from './engines/push-up-engine';
import { BicepCurlEngine } from './engines/bicep-curl-engine';
import { SitUpEngine } from './engines/sit-up-engine';
import { LateralRaiseEngine } from './engines/lateral-raise-engine';
import { OverheadPressEngine } from './engines/overhead-press-engine';
import { CrunchEngine } from './engines/crunch-engine';
import { PullUpEngine } from './engines/pull-up-engine';
import { LegRaiseEngine } from './engines/leg-raise-engine';
import { KneeRaiseEngine } from './engines/knee-raise-engine';
import { InclineDbPressEngine } from './engines/incline-db-press-engine';
import { TricepPushdownEngine } from './engines/tricep-pushdown-engine';
import { FacePullEngine } from './engines/face-pull-engine';
import { ArnoldPressEngine } from './engines/arnold-press-engine';
import { SeatedCableRowEngine } from './engines/seated-cable-row-engine';
import { SumoSquatEngine } from './engines/sumo-squat-engine';
import { WallSitEngine } from './engines/wall-sit-engine';
import { StepUpEngine } from './engines/step-up-engine';
import { CalfRaiseEngine } from './engines/calf-raise-engine';
import { NordicCurlEngine } from './engines/nordic-curl-engine';
import { getAllExerciseIds } from './exercise-config';

export function getEngine(exerciseId: string): ExerciseFormEngine {
  switch (exerciseId) {
    case 'squat':             return new SquatEngine();
    case 'push_up':           return new PushUpEngine();
    case 'bicep_curl':        return new BicepCurlEngine();
    case 'sit_up':            return new SitUpEngine();
    case 'lateral_raise':     return new LateralRaiseEngine();
    case 'overhead_press':    return new OverheadPressEngine();
    case 'crunch':            return new CrunchEngine();
    case 'pull_up':           return new PullUpEngine();
    case 'leg_raise':         return new LegRaiseEngine();
    case 'knee_raise':        return new KneeRaiseEngine();
    case 'incline_db_press':  return new InclineDbPressEngine();
    case 'tricep_pushdown':   return new TricepPushdownEngine();
    case 'face_pull':         return new FacePullEngine();
    case 'arnold_press':      return new ArnoldPressEngine();
    case 'seated_cable_row':  return new SeatedCableRowEngine();
    case 'sumo_squat':        return new SumoSquatEngine();
    case 'wall_sit':          return new WallSitEngine();
    case 'step_up':           return new StepUpEngine();
    case 'calf_raise':        return new CalfRaiseEngine();
    case 'nordic_curl':       return new NordicCurlEngine();
    default:
      throw new Error(
        `Unknown exercise ID: "${exerciseId}". ` +
        `Valid IDs: ${getAllExerciseIds().join(', ')}`
      );
  }
}

/** All exercise IDs in display order. */
export const EXERCISE_IDS = [
  'squat',
  'push_up',
  'sit_up',
  'bicep_curl',
  'lateral_raise',
  'overhead_press',
  'leg_raise',
  'knee_raise',
  'crunch',
  'pull_up',
  'incline_db_press',
  'tricep_pushdown',
  'face_pull',
  'arnold_press',
  'seated_cable_row',
  'sumo_squat',
  'wall_sit',
  'step_up',
  'calf_raise',
  'nordic_curl',
] as const;

export type ExerciseId = typeof EXERCISE_IDS[number];
