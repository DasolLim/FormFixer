export type Phase = 'base' | 'build' | 'peak' | 'deload';

export interface ProgressionWeek {
  week:          number;
  sets:          number;
  reps:          string;
  phase:         Phase;
  coaching_note: string;
}

export function generateLinearProgression(
  baseSets: number,
  baseReps: string,
  totalWeeks: number,
): ProgressionWeek[] {
  const weeks: ProgressionWeek[] = [];

  const [minRep, maxRep] = baseReps.split('-').map(Number);
  const safeMin = isNaN(minRep) ? 8 : minRep;
  const safeMax = isNaN(maxRep) ? safeMin + 2 : maxRep;

  for (let w = 1; w <= totalWeeks; w++) {
    const isDeload = w === totalWeeks && totalWeeks >= 4;

    if (isDeload) {
      weeks.push({
        week:          w,
        sets:          Math.max(2, Math.floor(baseSets * 0.5)),
        reps:          `${safeMin - 2}-${safeMin}`,
        phase:         'deload',
        coaching_note: 'Deload week — reduce weight 40–50%, focus on form and recovery.',
      });
      continue;
    }

    const progressRatio = (w - 1) / Math.max(totalWeeks - 2, 1);
    let phase: Phase;
    if (progressRatio < 0.35)      phase = 'base';
    else if (progressRatio < 0.70) phase = 'build';
    else                           phase = 'peak';

    const repIncrement = Math.floor((w - 1) / 2);
    const newMin = safeMin + repIncrement;
    const newMax = safeMax + repIncrement;

    const setIncrement = phase === 'base' ? 0 : 1;
    const newSets = baseSets + setIncrement;

    const notes: Record<Phase, string> = {
      base:   'Establish baseline — prioritise full range of motion and muscle connection.',
      build:  'Progressive overload phase — add load when top of rep range is reached.',
      peak:   'Peak intensity — push close to failure on last set, maintain form.',
      deload: 'Deload week — reduce weight 40–50%, focus on form and recovery.',
    };

    weeks.push({
      week:          w,
      sets:          newSets,
      reps:          `${newMin}-${newMax}`,
      phase,
      coaching_note: notes[phase],
    });
  }

  return weeks;
}
