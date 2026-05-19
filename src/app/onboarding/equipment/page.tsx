'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { saveEquipmentProfile } from '@/lib/onboarding/sessions';
import { EQUIPMENT_OPTIONS, type EquipmentId } from '@/lib/onboarding/types';

export default function EquipmentPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<EquipmentId>>(new Set(['bodyweight']));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    })();
  }, []);

  function toggle(id: EquipmentId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (id === 'bodyweight') return next; // always keep bodyweight
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!userId) { setError('Login required.'); return; }
    setSaving(true);
    setError(null);
    try {
      await saveEquipmentProfile(userId, Array.from(selected));
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save equipment');
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <h1 className="onboarding-title">Your Equipment</h1>
        <p className="onboarding-subtitle">
          Select everything you have access to. We use this to filter programs and exercises to what you can actually do.
        </p>

        <div className="equipment-grid">
          {EQUIPMENT_OPTIONS.map(opt => {
            const active = selected.has(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                className={`equipment-tile${active ? ' equipment-tile-active' : ''}`}
                onClick={() => toggle(opt.id)}
                aria-pressed={active}
              >
                <span className="equipment-tile-label">{opt.label}</span>
                {active && <span className="equipment-tile-check">&#10003;</span>}
              </button>
            );
          })}
        </div>

        {error && (
          <p style={{ color: 'var(--color-warn)', fontSize: '0.85rem', margin: '8px 0' }}>{error}</p>
        )}

        <button
          type="button"
          className="btn btn-primary btn-full"
          style={{ marginTop: 16 }}
          onClick={handleSave}
          disabled={saving || selected.size === 0}
        >
          {saving ? 'Saving...' : 'Continue'}
        </button>

        <button
          type="button"
          style={{ marginTop: 10, width: '100%', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', padding: '6px 0' }}
          onClick={() => router.push('/dashboard')}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
