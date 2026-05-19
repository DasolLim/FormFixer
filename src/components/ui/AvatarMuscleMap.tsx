'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  muscleData: Record<string, number>
  view?: 'front' | 'back'
}

const NEUTRAL_FILL   = 'var(--bg-card-raised)'
const NEUTRAL_STROKE = 'var(--border)'

function resolve(data: Record<string, number>, ...keys: string[]): number {
  for (const k of keys) {
    const v = data[k] ?? data[k.toLowerCase()] ?? 0
    if (v > 0) return v
  }
  return 0
}

type SVGShapeStyle = {
  fill: string
  stroke: string
  strokeWidth: number
}

function zoneStyle(intensity: number): SVGShapeStyle {
  if (intensity === 0) {
    return { fill: NEUTRAL_FILL, stroke: NEUTRAL_STROKE, strokeWidth: 1 }
  }
  return {
    fill: `rgba(213, 255, 95, ${intensity * 0.7})`,
    stroke: `rgba(213, 255, 95, ${intensity})`,
    strokeWidth: intensity > 0.5 ? 2 : 1,
  }
}

const neutral: SVGShapeStyle = { fill: NEUTRAL_FILL, stroke: NEUTRAL_STROKE, strokeWidth: 1 }

function FrontSVG({ d }: { d: Record<string, number> }) {
  const chest     = resolve(d, 'chest', 'pectorals')
  const shoulders = resolve(d, 'shoulders', 'delts', 'deltoids')
  const biceps    = resolve(d, 'biceps', 'bicep')
  const core      = resolve(d, 'core', 'abs', 'abdominals')
  const quads     = resolve(d, 'quads', 'quadriceps', 'quad')
  const calves    = resolve(d, 'calves', 'calf')

  return (
    <svg viewBox="0 0 160 265" style={{ display: 'block', width: '100%', maxWidth: 180 }} aria-label="Front muscle map">
      {/* Head */}
      <ellipse cx="80" cy="22" rx="17" ry="20" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* Neck */}
      <rect x="73" y="40" width="14" height="10" rx="3" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* Torso base */}
      <rect x="44" y="50" width="72" height="72" rx="8" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* Chest (upper torso) */}
      <rect x="50" y="54" width="60" height="46" rx="6" fill={zoneStyle(chest).fill} stroke={zoneStyle(chest).stroke} strokeWidth={zoneStyle(chest).strokeWidth} />
      {/* Core/Abs (lower torso) */}
      <rect x="52" y="100" width="56" height="20" rx="6" fill={zoneStyle(core).fill} stroke={zoneStyle(core).stroke} strokeWidth={zoneStyle(core).strokeWidth} />
      {/* Pelvis */}
      <rect x="52" y="122" width="56" height="18" rx="6" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* L Delt (char left = viewer right) */}
      <ellipse cx="122" cy="62" rx="13" ry="13" fill={zoneStyle(shoulders).fill} stroke={zoneStyle(shoulders).stroke} strokeWidth={zoneStyle(shoulders).strokeWidth} />
      {/* R Delt */}
      <ellipse cx="38" cy="62" rx="13" ry="13" fill={zoneStyle(shoulders).fill} stroke={zoneStyle(shoulders).stroke} strokeWidth={zoneStyle(shoulders).strokeWidth} />
      {/* L Bicep */}
      <rect x="116" y="73" width="14" height="38" rx="6" fill={zoneStyle(biceps).fill} stroke={zoneStyle(biceps).stroke} strokeWidth={zoneStyle(biceps).strokeWidth} />
      {/* R Bicep */}
      <rect x="30" y="73" width="14" height="38" rx="6" fill={zoneStyle(biceps).fill} stroke={zoneStyle(biceps).stroke} strokeWidth={zoneStyle(biceps).strokeWidth} />
      {/* L Elbow */}
      <ellipse cx="123" cy="113" rx="8" ry="7" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* R Elbow */}
      <ellipse cx="37" cy="113" rx="8" ry="7" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* L Forearm */}
      <rect x="117" y="118" width="12" height="30" rx="5" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* R Forearm */}
      <rect x="31" y="118" width="12" height="30" rx="5" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* L Hand */}
      <ellipse cx="123" cy="152" rx="7" ry="8" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* R Hand */}
      <ellipse cx="37" cy="152" rx="7" ry="8" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* L Hip */}
      <ellipse cx="90" cy="141" rx="12" ry="10" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* R Hip */}
      <ellipse cx="70" cy="141" rx="12" ry="10" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* L Quad */}
      <rect x="80" y="148" width="24" height="52" rx="6" fill={zoneStyle(quads).fill} stroke={zoneStyle(quads).stroke} strokeWidth={zoneStyle(quads).strokeWidth} />
      {/* R Quad */}
      <rect x="56" y="148" width="24" height="52" rx="6" fill={zoneStyle(quads).fill} stroke={zoneStyle(quads).stroke} strokeWidth={zoneStyle(quads).strokeWidth} />
      {/* L Knee */}
      <ellipse cx="92" cy="202" rx="11" ry="9" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* R Knee */}
      <ellipse cx="68" cy="202" rx="11" ry="9" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* L Calf */}
      <rect x="82" y="209" width="20" height="40" rx="6" fill={zoneStyle(calves).fill} stroke={zoneStyle(calves).stroke} strokeWidth={zoneStyle(calves).strokeWidth} />
      {/* R Calf */}
      <rect x="58" y="209" width="20" height="40" rx="6" fill={zoneStyle(calves).fill} stroke={zoneStyle(calves).stroke} strokeWidth={zoneStyle(calves).strokeWidth} />
      {/* L Foot */}
      <ellipse cx="92" cy="252" rx="10" ry="7" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* R Foot */}
      <ellipse cx="68" cy="252" rx="10" ry="7" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
    </svg>
  )
}

