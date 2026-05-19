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
import { getAllExerciseIds } from './exercise-config';

export function getEngine(exerciseId: string): ExerciseFormEngine {
  switch (exerciseId) {
    case 'squat':          return new SquatEngine();
    case 'push_up':        return new PushUpEngine();
    case 'bicep_curl':     return new BicepCurlEngine();
    case 'sit_up':         return new SitUpEngine();
    case 'lateral_raise':  return new LateralRaiseEngine();
    case 'overhead_press': return new OverheadPressEngine();
    case 'crunch':         return new CrunchEngine();
    case 'pull_up':        return new PullUpEngine();
    case 'leg_raise':      return new LegRaiseEngine();
    case 'knee_raise':     return new KneeRaiseEngine();
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
] as const;

export type ExerciseId = typeof EXERCISE_IDS[number];
