import type { AwardXPResult, XPSource } from '@/types/xp'
import { getSupabaseClient } from '@/lib/supabaseClient'

// ─── Constants ───────────────────────────────────────────────────────────────
export const BASE_SESSION_XP       = 50
export const MAX_STREAK_MULTIPLIER = 2.0
export const STREAK_RATE           = 0.05   // +5% per streak day
export const CHALLENGE_BONUS_XP    = 300    // flat on challenge completion
export const WEEKLY_CHALLENGE_XP   = 200
export const GOAL_HIT_XP           = 100
export const PROGRAM_COMPLETE_XP   = 500

export const SESSION_MILESTONES: Record<number, number> = {
  10:  250,
  25:  500,
  50:  750,
  100: 2000,
}

// ─── Formula ─────────────────────────────────────────────────────────────────

/** Streak multiplier: 1.0 at day 0, caps at MAX_STREAK_MULTIPLIER */
export function streakMultiplier(streakDays: number): number {
  return Math.min(MAX_STREAK_MULTIPLIER, 1 + streakDays * STREAK_RATE)
}

/**
 * Session XP.
 * formScore: 0.0–1.0 (normalize from 0-100 before calling)
 * Every session earns at least BASE_SESSION_XP.
 */
export function calcSessionXP(formScore: number, repCount: number, streakDays: number): number {
  const repXP = formScore * repCount
  return Math.round((BASE_SESSION_XP + repXP) * streakMultiplier(streakDays))
}

/** Cumulative XP required to reach the START of a given level */
export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 100
}

/** Derive level from total XP */
export function xpToLevel(totalXP: number): number {
  return Math.min(50, Math.max(1, Math.floor(Math.sqrt(Math.max(0, totalXP) / 100)) + 1))
}

/** Progress 0→1 within the current level */
export function xpProgress(xpTotal: number, level: number): number {
  const start = xpForLevel(level)
  const end   = xpForLevel(level + 1)
  return Math.min(1, Math.max(0, (xpTotal - start) / (end - start)))
}

/** XP remaining until next level */
export function xpToNextLevel(xpTotal: number, level: number): number {
  if (level >= 50) return 0
  return xpForLevel(level + 1) - xpTotal
}

/** Color tier changes every 10 levels */
export function xpLevelColor(level: number): string {
  if (level >= 50) return '#FFD700'
  if (level >= 40) return '#FF6B35'
  if (level >= 30) return '#C084FC'
  if (level >= 20) return '#60A5FA'
  if (level >= 10) return '#34D399'
  return '#94A3B8'
}

export function xpLevelGlow(level: number): string {
  if (level >= 50) return '0 0 10px #FFD700, 0 0 20px rgba(255,215,0,0.5)'
  if (level >= 40) return '0 0 8px rgba(255,107,53,0.8)'
  if (level >= 30) return '0 0 8px rgba(192,132,252,0.8)'
  if (level >= 20) return '0 0 6px rgba(96,165,250,0.7)'
  if (level >= 10) return '0 0 6px rgba(52,211,153,0.6)'
  return 'none'
}

// ─── Supabase helper — only place xp_total is mutated ────────────────────────

/**
 * Award XP via the award_xp RPC.
 * Never update profiles.xp_total directly — always use this.
 */
export async function awardXP(
  userId: string,
  amount: number,
  source: XPSource,
): Promise<AwardXPResult> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('award_xp', {
    p_user_id: userId,
    p_amount:  amount,
    p_source:  source,
  })
  if (error) throw new Error(`award_xp failed: ${error.message}`)
  const result = typeof data === 'string' ? JSON.parse(data) : data
  return result as AwardXPResult
}