function BackSVG({ d }: { d: Record<string, number> }) {
  const shoulders  = resolve(d, 'shoulders', 'delts', 'deltoids')
  const triceps    = resolve(d, 'triceps', 'tricep')
  const back       = resolve(d, 'back', 'lats', 'lat')
  const glutes     = resolve(d, 'glutes', 'glute')
  const hamstrings = resolve(d, 'hamstrings', 'hamstring')
  const calves     = resolve(d, 'calves', 'calf')

  return (
    <svg viewBox="0 0 160 265" style={{ display: 'block', width: '100%', maxWidth: 180 }} aria-label="Back muscle map">
      {/* Head */}
      <ellipse cx="80" cy="22" rx="17" ry="20" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* Neck */}
      <rect x="73" y="40" width="14" height="10" rx="3" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* Torso base */}
      <rect x="44" y="50" width="72" height="72" rx="8" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* Traps (upper back center) */}
      <rect x="56" y="54" width="48" height="18" rx="4" fill={zoneStyle(back).fill} stroke={zoneStyle(back).stroke} strokeWidth={zoneStyle(back).strokeWidth} />
      {/* L Lat (viewer right side) */}
      <rect x="100" y="70" width="16" height="48" rx="5" fill={zoneStyle(back).fill} stroke={zoneStyle(back).stroke} strokeWidth={zoneStyle(back).strokeWidth} />
      {/* R Lat (viewer left side) */}
      <rect x="44" y="70" width="16" height="48" rx="5" fill={zoneStyle(back).fill} stroke={zoneStyle(back).stroke} strokeWidth={zoneStyle(back).strokeWidth} />
      {/* Pelvis */}
      <rect x="52" y="122" width="56" height="18" rx="6" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* L Glute */}
      <rect x="78" y="124" width="28" height="14" rx="6" fill={zoneStyle(glutes).fill} stroke={zoneStyle(glutes).stroke} strokeWidth={zoneStyle(glutes).strokeWidth} />
      {/* R Glute */}
      <rect x="54" y="124" width="28" height="14" rx="6" fill={zoneStyle(glutes).fill} stroke={zoneStyle(glutes).stroke} strokeWidth={zoneStyle(glutes).strokeWidth} />
      {/* L Delt */}
      <ellipse cx="122" cy="62" rx="13" ry="13" fill={zoneStyle(shoulders).fill} stroke={zoneStyle(shoulders).stroke} strokeWidth={zoneStyle(shoulders).strokeWidth} />
      {/* R Delt */}
      <ellipse cx="38" cy="62" rx="13" ry="13" fill={zoneStyle(shoulders).fill} stroke={zoneStyle(shoulders).stroke} strokeWidth={zoneStyle(shoulders).strokeWidth} />
      {/* L Tricep */}
      <rect x="116" y="73" width="14" height="38" rx="6" fill={zoneStyle(triceps).fill} stroke={zoneStyle(triceps).stroke} strokeWidth={zoneStyle(triceps).strokeWidth} />
      {/* R Tricep */}
      <rect x="30" y="73" width="14" height="38" rx="6" fill={zoneStyle(triceps).fill} stroke={zoneStyle(triceps).stroke} strokeWidth={zoneStyle(triceps).strokeWidth} />
      {/* L Elbow */}
      <ellipse cx="123" cy="113" rx="8" ry="7" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* R Elbow */}
      <ellipse cx="37" cy="113" rx="8" ry="7" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* L Forearm */}
      <rect x="117" y="118" width="12" height="30" rx="5" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* R Forearm */}
      <rect x="31" y="118" width="12" height="30" rx="5" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* L Hand */}
      <ellipse cx="123" cy="152" rx="7" ry="8" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* R Hand */}
      <ellipse cx="37" cy="152" rx="7" ry="8" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* L Hip */}
      <ellipse cx="90" cy="141" rx="12" ry="10" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* R Hip */}
      <ellipse cx="70" cy="141" rx="12" ry="10" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* L Hamstring */}
      <rect x="80" y="148" width="24" height="52" rx="6" fill={zoneStyle(hamstrings).fill} stroke={zoneStyle(hamstrings).stroke} strokeWidth={zoneStyle(hamstrings).strokeWidth} />
      {/* R Hamstring */}
      <rect x="56" y="148" width="24" height="52" rx="6" fill={zoneStyle(hamstrings).fill} stroke={zoneStyle(hamstrings).stroke} strokeWidth={zoneStyle(hamstrings).strokeWidth} />
      {/* L Knee */}
      <ellipse cx="92" cy="202" rx="11" ry="9" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* R Knee */}
      <ellipse cx="68" cy="202" rx="11" ry="9" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* L Calf */}
      <rect x="82" y="209" width="20" height="40" rx="6" fill={zoneStyle(calves).fill} stroke={zoneStyle(calves).stroke} strokeWidth={zoneStyle(calves).strokeWidth} />
      {/* R Calf */}
      <rect x="58" y="209" width="20" height="40" rx="6" fill={zoneStyle(calves).fill} stroke={zoneStyle(calves).stroke} strokeWidth={zoneStyle(calves).strokeWidth} />
      {/* L Foot */}
      <ellipse cx="92" cy="252" rx="10" ry="7" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
      {/* R Foot */}
      <ellipse cx="68" cy="252" rx="10" ry="7" fill={neutral.fill} stroke={neutral.stroke} strokeWidth={neutral.strokeWidth} />
    </svg>
  )
}

