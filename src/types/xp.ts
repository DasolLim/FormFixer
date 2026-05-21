export type XPSource =
  | 'session'
  | 'challenge'
  | 'goal'
  | 'program'
  | 'weekly_challenge'
  | 'session_milestone'

export interface AwardXPResult {
  new_xp:     number
  new_level:  number
  prev_level: number
  leveled_up: boolean
  amount:     number
  source:     XPSource
}

export interface XPEvent {
  id:         string
  user_id:    string
  amount:     number
  source:     XPSource
  created_at: string
}
