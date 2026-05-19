export type MovementBaseline = {
  squat: {
    avgBottomAngleDeg: number
    avgTorsoLeanDeg: number
    symmetryScore: number
    repsRecorded: number
  }
  overheadReach: {
    leftShoulderFlexion: number
    rightShoulderFlexion: number
    mobilityScore: number
  }
  recordedAt: string
}

export type EquipmentId =
  | 'bodyweight'
  | 'dumbbells'
  | 'barbell'
  | 'pull_up_bar'
  | 'resistance_bands'
  | 'kettlebell'
  | 'cable_machine'

export const EQUIPMENT_OPTIONS: { id: EquipmentId; label: string }[] = [
  { id: 'bodyweight',       label: 'Bodyweight' },
  { id: 'dumbbells',        label: 'Dumbbells' },
  { id: 'barbell',          label: 'Barbell' },
  { id: 'pull_up_bar',      label: 'Pull-up Bar' },
  { id: 'resistance_bands', label: 'Resistance Bands' },
  { id: 'kettlebell',       label: 'Kettlebell' },
  { id: 'cable_machine',    label: 'Cable Machine' },
]
