'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import {
  getTreadmillMET,
  getStairmasterMET,
  STRENGTH_MET,
  calculateCaloriesBurned,
} from '@/lib/met-values';

type ExerciseType = 'treadmill' | 'stairmaster' | 'strength' | 'other';
type SpeedUnit = 'kmh' | 'mph';
type StrengthIntensity = 'light' | 'moderate' | 'vigorous';

const OTHER_MET_BY_TYPE: Record<string, number> = {
  running:    9.8,
  jogging:    7.0,
  cycling:    7.5,
  hiking:     6.0,
  swimming:   7.0,
  rowing:     7.0,
  elliptical: 5.0,
  HIIT:       8.0,
  boxing:     9.5,
  jump_rope:  11.0,
  basketball: 6.5,
  soccer:     7.0,
  dancing:    5.0,
  yoga:       2.5,
  pilates:    3.0,
};

const EXERCISE_TYPE_OPTIONS: { value: ExerciseType; label: string }[] = [
  { value: 'treadmill',   label: 'Treadmill' },
  { value: 'stairmaster', label: 'StairMaster' },
  { value: 'strength',    label: 'Lifting Weight' },
  { value: 'other',       label: 'Other Cardio' },
];

const STRENGTH_INTENSITY_OPTIONS: { value: StrengthIntensity; label: string; desc: string }[] = [
  { value: 'light',    label: 'Light',    desc: 'Machines, light weights' },
  { value: 'moderate', label: 'Moderate', desc: 'Free weights, general lifting' },
  { value: 'vigorous', label: 'Vigorous', desc: 'Heavy compounds, powerlifting' },
];

const OTHER_CARDIO_OPTIONS = Object.keys(OTHER_MET_BY_TYPE).map(k => ({
  value: k,
  label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
}));

function getStairmasterLabel(level: number): string {
  if (level <= 6)  return 'Low intensity';
  if (level <= 13) return 'Moderate intensity';
  return 'High intensity';
}

const toKmh = (mph: number) => Math.round(mph * 1.60934 * 10) / 10;

interface CalorieBurnCardProps {
  userId: string | null;
}

