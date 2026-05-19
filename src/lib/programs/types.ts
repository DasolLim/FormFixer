export type WorkoutExercise = {
  exercise_id: string
  sets: number
  reps: number
  rest_seconds: number
}

export type ProgramDay = {
  dayIndex: number
  label: string
  exercises: WorkoutExercise[]
}

export type ProgramTemplate = {
  id: string
  slug: string
  title: string
  description: string | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  weeks: number
  author_id: string | null
  is_public: boolean
  is_ai_generated: boolean
  required_equipment: string[]
  workout_days: ProgramDay[]
  created_at: string
}

export type ProgramWithProgress = ProgramTemplate & {
  progress: {
    current_week: number
    completed_workouts: number
    completion_percent: number
  } | null
}