export default function AvatarMuscleMap({ muscleData, view: initialView = 'front' }: Props) {
  const [view, setView]     = useState<'front' | 'back'>(initialView)
  const [fading, setFading] = useState(false)
  const [isAuto, setIsAuto] = useState(true)
  const viewRef = useRef(view)

  useEffect(() => { viewRef.current = view }, [view])

  useEffect(() => {
    if (!isAuto) return
    const id = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setView(v => v === 'front' ? 'back' : 'front')
        setFading(false)
      }, 300)
    }, 6000)
    return () => clearInterval(id)
  }, [isAuto])

  const hasData = Object.values(muscleData).some(v => v > 0)

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 className="ui-card-title">Muscle Activity (7 Days)</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={`avatar-view-btn${view === 'front' ? ' active' : ''}`}
            onClick={() => { setIsAuto(false); setView('front') }}
          >
            Front
          </button>
          <button
            type="button"
            className={`avatar-view-btn${view === 'back' ? ' active' : ''}`}
            onClick={() => { setIsAuto(false); setView('back') }}
          >
            Back
          </button>
        </div>
      </div>

      {!hasData && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', padding: '12px 0' }}>
          No muscle activity recorded this week.
        </p>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          opacity: fading ? 0 : 1,
          transition: 'opacity 0.3s ease',
        }}
      >
        {view === 'front'
          ? <FrontSVG d={muscleData} />
          : <BackSVG  d={muscleData} />
        }
      </div>

      {/* Legend */}
      <div style={{ marginTop: 14, padding: '0 4px' }}>
        <div style={{
          height: 8,
          borderRadius: 999,
          background: 'linear-gradient(to right, rgba(213,255,95,0.08), rgba(213,255,95,0.7))',
          marginBottom: 4,
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Rest</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Peak</span>
        </div>
      </div>
    </div>
  )
}
