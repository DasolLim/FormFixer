export type ProgramTemplate = {
  slug: string;
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate';
  durationWeeks: number;
  coachName: string;
  structure: string;
  exercises: string[];
  days: Array<{ dayNumber: number; title: string; workoutFocus: string }>;
};

export const PROGRAMS: ProgramTemplate[] = [
  {
    slug: 'form-fundamentals-4w',
    title: 'Form Fundamentals 4-Week',
    description: 'Build safe squat, push-up, and lunge mechanics with short guided sessions.',
    difficulty: 'Beginner',
    durationWeeks: 4,
    coachName: 'Coach Maya R.',
    structure: '3 workouts per week · mobility + strength focus',
    exercises: ['Squat', 'Push-up', 'Lunge', 'Core Bracing'],
    days: [
      { dayNumber: 1, title: 'Day 1', workoutFocus: 'Squat form + tempo reps' },
      { dayNumber: 2, title: 'Day 2', workoutFocus: 'Push-up mechanics + core' },
      { dayNumber: 3, title: 'Day 3', workoutFocus: 'Lunge stability + balance' }
    ]
  },
  {
    slug: 'strength-base-6w',
    title: 'Strength Base 6-Week',
    description: 'Progressive training split with movement quality and consistency tracking.',
    difficulty: 'Intermediate',
    durationWeeks: 6,
    coachName: 'Coach Daniel K.',
    structure: '4 workouts per week · strength + conditioning',
    exercises: ['Squat', 'Push-up', 'Lunge', 'Plank Variations'],
    days: [
      { dayNumber: 1, title: 'Day 1', workoutFocus: 'Lower body strength' },
      { dayNumber: 2, title: 'Day 2', workoutFocus: 'Upper body + core' },
      { dayNumber: 3, title: 'Day 3', workoutFocus: 'Full body technique' },
      { dayNumber: 4, title: 'Day 4', workoutFocus: 'Conditioning + mobility' }
    ]
  }
];

export function getProgramBySlug(slug: string) {
  return PROGRAMS.find((program) => program.slug === slug);
}
