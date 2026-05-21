import { create } from 'zustand'
import type { AwardXPResult } from '@/types/xp'

interface XPState {
  xpTotal:         number
  xpLevel:         number
  justLeveledUp:   boolean
  prevLevel:       number
  lastAwardAmount: number | null

  init:         (xpTotal: number, xpLevel: number) => void
  applyAward:   (result: AwardXPResult) => void
  clearLevelUp: () => void
}

export const useXPStore = create<XPState>((set) => ({
  xpTotal:         0,
  xpLevel:         1,
  justLeveledUp:   false,
  prevLevel:       1,
  lastAwardAmount: null,

  init: (xpTotal, xpLevel) =>
    set({ xpTotal, xpLevel, justLeveledUp: false }),

  applyAward: (result) =>
    set({
      xpTotal:         result.new_xp,
      xpLevel:         result.new_level,
      prevLevel:       result.prev_level,
      justLeveledUp:   result.leveled_up,
      lastAwardAmount: result.amount,
    }),

  clearLevelUp: () =>
    set({ justLeveledUp: false, lastAwardAmount: null }),
}))
