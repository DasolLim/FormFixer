'use client';

import { useEffect } from 'react';
import { useXPStore } from '@/store/xpStore';
import { xpLevelColor, xpLevelGlow } from '@/lib/xp';

export function LevelUpModal() {
  const justLeveledUp = useXPStore(s => s.justLeveledUp);
  const xpLevel       = useXPStore(s => s.xpLevel);
  const prevLevel     = useXPStore(s => s.prevLevel);
  const clearLevelUp  = useXPStore(s => s.clearLevelUp);

  useEffect(() => {
    if (!justLeveledUp) return;
    const t = setTimeout(clearLevelUp, 4000);
    return () => clearTimeout(t);
  }, [justLeveledUp, clearLevelUp]);

  if (!justLeveledUp) return null;

  const color = xpLevelColor(xpLevel);
  const glow  = xpLevelGlow(xpLevel);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}
      onClick={clearLevelUp}
    >
      <div style={{
        background: 'var(--bg-card)',
        border: `2px solid ${color}`,
        borderRadius: 16,
        padding: '32px 48px',
        textAlign: 'center',
        boxShadow: glow !== 'none' ? glow : `0 0 32px ${color}55`,
        maxWidth: 320,
        width: '90vw',
      }}>
        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>⬆️</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
          Level {prevLevel} → Level {xpLevel}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: '-0.02em' }}>
          Level Up!
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
          Tap to dismiss
        </div>
      </div>
    </div>
  );
}
