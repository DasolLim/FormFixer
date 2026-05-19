import { Flame } from 'lucide-react';

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak?: number;
}

export function StreakBadge({ currentStreak, longestStreak }: StreakBadgeProps) {
  if (currentStreak === 0) {
    return (
      <div className="streak-badge">
        <Flame size={18} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
        <span className="streak-label">Start your streak today</span>
      </div>
    );
  }

  return (
    <div className="streak-badge">
      <Flame size={18} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
      <span className="streak-count">{currentStreak}</span>
      <span className="streak-label">day streak</span>
      {longestStreak !== undefined && longestStreak > currentStreak && (
        <span className="streak-best">Best: {longestStreak}</span>
      )}
    </div>
  );
}