export function CalorieBurnCard({ userId }: CalorieBurnCardProps) {
  const [exerciseType,       setExerciseType]       = useState<ExerciseType>('treadmill');
  const [durationMinutes,    setDurationMinutes]    = useState(30);
  const [speedValue,         setSpeedValue]         = useState(8);
  const [speedUnit,          setSpeedUnit]          = useState<SpeedUnit>('kmh');
  const [incline,            setIncline]            = useState(0);
  const [stairmasterLevel,   setStairmasterLevel]   = useState(10);
  const [strengthIntensity,  setStrengthIntensity]  = useState<StrengthIntensity>('moderate');
  const [otherCardioType,    setOtherCardioType]    = useState('cycling');
  const [weightKg,           setWeightKg]           = useState<number | null>(null);
  const [weightMissing,      setWeightMissing]      = useState(false);

  useEffect(() => {
    if (!userId) return;
    getSupabaseClient()
      .from('profiles')
      .select('target_weight_kg')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.target_weight_kg) {
          setWeightKg(data.target_weight_kg);
        } else {
          setWeightMissing(true);
        }
      });
  }, [userId]);

  const effectiveWeightKg = weightKg ?? 70;

  const speedKmh = speedUnit === 'mph' ? toKmh(speedValue) : speedValue;

  const { met, label } = (() => {
    switch (exerciseType) {
      case 'treadmill':
        return { met: getTreadmillMET(speedKmh, incline), label: `${speedValue} ${speedUnit === 'kmh' ? 'km/h' : 'mph'}${incline > 0 ? ` · ${incline}% incline` : ''}` };
      case 'stairmaster':
        return { met: getStairmasterMET(stairmasterLevel), label: `Level ${stairmasterLevel} · ${getStairmasterLabel(stairmasterLevel)}` };
      case 'strength':
        return { met: STRENGTH_MET[strengthIntensity], label: `${STRENGTH_INTENSITY_OPTIONS.find(o => o.value === strengthIntensity)?.label} intensity` };
      case 'other':
        return { met: OTHER_MET_BY_TYPE[otherCardioType] ?? 6.0, label: OTHER_CARDIO_OPTIONS.find(o => o.value === otherCardioType)?.label ?? '' };
    }
  })();

  const calories = calculateCaloriesBurned(met, effectiveWeightKg, durationMinutes);

  return (
    <div className="card">
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>
        Calorie Burn
      </p>

      {/* Exercise type */}
      <label className="form-label">
        Exercise type
        <select
          value={exerciseType}
          onChange={e => setExerciseType(e.target.value as ExerciseType)}
          className="exercise-select"
        >
          {EXERCISE_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {/* Duration */}
      <label className="form-label" style={{ marginTop: 10 }}>
        Duration (minutes)
        <input
          type="number"
          min={1}
          max={300}
          value={durationMinutes}
          onChange={e => setDurationMinutes(Math.max(1, Number(e.target.value) || 1))}
          className="form-input"
        />
      </label>

      {/* CHANGE 2 — Treadmill inputs */}
      {exerciseType === 'treadmill' && (
        <>
          <div style={{ marginTop: 10 }}>
            <label className="form-label">
              Speed
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                min={speedUnit === 'kmh' ? 1 : 0.6}
                max={speedUnit === 'kmh' ? 20 : 12.4}
                step={0.5}
                value={speedValue}
                onChange={e => setSpeedValue(Number(e.target.value) || 0)}
                className="form-input"
                style={{ flex: 1 }}
              />
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                {(['kmh', 'mph'] as SpeedUnit[]).map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {
                      if (u === speedUnit) return;
                      setSpeedUnit(u);
                      setSpeedValue(prev =>
                        u === 'mph'
                          ? Math.round(prev / 1.60934 * 10) / 10
                          : Math.round(prev * 1.60934 * 10) / 10
                      );
                    }}
                    style={{
                      padding: '6px 10px',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 12,
                      fontWeight: 600,
                      background: speedUnit === u ? 'var(--accent)' : 'var(--bg-input)',
                      color: speedUnit === u ? 'var(--text-on-lime)' : 'var(--text-secondary)',
                    }}
                  >
                    {u === 'kmh' ? 'km/h' : 'mph'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="form-label" style={{ marginTop: 10 }}>
            Incline (%)
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="range"
                min={0}
                max={15}
                step={0.5}
                value={incline}
                onChange={e => setIncline(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 36, textAlign: 'right' }}>
                {incline}%
              </span>
            </div>
          </label>
        </>
      )}

      {/* CHANGE 3 — StairMaster inputs */}
      {exerciseType === 'stairmaster' && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="form-label" style={{ margin: 0 }}>Level</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {stairmasterLevel} — {getStairmasterLabel(stairmasterLevel)}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={stairmasterLevel}
            onChange={e => setStairmasterLevel(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            <span>1</span>
            <span>10</span>
            <span>20</span>
          </div>
        </div>
      )}

      {/* Strength inputs */}
      {exerciseType === 'strength' && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {STRENGTH_INTENSITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStrengthIntensity(opt.value)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10,
                border: `1px solid ${strengthIntensity === opt.value ? 'var(--border-active)' : 'var(--border)'}`,
                background: strengthIntensity === opt.value ? 'var(--accent-muted)' : 'var(--bg-input)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Other cardio inputs */}
      {exerciseType === 'other' && (
        <label className="form-label" style={{ marginTop: 10 }}>
          Activity
          <select
            value={otherCardioType}
            onChange={e => setOtherCardioType(e.target.value)}
            className="exercise-select"
          >
            {OTHER_CARDIO_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      )}

      {/* CHANGE 4 — Calorie preview */}
      <div style={{
        marginTop: 16,
        padding: '14px 16px',
        borderRadius: 12,
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 4px' }}>Estimated burn</p>
        <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', margin: '0 0 4px', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {calories} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>kcal</span>
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          MET {met} · {effectiveWeightKg} kg · {durationMinutes} min
          {label ? ` · ${label}` : ''}
        </p>
        {weightMissing && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', fontStyle: 'italic' }}>
            Add your weight in your nutrition profile for accurate estimates. Using 70 kg fallback.
          </p>
        )}
      </div>
    </div>
  );
}
