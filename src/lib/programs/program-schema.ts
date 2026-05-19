import { z } from 'zod'

const WorkoutExerciseSchema = z.object({
  exercise_id: z.string().min(1),
  sets: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(100),
  rest_seconds: z.number().int().min(15).max(300),
})

const ProgramDaySchema = z.object({
  dayIndex: z.number().int().min(0),
  label: z.string().min(1).max(100),
  exercises: z.array(WorkoutExerciseSchema).min(1).max(8),
})

export const GeneratedProgramSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().min(10).max(400),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  weeks: z.number().int().min(1).max(16),
  required_equipment: z.array(z.string()).min(1),
  workout_days: z.array(ProgramDaySchema).min(1).max(7),
})

export type GeneratedProgram = z.infer<typeof GeneratedProgramSchema>

export function validateExerciseIds(
  program: GeneratedProgram,
  validIds: string[]
): string[] {
  const invalid: string[] = []
  for (const day of program.workout_days) {
    for (const ex of day.exercises) {
      if (!validIds.includes(ex.exercise_id)) {
        invalid.push(ex.exercise_id)
      }
    }
  }
  return invalid
}
