'use client';

export type RateLimitPeriod = 'day' | 'week';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisWeekKey(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function lsKey(key: string, period: RateLimitPeriod): string {
  return `gymfxr_rl_${key}_${period === 'day' ? todayKey() : thisWeekKey()}`;
}

export function rlUsed(key: string, period: RateLimitPeriod): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(lsKey(key, period)) ?? '0', 10);
}

export function rlIncrement(key: string, period: RateLimitPeriod): number {
  if (typeof window === 'undefined') return 0;
  const k = lsKey(key, period);
  const next = parseInt(localStorage.getItem(k) ?? '0', 10) + 1;
  localStorage.setItem(k, String(next));
  return next;
}

export function rlRemaining(key: string, max: number, period: RateLimitPeriod): number {
  return Math.max(0, max - rlUsed(key, period));
}

export function rlLimited(key: string, max: number, period: RateLimitPeriod): boolean {
  return rlUsed(key, period) >= max;
}

export function rlResetLabel(period: RateLimitPeriod): string {
  if (period === 'day') return 'midnight (12:00 AM)';
  const d = new Date();
  const diff = 7 - d.getDay();
  const reset = new Date(d);
  reset.setDate(d.getDate() + (diff === 7 ? 7 : diff));
  return reset.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
